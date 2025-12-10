#
# © 2025. Triad National Security, LLC. All rights reserved.
# This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
#
import pytest

from neomd import converter


@pytest.mark.usefixtures("driver", "qb")
def test_query_to_ASE_with_path(driver, qb):
    q = qb.generate_get_path(305, 310, "nano_pt", "timestep")

    state_atom_dict = converter.query_to_ASE(driver, q)
    atoms = list(state_atom_dict.values())

    # should be IDs 34, 35 and 95
    assert len(atoms) == 3
    assert (
        all(list(map(lambda a: (a.symbols == "Pt147").all(), atoms))) is True
    )


@pytest.mark.usefixtures("driver", "qb")
def test_query_to_ASE_with_list(driver, qb):
    q = qb.get_states([1, 2, 3], True)

    state_atom_dict = converter.query_to_ASE(driver, q)
    atoms = list(state_atom_dict.values())

    # should be IDs 34, 35 and 95
    assert len(atoms) == 3
    assert (
        all(list(map(lambda a: (a.symbols == "Pt147").all(), atoms))) is True
    )


@pytest.mark.usefixtures("driver", "qb")
def test_ase_to_query(driver, qb):
    q = qb.get_states([1, 2, 3], True)
    state_atom_dict = converter.query_to_ASE(driver, q)
    atom = list(state_atom_dict.values())[0]
    counter = converter.ase_to_neo4j(driver, ["NEB"], atom)

    q = qb.get_states([counter], True)
    state_atom_dict2 = converter.query_to_ASE(driver, q)
    atom2 = list(state_atom_dict2.values())[0]

    assert (atom.symbols == atom2.symbols).all()
