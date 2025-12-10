import pytest

from neomd.graphs import StateGraph
from neomd.graphs import TransitionGraph


@pytest.mark.usefixtures("g", "g2")
def test_build_graph(g, g2):
    b = TransitionGraph(g, g2)
    assert len(b.graph.nodes) == len(g.graph.nodes) + len(g2.graph.nodes)
    c = 0
    for e in b.graph.edges:
        edge = b.graph.edges[e]
        if "moved" in edge:
            if edge["moved"] == 1:
                c += 1
        if "weighted_distance" in edge:
            print(edge["weighted_distance"])
    print("changed", c)
    print(b.get_moved())

@pytest.mark.usefixtures("g", "g2", "g3", "g4")
def test_build_graph_multi(g, g2, g3, g4):
    b = TransitionGraph(g, g2, g3, g4)
    assert len(b.graph.nodes) == len(g.graph.nodes) + len(
        g2.graph.nodes
    ) + len(g3.graph.nodes) + len(g4.graph.nodes)
