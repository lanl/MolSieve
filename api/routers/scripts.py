"""
Module for accessing script information.
"""
import os

from fastapi import APIRouter

from ..utils import get_script_properties_map

router = APIRouter(prefix="/scripts", tags=["scripts"])


@router.get("/properties")
def script_properties():
    """
    Gets the properties of each script within the scripts folder.

    :returns List[str]: A list of properties within the scripts.
    """
    properties_to_script = get_script_properties_map()
    return list(properties_to_script.keys())


@router.get("/visual")
def visual_scripts():
    """
    Gets the names of the visualization scripts placed in the vis_scripts folder.
    :returns List[str]: A list of visualization script names.
    """
    scripts = []
    with os.scandir("vis_scripts") as entries:
        for entry in entries:
            _, ext = os.path.splitext(entry)
            if ext == ".py":
                scripts.append(entry.name)
    return scripts
