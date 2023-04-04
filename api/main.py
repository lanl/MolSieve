import base64
import io
import logging
import os
from typing import List, Optional

import ase.geometry
import neo4j
from celery.result import AsyncResult
from celery.utils import uuid
from fastapi import (
    APIRouter,
    Body,
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware

# image rendering
from PIL import Image
from pymemcache import serde
from pymemcache.client.base import PooledClient
from sklearn import preprocessing
from sklearn.cluster import OPTICS

from neomd import converter, querybuilder, visualizations

from .background_worker.celery import TASK_COMPLETE, celery
from .connectionmanager import ConnectionManager
from .graphdriver import GraphDriver
from .trajectory import Trajectory
from .utils import getMetadata, load_pickle, save_pickle

os.environ["OVITO_THREAD_COUNT"] = "1"
os.environ["DISPLAY"] = ""

trajectories = {}

app = FastAPI()

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix="/api")
cm = ConnectionManager()
unprocessed = {}

logging.basicConfig(filename="molsieve.log", level=logging.INFO)


# put in seperate worker file
@router.post("/update_task/{task_id}")
async def update_task(task_id: str, data: dict):
    if task_id in cm.active_connections:
        if data["type"] == TASK_COMPLETE:
            result = AsyncResult(task_id, app=celery)
            if result.ready():
                data = result.get()
                await cm.send(task_id, {"type": TASK_COMPLETE})
                await cm.disconnect(task_id)
        else:
            await cm.send(task_id, data)


@router.websocket("/ws/{task_id}")
async def ws(task_id: str, websocket: WebSocket):
    await cm.connect(task_id, websocket)
    # get the task's parameters, send it off
    task_params = unprocessed[task_id]
    celery.send_task(task_params["name"], kwargs=task_params["params"], task_id=task_id)
    try:
        await websocket.receive()
    except WebSocketDisconnect:
        await cm.disconnect(task_id)


@router.get("/generate_ovito_image", status_code=200)
async def generate_ovito_image_endpoint(id: int, visScript: str):
    driver = GraphDriver()
    qb = querybuilder.Neo4jQueryBuilder([("Atom", "PART_OF", "State", "MANY-TO-ONE")])

    q = qb.generate_get_node_list("State", [id], "PART_OF")
    atom_dict = converter.query_to_ASE(driver, q)

    modifier = get_script_code(visScript, folder="vis_scripts")
    exec(modifier, globals())

    return {"id": id, "img": generate_ovito_image(atom_dict[id], modify_pipeline)}


def generate_ovito_image(atoms, image_modifier):
    qimg = visualizations.render_ASE(atoms, pipeline_modifier=image_modifier)

    img = Image.fromqimage(qimg)
    rawBytes = io.BytesIO()
    img.save(rawBytes, "PNG")
    rawBytes.seek(0)
    img_base64 = base64.b64encode(rawBytes.read())

    image_string = str(img_base64)
    image_string = image_string.removesuffix("'")
    image_string = image_string.removeprefix("b'")
    return image_string


@router.get("/calculate_neb_on_path", status_code=201)
async def calculate_neb_on_path(
    run: str,
    start: str,
    end: str,
    interpolate: int = 3,
    maxSteps: int = 2500,
    fmax: float = 0.01,
    saveResults: bool = True,
):

    task_id = uuid()
    unprocessed.update(
        {
            task_id: {
                "name": "calculate_neb_on_path",
                "params": {
                    "run": run,
                    "start": start,
                    "end": end,
                    "interpolate": interpolate,
                    "maxSteps": maxSteps,
                    "fmax": fmax,
                    "saveResults": saveResults,
                },
            }
        }
    )
    return task_id


