import base64
import io
import json
import logging
import os
import time
from typing import List, Optional

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

from neomd import calculator, converter, querybuilder, utils, visualizations

from .connectionmanager import ConnectionManager
from .graphdriver import GraphDriver
from .models import AnalysisStep
from .trajectory import Trajectory
from .utils import (
    checkRequiredProperties,
    getMetadata,
    getScipyDistributions,
    loadTestPickle,
    saveTestPickle,
)
from .background_worker.celery import TASK_COMPLETE, celery

from itertools import chain
import ase.geometry

os.environ["OVITO_THREAD_COUNT"] = "1"
os.environ["DISPLAY"] = ""

trajectories = {}

app = FastAPI()

origins = ['*']

app.add_middleware(CORSMiddleware,
        allow_origins=origins,
        allow_methods=["*"],
        allow_headers=["*"],
)

router = APIRouter(prefix="/api")
cm = ConnectionManager()
unprocessed = {}

logging.basicConfig(filename="neomd.log", level=logging.INFO)


@router.get("/get_scipy_distributions")
def get_scipy_distributions():
    return getScipyDistributions()


@router.get("/get_ovito_modifiers")
def get_ovito_modifiers():
    return utils.return_ovito_modifiers()


# move to celery worker
@router.get("/run_cypher_query")
def run_cypher_query(query: str):
    driver = GraphDriver()
    j = []
    with driver.session() as session:
        results = session.run(query)
        for r in results.value():
            j.append(r)

    return j


@router.post("/update_task/{task_id}")
async def update_task(task_id: str, data: dict):
    if task_id in cm.active_connections:
        if data["type"] == TASK_COMPLETE:
            result = AsyncResult(task_id, app=celery)
            if result.ready():
                data = result.get()
                await cm.send(
                    task_id, {"type": TASK_COMPLETE, "data": json.loads(data)}
                )
        else:
            await cm.send(task_id, data)


@router.websocket("/ws/{task_id}")
async def ws(task_id: str, websocket: WebSocket):
    await cm.connect(task_id, websocket)
    # get the task's parameters, send it off
    task_params = unprocessed[task_id]
    celery.send_task(
        task_params["name"], kwargs=task_params["params"], task_id=task_id
    )
    try:
        await websocket.receive()
    except WebSocketDisconnect:
        await cm.disconnect(task_id)


@router.websocket("/generate_ovito_images")
async def generate_ovito_images(websocket: WebSocket):
    await websocket.accept()
    try:
        ids = await websocket.receive_json()
        driver = GraphDriver()
        qb = querybuilder.Neo4jQueryBuilder(
            [
                ("Atom", "PART_OF", "State", "MANY-TO-ONE"),
            ]
        )

        q = qb.generate_get_node_list("State", ids, "PART_OF")
        attr_atom_dict = converter.query_to_ASE(driver, q, "Pt")

        for id, atoms in attr_atom_dict.items():
            img = generate_ovito_image(atoms)
            await websocket.send_json({"id": id, "img": img})
    except WebSocketDisconnect:
        print("Websocket disconnected")


@router.get("/generate_ovito_image", status_code=200)
async def generate_ovito_image_endpoint(id: int):
    driver = GraphDriver()
    qb = querybuilder.Neo4jQueryBuilder([("Atom", "PART_OF", "State", "MANY-TO-ONE")])

    q = qb.generate_get_node_list("State", [id], "PART_OF")
    atom_dict = converter.query_to_ASE(driver, q, "Pt")

    return {"id": id, "img": generate_ovito_image(atom_dict[id])}


def generate_ovito_image(atoms):
    qimg = visualizations.render_ASE(atoms)

    img = Image.fromqimage(qimg)
    rawBytes = io.BytesIO()
    img.save(rawBytes, "PNG")
    rawBytes.seek(0)
    img_base64 = base64.b64encode(rawBytes.read())

    image_string = str(img_base64)
    image_string = image_string.removesuffix("'")
    image_string = image_string.removeprefix("b'")
    return image_string


