class Config(object):                 
    NEO4J_ADDRESS = "bolt://127.0.0.1:7687"
    NEO4J_AUTH = ("neo4j", "secret")
    save_cache = False
    load_cache = False


config = Config()
