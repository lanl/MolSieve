from fastapi import FastAPI, Body, APIRouter, WebSocket, WebSocketDisconnect
from typing import Optional, List

import neo4j
from neomd import querybuilder, converter, calculator, visualizations, utils
import os
import pygpcca as gp
import numpy as np

from celery.result import AsyncResult
from .worker.celery_app import TASK_COMPLETE, celery_app
from celery.utils import uuid

# image rendering
from PIL import Image
import io
import base64

from .config import config
from .trajectory import Trajectory
from .utils import (
    getMetadata,
    getScipyDistributions,
    get_atom_type,
    saveTestJson,
    loadTestJson,
)
from .connectionmanager import ConnectionManager

from scipy import sparse
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
    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
    )
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
    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
    )

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
async def generate_ovito_animation(title: str, states: List[int] = Body(...)):
    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
    )

    qb = querybuilder.Neo4jQueryBuilder([("Atom", "PART_OF", "State", "MANY-TO-ONE")])

    q = qb.generate_get_node_list("State", states, "PART_OF")

    attr_atom_dict = converter.query_to_ASE(driver, qb, q, "Pt")

    output_path = visualizations.render_ASE_list(
        attr_atom_dict.values(), list(attr_atom_dict.keys())
    )

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


# move to celery worker
@router.get("/load_property", status_code=201)
def load_property(prop: str):
    """
    Loads the given property for all applicable nodes
    :param prop: The property to load.

    :returns: a dict of {id: property}
    """
    uniqueStateAttributes = ["id", prop]
    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
    )

    qb = querybuilder.Neo4jQueryBuilder()

    query = qb.generate_get_all_nodes(
        "State", node_attributes=uniqueStateAttributes, ignoreNull=True
    )

    j = {}
    with driver.session() as session:
        result = session.run(query.text)
        j["propertyList"] = result.data()

    return j


# move to celery worker
@router.get("/load_sequence")
def load_sequence(run: str, properties: str):

    if config.IMPATIENT:
        r = loadTestJson(run, "sequence")
        if r != None:
            return r

    # id is technically not a property, so we have to include it here
    # everything else is dynamically loaded in
    node_attributes = [("id", "first")]
    uniqueStateAttributes = ["id"]
    if properties != "":
        properties = properties.split(",")
        for prop in properties:
            node_attributes.append((prop, "first"))
            uniqueStateAttributes.append(str(prop))

    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
    )
    qb = querybuilder.Neo4jQueryBuilder(
        [
            ("State", run, "State", "ONE-TO-ONE"),
            ("Atom", "PART_OF", "State", "MANY-TO-ONE"),
        ]
    )

    q = qb.generate_trajectory(
        run, "ASC", ("relation", "timestep"), node_attributes=[("id", "first")]
    )

    uniqueStateQuery = qb.generate_get_all_nodes(
        "State", node_attributes=uniqueStateAttributes, relation=run
    )

    # could use this to get the occurrence counts, build the matrix and lots of other stuff
    # uniqueRelationQuery = "MATCH (a:State)-[r:{run}]->(b:State) RETURN DISTINCT r ORDER BY r.timestep"
    # for now though, it would mostly just waste more memory than its worth - length is not meaningful
    # the only thing that could be worth skipping is whether or not states are symmetrical

    run_md = get_metadata(run)

    j = {}

    occurrenceString = "{run}_occurrences".format(run=run)

    with driver.session() as session:

        #        if occurrenceString not in run_md.keys():
        oq = qb.generate_get_occurrences(run, occurrenceString)
        session.run(oq.text)

        """
        shave off time by calculating this in the database
        if "AtomCount" not in run_md.keys():
            oq2 = qb.generate_calculate_many_to_one_count("PART_OF",
                                                          saveMetadata=True,
                                                          run=run)
            session.run(oq2.text)
        """

        result = session.run(q.text)
        j["sequence"] = result.value()

        res = session.run(uniqueStateQuery.text)
        j["uniqueStates"] = res.data()

        saveTestJson(run, "sequence", j)

    new_traj = Trajectory()
    new_traj.sequence = j["sequence"]
    new_traj.uniqueStates = j["uniqueStates"]

    trajectories[run] = new_traj

    return j


@router.get("/get_property_list")
def get_property_list():
    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
    )

    # sample 1000 nodes from the database and return a list of properties
    j = []
    with driver.session() as session:
        try:
            result = session.run(
                "MATCH (n:State) with n LIMIT 1000 UNWIND keys(n) as key RETURN DISTINCT key;"
            )
            j = [r[0] for r in result.values()]

        except neo4j.exceptions.ServiceUnavailable as exception:
            raise exception

    return j


