from typing import Any, Dict, List

import requests
from celery import Celery, Task, current_task
from celery.utils.log import get_task_logger

from neomd import calculator, converter, metadata
from neomd.queries import Neo4jQueryBuilder

from ..graphdriver import GraphDriver
from .celeryconfig import CeleryConfig

celery = Celery(
    "background_worker",
    backend="redis://localhost:6379/0",
    broker="redis://localhost:6379/0",
)
celery.config_from_object(CeleryConfig)
logger = get_task_logger(__name__)

TASK_START = "TASK_START"
TASK_PROGRESS = "TASK_PROGRESS"
TASK_COMPLETE = "TASK_COMPLETE"


def send_update(task_id: str, data: Dict[Any, Any]):
    """
    Send update to FastAPI containing whatever data is passed here.

    :param task_id: The task to update.
    :param data: The data to send.
    """
    requests.post(f"http://localhost:8000/worker/update_task/{task_id}", json=data)


class PostingTask(Task):
    def before_start(self, task_id, args, kwargs):
        # send update that task is starting
        send_update(task_id, {"type": TASK_START})
        return super().before_start(task_id, args, kwargs)

    def on_success(self, retval, task_id, args, kwargs):
        # send update that task has finished
        send_update(task_id, {"type": TASK_COMPLETE})
        return super().on_success(retval, task_id, args, kwargs)


@celery.task(name="subset_connectivity_difference", base=PostingTask)
def subset_connectivity_difference(stateIDs: List[int]):
    """
    Calculates the critical states of a sequence.
    This is achieved using a greedy algorithm where the first state is compared to the entire sequence,
    and then the index of the state with the most difference is returned.
    Using this most different state, we start the loop again and look for the 
    maximally different state from that point in the sequence.
    Continue until 3 iterations or we reach the end.

    :param stateIDs: The states to compare.

    :returns: The IDs of the critical states of the sequence.
    """
    driver = GraphDriver()
    task_id = current_task.request.id

    qb = Neo4jQueryBuilder([("Atom", "PART_OF", "State", "MANY-TO-ONE")], ["State"])
    q = qb.generate_get_node_list("State", stateIDs, "PART_OF")
    state_atom_dict = converter.query_to_ASE(driver, q)

    connectivity_list = []  # all connectivity matrices in order
    for stateID in stateIDs:
        atoms = state_atom_dict[stateID]
        connectivity_list.append((stateID, atoms))

    maximum_difference = []
    iter = 0
    while iter < 3:
        result = calculator.max_connectivity_difference(
            connectivity_list[0][1], connectivity_list[1:]
        )
        if result["id"] is not None and result["id"] not in maximum_difference:
            maximum_difference.append(result["id"])

            current_task.update_state(state="PROGRESS")
            send_update(
                task_id,
                {
                    "type": TASK_PROGRESS,
                    "data": result["id"],
                },
            )

            connectivity_list = connectivity_list[result["index"] :]
        else:
            break
        iter += 1

    # again, return the states here possibly?
    return ""


@celery.task(name="neb_on_path", base=PostingTask)
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

    :param run: Name of the trajectory.
    :param start: Start timestep.
    :param end: End timestep.
    :param interpolate: How many images should be between each timestep.
    :param maxSteps: Maximum step reached in the optimization before it stops.
    :param fmax: Minimum energy value before stopping.
    :param saveResults: Unused. The database always saves results.
    """

    task_id = current_task.request.id
    driver = GraphDriver()

    md = metadata.get_metadata(driver, run)
    path, allStates = calculator.canonical_path(driver, run, start, end)

    qb = Neo4jQueryBuilder(
        [("Atom", "PART_OF", "State", "MANY-TO-ONE")],
        ["State"]
    )

    q = qb.generate_get_node_list("State", allStates, "PART_OF")
    full_atom_dict = converter.query_to_ASE(driver, q)

    if interpolate < 0:
        # should send error message to main
        raise ValueError("Cannot interpolate less than 0 images.")

    # utility function to update client
    def send_neb_step(id, atoms, index):
        send_update(
            task_id,
            {
                "type": TASK_PROGRESS,
                "progress": f"{index+1/len(path)}",
                "data": {
                    "id": id,
                    "energy": atoms.get_potential_energy(),
                    "timestep": index,
                },
            },
        )

    idx = 0  # keeps count of how many steps we have processed
    for relation in path.values():
        s1, s2, old_state = relation
        s1_atoms = full_atom_dict[s1]
        s2_atoms = full_atom_dict[s2]

        images = calculator.calculate_neb_for_pair(
            s1_atoms,
            s2_atoms,
            md["cmds"],
            interpolate,
            maxSteps,
            fmax,
        )

        send_neb_step(old_state, s1_atoms, idx)
        idx += 1

        # convert ASE Atoms to new states
        for atoms in images[1:-1]:
            stateID = converter.ase_to_neo4j(driver, ["NEB", run], atoms)
            send_neb_step(stateID, atoms, idx)
            idx += 1

        send_neb_step(s2, s2_atoms, idx)

    # return entire list to store in cache later?
    return {}


@celery.task(name="save_to_db")
def save_to_db(new_attributes):
    """
    Saves the data provided in the database. Heavily used in load_properties, this frees FastAPI from sending data to the database.

    :param new_attributes Dict[int, Dict[str, Any]]: Dictionary of stateIDs to dictionaries containing new properties.
    """
    driver = GraphDriver()

    qb = Neo4jQueryBuilder(nodes=["State"])

    q = None
    with driver.session() as session:
        tx = session.begin_transaction()
        for id, data in new_attributes.items():
            # q is a template query that gets filled in with each datapoint
            if q is None:
                q = qb.generate_update_entity(data, "State", "id")
            data.update({"id": id})
            tx.run(q.text, data)
        tx.commit()
