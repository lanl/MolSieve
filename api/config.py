from pydantic import BaseSettings

class Config(object):                 
    IMPATIENT = True # serve json data stored locally; only rely on this for testing

config = Config()