@router.get("/get_atom_properties")
def get_atom_properties():
    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
    )
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
def get_run_list(truncateNEB: Optional[bool] = True):
    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
    )
    j = []
    with driver.session() as session:
        try:
            result = session.run(
                "MATCH (n:State) RETURN DISTINCT labels(n) LIMIT 1000;"
            )
            runs = []
            for r in result.values():
                for record in r:
                    for label in record:
                        if label != "NEB" and label != "State":
                            runs.append(label)
                            trajectories.update({label: Trajectory()})

            j = runs
        except neo4j.exceptions.ServiceUnavailable as exception:
            raise exception

    return j


@router.get("/get_metadata")
def get_metadata(run: str):
    _, j = getMetadata(run, getJson=True)
    return j

@router.get("/idToTimestep")
def idToTimestep(run: str):
    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret"))

    if config.IMPATIENT:
        r = loadTestJson(run, "idToTimestep")
        if r != None:
            return r
    
    query = """MATCH (n:{run})-[r:{run}]->(:{run})
               RETURN DISTINCT ID(n) as id, collect(r.timestep) as timesteps;""".format(run=run)

    j = None
    with driver.session() as session:
        try:
            result = session.run(query)
            j = result.data()
        except neo4j.exceptions.ServiceUnavailable as exception:
            raise exception

    saveTestJson(run, "idToTimestep", j)
    return j


# TODO: make pcca support multiple runs
# move to celery worker
@router.get("/pcca")
async def pcca(run: str, clusters: int, optimal: int, m_min: int, m_max: int):
    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret"))
    if config.IMPATIENT:
        r = loadTestJson(run, "optimal_pcca")
        if r != None:
            return r

    m, idx_to_id, occurrenceMatrix = calculator.calculate_transition_matrix(
        driver, run=run, discrete=True, getOccurrenceMatrix=True
    )
    print("finished loading transition matrix")
    gpcca = gp.GPCCA(np.array(m.values), z="LM", method="brandts")
    print("finished calculating optimal pcca values")
    j = {}
    sets = {}
    fuzzy_memberships = {}
    if optimal == 1:
        try:
            # gpcca.optimize(2)
            gpcca.optimize({"m_min": m_min, "m_max": m_max})
            print("finished optimization")
            j.update({"optimal_value": gpcca.n_m})
            feasible_clusters = []
            for cluster_idx, val in enumerate(gpcca.crispness_values):
                if val != 0:
                    feasible_clusters.append(cluster_idx + m_min)
                    # we still want the clustering...
                    gpcca.optimize(cluster_idx + m_min)
                    print(f"calculating cluster {cluster_idx + m_min}")
                    clusterings = []
                    for s in gpcca.macrostate_sets:
                        newSet = []
                        for i in s:
                            newSet.append(idx_to_id[i])
                        clusterings.append(newSet)
                    sets.update({cluster_idx + m_min: clusterings})
                    id_to_membership = {}
                    for idx, mem in enumerate(gpcca.memberships.tolist()):
                        id_to_membership.update({idx_to_id[idx]: mem})
                    fuzzy_memberships.update({cluster_idx + m_min: id_to_membership})
            j.update({"feasible_clusters": feasible_clusters})

            # for cc, clustering in enumerate(sets[gpcca.n_m]):
            #    for iden in clustering:
            #            currentClustering[iden] = cc

        except ValueError as exception:
            raise exception
    else:
        try:
            gpcca.optimize(clusters)
            clusterings = []
            for s in gpcca.macrostate_sets:
                newSet = []
                for i in s:
                    newSet.append(idx_to_id[i])
                clusterings.append(newSet)
            sets.update({clusters: clusterings})
            id_to_membership = {}
            for idx, mem in enumerate(gpcca.memberships.tolist()):
                id_to_membership.update({idx_to_id[idx]: mem})
            fuzzy_memberships.update({clusters: id_to_membership})
        except ValueError as exception:
            raise exception

    j.update({"sets": sets})
    j.update({"fuzzy_memberships": fuzzy_memberships})
    j.update({'occurrence_matrix': occurrenceMatrix})
    # j.update({'currentClustering': currentClustering});
    # TODO: add as metadata in vis
    # j.update({'dominant_eigenvalues': gpcca.dominant_eigenvalues.tolist()})
    # j.update({'minChi': gpcca.minChi(m_min, m_max)})
    # print(gpcca.n_m)
    # print(j)

    saveTestJson(run, "optimal_pcca", j)
    return j


app.include_router(router)
