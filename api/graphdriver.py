"""
Singleton wrapper around neo4j driver object.
"""

import neo4j
from .config import config


class GraphDriver(object):

    __instance = None
    __driver = None

    def __new__(cls):
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
