from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_cluster_states():
    r = client.post("/calculate/cluster_states",
                json={"stateIds": [1623,1621,1618,1609,644], 
                      "props": ['CommonNeighborAnalysis_counts_HCP']})
    assert r.status_code == 200

def test_selection_distance():
    r = client.post("/calculate/selection_distance",
                json={"stateSet1": [1623,1621,1618,1609,644], 
                      "stateSet2": [611,650,649,640,639]})
    assert r.status_code == 200


# TODO: finish with actually running NEB
def test_neb_on_path():
    r = client.get("/calculate/neb_on_path",
                    params={'run': 'nano_pt',
                            'start': 305,
                            'end': 306})
    assert r.status_code == 201

    # id = r.content.decode('UTF-8') connect to websocket with this


# TODO: actually run subset connectivity difference
def test_subset_connectivity_difference():
    r = client.post("/calculate/subset_connectivity_difference",
                    json={"stateIDs": [1623, 1621, 1618, 1609, 644]})
    print(r.content) # fails for some reason with this list
    assert r.status_code == 201

    # id = r.content.decode('UTF-8') connect to websocket with this
