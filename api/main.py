from fastapi import (
    FastAPI,
    Body,
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
    HTTPException,
)
from typing import Optional, List, Dict

import neo4j

from neomd import querybuilder, converter, calculator, visualizations, utils
import os
import numpy as np

from celery.result import AsyncResult

from .constants import PROPERTY_TO_ANALYSIS
from .worker.celery_app import TASK_COMPLETE, celery_app, run_analysis_task
from celery.utils import uuid

# image rendering
from PIL import Image
import io
import base64

from .memcachedclient import MemcachedClient
from .graphdriver import GraphDriver
from .config import config
from .trajectory import Trajectory
from .utils import (
    getMetadata,
    getScipyDistributions,
    checkRequiredProperties,
    get_atom_type,
    saveTestJson,
    loadTestJson,
    saveTestPickle,
    loadTestPickle,
)
from .connectionmanager import ConnectionManager

import json
from .worker.celery_app import celery_app
from .models import AnalysisStep

os.environ["OVITO_THREAD_COUNT"] = "1"
os.environ["DISPLAY"] = ""

trajectories = {}

app = FastAPI()
router = APIRouter(prefix="/api")
cm = ConnectionManager()

unprocessed = {}


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
            result = AsyncResult(task_id, app=celery_app)
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
    celery_app.send_task(
        task_params["name"], kwargs=task_params["params"], task_id=task_id
    )
    try:
        await websocket.receive()
    except WebSocketDisconnect:
        await cm.disconnect(task_id)


# move to celery worker
@router.get("/generate_ovito_image")
async def generate_ovito_image(number: str):
    driver = GraphDriver()
    # relation agnostic
    qb = querybuilder.Neo4jQueryBuilder(
        schema=[
            ("State", "", "State", "ONE-TO-ONE"),
            ("Atom", "PART_OF", "State", "MANY-TO-ONE"),
        ]
    )

    q = qb.generate_get_node("State", ("number", number), "PART_OF")

    state_atom_dict = converter.query_to_ASE(driver, qb, q, "Pt", getRelationList=False)

    qimg = None

    for atoms in state_atom_dict.values():
        qimg = visualizations.render_ASE(atoms)

    img = Image.fromqimage(qimg)
    rawBytes = io.BytesIO()
    img.save(rawBytes, "PNG")
    rawBytes.seek(0)
    img_base64 = base64.b64encode(rawBytes.read())

    image_string = str(img_base64)
    image_string = image_string.removesuffix("'")
    image_string = image_string.removeprefix("b'")
    return {"image": image_string}


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
        while True:
            data = await websocket.receive_json()
            results = await load_properties_for_subset(data["props"], data["stateIds"])
            await websocket.send_json(results)
    except WebSocketDisconnect:
        print("Websocket disconnected")


from sklearn import preprocessing
from sklearn.cluster import OPTICS


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
async def load_properties_for_subset(
    props: List[str] = Body([]), stateIds: List[int] = Body([])
):
    qb = querybuilder.Neo4jQueryBuilder()
    driver = GraphDriver()

    q = qb.generate_get_node_list(
        "State", idAttributeList=stateIds, attributeList=props
    )

    j = {}
    with driver.session() as session:
        result = session.run(q.text)
        j = result.data()

    # check if property is missing in database
    # optimize with Neo4j
    missingProperties = {}
    for s in j:
        for key, value in s.items():
            if value == None:
                if key not in missingProperties:
                    missingProperties[key] = []
                missingProperties[key].append(s["id"])

    if len(missingProperties.keys()) > 0:
        runAnalyses = {}
        for key, values in missingProperties.items():
            analysis = PROPERTY_TO_ANALYSIS.get(key)
            # if the dict does not know what analysis to do, throw an error
            if not analysis:
                raise HTTPException(status_code=404, detail="Unknown property")

            if analysis not in runAnalyses:
                runAnalyses[analysis] = values
            else:
                runAnalyses[analysis] = runAnalyses[analysis] + values

        for analysisName, states in runAnalyses.items():
            await run_ovito_analysis(analysisName, states=states)

        # instead of trying to update the list, just get the list again with the updated values
        q = qb.generate_get_node_list(
            "State", idAttributeList=stateIds, attributeList=props
        )

        j = {}
        with driver.session() as session:
            result = session.run(q.text)
            j = result.data()

    return j


# needs to be smarter than this to avoid repetition
async def run_ovito_analysis(analysisName: str, states: List[int]):
    driver = GraphDriver()

    qb = querybuilder.Neo4jQueryBuilder(
        [
            ("Atom", "PART_OF", "State", "MANY-TO-ONE"),
        ]
    )
    q = qb.generate_get_node_list("State", states, "PART_OF")
    state_atom_dict = converter.query_to_ASE(driver, q, "Pt")

    results = []

    # 504 error?
    new_attributes = calculator.apply_ovito_pipeline_modifier(
        state_atom_dict, analysisName
    )

    q = None
    with driver.session() as session:
        tx = session.begin_transaction()
        for id, data in new_attributes.items():
            # q is a template query that gets filled in with each datapoint
            if q is None:
                q = qb.generate_update_entity(data, "State", "id", "node")
            data.update({"id": id})
            tx.run(q.text, data)
        tx.commit()
        results.append(new_attributes)

    return results


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


