import base64
import io
import os
import pickle
from typing import Any, Dict, List

# image rendering
from PIL import Image
from typeguard import typechecked

from .config import config


def remove_duplicates(arr: List[Any]):
    return list(set(arr))


def find_missing_properties(
    data: List[Dict[str, Any]], identifier: str = "id"
) -> Dict[str, List[Any]]:
    """
    Given a list of dictionaries (objects) iterate through each object and find
    all objects that have None assigned to a property.

    :param data: The list of objects to check.
    :param identifier: What is used to uniquely identify each object, placed in resulting dictionary.

    :returns Dict[str, List[Any]]: A dictionary of properties to lists of object identifiers that are missing that property.
    """
    missing_properties = {}
    for d in data:
        for key, value in d.items():
            if value is None:
                if key not in missing_properties:
                    missing_properties[key] = []
                missing_properties[key].append(d[identifier])

    return missing_properties


def qImage_to_string(qimg) -> str:
    """
    Converts a qImage object to a string that can be returned as part of a request.

    :param qimg: The qImage object to convert.
    :returns str: base64 encoding of the resulting image
    """

    img = Image.fromqimage(qimg)
    rawBytes = io.BytesIO()
    img.save(rawBytes, "PNG")
    rawBytes.seek(0)
    img_base64 = base64.b64encode(rawBytes.read())

    image_string = str(img_base64)
    image_string = image_string.removesuffix("'")
    image_string = image_string.removeprefix("b'")
    return image_string


def get_script_properties_map(folder: str = "scripts") -> Dict[str, str]:
    """
    Read all of the scripts within the scripts folder, then get the properties that they will return.
    :returns Dict[str, str]: A dictionary mapping each property to its script.
    """

    properties_to_script = {}
    with os.scandir(folder) as entries:
        for entry in entries:
            _, ext = os.path.splitext(entry)
            if ext == ".py":
                with open(entry.path, mode="r") as script:
                    code = script.read()
                # puts properties in global namespace
                exec(code, globals())
                for prop in properties():
                    properties_to_script[prop] = entry.name

    return properties_to_script


@typechecked
def get_script_code(script_name: str, folder: str = "scripts") -> str:
    """
    Get the actual code for the script within the folder specified.

    :param script_name str: Name of script to retrieve.
    :param folder str: Name of folder to check.
    :raises FileNotFoundError: Complain if file does not exist.

    :returns str: A string containing the script's code.
    """
    with os.scandir(folder) as entries:
        for entry in entries:
            if entry.name == script_name:
                with open(entry.path, mode="r") as script:
                    return script.read()
        raise FileNotFoundError


@typechecked
def get_atom_type(parameters: Dict[str, str]) -> str:
    """
    Gets the atom type of the trajectory from the metadata.

    :param parameters: Dictionary of parameters calculated from the LAMMPS bootstrap script.
    :raises ValueError: Complain if pair_coeff not found.
    """
    if "pair_coeff" not in parameters.keys():
        raise ValueError("pair_coeff field not found in dictionary supplied.")
    return parameters["pair_coeff"][-1].split(" ")[-1]


@typechecked
def save_pickle(run: str, t: str, j: Any):
    """
    Saves the dictionary supplied into a pickle file for later use.

    :param run: name of the run you're saving
    :param t: name of the data you're saving
    :param j: value to save
    """

    if config.SAVE_CACHE:
        createDir("api/cache")

        with open(f"api/cache/{run}_{t}.pickle", "wb") as f:
            pickle.dump(j, f)


@typechecked
def createDir(path: str):
    """
    Creates a directory if it doesn't exist.

    :param path str: The name of the directory.
    """
    if not os.path.exists(path):
        os.mkdir(path)


@typechecked
def load_pickle(run: str, t: str) -> Any:
    """
    Loads the data saved from the specified pickle file.

    :param run: name of the run to load
    :param t: type of sequence you're loading
    :returns: data that was pickled
    """

    if config.LOAD_CACHE:
        try:
            with open(f"api/testing/{run}_{t}.pickle", "rb") as f:
                return pickle.load(f)
        except Exception:
            print(f"Calculating {run} {t} instead of using cached version.")
            return None
