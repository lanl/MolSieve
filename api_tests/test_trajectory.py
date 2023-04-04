import pytest

from api.graphdriver import GraphDriver
from api.trajectory import Trajectory


@pytest.fixture
def driver():
    return GraphDriver()


@pytest.fixture
def trajectory(driver):
    return Trajectory.load_sequence(driver, "nano_pt")


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
