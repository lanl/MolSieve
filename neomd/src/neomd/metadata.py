#
# © 2025. Triad National Security, LLC. All rights reserved.
# This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
#
"""
Module that retrieves and manages metadata for each trajectory in the database.
"""

from typing import Any, Dict, List
from typing_extensions import LiteralString

import neo4j
from typeguard import typechecked

from neomd.queries import Neo4jQueryBuilder


@typechecked
def metadata_to_parameters(raw_metadata: str):
    """
    Converts metadata to parameters to use for LAMMPSRun parameters.

    :param raw_metadata str: The raw metadata to convert.

    :returns: The parameters as a dictionary.
    """
    parameters = {}
    for line in raw_metadata.splitlines():
        if line != "":
            (firstWord, rest) = line.split(maxsplit=1)
            # for some reason, pair_coeff needs to be a list
            if firstWord == "pair_coeff":
                rest = [rest]
            parameters.update({firstWord: rest})
    return parameters


@typechecked
def metadata_to_cmds(metadata_dict: Dict[str, Any]) -> List[str]:
    """
    Converts parameters to commands to use for LAMMPSLib's lmpcmds parameters.

    :param raw_metadata: The metadata dict to convert.

    :returns: The metadata as a list.
    """
    parameters = []
    parameters.append("pair_style {rest}".format(rest=metadata_dict["pair_style"]))
    parameters.append("pair_coeff {rest}".format(rest=metadata_dict["pair_coeff"][0]))
    return parameters


@typechecked
def get_metadata(driver: neo4j.Driver, run: str) -> Dict[str, Any]:
    """
    Get the metadata for a trajectory as a Python-readable dictionary.

    :param driver neo4j.Driver: Neo4j Driver to query.
    :param run str: Name of the trajectory

    :returns: Dictionary of metadata information
    """

    metadata = {}
    with driver.session() as session:
        result = session.run(f"MATCH (m:Metadata WHERE m.run = '{run}') RETURN m;")
        record = result.single()
        for n in record.values():
            for key, value in n.items():
                if key == "LAMMPSBootstrapScript":
                    params = metadata_to_parameters(value)
                    cmds = metadata_to_cmds(params)
                    metadata.update({"parameters": params})
                    metadata.update({"cmds": cmds})
                metadata.update({key: value})
    return metadata


def get_server_metadata(field: str) -> str:
    return f"OPTIONAL MATCH (m:ServerMetadata) RETURN m.{field} AS {field}"


def update_metadata(field: str) -> str:
    return f"MATCH (m:ServerMetadata) SET m.{field} = $value"


def get_counter(driver: neo4j.Driver, name: str) -> int:
    counter = 0
    with driver.session() as session:
        result = session.run(get_server_metadata(name))
        record = result.single()
        counter = record.value() if record.value() is not None else 0
    return counter


def update_counter(tx: neo4j.Transaction, name: str, value: int):
    # should be in a tx to avoid data inconsistency
    tx.run(update_metadata(name), value=value)


def retrieve_potentials_file(driver: neo4j.Driver, run: str):
    """
    Grabs the potentials file from the database, dumps it into a file,
    and returns a path to the file for use
    with the LAMMPS_POTENTIALS environment variable.

    :param driver: Driver with connection to database
    :param run: Name of the run to retrieve the potentials file for.
    """

    qb = Neo4jQueryBuilder(nodes=["Metadata"])
    q = qb.get_potential_file(run)

    filename = None
    raw = None
    with driver.session() as session:
        result = session.run(q.text)
        for record in result.data():
            filename = record["potentialFileName"]
            raw = record["potentialFileRaw"]

    if filename is None or filename == "":
        raise ValueError("No potential file found.")

    if raw is None or raw == "":
        raise ValueError(f"Potential file is named {filename}, but contains no data.")

    potentials_file = open(filename, "w")
    potentials_file.write(raw)
    potentials_file.close()

    return filename