def load_sequence(run: str, properties: List[str]):
    get_potential(run)
    run_md = get_metadata(run)

    if config.IMPATIENT:
        r = loadTestPickle(run, "sequence")
        if r is not None:
            return Trajectory(run, r["sequence"], r["unique_states"])

    uniqueStateAttributes = []

    if len(properties) > 0:
        for prop in properties:
            uniqueStateAttributes.append(str(prop))

    driver = GraphDriver()
    qb = querybuilder.Neo4jQueryBuilder(
        [
            ("State", run, "State", "ONE-TO-ONE"),
            ("Atom", "PART_OF", "State", "MANY-TO-ONE"),
        ]
    )

    q = qb.generate_trajectory(
        run, "ASC", ("relation", "timestep"), node_attributes=[("id", "first")]
    )

    """
    uniqueStateQuery = qb.generate_get_all_nodes(
        "State", node_attributes=uniqueStateAttributes, relation=run
    )
    """

    # could use this to get the occurrence counts, build the matrix and lots of other stuff
    # uniqueRelationQuery = "MATCH (a:State)-[r:{run}]->(b:State) RETURN DISTINCT r ORDER BY r.timestep"
    # for now though, it would mostly just waste more memory than its worth - length is not meaningful
    # the only thing that could be worth skipping is whether or not states are symmetrical

    j = {}

    with driver.session() as session:
        result = session.run(q.text)
        j["sequence"] = result.value()
        j["unique_states"] = set(j["sequence"])

    new_traj = Trajectory(run, j["sequence"], j["unique_states"])

    """
    occurrenceString = "{run}_occurrences".format(run=run)
    with driver.session() as session:
        if occurrenceString not in run_md.keys():
            oq = qb.generate_get_occurrences(run, occurrenceString)
            session.run(oq.text)

        shave off time by calculating this in the database
        if "AtomCount" not in run_md.keys():
            oq2 = qb.generate_calculate_many_to_one_count("PART_OF",
                                                          saveMetadata=True,
                                                          run=run)
            session.run(oq2.text)

        result = session.run(q.text)
        j["sequence"] = result.value()

        res = session.run(uniqueStateQuery.text)
        j["unique_states"] = res.data()

   """
    saveTestPickle(run, "sequence", j)
    return new_traj


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


@router.get("/simplify_sequence")
def simplify_sequence_endpoint(run: str, chunkingThreshold: float):
    """
    Simplifies the sequence for the given trajectory.

    :param run str: Trajectory to simplify.
    :param chunkingThreshold float: Cluster membership threshold at which a state is considered important / unimportant.
    """
    mem_client = MemcachedClient()
    trajectory = mem_client.get(run)

    if trajectory:
        trajectory.simplify_sequence(chunkingThreshold)
    else:
        print("trajectory not found in cache")

    return trajectory.chunks


@router.get("/single_pcca")
def single_pcca(run: str, numClusters: int):
    """
    Runs PCCA with the specified number of clusters.

    TODO: error checking for invalid number of clusters
    TODO: load trajectory if not exists

    :param run str: The trajectory for which PCCA should be run.
    :param numClusters int: The number of clusters to cluster the trajectory into.
    """
    driver = GraphDriver()
    mem_client = MemcachedClient()
    trajectory = mem_client.get(run)

    if trajectory:
        if numClusters not in trajectory.clusterings.keys():
            trajectory.single_pcca(numClusters, driver)
        trajectory.current_clustering = numClusters
        trajectory.calculateIDToCluster()
        trajectory.simplify_sequence(trajectory.chunkingThreshold)
    else:
        print("trajectory not found")
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

    trajectory = load_sequence(run, ["id"])
    # PCCA
    trajectory.pcca(mMin, mMax, driver)
    sequence = trajectory.sequence

    trajectory.calculateIDToCluster()
    trajectory.simplify_sequence(chunkingThreshold)
    trajectory.calculate_id_to_timestep(driver)

    mem_client = MemcachedClient()
    mem_client.set(run, trajectory)

    # TODO: reduce state list to only important

    # only return current clustering?
    # feasible and sequence may not be necessary at all
    return {
        "uniqueStates": set(sequence),
        "idToTimestep": trajectory.id_to_timestep,
        "simplified": trajectory.chunks,
        "idToCluster": trajectory.idToCluster,
        "feasible_clusters": trajectory.feasible_clusters,
        "current_clustering": trajectory.current_clustering,
    }


app.include_router(router)
