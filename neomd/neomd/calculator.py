"""
Module that calculates various important quantities automatically.
Basically a synthesis of the converter and querybuilder modules.
"""

import copy
import os
import sys
from typing import Dict, List, Optional, Set, Tuple, TypeAlias, Union, Iterable

import ase.geometry
import neo4j
import networkx as nx
import numpy as np
import ovito  # always keep ovito imported
import pandas as pd
from ase import Atoms
from ase.calculators.lammpslib import LAMMPSlib
from ase.neb import NEB
from ase.optimize import FIRE
from ovito.io.ase import ase_to_ovito
from ovito.pipeline import Pipeline, StaticSource
from scipy import sparse
from scipy.spatial.distance import euclidean
from sklearn import preprocessing
from typeguard import typechecked
from tqdm import tqdm
from multiprocessing import Pool
from neomd import converter, utils
from neomd.graphs import StateGraph, TransitionGraph, graphutils
from neomd.metadata import get_metadata
from neomd.queries import Neo4jQueryBuilder

os.environ["DISPLAY"] = ""

StateID: TypeAlias = int
Transition: TypeAlias = Tuple[StateID, StateID]


# TODO: check that analysisType is supported
# TODO: get rid of eval, have analysisType hit a dictionary or something
def apply_ovito_pipeline_modifier(
    state_atom_dict: Dict[int, ase.Atoms], analysisType: str
):
    """
    Apply any Ovito modifier to the dataset.

    :returns: - dict of {state_number: attributes} calculated from the modifier
    """

    new_attributes = {}

    for id, atoms in state_atom_dict.items():
        o_atoms = ase_to_ovito(atoms)
        pipeline = Pipeline(source=StaticSource(data=o_atoms))
        modifier = eval(
            "ovito.modifiers.{analysisType}()".format(analysisType=analysisType)
        )

        if analysisType == "PolyhedralTemplateMatchingModifier":
            modifier.structures[4].enabled = True
            modifier.structures[5].enabled = True
            modifier.structures[6].enabled = True
            modifier.structures[7].enabled = True
            modifier.structures[8].enabled = True

        pipeline.modifiers.append(modifier)
        data = pipeline.compute()
        cleanDict = {
            utils.sanitize_neo4j_string(k): v for k, v in data.attributes.items()
        }
        new_attributes.update({id: cleanDict})

    return new_attributes


@typechecked
def calculate_neb_for_pair(
    init_state: ase.Atoms,
    final_state: ase.Atoms,
    lmpscmds: List[str] = [],
    interpolate: int = 10,
    maxSteps: int = 2500,
    fmax: float = 0.01,
):
    """
    Calculates the NEB (nudged elastic band) between two states.

    :param init_state: First image of NEB calculation
    :param final_state: Second image of NEB calculation
    :param lmpscmds: optional parameters for the lammps calculator; correct results are not guaranteed without potentials
    :param interpolate: how many images to interpolate between; default 10
    :param maxSteps: maximum steps to take before halting optimization
    :param fmax: stopping threshold
    """

    images = [init_state]

    if interpolate > 0:
        images += [init_state.copy() for _ in range(interpolate)]

    images += [final_state]

    neb = NEB(images)
    neb.interpolate(method="idpp")

    for image in images:
        image.calc = LAMMPSlib(keep_alive=True, lmpcmds=lmpscmds)

    dyn = FIRE(neb, logfile="neb.log")
    dyn.run(fmax=fmax, steps=maxSteps)

    return images


@typechecked
def calculate_trajectory_occurrences(driver: neo4j.Driver, run: str):
    """
    Calculates the number of times a state occurred in the trajectory
    and stores it in the database.

    :param driver: Neo4j driver to query.
    :param run: Name of the trajectory
    :raises ServiceUnavailable: Raised when the server is down.
    """
    qb = Neo4jQueryBuilder.infer_db_structure(driver)
    q = qb.generate_get_occurrences(run)
    try:
        with driver.session() as session:
            session.run(q.text)
    except neo4j.exceptions.ServiceUnavailable as exception:
        raise exception


