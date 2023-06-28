class Config(object):
    NEO4J_ADDRESS = "bolt://127.0.0.1:7687"
    NEO4J_AUTH = ("neo4j", "secret")
    SAVE_CACHE = True
    LOAD_CACHE = True
    SIZE_THRESHOLD = 250


config = Config()
