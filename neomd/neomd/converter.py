"""
This class consumes queries, either user-built or by the query builder and
converts the data from the database into the given data types / file formats.
"""

from typing import List, Literal, Tuple

import ase
import neo4j
import numpy as np
from ase import Atoms
from ase.calculators.lammps import convert
from typeguard import typechecked

from neomd.metadata import get_counter, update_counter
from neomd.queries import Query


@typechecked
def query_to_ASE(
    driver: neo4j.Driver,
    query: Query,
    dictKey: Tuple[Literal["state", "atom", "relation"], str] = (
        "state",
        "id",
    ),
):
    """
    Converts a query into ASE format. Returns a dict of state number : ASE atoms objects.

    :param driver: Neo4j driver object - executes the query and then builds ASE list
    :param query: Query to convert to ASE format
    :param atomType: The type of the atoms that will be converted
    :param dictKey: What attribute to use as a key in the dictionary. Tuple of ('state' | 'atom' | 'relation', 'attribute_name')

    :returns: Dict[int, ase.Atoms], a dictionary of state IDs to ASE Atoms.
    """
    if "ASE" not in query.options:
        raise ValueError("This query cannot be converted to ASE format.")

    with driver.session() as session:
        result = session.run(query.text)
        return result_to_ASE(result, dictKey)


@typechecked
def result_to_ASE(result: neo4j.Result, dictKey=("state", "id")):
    """
    Converts a neo4j.Result to a dictionary of IDs to ASE objects.

    :param result: The result object to convert.
    :param dictKey: The key from the results to use as the dictionary key.

    :raises ValueError: Raised if the result contains
    something other than lists and nodes.
    :returns: Dict[int, ase.Atoms]
    """
    attr_atom_dict = {}

    states = []
    atomsList = []
    for record in result:
        for node in record:
            if isinstance(node, neo4j.graph.Node):
                labels = list(node.labels)
                if "State" in labels:
                    states.append(node)
            elif isinstance(node, list):
                atomsList.append(node)
            else:
                raise ValueError(f"Unrecognized entity type {type(node)}.")

    for state, atoms in zip(states, atomsList):
        # eventually, we'll use the boxID from the state to grab the boxInfo
        k = state[dictKey[1]]
        cell_x = state["boxhi_x"] - state["boxlo_x"]
        cell_y = state["boxhi_y"] - state["boxlo_y"]
        cell_z = state["boxhi_z"] - state["boxlo_z"]
        xy = state["xy"]
        xz = state["xz"]
        yz = state["yz"]
        periodic_x = state["periodic_x"]
        periodic_y = state["periodic_y"]
        periodic_z = state["periodic_z"]
        atom_count = state["AtomCount"]

        N = atom_count

        # travel corresponds to the last 3 fields in a position line of the lammps file if they exist
        travel = np.zeros((N, 3), int)
        types = np.zeros((N), int)
        for i in range(0, N):
            types[i] = 1

        velocities = np.zeros((N, 3))
        positions = np.zeros((N, 3))
        ids = np.zeros((N))
        masses = np.zeros((N))
        cell = np.zeros((3, 3))
        atomTypes = [""] * N
        cell[0, 0] = cell_x
        cell[1, 1] = cell_y
        cell[2, 2] = cell_z
        if xy is not None:
            cell[1, 0] = xy
        if xz is not None:
            cell[2, 0] = xz
        if yz is not None:
            cell[2, 1] = yz

        for idx, r in enumerate(atoms):
            positions[idx] = [
                np.float64(r["position_x"]),
                np.float64(r["position_y"]),
                np.float64(r["position_z"]),
            ]
            velocities[idx] = [
                np.float64(r["velocity_x"]),
                np.float64(r["velocity_y"]),
                np.float64(r["velocity_z"]),
            ]
            atomTypes[idx] = r["atom_type"]
            ids[idx] = r["internal_id"]

        def shift_positions(positions, cell_size):
            if all(abs((cell_size / 2) - x) > 1.0 for x in positions):
                return cell_size / 2
            return 0

        # this should not be metal
        positions = convert(positions, "distance", "metal", "ASE")
        cell = convert(cell, "distance", "metal", "ASE")
        masses = convert(masses, "mass", "metal", "ASE")
        velocities = convert(velocities, "velocity", "metal", "ASE")

        atoms = Atoms(
            positions=positions,
            symbols=atomTypes,
            cell=cell,
            pbc=(periodic_x, periodic_y, periodic_z),
            tags=ids,
        )
        atoms.set_velocities(velocities)
        atoms.arrays["travel"] = travel
        atoms.arrays["id"] = ids
        atoms.arrays["type"] = types

        xPos = [p[0] for p in atoms.positions]
        yPos = [p[1] for p in atoms.positions]
        zPos = [p[2] for p in atoms.positions]

        # shift_positions corrects systems that may have been wrapped around the cell
        shiftX = shift_positions(xPos, cell_x)
        shiftY = shift_positions(yPos, cell_y)
        shiftZ = shift_positions(zPos, cell_z)

        shifted = []
        for x, y, z in zip(xPos, yPos, zPos):
            shifted.append([x - shiftX, y - shiftY, z - shiftZ])
        atoms.positions = shifted
        atoms.wrap()
        attr_atom_dict[k] = atoms

    return attr_atom_dict


# TODO: use querybuilder
def ase_to_neo4j(driver: neo4j.Driver, labels: List[str], atoms: ase.Atoms) -> int:
    """
    Creates a new State node in the neo4j database from an ASE Atoms object.

    :param driver: The neo4j driver to use.
    :param labels: A list of strings to use to label the new state.
    :param atoms ase.Atoms: The ASE atoms object to insert into the database.

    :returns int: The state ID of the new node in the database.
    """
    cell = atoms.get_cell()
    cell_x = cell[0, 0]
    cell_y = cell[1, 1]
    cell_z = cell[2, 2]
    xy = cell[1, 0]
    xz = cell[2, 0]
    yz = cell[2, 1]
    px, py, pz = atoms.get_pbc()
    atom_count = len(atoms)

    stateIDCounter = get_counter(driver, "stateIDCounter")

    with driver.session() as session:
        tx = session.begin_transaction()

        # move elsewhere? not sure
        stateQ = f"""CREATE (s:State:{":".join(labels)})
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
        atomQ = """MATCH (s:State) WHERE s.id = $stateIDCounter
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

        update_counter(tx, "stateIDCounter", stateIDCounter + 1)
        tx.commit()

    return stateIDCounter


# query to get all transforms for a given state
