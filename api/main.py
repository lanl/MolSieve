import logging
import os
from typing import List

import ase.geometry
from celery.result import AsyncResult
from celery.utils import uuid
from fastapi import (
    APIRouter,
    Body,
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from sklearn import preprocessing
from sklearn.cluster import OPTICS
from pymemcache import serde
from pymemcache.client.base import PooledClient

from neomd import converter, querybuilder
from .background_worker.celery import TASK_COMPLETE, celery
from .connectionmanager import ConnectionManager
from .graphdriver import GraphDriver
from .trajectory import Trajectory
from .routers import data
from .utils import get_script_properties_map 

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

app.include_router(data.router)
app.include_router(router)
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
