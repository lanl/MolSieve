import logging
import os

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import data, calculate, worker
from .utils import get_script_properties_map

os.environ["OVITO_THREAD_COUNT"] = "1"
os.environ["DISPLAY"] = ""

trajectories = {}

app = FastAPI()

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix="/api")
app.include_router(data.router)
app.include_router(calculate.router)
app.include_router(worker.router)
logging.basicConfig(filename="molsieve.log", level=logging.INFO)


# place in scripts route
@router.get("/script_properties")
def script_properties():
    """
    Gets the properties of each script within the scripts folder.

    :returns List[str]: A list of properties within the scripts.
    """
    properties_to_script = get_script_properties_map()
    return list(properties_to_script.keys())


# place in scripts route
@router.get("/vis_scripts")
def vis_scripts():
    """
    Gets the names of the visualization scripts placed in the vis_scripts folder.
    :returns List[str]: A list of visualization script names.
    """
    scripts = []
    with os.scandir("vis_scripts") as entries:
        for entry in entries:
            root, ext = os.path.splitext(entry)
            if ext == ".py":
                scripts.append(entry.name)
    return scripts


app.include_router(router)
