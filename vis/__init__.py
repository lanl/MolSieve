import os
from flask import (render_template, Flask,jsonify)
from neomd import querybuilder
import py2neo

def create_app(test_config=None):
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'flaskr.sqlite'),
    )

    if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
    else:
        # load the test config if passed in
        app.config.from_mapping(test_config)

    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # a simple page that says hello
    @app.route('/')
    def home():
        return render_template('home.html')

    @app.route('/load_dataset', methods=['GET'])
    def load_dataset():
        
        qb = querybuilder.Neo4jQueryBuilder([('State','NEXT','State','ONE-TO-ONE'),
                                             ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')])

        graph = py2neo.Graph("bolt://127.0.0.1:7687", auth=("neo4j", "secret"))
        q = """MATCH (s:State)-[r:NEXT]->(s2:State) 
               return s.number as number, r.timestep as timestep ORDER BY timestep ASC LIMIT 2500"""
        
        j = jsonify(graph.run(q).data())
        return j
    
    @app.route('/generate_subsequences', methods=['GET'])
    def generate_subsequences():
        raise NotImplementedError("Function not yet implemented.")

    return app
