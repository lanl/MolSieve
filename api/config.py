from pydantic import BaseSettings

class Config(object):                 
    IMPATIENT = False # serve json data stored locally; only rely on this for testing

config = Config()
