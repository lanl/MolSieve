#
# © 2025. Triad National Security, LLC. All rights reserved.
# This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
#
import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient

from api.main import app

client = TestClient(app)


# TODO: figure out how to test, all tests need to be more robust
"""
def test_load_properties_for_subset():
    c = TestClient(app) 
    with c.websocket_connect("/data/load_properties_for_subset") as ws:
        ws.send_json({'stateIds': [1,2,3,4,5], 
                      'props': ['CommonNeighborAnalysis_counts_HCP', 'AtomCount'],
                      'chunkSize': 100})
        data = ws.receive_json()
        print(data)
"""

@pytest.mark.anyio
async def test_generate_ovito_image():
    async with AsyncClient(app=app, base_url="http://localhost:8000") as ac:
        r = await ac.get("/data/generate_ovito_image", params={'id': 5, 'visScript': 'default.py'})
    assert r.status_code == 200

def test_get_trajectories():
    r = client.get("/data/list_trajectories")
    assert r.status_code == 200

def test_get_sequence():
    r = client.get("/data/get_sequence", params={'run': 'nano_pt', 'start': 1, 'end': 100}) 
    assert r.status_code == 200

def test_load_trajectory():
    r = client.get("/data/load_trajectory", params={'run': 'nano_pt', 'mMin': 2, 'mMax': 20, 'chunkingThreshold': 0.75})
    assert r.status_code == 200

def test_load_trajectory_set_clustering():
    r = client.get("/data/load_trajectory", params={'run': 'nano_pt', 'mMin': 2, 'mMax': 20, 'chunkingThreshold': 0.75, 'numClusters': 4})
    assert r.status_code == 200

