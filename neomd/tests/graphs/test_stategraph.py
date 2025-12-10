import pytest


@pytest.mark.usefixtures("g", "g2")
def test_state_graph_sub(g, g2):
    t = g2 - g
    assert len(t.keys()) == 147

    g + t
    for n in g.graph.nodes:
        assert g.graph.nodes[n]["p_x"] - g2.graph.nodes[n]["p_x"] < 0.001
        assert g.graph.nodes[n]["p_y"] - g2.graph.nodes[n]["p_y"] < 0.001
        assert g.graph.nodes[n]["p_z"] - g2.graph.nodes[n]["p_z"] < 0.001


@pytest.mark.usefixtures("g2", "g3", "g4")
def test_remapping_iso(g2, g3, g4):
    g2 << g3
    g3 << g2

    t = g4 - g2
    g2 + t
    for n in g2.graph.nodes:
        assert g2.graph.nodes[n]["p_x"] - g4.graph.nodes[n]["p_x"] < 0.001
        assert g2.graph.nodes[n]["p_y"] - g4.graph.nodes[n]["p_y"] < 0.001
        assert g2.graph.nodes[n]["p_z"] - g4.graph.nodes[n]["p_z"] < 0.001


@pytest.mark.usefixtures("g", "g2")
def test_remapping_not_iso(g, g2):
    with pytest.raises(ValueError):
        g2 << g

@pytest.mark.usefixtures("g")
def test_size(g):
    assert(g.size() == 147)

@pytest.mark.usefixtures("g")
def test_distance_matrix(g):
    print(g.get_distance_matrix())
