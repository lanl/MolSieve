#
# © 2025. Triad National Security, LLC. All rights reserved.
# This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
#
"""
Singleton wrapper around neo4j driver object.
"""

import neo4j
from typeguard import typechecked

from .config import config


@typechecked
class GraphDriver(object):

    __instance = None
    __driver = None

    def __new__(cls) -> neo4j.Driver:
        if cls.__instance is None:
            inst = cls.__instance = object.__new__(cls)
            inst.__driver = neo4j.GraphDatabase.driver(
                config.NEO4J_ADDRESS, auth=config.NEO4J_AUTH
            )
        return cls.__instance.__driver

    @classmethod
    def shutdown(cls):
        if cls.__instance:
            cls.__instance.__driver.close()
            cls.__instance = None
