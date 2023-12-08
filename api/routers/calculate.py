"""
Module for running various calculations on the data-set.
"""
from typing import List

import ase.geometry
from fastapi import APIRouter, Body
from sklearn import preprocessing
from sklearn.cluster import OPTICS

from neomd import converter
from neomd.queries import Neo4jQueryBuilder

from ..graphdriver import GraphDriver
from .worker import add_task_to_queue

router = APIRouter(prefix="/calculate", tags=["calculations"])


@router.post("/cluster_states", status_code=200)
def cluster_states(
    props: List[str] = Body([]), stateIds: List[int] = Body([])
):
    """
    Given a set of properties and a list of state IDs, grabs them from the database and then
    clusters them using the OPTICS algorithm.

    :param props: The properties to use while clustering.
    :param stateIds: The state IDs to use while clustering.

    :returns: A dictionary of state IDs to cluster numbers.
    """
    qb = Neo4jQueryBuilder(nodes=["State"])
    driver = GraphDriver()

    q = qb.get_states(id_list=stateIds, attribute_list=props + ["id"])

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


# make this a websocket?
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
    qb = Neo4jQueryBuilder.infer_db_structure(driver)

    q = qb.get_states(stateIDs, True)
    state_atom_dict = converter.query_to_ASE(driver, q)
    m = {id: {id2: 0 for id2 in stateSet2} for id in stateSet1}
    for id1 in stateSet1:
        s1 = state_atom_dict[id1]
        for id2 in stateSet2:
            s2 = state_atom_dict[id2]
            dist = ase.geometry.distance(s1, s2)
            m[id1][id2] = dist
    return m


@router.get("/neb_on_path", status_code=201)
def neb_on_path(
    run: str,
    start: str,
    end: str,
    interpolate: int = 3,
    maxSteps: int = 2500,
    fmax: float = 0.01,
    saveResults: bool = True,
):
    """
    Calculates the NEB on a path on the given trajectory from the start to the end timesteps provided.
    Sends a task to the celery background worker to do the work so that the back-end can process other tasks.

    :param run: Name of the trajectory.
    :param start: Start timestep.
    :param end: End timestep.
    :param interpolate: How many images should be between each timestep.
    :param maxSteps: Maximum step reached in the optimization before it stops.
    :param fmax: Minimum energy value before stopping.
    :param saveResults: Unused. The database always saves results.

    :returns int: The task ID.
    """

    task_id = add_task_to_queue(
        "neb_on_path",
        {
            "run": run,
            "start": start,
            "end": end,
            "interpolate": interpolate,
            "maxSteps": maxSteps,
            "fmax": fmax,
            "saveResults": saveResults,
        },
    )
    return task_id


@router.post("/subset_connectivity_difference", status_code=201)
def subset_connectivity_difference(stateIDs: List[int] = Body([])):
    """
    Uses a greedy search algorithm to generate a preview of the states where
    each state shown is as different as possible from the previous state.
    Helps locate structural differences in the simulation.

    :param stateIDs: A list of state IDs to run the calculation for.

    :returns int: The task ID.
    """
    task_id = add_task_to_queue(
        "subset_connectivity_difference",
        {
            "stateIDs": stateIDs,
        },
    )

    return task_id