@router.post("/generate_ovito_animation")
async def generate_ovito_animation(
    width: int = Body(200), height: int = Body(200), states: List[int] = Body(...)
):
    driver = GraphDriver()

    qb = querybuilder.Neo4jQueryBuilder([("Atom", "PART_OF", "State", "MANY-TO-ONE")])

    q = qb.generate_get_node_list("State", states, "PART_OF")
    attr_atom_dict = converter.query_to_ASE(driver, q, "Pt")

    output_path = "vid.webm"
    # https://stackoverflow.com/questions/55873174/how-do-i-return-an-image-in-fastapi/67497103#67497103
    visualizations.render_ASE_list_to_file(
        attr_atom_dict.values(),
        output_path,
        image_height=height,
        image_width=width,
    )

    # TODO: make into a stream
    # TODO: avoid writing video file
    video_string = ""
    with open(output_path, "rb") as video:
        video_string = base64.b64encode(video.read())
    os.remove(output_path)
    return {"video": video_string}


@router.post("/run_analysis", status_code=201)
async def run_analysis(
    steps: List[AnalysisStep],
    run: Optional[str] = Body(None),
    states: Optional[List[int]] = Body([]),
    displayResults: bool = Body(True),
    saveResults: bool = Body(True),
):
    task_id = uuid()
    unprocessed.update(
        {
            task_id: {
                "name": "run_analysis",
                "params": {
                    "steps": steps,
                    "run": run,
                    "states": states,
                    "displayResults": displayResults,
                    "saveResults": saveResults,
                },
            }
        }
    )
    return task_id


@router.post("/perform_KS_Test", status_code=201)
def perform_KSTest(data: dict):
    task_id = uuid()  # = celery_app.send_task('perform_KS_Test', args=[data])
    unprocessed.update({task_id: {"name": "perform_KS_Test", "params": {"data": data}}})
    return task_id


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
    print(task_id)
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


@router.post("/calculate_path_similarity")
def calculate_path_similarity(
    p1: List[int],
    p2: List[int],
    state_attributes: List[str] = [],
    atom_attributes: List[str] = [],
):

    task_id = uuid()
    unprocessed.update(
        {
            task_id: {
                "name": "calculate_path_similarity",
                "params": {
                    "p1": p1,
                    "p2": p2,
                    "state_attributes": state_attributes,
                    "atom_attributes": atom_attributes,
                },
            }
        }
    )

    return task_id


@router.post("/load_property_for_subset", status_code=200)
def load_property_for_subset(prop: str, stateIds: List[int]):
    return load_properties_for_subset([prop], stateIds)


@router.websocket("/load_properties_for_subset")
async def ws_load_properties_for_subset(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        qb = querybuilder.Neo4jQueryBuilder()
        driver = GraphDriver()

        # also potential bottleneck
        q = qb.generate_get_node_list(
            "State", idAttributeList=data["stateIds"], attributeList=data["props"]
        )

        stateList = []
        with driver.session() as session:
            result = session.run(q.text)
            stateList = result.data()

        def split(arr, chunk_size):
            for i in range(0, len(arr), chunk_size):
                yield arr[i:i + chunk_size]

        chunks = list(split(stateList, 100))

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


@router.post("/load_properties_for_subset", status_code=200)
async def load_properties_for_subset_endpoint(props: List[str] = Body([]), stateIds: List[int] = Body([])):
    qb = querybuilder.Neo4jQueryBuilder()
    driver = GraphDriver()

    q = qb.generate_get_node_list(
        "State", idAttributeList=stateIds, attributeList=props
    )

    stateList = []
    with driver.session() as session:
        result = session.run(q.text)
        stateList = result.data()

    return await load_properties_for_subset(stateList)


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
            ])
            q = qb.generate_get_node_list("State", allMissing, "PART_OF")
            state_atom_dict = converter.query_to_ASE(driver, q, "Pt")

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
    driver = GraphDriver()
    qb = querybuilder.Neo4jQueryBuilder([
            ("Atom", "PART_OF", "State", "MANY-TO-ONE"),
    ])

    code = get_script_code(script)
    exec(code, globals())
    new_attributes = run(state_atom_dict)
    task_id = uuid()
    celery.send_task("save_to_db", kwargs={"new_attributes": new_attributes}, task_id=task_id)

    # move into seperate process?
    return new_attributes


