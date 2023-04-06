import json
from typing import Any, Dict, List

import neo4j
import requests
from celery import Celery, Task, current_task
from celery.utils.log import get_task_logger
from scipy import stats

from neomd import calculator, converter, metadata, querybuilder
from neomd.query import Query

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
    requests.post(f"http://localhost:8000/worker/update_task/{task_id}", json=data)


class PostingTask(Task):
    def before_start(self, task_id, args, kwargs):
        send_update(task_id, {"type": TASK_START})
        return super().before_start(task_id, args, kwargs)

    def on_success(self, retval, task_id, args, kwargs):
        send_update(task_id, {"type": TASK_COMPLETE})
        return super().on_success(retval, task_id, args, kwargs)


@celery.task(name="subset_connectivity_difference", base=PostingTask)
def subset_connectivity_difference(stateIDs: List[int]):
    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
    )
    task_id = current_task.request.id

    qb = querybuilder.Neo4jQueryBuilder([("Atom", "PART_OF", "State", "MANY-TO-ONE")])
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

    return ""


@celery.task(name="perform_KS_Test", base=PostingTask)
def perform_KSTest(data: dict):
    cdf = data["cdf"]
    rvs = data["rvs"]
    prop = data["property"]

    task_id = current_task.request.id

    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
    )

    qb = querybuilder.Neo4jQueryBuilder()
    q = qb.generate_get_node_list("State", rvs, attributeList=[prop])

    current_task.update_state(state="PROGRESS")
    send_update(
        task_id,
        {
            "type": TASK_PROGRESS,
            "message": "Finished processing nodes.",
            "progress": "0.5",
        },
    )

    rvs_df = converter.query_to_df(driver, q)
    rvs_final = rvs_df[prop].to_numpy()
    cdf_final = None

    if type(data["cdf"]) is dict:
        q = qb.generate_get_node_list("State", cdf)
        cdf_df = converter.query_to_df(driver, q)
        cdf_final = cdf_df[prop].to_numpy()
    else:
        cdf_final = cdf

    statistic, pvalue = stats.kstest(rvs_final, cdf_final)

    return json.dumps({"statistic": statistic, "pvalue": pvalue})

