from fastapi import WebSocket
from typing import Dict,Any

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
