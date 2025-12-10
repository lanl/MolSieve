#
# © 2025. Triad National Security, LLC. All rights reserved.
# This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
#
import functools

import pytest

from neomd.queries.neo4j_types import Neo4jAlias, Neo4jNode, Neo4jRelation
from neomd.queries.statement import MatchStatement, Statement, WithStatement


def render(*_):
    pass


def with_render(e_list, next_list):
    def ids(arr):
        return list(map(lambda e: e.id, arr))

    return ids(e_list) + ids(next_list)


def render_all(e_list, s_list):
    entities = {}
    for i in range(0, len(s_list)):
        s = s_list[i]
        t = s.render(e_list, s_list, i)
        if t is not None:
            entities[i] = t

    return entities


def get_all_ids(e_dict):
    return list(functools.reduce(lambda a, b: a + b, e_dict.values()))


@pytest.fixture
def entities():
    n = Neo4jNode("n", "Node")
    n.id = 1

    n2 = Neo4jNode("n2", "Node")
    n2.id = 2

    r = Neo4jRelation("r", n, "relates", n2, "ONE-TO-ONE")
    r.id = 3

    m = Neo4jNode("m", "SmallNode")
    m.id = 4

    c = Neo4jRelation("c", m, "composes", n, "MANY-TO-ONE")
    c.id = 5

    m_list = Neo4jAlias("m_list", "init")
    m_list.id = 6

    return {1: n, 2: n2, 3: r, 4: m, 5: c, 6: m_list}


@pytest.fixture
def statements1(entities):
    # Match statement alone
    return [MatchStatement(entities[1], render)]


# these functions test if match statements properly bind to future variables
def test_match_statement_bind_no_following(entities, statements1):
    render_all(entities, statements1)

    for e in entities.values():
        assert e.bound is False


@pytest.fixture
def statements2(entities, statements1):
    # Match statement followed by a bind
    return statements1 + [Statement(entities[1], render)]


def test_match_statement_bind_with_following(entities, statements2):
    render_all(entities, statements2)

    assert entities[1].bound is True
    assert entities[2].bound is False
    assert entities[3].bound is False


@pytest.fixture
def statements3(entities, statements1):
    # Statement followed by Match
    return [Statement(entities[1], render)] + statements1


def test_match_statement_as_last(entities, statements3):
    render_all(entities, statements3)

    for e in entities.values():
        assert e.bound is False


# these functions test with statement binding
@pytest.fixture()
def statements4(entities):
    return [
        MatchStatement([entities[4], entities[5], entities[1]], render),
        WithStatement([entities[6]], with_render),
        Statement([entities[6], entities[1]], render),
    ]


def test_with_statement(entities, statements4):
    w_entities = render_all(entities, statements4)
    ids = get_all_ids(w_entities)
    assert 6 in ids  # should be the alias
    assert 1 in ids  # should be the node


@pytest.fixture()
def statements5(entities):
    return [
        MatchStatement([entities[4], entities[5], entities[1]], render),
        WithStatement([], with_render),
        Statement([entities[2]], render),
    ]


def test_with_statement_no_nodes_to_pass(entities, statements5):
    w_entities = render_all(entities, statements5)
    ids = get_all_ids(w_entities)
    assert len(ids) == 0


@pytest.fixture()
def statements6(entities):
    return [
        MatchStatement([entities[4], entities[5], entities[1]], render),
        WithStatement([], with_render),
        Statement([entities[4]], render),
        WithStatement([entities[6]], with_render),
        Statement([entities[4], entities[6]], render),
    ]


def test_multiple_conflicting_with_statements(entities, statements6):
    w_entities = render_all(entities, statements6)
    assert 4 in w_entities[1]
    assert 4 in w_entities[3]
    assert 6 in w_entities[3]