# TODO: use querybuilder
@typechecked
def calculate_transition_matrix(driver: neo4j.Driver, run: str, useCanon: bool = False):
    """
    Returns the transition matrix for a given trajectory.
    The [i][j]th element of each matrix is defined as
    the number of i to j transitions / the # of visits to i;
    i.e., the probability of visiting of i from j.

    :param driver: - neo4j driver
    :param run: name of the run to build the transition matrix for
    :param useCanon: Use the canonical representations of states
    when building the transition matrix.
    :returns: a tuple of (sparse.csr_matrix of connection information,
                          Dict where the index retrieves the state id)
    """

    # check if occurrence counts have been calculated for the trajectory
    md = get_metadata(driver, run)
    if f"{run}_occurrences" not in md:
        calculate_trajectory_occurrences(driver, run)

    q = """
    MATCH (n:{run}:State)-[r:{run}]->(n2:{run}:State)
    WITH n.id AS n_id, n2.id AS n2_id, count(r) AS transition_count,
    n.{occurrenceString} AS occurrences
    WITH collect({{id: n2_id, p: toFloat(transition_count) / occurrences }})
    AS transitions, n_id
    RETURN n_id, transitions
    ORDER BY n_id;
    """.format(run=run, occurrenceString=f"{run}_occurrences")
    with driver.session() as session:
        result = session.run(q)
        uniqueStates = result.data()

    matrix = None
    idx_to_id = []
    if useCanon:
        state_to_canon = {}
        # get state_to_canon dict, and convert every transition
        q = f"""
        MATCH (n:State)-[r:canon_rep_{run}]->(n2:State)
        WITH n, n2 ORDER BY r.timestep DESC
        RETURN n.id AS state, n2.id AS sym;"""
        with driver.session() as session:
            r = session.run(q)
            for record in r:
                state_to_canon[record["state"]] = record["sym"]
    else:
        mSize = len(uniqueStates)
        id_to_idx = {}
        matrix = sparse.lil_matrix((mSize, mSize))
        for idx, ut in enumerate(uniqueStates):
            id_to_idx.update({ut["n_id"]: idx})
        idx_to_id = list(id_to_idx.keys())

        for ut in uniqueStates:
            curr_id = id_to_idx[ut["n_id"]]
            for t in ut["transitions"]:
                matrix[curr_id, id_to_idx[t["id"]]] = t["p"]

    return matrix.tocsc(), idx_to_id


def max_connectivity_difference(
    atoms1: ase.Atoms, atoms_list: List[Tuple[StateID, ase.Atoms]]
):
    """
    Get the geometric distance between two ase Atoms objects.

    :param atoms1: The Atoms to compare to the rest of the list.
    :param connectivity_list: [TODO:description]

    :return: A dictionary containing the value, id and index of the most
    different Atoms object from atoms1.
    """
    # entry is (id, matrix)
    max_val = -sys.maxsize - 1
    max_id = None
    max_idx = None
    for idx, entry in enumerate(atoms_list):
        id, atoms2 = entry
        val = ase.geometry.distance(atoms1, atoms2)
        if abs(val) > max_val:
            max_val = abs(val)
            max_id = id
            max_idx = idx

    return {"value": max_val, "id": max_id, "index": max_idx}


# TODO: use querybuilder, needs to be better documented
# also no use when relabelled
def canonical_path(driver: neo4j.Driver, run: str, start: int, end: int):
    """
    Gets the canonical states in the path from start to end. Used
    in NEB calculation.

    :param driver: Neo4j driver object to use to retrieve path.
    :param run: The name of the trajectory to use.
    :param start: Start timestep.
    :param end: End timestep.
    """
    path = {}  # the order in which they should be calculated
    stateIDs = []  # stateIDs used in the calculation
    with driver.session() as session:
        # get the path first, just the ids
        q = f"""MATCH (n:State:{run})-[r:{run}]->(n2:State:{run})
        WHERE r.timestep >= {start} AND r.timestep <= {end}
        RETURN n.id AS first, r.timestep AS timestep, n2.id AS second, r.sym AS sym
        ORDER BY timestep, sym;"""

        symmetry_results = session.run(q)
        for r in symmetry_results:
            if r["sym"]:
                t = path.get(r["timestep"], None)
                second = None
                if t is not None:
                    second = t.get("second", None)

                path.update(
                    {
                        r["timestep"]: {
                            "first": r["first"],
                            "second": second,
                            "symmetry": r["second"],
                        }
                    }
                )

            else:
                t = path.get(r["timestep"], None)
                symmetry = None
                if t is not None:
                    symmetry = t.get("symmetry", None)
                path.update(
                    {
                        r["timestep"]: {
                            "first": r["first"],
                            "second": r["second"],
                            "symmetry": symmetry,
                        }
                    }
                )

        for relation in path.values():
            if relation["first"] not in stateIDs:
                stateIDs.append(relation["first"])
            if relation["second"] not in stateIDs and relation["second"] is not None:
                stateIDs.append(relation["second"])
            if (
                relation["symmetry"] not in stateIDs
                and relation["symmetry"] is not None
            ):
                stateIDs.append(relation["symmetry"])

    return path, stateIDs


