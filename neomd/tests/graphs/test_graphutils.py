from neomd.graphs import graphutils
import pytest


@pytest.mark.usefixtures("g", "g2")
def test_calculate_connectivity_difference_all(g, g2):
    print(graphutils.calculate_connectivity_difference(g, g2, 0))


@pytest.mark.usefixtures("g", "g2")
def test_calculate_connectivity_difference(g, g2):
    print(graphutils.calculate_connectivity_difference(g, g2, 0.2))


@pytest.mark.usefixtures("g", "g2")
def test_calculate_rel_bond_delta(g, g2):
    print(graphutils.calculate_rel_bond_delta(g, g2))