# move to celery worker
@router.get("/load_property", status_code=200)
def load_property(prop: str):
    """
    Loads the given property for all applicable nodes
    :param prop: The property to load.

    :returns: a dict of {id: property}
    """
    uniqueStateAttributes = ["id", prop]
    driver = GraphDriver()

    qb = querybuilder.Neo4jQueryBuilder()

    query = qb.generate_get_all_nodes(
        "State", node_attributes=uniqueStateAttributes, ignoreNull=True
    )

    j = {}
    with driver.session() as session:
        result = session.run(query.text)
        j["propertyList"] = result.data()

    return j


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

def calculate_trajectory_occurrences(run: str):
    driver = GraphDriver() 
    
    qb = querybuilder.Neo4jQueryBuilder([
            ("State", run, "State", "ONE-TO-ONE")
    ])
    
    q = qb.generate_get_occurrences(run, f"{run}_occurrences")  

    with driver.session() as session:
        session.run(q.text)

def load_sequence(run: str, properties: List[str], driver):
    """
    Creates a Trajectory object for later use.

    :param run str: The name of the run to load.
    :param properties List[str]: Which properties to load, if any.
    :param driver: Neo4j driver to use.
    """
    get_potential(run)
    run_md = get_metadata(run)

    if f"{run}_occurrences" not in run_md:
        calculate_trajectory_occurrences(run)
        
    r = loadTestPickle(run, "sequence")
    if r is not None:
        return Trajectory(run, r["sequence"], r["unique_states"])

    uniqueStateAttributes = []

    if len(properties) > 0:
        for prop in properties:
            uniqueStateAttributes.append(str(prop))

    """qb = querybuilder.Neo4jQueryBuilder(
        [
            ("State", run, "State", "ONE-TO-ONE"),
            ("Atom", "PART_OF", "State", "MANY-TO-ONE"),
        ]
    )"""

    q = """
    MATCH (n:State:{run})-[r:{run}]->(:State:{run})
    RETURN n.id as id
    ORDER BY r.timestep ASC;
    """.format(
        run=run
    )

    j = {}
    with driver.session() as session:
        result = session.run(q)
        j["sequence"] = result.value()
        j["unique_states"] = set(j["sequence"])

    new_traj = Trajectory(run, j["sequence"], j["unique_states"])

    # needs to be more descriptive, with properties saved as well!
    saveTestPickle(run, "sequence", j)
    return new_traj


@router.get("/script_properties")
def script_properties():
    properties_to_script = get_script_properties_map()
    return list(properties_to_script.keys())


def get_script_properties_map():
    # read scripts folder, enumerate every file and return as array
    properties_to_script = {}
    with os.scandir("scripts") as entries:
        for entry in entries:
            with open(entry.path, mode="r") as script:
                code = script.read()
            # puts properties in global namespace
            exec(code, globals())
            for prop in properties():
                properties_to_script[prop] = entry.name

    return properties_to_script


def get_script_code(script_name):
    with os.scandir("scripts") as entries:
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

    driver = GraphDriver()
    if trajectory is None:
        trajectory = load_sequence(run, ["id"], driver)

    if start is None or end is None:
        return trajectory.sequence
    else:
        return trajectory.sequence[start: end + 1]


@router.get("/get_property_list")
def get_property_list():
    driver = GraphDriver()

    j = []
    with driver.session() as session:
        try:
            result = session.run(
                "MATCH (n:State) WITH n LIMIT 100 UNWIND keys(n) as key RETURN DISTINCT key;"
            )
            j = [r[0] for r in result.values()]
            # add metadata properties

            result = session.run(
                f"""MATCH (m:Metadata)
                UNWIND keys(m) AS prop
                WITH m, prop WHERE m[prop] = true
                RETURN DISTINCT prop;"""
            )
            for r in result:
                if r[0] not in j:
                    j.append(r[0])

        except neo4j.exceptions.ServiceUnavailable as exception:
            raise exception

    return j


@router.get("/get_atom_properties")
def get_atom_properties():
    driver = GraphDriver()

    j = []
    with driver.session() as session:
        try:
            result = session.run(
                "MATCH (n:Atom) WITH n LIMIT 1000 UNWIND keys(n) as key RETURN DISTINCT key;"
            )
            j = [r[0] for r in result.values()]
        except neo4j.exceptions.ServiceUnavailable as exception:
            raise exception

    return j


