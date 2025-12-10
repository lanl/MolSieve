import copy

import pytest

from neomd import calculator, converter
from neomd.graphs import StateGraph, bipartite


@pytest.mark.usefixtures("atoms_dict")
@pytest.fixture
def atoms_object(atoms_dict):
    return list(atoms_dict.values())[0]


def get_result(driver, q):
    with driver.session() as session:
        result = session.run(q.text)
        for r in result:
            print(r)


@pytest.mark.usefixtures("atoms_dict")
def test_apply_ovito_pipeline_modifier(atoms_dict):
    attrs = calculator.apply_ovito_pipeline_modifier(
        atoms_dict, "CommonNeighborAnalysisModifier"
    )
    assert len(attrs.keys()) == 3


@pytest.mark.usefixtures("driver")
def test_calculate_transition_matrix(driver):
    m, _ = calculator.calculate_transition_matrix(driver, "nano_pt")

    allOne = m.sum(axis=1).all()
    assert allOne


@pytest.mark.usefixtures("driver")
def test_canonical_path(driver):
    path, _ = calculator.canonical_path(driver, "nano_pt", 308, 310)
    # make sure that path follows states logically
    continuous_path = True
    path_vals = list(path.values())
    for i in range(0, len(path_vals) - 1):
        if path_vals[i]["second"] != path_vals[i + 1]["first"]:
            continuous_path = False

    assert continuous_path

    # timestep 310 contains a symmetrical state
    assert path[310]["symmetry"] == 6


# add test to compare with original transitions
@pytest.mark.usefixtures("driver")
def test_relabel_trajectory(driver, qb):
    calculator.relabel_trajectory(driver, qb, "nano_pt")

    # start with getting all unique transitions from the db
    q = """MATCH (n:nano_pt)-[r:nano_pt]->(n2:nano_pt) WHERE r.sym = False
           RETURN n.id AS n1, n2.id AS n2 ORDER by n.id"""
    transitions = set()
    unique_states = set()
    with driver.session() as session:
        res = session.run(q)
        for r in res:
            unique_states.add(r["n1"])
            unique_states.add(r["n2"])
            transitions.add((r["n1"], r["n2"]))

    unique_transitions = copy.deepcopy(transitions)
    for t in transitions:
        s1, s2 = t
        for t_2 in transitions:
            if t != t_2:
                t_2s1, t_2s2 = t_2
                if s2 == t_2s1 and t_2s2 == s1:
                    unique_transitions.remove(t_2)

    q = qb.get_states(list(unique_states), True, order_by="nano_pt_label")
    ase_dict = converter.query_to_ASE(driver, q)

    b_list = []
    graph_dict = {}
    for transition in unique_transitions:
        id1, id2 = transition
        s1 = graph_dict.get(id1, None)
        s2 = graph_dict.get(id2, None)
        if s1 is None:
            s1 = StateGraph(ase_dict[id1], id1)
            graph_dict[id1] = s1

        if s2 is None:
            s2 = StateGraph(ase_dict[id2], id2)
            graph_dict[id2] = s2

        b = bipartite.build(s1, s2)
        b_list.append(b)

    counts = []
    for b in b_list:
        c = 0
        for e in b.edges:
            edge = b.edges[e]
            if "moved" in edge:
                if edge["moved"] == 1:
                    c += 1
        counts.append(c)
    no_full = 0
    for c in counts:
        if c != 147:
            no_full += 1

    assert len(counts) == no_full
