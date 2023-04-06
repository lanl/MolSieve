from celery.result import AsyncResult
from celery.utils import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..background_worker.celery import TASK_COMPLETE, celery
from ..connectionmanager import ConnectionManager

router = APIRouter(prefix="/worker", tags=["worker"])
cm = ConnectionManager()
unprocessed = {}


@router.post("/update_task/{task_id}")
async def update_task(task_id: str, data: dict):
    if task_id in cm.active_connections:
        if data["type"] == TASK_COMPLETE:
            result = AsyncResult(task_id, app=celery)
            if result.ready():
                data = result.get()
                await cm.send(task_id, {"type": TASK_COMPLETE})
                await cm.disconnect(task_id)
        else:
            await cm.send(task_id, data)


@router.websocket("/ws/{task_id}")
async def ws(task_id: str, websocket: WebSocket):
    await cm.connect(task_id, websocket)
    # get the task's parameters, send it off
    task_params = unprocessed[task_id]
    celery.send_task(task_params["name"], kwargs=task_params["params"], task_id=task_id)
    try:
        await websocket.receive()
    except WebSocketDisconnect:
        await cm.disconnect(task_id)


def add_task_to_queue(name, params):
    task_id = uuid()
    unprocessed.update({task_id: {"name": name, "params": params}})
    return task_id