@router.get("/get_run_list")
def get_run_list():
    driver = GraphDriver()

    j = []
    with driver.session() as session:
        try:
            result = session.run("MATCH (m:Metadata) RETURN m.run;")
            runs = []
            for r in result.values():
                for record in r:
                    runs.append(record)
            j = runs
        except neo4j.exceptions.ServiceUnavailable as exception:
            raise exception

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
        trajectory = load_sequence(run, ["id"], driver)

    if numClusters not in trajectory.clusterings.keys():
        trajectory.single_pcca(numClusters, driver)

    trajectory.current_clustering = numClusters
    trajectory.calculateIDToCluster()
    trajectory.simplify_sequence(chunkingThreshold)

    mem_client.set(run, trajectory)

    return {
        "simplified": trajectory.chunks,
        "idToCluster": trajectory.idToCluster,
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

    logging.info(f"Loading sequence {run}")
    t0 = time.time()
    trajectory = load_sequence(run, ["id"], driver)
    t1 = time.time()
    logging.info(f"Loading sequence took {t1-t0} seconds total.")

    logging.info("Calculating PCCA")
    t0 = time.time()
    try:
        trajectory.pcca(mMin, mMax, driver)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
    t1 = time.time()
    logging.info(f"PCCA took {t1-t0} seconds total.")

    trajectory.calculateIDToCluster()

    logging.info("Simplifying sequence")
    t0 = time.time()
    trajectory.simplify_sequence(chunkingThreshold)
    t1 = time.time()
    logging.info(f"Simplification took {t1-t0} seconds total.")

    trajectory.calculate_id_to_timestep(driver)

    mem_client = PooledClient("localhost", max_pool_size=1, serde=serde.pickle_serde)
    mem_client.set(run, trajectory)

    # TODO: reduce state list to only important

    # only return current clustering?
    # feasible may not be necessary at all
    return {
        "uniqueStates": set(trajectory.sequence),
        "idToTimestep": trajectory.id_to_timestep,
        "simplified": trajectory.chunks,
        "idToCluster": trajectory.idToCluster,
        "feasible_clusters": trajectory.feasible_clusters,
        "current_clustering": trajectory.current_clustering,
    }


@router.post("/subset_connectivity_difference")
def subset_connectivity_difference(stateIDs: List[int] = Body([])):
    driver = GraphDriver()
    qb = querybuilder.Neo4jQueryBuilder([("Atom", "PART_OF", "State", "MANY-TO-ONE")])
    q = qb.generate_get_node_list("State", stateIDs, "PART_OF")
    state_atom_dict = converter.query_to_ASE(driver, q, "Pt")

    connectivity_list = []  # all connectivity matrices in order
    for stateID in stateIDs:
        atoms = state_atom_dict[stateID]
        connectivity_list.append((stateID, atoms))

    maximum_difference = []
    iter = 0
    while iter < 3:
        result = calculator.max_connectivity_difference(connectivity_list[0][1], connectivity_list[1:])
        if result['id'] is not None:
            maximum_difference.append(result['id'])
            connectivity_list = connectivity_list[result['index']:]
        else:
            break
        iter += 1

    return maximum_difference


@router.post("/selection_distance")
def selection_distance(stateIDPairs: List[List[int]] = Body([])):
    driver = GraphDriver()
    
    # flattens 2D array
    stateIDs = list(chain.from_iterable(stateIDPairs))
    qb = querybuilder.Neo4jQueryBuilder([("Atom", "PART_OF", "State", "MANY-TO-ONE")])
    q = qb.generate_get_node_list("State", stateIDs, "PART_OF")
    state_atom_dict = converter.query_to_ASE(driver, q, "Pt")

    seen = {}
    distances = []
    for pair in stateIDPairs:
        if pair in seen:
            distances.append(seen[pair])
        else:
            id1, id2 = pair
            s1 = state_atom_dict[id1]
            s2 = state_atom_dict[id2]
            dist = ase.geometry.distance(s1, s2)  
            distances.append(dist)
            seen[pair] = dist

    return distances


app.include_router(router)