@router.websocket("/load_properties_for_subset")
async def ws_load_properties_for_subset(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        qb = querybuilder.Neo4jQueryBuilder()
        driver = GraphDriver()

        q = qb.generate_get_node_list(
            "State", idAttributeList=data["stateIds"], attributeList=data["props"]
        )

        stateList = []
        with driver.session() as session:
            result = session.run(q.text)
            stateList = result.data()

        def split(arr, chunk_size):
            for i in range(0, len(arr), chunk_size):
                yield arr[i : i + chunk_size]

        chunks = list(split(stateList, data["chunkSize"]))

        for chunk in chunks:
            await websocket.send_json(await load_properties_for_subset(chunk))
        await websocket.close()
    except WebSocketDisconnect:
        print("Websocket disconnected")


@router.post("/cluster_states", status_code=200)
def cluster_states(props: List[str] = Body([]), stateIds: List[int] = Body([])):
    qb = querybuilder.Neo4jQueryBuilder()
    driver = GraphDriver()

    q = qb.generate_get_node_list(
        "State", idAttributeList=stateIds, attributeList=props
    )

    j = {}
    with driver.session() as session:
        result = session.run(q.text)
        j = result.data()

    ids = []
    states = []
    for state in j:
        attrs = []
        for key in state:
            if key == "id":
                ids.append(state[key])
            else:
                attrs.append(state[key])
        states.append(attrs)

    states = preprocessing.MinMaxScaler().fit_transform(states)

    clustering = OPTICS(min_samples=5).fit(states)
    labels = clustering.labels_.tolist()

    return dict(zip(ids, labels))

async def load_properties_for_subset(stateList):
    driver = GraphDriver()

    # TODO: put in seperate function
    missingProperties = {}
    for state in stateList:
        for key, value in state.items():
            if value is None:
                if key not in missingProperties:
                    missingProperties[key] = []
                missingProperties[key].append(state["id"])

    # build map of properties to script name
    property_to_script = get_script_properties_map()
    allMissing = []
    if len(missingProperties.keys()) > 0:
        runScripts = {}
        for key, values in missingProperties.items():
            script = property_to_script.get(key)
            if not script:
                # check for script with same name - this can be any number of properties
                # each script should return a dictionary of id : attribute(s)
                # then we put it in the database
                # each script should have a function that returns the attributes it produces, so that we can search in the database beforehand
                raise HTTPException(status_code=404, detail="Unknown property")

            if script not in runScripts:
                runScripts[script] = values
            else:
                runScripts[script] = runScripts[script] + values
            allMissing = allMissing + values

        if len(allMissing) > 0:
            qb = querybuilder.Neo4jQueryBuilder(
                [
                    ("Atom", "PART_OF", "State", "MANY-TO-ONE"),
                ]
            )
            q = qb.generate_get_node_list("State", allMissing, "PART_OF")
            state_atom_dict = converter.query_to_ASE(driver, q)

            # convert stateList to dict for easy modification
            stateDict = {}
            for state in stateList:
                stateDict[state["id"]] = state

            for analysisName, states in runScripts.items():
                script_dict = {id: state_atom_dict[id] for id in states}
                results = await run_script(analysisName, script_dict)
                for id, data in results.items():
                    stateData = stateDict[id]
                    for key, value in data.items():
                        stateData[key] = value
                    stateDict[id] = stateData

            return list(stateDict.values())
    else:
        return stateList


# needs to be smarter than this to avoid repetition
async def run_script(script: str, state_atom_dict):
    code = get_script_code(script)
    exec(code, globals())
    new_attributes = run(state_atom_dict)
    task_id = uuid()
    celery.send_task(
        "save_to_db", kwargs={"new_attributes": new_attributes}, task_id=task_id
    )

    # move into seperate process?
    return new_attributes


def get_potential(run: str) -> str:
    """
    Gets a potential file associated with the run, and writes it to the current working directory.
    Used in various LAMMPS calculations.

    :param run: the run to query for the potential file
    :return: the filename of the potential file
    """
    driver = GraphDriver()
    q = f"MATCH (m:Metadata) WHERE m.run = '{run}' RETURN m.potentialFileName AS filename, m.potentialFileRaw AS data;"

    with driver.session() as session:
        result = session.run(q)
        r = result.single()
        filename = r["filename"]
        with open(filename, "w") as f:
            f.write(r["data"])

        return filename


def load_sequence(run: str):
    """
    Loads the sequence for the trajectory and creates a Trajectory object to use.
    Uses a cached version if available.
    :param run str: The name of the trajectory to load.

    :returns: A Trajectory object with the sequence and unique states loaded.
    """

    r = load_pickle(run, "sequence")
    if r is not None:
        return Trajectory(run, r["sequence"], r["unique_states"])

    driver = GraphDriver()
    trajectory = Trajectory.load_sequence(driver, run)

    save_pickle(run, "sequence", {
        'sequence': trajectory.sequence,
        'unique_states': trajectory.unique_states
    })
    return trajectory


@router.get("/script_properties")
def script_properties():
    properties_to_script = get_script_properties_map()
    return list(properties_to_script.keys())


@router.get("/vis_scripts")
def vis_scripts():
    scripts = []
    with os.scandir("vis_scripts") as entries:
        for entry in entries:
            root, ext = os.path.splitext(entry)
            if ext == ".py":
                scripts.append(entry.name)
    return scripts


def get_script_properties_map():
    # read scripts folder, enumerate every file and return as array
    properties_to_script = {}
    with os.scandir("scripts") as entries:
        for entry in entries:
            root, ext = os.path.splitext(entry)
            if ext == ".py":
                with open(entry.path, mode="r") as script:
                    code = script.read()
                # puts properties in global namespace
                exec(code, globals())
                for prop in properties():
                    properties_to_script[prop] = entry.name

    return properties_to_script


def get_script_code(script_name, folder="scripts"):
    with os.scandir(folder) as entries:
        for entry in entries:
            if entry.name == script_name:
                with open(entry.path, mode="r") as script:
                    return script.read()
        raise FileNotFoundError


# could be sequence/{run}
@router.get("/get_sequence")
def get_sequence(run: str, start: Optional[int], end: Optional[int] = None):
    mem_client = PooledClient("localhost", max_pool_size=4, serde=serde.pickle_serde)
    trajectory = mem_client.get(run)

    if trajectory is None:
        trajectory = load_sequence(run)

    if start is None or end is None:
        return trajectory.sequence
    else:
        return trajectory.sequence[start : end + 1]


@router.get("/get_run_list")
def get_run_list():
    driver = GraphDriver()

    j = []
    with driver.session() as session:
        result = session.run("MATCH (m:Metadata) RETURN DISTINCT m.run;")
        runs = []
        for r in result.values():
            for record in r:
                runs.append(record)
        j = runs

    return j


@router.get("/get_metadata")
def get_metadata(run: str):
    _, j = getMetadata(run, getJson=True)
    return j


@router.get("/modify_trajectory")
def modify_trajectory(run: str, chunkingThreshold: float, numClusters: int):
    mem_client = PooledClient("localhost", max_pool_size=4, serde=serde.pickle_serde)
    trajectory = mem_client.get(run)

    driver = GraphDriver()
    if trajectory is None:
        trajectory = load_sequence(run)

    if numClusters not in trajectory.clusterings.keys():
        trajectory.single_pcca(driver, numClusters)

    trajectory.current_clustering = numClusters
    trajectory.calculateIDToCluster()
    trajectory.simplify_sequence(chunkingThreshold)

    mem_client.set(run, trajectory)

    return {
        "uniqueStates": trajectory.simplified_unique_states,
        "simplified": trajectory.chunks,
        "current_clustering": trajectory.current_clustering,
    }


@router.get("/load_trajectory")
def load_trajectory(run: str, mMin: int, mMax: int, chunkingThreshold: float):
    """
    Main function for the backend. Loads the trajectory's sequence, runs PCCA on it, simplifies it, and returns a list of important / unimportant regions + states.

    :param run str: The name of the trajectory to load
    :param mMin int: When running PCCA, the minimum cluster size to try.
    :param mMax int: When running PCCA, the maximum cluster size to try.
    :param chunkingThreshold float: Cluster membership threshold at which states are considered important.
    """

    driver = GraphDriver()
    get_potential(run)
    trajectory = load_sequence(run)

    try:
        trajectory.pcca(mMin, mMax, driver)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")

    trajectory.calculateIDToCluster()

    trajectory.simplify_sequence(chunkingThreshold)

    mem_client = PooledClient("localhost", max_pool_size=1, serde=serde.pickle_serde)
    mem_client.set(run, trajectory)

    return {
        "uniqueStates": trajectory.simplified_unique_states,
        "simplified": trajectory.chunks,
        "current_clustering": trajectory.current_clustering,
    }


@router.post("/subset_connectivity_difference")
def subset_connectivity_difference(stateIDs: List[int] = Body([])):
    task_id = uuid()
    unprocessed.update(
        {
            task_id: {
                "name": "subset_connectivity_difference",
                "params": {
                    "stateIDs": stateIDs,
                },
            }
        }
    )

    return task_id


@router.post("/selection_distance")
def selection_distance(
    stateSet1: List[int] = Body([]), stateSet2: List[int] = Body([])
):
    driver = GraphDriver()

    # get all states without duplicates
    stateIDs = list(set(stateSet1 + stateSet2))
    qb = querybuilder.Neo4jQueryBuilder([("Atom", "PART_OF", "State", "MANY-TO-ONE")])
    q = qb.generate_get_node_list("State", stateIDs, "PART_OF")
    state_atom_dict = converter.query_to_ASE(driver, q)

    m = {id: {id2: 0 for id2 in stateSet2} for id in stateSet1}
    for id1 in stateSet1:
        s1 = state_atom_dict[id1]
        for id2 in stateSet2:
            s2 = state_atom_dict[id2]
            dist = ase.geometry.distance(s1, s2)
            m[id1][id2] = dist
    return m


app.include_router(router)
