"""
Allows the back-end to offload tasks to celery.
"""
from celery.result import AsyncResult
from celery.utils import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..background_worker.celery import TASK_COMPLETE, celery
from ..connectionmanager import ConnectionManager

router = APIRouter(prefix="/worker", tags=["worker"])

cm = ConnectionManager()  # websocket manager for tasks that are currently running
unprocessed = {}  # dictionary of tasks that have not been sent to Celery yet


@router.websocket("/ws/{task_id}")
async def ws(task_id: str, websocket: WebSocket):
    """
    Once a celery task is requested with a POST request, the
    client connects to this websocket to watch its progress and recieve data.

    :param task_id: The task to follow.
    :param websocket: The websocket object.
    """
    await cm.connect(task_id, websocket)
    # get the task's parameters, send it off
    task_params = unprocessed[task_id]
    celery.send_task(task_params["name"], kwargs=task_params["params"], task_id=task_id)
    try:
        await websocket.receive()
    except WebSocketDisconnect:
        await cm.disconnect(task_id)


@router.post("/update_task/{task_id}")
async def update_task(task_id: str, data: dict):
    """
    Used by celery to update the task's progress, since the celery back-end is a seperate process.

    :param task_id: The task to update.
    :param data: The data to send.
    """
    if task_id in cm.active_connections:
        if data["type"] == TASK_COMPLETE:
            result = AsyncResult(task_id, app=celery)
            if result.ready():
                data = result.get()
                await cm.send(task_id, {"type": TASK_COMPLETE})
                await cm.disconnect(task_id)
        else:
            await cm.send(task_id, data)


def add_task_to_queue(name, params):
    """
    Requests in other routers can use this method to queue work and calculations.
    Ideally, heavy tasks should be performed by Celery and easier tasks by FastAPI.
    Additionally, beware of using non-serializable objects as parameters here, their
    methods will be lost upon getting sent to Celery.
    
    :param name str: The name of the background task to fulfill.
    :param params Dict[str,Any]: The parameters for that function.

    :returns int: The task's ID, which the client will use toconnect to the websocket and fetch the data.
    """
    task_id = uuid()
    unprocessed.update({task_id: {"name": name, "params": params}})
    return task_id