def relabel_trajectory(driver: neo4j.Driver, qb: Neo4jQueryBuilder, run: str):
    """
    Adds trajectory specific labels to each Atom node in the database.
    When retrieved from the database and ordered by these labels, they
    are consistent for each state, allowing you to run NEBs between non-adjacent
    states and so on.

    :param driver: Neo4j driver to access the database with.
    :param run: Name of the trajectory to access.
    :param qb: Querybuilder to use.
    """

    # get every state and its transitions, and if they are symmetric or not
    q = f"""MATCH (n:{run})-[r:{run}]->(n2:{run})
    RETURN DISTINCT n.id as s1, r.sym as sym, n2.id as s2"""
    sym_g = nx.Graph()
    states = set()
    with driver.session() as session:
        res = session.run(q)
        for rec in res:
            states.add(rec["s1"])
            states.add(rec["s2"])
            sym_g.add_edge(rec["s1"], rec["s2"], sym=rec["sym"])

    q = qb.get_states(list(states), True)
    ase_dict = converter.query_to_ASE(driver, q)

    mappings = {}
    inter = {}

    def get_graph(s_id):
        g = graph_dict.get(s_id, None)
        if g is None:
            g = StateGraph(ase_dict[s_id], s_id)
            graph_dict[s_id] = g
        return g

    def get_intermediate_mapping(t):
        m = inter.get(t, None)
        if m is None:
            s1, s2 = t
            g1 = get_graph(s1)
            g2 = get_graph(s2)
            m = g2.map_from(g1)
            inter[t] = m
        return m

    # get first state in sequence
    q = f"""MATCH (n:{run})-[r:{run}]->(:{run})
            WHERE r.sym = False
            RETURN n.id AS id ORDER BY r.timestep LIMIT 1;"""

    initial = None
    with driver.session() as session:
        res = session.run(q)
        initial = res.single()["id"]

    nodes = list(sym_g.nodes)
    for n in nodes:
        g = StateGraph(ase_dict[initial], initial)
        if n != initial:
            path = nx.shortest_path(sym_g, initial, n)
            graph_dict = {}
            map_list = []
            for j in range(len(path) - 1):
                this = path[j]
                nxt = path[j + 1]
                edge = sym_g.get_edge_data(this, nxt)

                if edge is None:
                    raise ValueError(f"Edge missing: {this} -> {nxt}")

                if edge["sym"]:
                    m = get_intermediate_mapping((this, nxt))
                    map_list.append(m)

            map_list.reverse()
            g = copy.deepcopy(get_graph(n))

            for m in map_list:
                new_labelling = nx.relabel_nodes(g.graph, m)
                g.graph = new_labelling

        mappings[n] = g

    with driver.session() as session:
        for state, g in mappings.items():
            label_objects = []
            for label, node in g.graph.nodes(data=True):
                label_objects.append(f"{{ id: {node['id']}, label: {label} }}")
            batch = f"[{','.join(label_objects)}]"
            q = f"""UNWIND {batch} AS row
            MATCH (a:Atom {{internal_id: row.id}})-[:PART_OF]->(:State {{id: {state}}})
            SET a.{run}_label = row.label;
            """
            session.run(q)

        q = f"MATCH (m:Metadata {{run: '{run}' }}) SET m.relabelled = true;"
        session.run(q)

    return mappings


def get_sequence(driver: neo4j.Driver, run: str, sym=False):
    sym_statement = ""
    if not sym:
        sym_statement = "WHERE r.sym = False"

    q = f"""MATCH (n:State:{run})-[r:{run}]->(:State:{run})
    {sym_statement}
    RETURN n.id as id
    ORDER BY r.timestep ASC;
    """
    sequence = []
    with driver.session() as session:
        result = session.run(q)
        sequence = result.value()

    if len(sequence) == 0:
        raise ValueError(f"Trajectory {run} not found.")

    return sequence


def get_transitions(driver: neo4j.Driver, run: str, sym=False):
    sym_statement = ""
    if not sym:
        sym_statement = "WHERE r.sym = False"

    q = f"""MATCH 
    (n:State:{run})-[r:{run}]->(n2:State:{run})
    {sym_statement}
    RETURN n.id as s1, n2.id as s2
    ORDER BY r.timestep ASC;
    """

    transition_list = []
    with driver.session() as session:
        result = session.run(q)
        for r in result:
            transition_list.append((r["s1"], r["s2"]))

    return transition_list


def simplify_transitions(t_list):
    c = []
    states = set()
    for t in t_list:
        s1, s2 = t
        states.add(s1)
        states.add(s2)
        if s1 > s2:
            c.append((s2, s1))
        else:
            c.append(t)
    return list(set(c)), list(states)


def center_atom_positions(a):
    p = a.get_positions()
    cm = np.mean(p, axis=0)
    return p - cm, cm


def kabsch(P, Q):
    H = P.T @ Q
    U, S, Vh = np.linalg.svd(H, full_matrices=True)
    return U @ np.diag([1, 1, np.linalg.det(U) * np.linalg.det(Vh)]) @ Vh


