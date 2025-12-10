import neo4j
import pytest

from neomd import converter
from neomd.graphs import StateGraph
from neomd.queries import Neo4jQueryBuilder


@pytest.fixture(autouse=True)
def qb():
    return Neo4jQueryBuilder(
        [
            ("State", "nano_pt", "State", "ONE-TO-ONE"),
            ("Atom", "PART_OF", "State", "MANY-TO-ONE"),
        ],
        ["Metadata"],
    )


@pytest.fixture
def driver():
    return neo4j.GraphDatabase.driver(
        "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
    )


@pytest.fixture
def atoms_dict(driver, qb):
    q = qb.get_states([1, 2, 3, 4], True)
    return converter.query_to_ASE(driver, q)


@pytest.fixture
def g(atoms_dict):
    return StateGraph(atoms_dict[1], 1)


@pytest.fixture
def g2(atoms_dict):
    return StateGraph(atoms_dict[2], 2)


# symmetric to g2
@pytest.fixture
def g3(atoms_dict):
    return StateGraph(atoms_dict[3], 3)


@pytest.fixture
def g4(atoms_dict):
    return StateGraph(atoms_dict[4], 4)
