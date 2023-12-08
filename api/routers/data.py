"""
Module for retrieving data from the database.
"""
import logging
import time
from typing import Any, Dict, List, Optional

from ase import Atoms
from celery.utils import uuid
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pymemcache import serde
from pymemcache.client.base import PooledClient

import neomd.utils
from neomd import converter, metadata, visualizations
from neomd.queries import Neo4jQueryBuilder

from ..background_worker.celery import celery
from ..graphdriver import GraphDriver
from ..trajectory import Trajectory
from ..utils import (
    find_missing_properties,
    get_script_code,
    get_script_properties_map,
    qImage_to_string,
    remove_duplicates,
)

router = APIRouter(prefix="/data", tags=["data"])


async def run_script(script: str, state_atom_dict: Dict[int, Atoms]):
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
        "save_to_db",
        kwargs={"new_attributes": new_attributes},
        task_id=task_id,
    )

    # move into seperate process?
    return new_attributes


@router.post("/generate_ovito_image", status_code=200)
async def generate_ovito_image_endpoint(
    id: int, visScript: str, data: dict[str, str] = None
):
    """
    Generates an image of the state ID specified using the specified visualization script.

    :param id int: The state ID to be rendered.
    :param visScript: The visualization script to use.
    :param data: additional data to be used in the visulization script.

    :returns: Object containing state ID and a base64 encoded image string.
    """
    driver = GraphDriver()
    qb = Neo4jQueryBuilder(
        [("Atom", "PART_OF", "State", "MANY-TO-ONE")], ["State"]
    )

    q = qb.get_states([id], True)
    atom_dict = converter.query_to_ASE(driver, q)

    modifier = get_script_code(visScript, folder="vis_scripts")
    exec(modifier, globals())

    pipeline = visualizations.build_pipeline(
        atom_dict[id], pipeline_modifier=modify_pipeline, data=data
    )
    results = pipeline.compute()
    # converts OVITO results to json encodable format
    unpacked = neomd.utils.unpack_ovito(results)

    return {"id": id, "results": unpacked}


@router.get("/get_metadata")
def get_metadata(run: str):
    """
    Retrieves metadata for the requested trajectory.

    :param run: Name of the trajectory.

    :returns Dict[str, Any]: Dictionary of metadata information.
    """
    driver = GraphDriver()
    return metadata.get_metadata(driver, run)


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
        qb = Neo4jQueryBuilder(nodes=["State"])
        driver = GraphDriver()

        q = qb.get_states(
            id_list=data["stateIds"],
            attribute_list=data["props"] + ["id"],
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
        pass


async def load_properties_for_subset(stateList: List[Dict[str, Any]]):
    """
    Given a list of states, checks the properties currently loaded in the system and
    calculates the properties for each state if they are missing.

    :param stateList List[Dict[str, Any]]: A list of state IDs to run the calculations for.
    :raises ValueError: Complain if specified property does not exist in scripts provided.
    """
    driver = GraphDriver()

    # find what properties we need to calculate
    missingProperties = find_missing_properties(stateList)

    # build map of properties to script name
    property_to_script = get_script_properties_map()

    all_missing = []
    if len(missingProperties.keys()) > 0:
        runScripts = {}
        for key, values in missingProperties.items():
            script = property_to_script.get(key)
            if not script:
                raise ValueError(
                    f"Unknown property {key}. No script provided calculates that property."
                )

            # add to scripts we need to run
            if script not in runScripts:
                runScripts[script] = values
            else:
                runScripts[script] = runScripts[script] + values
            all_missing = all_missing + values

        if len(all_missing) > 0:
            qb = Neo4jQueryBuilder(
                [
                    ("Atom", "PART_OF", "State", "MANY-TO-ONE"),
                ],
                ["State"],
            )
            q = qb.get_states(remove_duplicates(all_missing), True)
            state_atom_dict = converter.query_to_ASE(driver, q)

            # convert stateList to dict for easy modification
            stateDict = {}
            for state in stateList:
                stateDict[state["id"]] = state

            for analysisName, states in runScripts.items():
                script_dict = {
                    id: state_atom_dict[id] for id in remove_duplicates(states)
                }
                results = await run_script(analysisName, script_dict)
                for id, data in results.items():
                    stateData = stateDict[id]
                    for key, value in data.items():
                        stateData[key] = value
                    stateDict[id] = stateData

            return list(stateDict.values())
    else:
        return stateList


# TODO: this is in neomd as well, need to pick one version
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


# maybe better to just hit database rather than use cache and load entire run?
@router.get("/get_sequence")
def get_sequence(run: str, start: Optional[int], end: Optional[int] = None):
    """
    Retreives the sequence for the specified trajectory, optionally returning a range of the sequence.

    :param run: The name of the trajectory.
    :param start: The beginning of the range to retrieve.
    :param end: The end of the range.

    :returns List[int]: A list of state IDs within the specified range.
    """
    mem_client = PooledClient(
        "localhost", max_pool_size=4, serde=serde.pickle_serde
    )
    trajectory = mem_client.get(run)

    driver = GraphDriver()
    if trajectory is None:
        trajectory = Trajectory.load_sequence(driver, run)

    if start is None or end is None:
        return trajectory.sequence
    else:
        return trajectory.sequence[start : end + 1]


@router.get("/list_trajectories")
def list_trajectories():
    """
    Returns the trajectories available in the database.

    :returns List[str]: A list of trajectories available in the database.
    """
    driver = GraphDriver()

    # maybe build querybuilder with runs?
    j = []
    with driver.session() as session:
        result = session.run("MATCH (m:Metadata) RETURN DISTINCT m.run;")
        runs = []
        for r in result.values():
            for record in r:
                runs.append(record)
        j = runs

    return j


@router.get("/load_trajectory")
def load_trajectory(
    run: str,
    mMin: int,
    mMax: int,
    chunkingThreshold: float,
    numClusters: int | None = None,
):
    """
    Loads the trajectory's sequence, runs PCCA on it, simplifies it, and returns a list of important / unimportant regions + states.
    If numClusters is specified, it is used to cluster the trajectory; otherwise, the optimal clustering value found by minChi(mMin,mMax) is used.

    :param run str: The name of the trajectory to load
    :param mMin int: When running PCCA, the minimum cluster size to try.
    :param mMax int: When running PCCA, the maximum cluster size to try.
    :param chunkingThreshold float: Cluster membership threshold at which states are considered important.
    """

    s_t = time.time()

    driver = GraphDriver()
    get_potential(run)  # needed for NEB later on
    trajectory = Trajectory.load_sequence(driver, run)

    try:
        trajectory.pcca(driver, mMin, mMax, numClusters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
    # calculate what cluster each state belongs to, need it for simplify_sequence
    trajectory.calculateIDToCluster()
    trajectory.simplify_sequence(chunkingThreshold)

    mem_client = PooledClient(
        "localhost", max_pool_size=1, serde=serde.pickle_serde
    )
    mem_client.set(run, trajectory)

    logging.info(f"Backend processing took {time.time() - s_t}.")

    return {
        "uniqueStates": trajectory.simplified_unique_states,
        "simplified": trajectory.chunks,
        "current_clustering": trajectory.current_clustering,
    }