def align(s1, s2):
    """
    given two ASE atoms objects, `s1` and `s2`,
    aligns the positions of `s2` to `s1`.
    """

    s1c = copy.deepcopy(s1)
    s2c = copy.deepcopy(s2)

    r1, com1 = center_atom_positions(s1c)
    r2, com2 = center_atom_positions(s2c)

    R = kabsch(r2, r1)
    s2c.set_positions(r2 @ R + com2)
    return s2c


def pure_align(s1, s2):
    r1, com1 = center_atom_positions(s1)
    r2, com2 = center_atom_positions(s2)

    R = kabsch(r2, r1)
    return r2 @ R + com2


def distance_matrix(items, fn=lambda x, y: np.linalg.norm(y - x)):
    m = np.zeros((len(items), len(items)))
    idxes = np.triu_indices(len(items), k=1)
    for i, j in tqdm(zip(idxes[0], idxes[1]), total=len(idxes[0])):
        ri = items[i]
        rj = items[j]
        m[i, j] = fn(ri, rj)
    return m + m.T - np.diag(np.diag(m))


def distance_matrix_parallel(
    d, fn=lambda i, j, x, y: (i, j, np.linalg.norm(y - x)), num_processes=16, **kwargs
):
    m = np.zeros((len(d), len(d)))
    idxes = np.triu_indices(len(d), k=1)
    tasks = [(i, j, d[i], d[j], kwargs) for i, j in zip(idxes[0], idxes[1])]

    with Pool(processes=num_processes) as pool:
        pbar = tqdm(pool.imap_unordered(fn, tasks), total=len(tasks))
        for i, j, distance in pbar:
            m[i, j] = distance
            # pbar.set_description(f"{distance}")

    return m + m.T - np.diag(np.diag(m))  # return symmetric matrix


@typechecked
def states_to_graphs(
    state_list: Iterable[StateID], ase_dict: Dict[StateID, Atoms]
) -> Dict[StateID, StateGraph]:
    d = {}

    for s in tqdm(state_list):
        a = ase_dict[s]
        d[s] = StateGraph(a, s)
    return d


@typechecked
def transitions_to_graphs(
    transitions: Iterable[Transition],
    state_graphs: Dict[StateID, StateGraph],
) -> Dict[Transition, TransitionGraph]:
    """
    Converts a list or set of transitions and an ASE dict containing information
    for each state into a dictionary of graphs and transitions.

    :param transitions: List or set of transitions to convert.
    :param ase_dict: Dictionary of ASE information.
    :return: Returns a tuple of a graph dictionary and a transition graph dictionary.
    """

    d = {}
    for transition in tqdm(transitions):
        id1, id2 = transition
        s1g = state_graphs[id1]
        s2g = copy.deepcopy(state_graphs[id2])

        s2c = align(s1g.atoms, s2g.atoms)
        s2g.set_atoms(s2c)

        d[(id1, id2)] = TransitionGraph(s1g, s2g)

    return d


@typechecked
def build_graph_distance_matrix(
    graph_dict: Union[Dict[StateID, StateGraph], Dict[Transition, TransitionGraph]],
    weight: Optional[str] = None,
):
    """
    Builds a distance matrix based on the dictionary of graph objects provided.
    The matrix is ordered the same as the dictionary.

    :param graph_dict: The graphs to calculate distances for.
    :param weight: The label for the edge weights to use when calculating the distance.
    Providing None uses the connectivity of the graph as weights to the adjacency matrix.
    """
    specs = {}
    m = []
    dists = {}

    def get_cached_spectrum(id, g):
        spec = specs.get(id, None)
        if spec is None:
            spec = graphutils.im_spectrum(g.graph, weight)
            specs[id] = spec
        return spec

    def get_cached_distance(i, j, d1, d2):
        dist = dists.get((i, j), None)
        if dist is None:
            dist = graphutils.im_distance(d1, d2)
            dists[(i, j)] = dist
            dists[(j, i)] = dist
        return dist

    graph_list = graph_dict.values()
    for i, g in enumerate(graph_list):
        distances = []
        d1 = get_cached_spectrum(i, g)
        for j, g2 in enumerate(graph_list):
            d2 = get_cached_spectrum(j, g2)
            d = get_cached_distance(i, j, d1, d2)
            distances.append(d)
        m.append(distances)
    return m


# TODO: perhaps run on build_graph_distance_matrix finish?
def normalize_distance_matrix(m):
    """
    Normalizes the distance matrix input.

    :param m: Matrix to normalize.
    """
    df = pd.DataFrame(data=m).transpose()
    x = df.values
    min_max_scaler = preprocessing.MinMaxScaler()
    x_scaled = min_max_scaler.fit_transform(x)
    return pd.DataFrame(x_scaled)
