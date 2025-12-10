#
# © 2025. Triad National Security, LLC. All rights reserved.
# This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
#
import pytest

from api.graphdriver import GraphDriver
from api.trajectory import Trajectory


@pytest.fixture
def driver():
    return GraphDriver()


@pytest.fixture
def trajectory(driver):
    return Trajectory.load_sequence(driver, "nano_pt")

@pytest.fixture
def clustered_trajectory(driver, trajectory):
    trajectory.pcca(driver, 2, 20, None)
    trajectory.calculateIDToCluster()
    return trajectory

def test_load_sequence_on_nonexistent_trajectory(driver):
    with pytest.raises(ValueError, match="Trajectory test not found."):
        Trajectory.load_sequence(driver, "test")

def test_unique_states(trajectory, driver):
    # strangely, it seems that canonical representations are also referred to as nano_pt
    q = """MATCH (n:State:nano_pt)-[:nano_pt]->(:nano_pt)
            WITH count(DISTINCT n) as unique_state_count
            RETURN unique_state_count;
        """

    unique_state_count = 0
    with driver.session() as session:
        result = session.run(q)
        unique_state_count = result.single().value()

    assert unique_state_count == len(trajectory.unique_states)


def test_sequence(trajectory, driver):
    q = """MATCH (:State:nano_pt)-[r:nano_pt]->(:nano_pt)
           RETURN max(r.timestep) as timestep
    """

    last_timestep = 0
    with driver.session() as session:
        result = session.run(q)
        last_timestep = result.single().value()

    assert last_timestep == len(trajectory.sequence) - 1

# TODO: make this more robust
def test_simplify_sequence(clustered_trajectory):
    clustered_trajectory.simplify_sequence(0.75)
    
    # make sure chunks are continuous
    continuous = True
    for i in range(0, len(clustered_trajectory.chunks) - 1):
        if clustered_trajectory.chunks[i]['last'] + 1 != clustered_trajectory.chunks[i+1]['timestep']:
            print(f"{clustered_trajectory.chunks[i]['last']} {clustered_trajectory.chunks[i+1]['timestep']}")   
            continuous = False
        
    assert continuous
