"""
Singleton wrapper around pymemcache client object.
"""

from pymemcache.client.base import Client
from pymemcache import serde
from typeguard import typechecked
from .config import config


@typechecked
class MemcachedClient(object):

    __instance = None
    __client = None

    def __new__(cls):
        if cls.__instance is None:
            inst = cls.__instance = object.__new__(cls)
            inst.__client = Client("localhost", serde=serde.pickle_serde)
        return cls.__instance.__client