# needs serious cleanup
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

    task_id = current_task.request.id

    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
    )

    qb = querybuilder.Neo4jQueryBuilder(
        schema=[("Atom", "PART_OF", "State", "MANY-TO-ONE")]
    )

    current_task.update_state(state="PROGRESS")
    send_update(
        task_id,
        {
            "type": TASK_PROGRESS,
            "message": "Finished getting nodes.",
            "progress": "0.1",
        },
    )

    md = metadata.get_metadata(driver, run)

    path = {}
    allStates = []
    with driver.session() as session:
        # get the path first, just the ids
        q = f"""MATCH (n:State:{run})-[r:{run}]->(n2:State:{run})
        WHERE r.timestep >= {start} AND r.timestep <= {end}
        RETURN n.id AS first, r.timestep AS timestep, n2.id AS second;"""

        res = session.run(q)
        for r in res:
            path.update({r["timestep"]: (r["first"], r["second"], r["first"])})

        # get their canonical representations - this is a seperate query
        q = f"""OPTIONAL MATCH (n:{run})-[r:canon_rep_{run}]->(n2:State)
            WHERE r.timestep >= {start} AND r.timestep <= {end} AND n.id IN ["""
        count = 0
        for relation in path.values():
            q += str(relation[0])
            if count != len(path.items()) - 1:
                q += ","
            count += 1
        q += "] RETURN DISTINCT r.timestep AS timestep, n2.id AS sym_state ORDER BY r.timestep;"
        res = session.run(q)
        for r in res:
            if r["timestep"] in path:
                curr_tuple = path[r["timestep"]]
                path[r["timestep"]] = (curr_tuple[0], r["sym_state"], curr_tuple[1])

        for relation in path.values():
            if relation[0] not in allStates:
                allStates.append(relation[0])
            if relation[1] not in allStates:
                allStates.append(relation[1])

    full_atom_dict = {}
    for stateID in allStates:
        q = f"""MATCH (a:Atom)-[:PART_OF]->(n:State) WHERE n.id = {stateID}
        WITH n,a ORDER BY a.internal_id WITH collect(DISTINCT a) AS atoms, n
        RETURN n, atoms;
        """
        attr_atom_dict = converter.query_to_ASE(driver, Query(q, ["ASE"]))

        for state, atoms in attr_atom_dict.items():
            full_atom_dict.update({state: atoms})

    energyList = []
    if interpolate < 0:
        # should send error message to main
        raise ValueError("Cannot interpolate less than 0 images.")

    stateIDCounter = metadata.get_stateID_counter()
    idx = 0

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

        with driver.session() as session:
            tx = session.begin_transaction()

            # send first state
            current_task.update_state(state="PROGRESS")
            send_update(
                task_id,
                {
                    "type": TASK_PROGRESS,
                    "progress": f"{idx+1/len(path)}",
                    "data": {
                        "id": old_state,
                        "energy": s1_atoms.get_potential_energy(),
                        "timestep": idx,
                    },
                },
            )
            idx += 1
            for atoms in images[1:-1]:
                cell = atoms.get_cell()
                cell_x = cell[0, 0]
                cell_y = cell[1, 1]
                cell_z = cell[2, 2]
                xy = cell[1, 0]
                xz = cell[2, 0]
                yz = cell[2, 1]
                px, py, pz = atoms.get_pbc()
                atom_count = len(atoms)

                stateQ = f"""CREATE (s:State:NEB:{run}) 
                        SET s.id = {stateIDCounter},
                        s.boxhi_x = {cell_x},
                        s.boxhi_y = {cell_y},
                        s.boxhi_z = {cell_z},
                        s.boxlo_x = 0.0,
                        s.boxlo_y = 0.0,
                        s.boxlo_z = 0.0,
                        s.xy = {xy},
                        s.xz = {xz},
                        s.yz = {yz},
                        s.periodic_x = {int(px)},
                        s.periodic_y = {int(py)},
                        s.periodic_z = {int(pz)},
                        s.AtomCount = {atom_count};"""
                tx.run(stateQ)

                positions = atoms.get_positions()
                velocities = atoms.get_velocities()
                atomQ = """MATCH (s:NEB) WHERE s.id = $stateIDCounter
                            CREATE (a:Atom)
                            SET a.atom_type = $symbol,
                            a.id = $atom_id,
                            a.internal_id = $internal_id,
                            a.position_x = $px,
                            a.position_y = $py,
                            a.position_z = $pz,
                            a.velocity_x = $vx,
                            a.velocity_y = $vy,
                            a.velocity_z = $vz
                            MERGE (a)-[:PART_OF]->(s);"""

                atom_counter = 1
                for atom, position, velocity in zip(atoms, positions, velocities):
                    symbol = atom.symbol
                    px, py, pz = position
                    vx, vy, vz = velocity
                    tx.run(
                        atomQ,
                        stateIDCounter=stateIDCounter,
                        symbol=symbol,
                        atom_id=f"{stateIDCounter}_{atom_counter}",
                        internal_id=atom_counter,
                        px=px,
                        py=py,
                        pz=pz,
                        vx=vx,
                        vy=vy,
                        vz=vz,
                    )
                    atom_counter += 1

                current_task.update_state(state="PROGRESS")
                send_update(
                    task_id,
                    {
                        "type": TASK_PROGRESS,
                        "message": f"Image {idx + 1} processed.",
                        "progress": f"{idx+1/len(path)}",
                        "data": {
                            "id": stateIDCounter,
                            "energy": atoms.get_potential_energy(),
                            "timestep": idx,
                        },
                    },
                )
                stateIDCounter += 1
                idx += 1

            # send last state
            current_task.update_state(state="PROGRESS")
            send_update(
                task_id,
                {
                    "type": TASK_PROGRESS,
                    "message": f"Image {idx + 1} processed.",
                    "progress": f"{idx+1/len(path)}",
                    "data": {
                        "id": s2,
                        "energy": s2_atoms.get_potential_energy(),
                        "timestep": idx,
                    },
                },
            )

            q = f"MATCH (s:ServerMetadata) SET s.stateIDCounter={stateIDCounter};"
            tx.run(q)
            tx.commit()
    return {}


@celery.task(name="calculate_path_similarity", base=PostingTask)
def calculate_path_similarity(
    p1: List[int],
    p2: List[int],
    state_attributes: List[str] = [],
    atom_attributes: List[str] = [],
):

    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
    )

    generation_state_attributes = state_attributes.copy()
    generation_state_attributes.append("id")

    qb = querybuilder.Neo4jQueryBuilder([("Atom", "PART_OF", "State", "MANY-TO-ONE")])

    q1 = qb.generate_get_node_list(
        "State", p1, attributeList=generation_state_attributes
    )

    q2 = qb.generate_get_node_list(
        "State", p2, attributeList=generation_state_attributes
    )

    score = calculator.calculate_path_similarity(
        driver, q1, q2, state_attributes, atom_attributes
    )

    return json.dumps({"score": score})


# used with load_properties to save time
@celery.task(name="save_to_db")
def save_to_db(new_attributes):
    driver = neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
    )

    qb = querybuilder.Neo4jQueryBuilder(
        schema=[("Atom", "PART_OF", "State", "MANY-TO-ONE")]
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
