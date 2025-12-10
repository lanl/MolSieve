#
# © 2025. Triad National Security, LLC. All rights reserved.
# This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
#
from typing import Any, Dict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, key: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.update({key: websocket})

    async def disconnect(self, key: str):
        websocket = self.active_connections.pop(key, None)
        if websocket:
            await websocket.close()

    async def send(self, key: str, data: dict):
        websocket = self.active_connections[key]
        await websocket.send_json(data)

    async def disconnectAll(self):
        self.active_connections = {}

    async def broadcast(self, message: Any):
        for connection in self.active_connections.values():
            await connection.send_json(message)
