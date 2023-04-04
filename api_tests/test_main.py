import pytest
from api.main import load_sequence
from api.graphdriver import GraphDriver


def test_load_sequence_on_nonexistent_trajectory():
    with pytest.raises(ValueError, match="Trajectory test not found."):
        load_sequence('test')


@pytest.fixture
def driver():
    return GraphDriver()


@pytest.fixture
def trajectory():
    return load_sequence('nano_pt')


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
         RETURN r.timestep as timestep
         ORDER BY r.timestep DESC;
    """

    last_timestep = 0
    with driver.session() as session:
        result = session.run(q)
        last_timestep = result.single().value()

    assert last_timestep == len(trajectory.sequence) - 1
