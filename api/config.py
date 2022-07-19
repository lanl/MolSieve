#TODO add more skips, one for sequence + PCCA
class Config(object):                 
    IMPATIENT = True # serve json data stored locally; only rely on this for testing
    NEO4J_ADDRESS = "bolt://127.0.0.1:7687"
    NEO4J_AUTH = ("neo4j", "secret")
config = Config()
