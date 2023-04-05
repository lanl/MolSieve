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

# seperate worker file
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


# data
@router.get("/generate_ovito_image", status_code=200)
async def generate_ovito_image_endpoint(id: int, visScript: str):
    """
    Generates an image of the state ID specified using the specified visualization script.

    :param id int: The state ID to be rendered.
    :param visScript: The visualization script to use.

    :returns: Object containing state ID and a base64 encoded image string.
    """
    driver = GraphDriver()
    qb = querybuilder.Neo4jQueryBuilder([("Atom", "PART_OF", "State", "MANY-TO-ONE")])

    q = qb.generate_get_node_list("State", [id], "PART_OF")
    atom_dict = converter.query_to_ASE(driver, q)

    modifier = get_script_code(visScript, folder="vis_scripts")
    exec(modifier, globals())

    return {"id": id, "img": generate_ovito_image(atom_dict[id], modify_pipeline)}

# move to utils, decouple from atoms object
def generate_ovito_image(atoms, image_modifier) -> str:
    """
    Uses neomd to get a qImage object, and then converts it to a string that can be returned as part of a request.

    :param atoms ase.Atoms: Atoms object to render.
    :param image_modifier function: User-defined function to modify the resulting image.
    
    :returns str: base64 encoding of the resulting image
    """
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

# place in action route
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

# action
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


# need to update with neomd's get_metadata
# data
@router.get("/get_metadata")
def get_metadata(run: str):
    _, j = getMetadata(run, getJson=True)
    return j

# stays as action
@router.post("/cluster_states", status_code=200)
def cluster_states(props: List[str] = Body([]), stateIds: List[int] = Body([])):
    """
    Given a set of properties and a list of state IDs, grabs them from the database and then
    clusters them using the OPTICS algorithm.

    :param props: The properties to use while clustering.
    :param stateIds: The state IDs to use while clustering.

    :returns: A dictionary of state IDs to cluster numbers.
    """
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


# goes in data route
@router.websocket("/load_properties_for_subset")
async def ws_load_properties_for_subset(websocket: WebSocket):
    """
    Websocket method; expects a single list of states sent from the client and a number specifying how the list should be split.
    The server initially grabs the entire list of nodes from the server, and then splits the list according to the chunk size.
    It then checks each node within the list to see if it has the properties specified, if not, it runs the user script corresponding
    to the property and saves it to the database.

    :param websocket: Websocket object, automatically supplied by FastAPI.
    :returns: A list of states with the properties requested.
    """
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


# data route
async def load_properties_for_subset(stateList):
    """
    Given a list of states, checks the properties currently loaded in the system and 
    calculates the properties for each state if they are missing.

    :param stateList List[int]: A list of state IDs to run the calculations for.    
    :raises ValueError: Complain if specified property does not exist. 
    """
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
                raise ValueError("Unknown property")
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

# place in scripts route
async def run_script(script: str, state_atom_dict):
    """
    Runs the provided script's run() function on the state_atom_dict provided.

    :param script str: The script's name.
    :param state_atom_dict Dict[int, ase.Atoms]: A dictionary of IDs to atoms to run the script on.

    :returns: The result of the scripts being run on the dictionary.
    """
    code = get_script_code(script)
    exec(code, globals())
    new_attributes = run(state_atom_dict)
    task_id = uuid()
    celery.send_task(
        "save_to_db", kwargs={"new_attributes": new_attributes}, task_id=task_id
    )

    # move into seperate process?
    return new_attributes


# this is in neomd as well, need to pick one version
# under data route
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

# data route
def load_sequence(run: str) -> Trajectory:
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

    save_pickle(
        run,
        "sequence",
        {"sequence": trajectory.sequence, "unique_states": trajectory.unique_states},
    )
    return trajectory

# place in scripts route
@router.get("/script_properties")
def script_properties():
    """
    Gets the properties of each script within the scripts folder.

    :returns List[str]: A list of properties within the scripts.
    """
    properties_to_script = get_script_properties_map()
    return list(properties_to_script.keys())

# place in scripts route
@router.get("/vis_scripts")
def vis_scripts():
    """
    Gets the names of the visualization scripts placed in the vis_scripts folder.
    :returns List[str]: A list of visualization script names.
    """
    scripts = []
    with os.scandir("vis_scripts") as entries:
        for entry in entries:
            root, ext = os.path.splitext(entry)
            if ext == ".py":
                scripts.append(entry.name)
    return scripts

# place in scripts route
def get_script_properties_map():
    """
    Read all of the scripts within the scripts folder, then get the properties that they will return.
    :returns Dict[str, str]: A dictionary mapping each property to its script.
    """

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

# place in scripts route
def get_script_code(script_name, folder="scripts"):
    """
    Get the actual code for the script within the folder specified.

    :param script_name str: Name of script to retrieve.
    :param folder str: Name of folder to check.
    :raises FileNotFoundError: Complain if file does not exist.

    :returns str: A string containing the script's code.
    """
    with os.scandir(folder) as entries:
        for entry in entries:
            if entry.name == script_name:
                with open(entry.path, mode="r") as script:
                    return script.read()
        raise FileNotFoundError


# maybe better to just hit database rather than use cache and load entire run?
# data route
@router.get("/get_sequence")
def get_sequence(run: str, start: Optional[int], end: Optional[int] = None):
    """
    Retreives the sequence for the specified trajectory, optionally returning a range of the sequence.

    :param run: The name of the trajectory.
    :param start: The beginning of the range to retrieve.
    :param end: The end of the range.

    :returns List[int]: A list of state IDs within the specified range.
    """
    mem_client = PooledClient("localhost", max_pool_size=4, serde=serde.pickle_serde)
    trajectory = mem_client.get(run)

    if trajectory is None:
        trajectory = load_sequence(run)

    if start is None or end is None:
        return trajectory.sequence
    else:
        return trajectory.sequence[start : end + 1]

# data route
@router.get("/get_run_list")
def get_run_list():
    """
    Returns the trajectories available in the database.

    :returns List[str]: A list of trajectories available in the database.
    """
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

# actions like this go under actions route?
@router.get("/modify_trajectory")
def modify_trajectory(run: str, chunkingThreshold: float, numClusters: int):
    """
    Update the trajectory's exploratory parameters, i.e., the simplfication threshold and number of PCCA clusters.
    Not split into two seperate functions since you need to apply both when the number of clusters changes.

    :param run str: The trajectory to modify.
    :param chunkingThreshold: The simplification threshold.
    :param numClusters: The number of clusters to cluster the trajectory into.
    """
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

# maybe go to data route
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


# make this a websocket?
# actions
@router.post("/selection_distance")
def selection_distance(
    stateSet1: List[int] = Body([]), stateSet2: List[int] = Body([])
):
    """
    Given two lists of state IDs, get their atomic configurations and compare using ase's 
    Frobeian norm.

    :param stateSet1: First set of states. 
    :param stateSet2: Second set of states.

    :returns Dict[int, Dict[int, float]]: A dictionary of dictionaries (like matrix) that describes
    the distance from one state to all other states.
    """
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
