import os
import json

from flask import (render_template, Flask, jsonify, request)
from neomd import querybuilder, calculator, converter
import neo4j
import hashlib
import numpy as np
from pydivsufsort import divsufsort, kasai, most_frequent_substrings, sa_search
import jsonpickle
from .epoch import Epoch, calculate_epoch
import pyemma
import pygpcca as gp



# https://stackoverflow.com/questions/57269741/typeerror-object-of-type-ndarray-is-not-json-serializable
class NumpyEncoder(json.JSONEncoder):
    """ Special json encoder for numpy types """
    def default(self, obj):
        if isinstance(obj,
                      (np.int_, np.intc, np.intp, np.int8, np.int16, np.int32,
                       np.int64, np.uint8, np.uint16, np.uint32, np.uint64)):
            return int(obj)
        elif isinstance(obj, (np.float_, np.float16, np.float32, np.float64)):
            return float(obj)
        elif isinstance(obj, (np.ndarray, )):
            return obj.tolist()
        return json.JSONEncoder.default(self, obj)

def create_app(test_config=None):
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)

    # set this to your lammps path
    lammps_path = 'mpirun -n 4 /home/frosty/Apps/lammps/install/bin/lmp'

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

    @app.route('/')
    def home():
        return render_template('home.html')

    # TODO: rename to load sequence or load trajectory
    @app.route('/load_dataset', methods=['GET'])
    def load_dataset():
        run = request.args.get('run')
        properties = request.args.get('properties')
        # id is technically not a property, so we have to include it here
        # everything else is dynamically loaded in
        node_attributes = [('id', 'first')]
        if properties != "":
            properties = properties.split(',')
            for prop in properties:
                node_attributes.append((prop, 'first'))
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        qb = querybuilder.Neo4jQueryBuilder(
            [('State', 'NEXT', 'State', 'ONE-TO-ONE'),
             ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')],
            constraints=[("RELATION", "NEXT", "run", run, "STRING")])

        q = qb.generate_trajectory("NEXT",
                                   "ASC", ['RELATION', 'timestep'],
                                   node_attributes=node_attributes,
                                   relation_attributes=['timestep'])
        oq = qb.generate_get_occurences("NEXT")
        with driver.session() as session:
            session.run(oq.text)
            result = session.run(q.text)
            j = jsonify(result.data())

        return j

    @app.route('/calculate_epochs', methods=['GET'])
    def calculate_epochs():
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        run = request.args.get('run')
        qb = querybuilder.Neo4jQueryBuilder(
            [('State', 'NEXT', 'State', 'ONE-TO-ONE'),
             ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')],
            constraints=[("RELATION", "NEXT", "run", run, "STRING")])

        q = qb.generate_trajectory("NEXT",
                                   "ASC", ['RELATION', 'timestep'],
                                   node_attributes=[('number', "FIRST")],
                                   relation_attributes=['timestep'])

        traj = None
        with driver.session() as session:
            result = session.run(q.text)
            traj = result.data()

        epoch = calculate_epoch(traj, 0)

        return jsonpickle.encode(epoch)

    @app.route('/connect_to_db', methods=['GET'])
    def connect_to_db():
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        j = {}
        with driver.session() as session:
            try:
                result = session.run(
                    "MATCH (:State)-[r]-(:State) RETURN DISTINCT r.run;")
                # gets rid of ugly syntax on js side - puts everything in one array; probably a better more elegant way to do this
                j.update({'runs': [r[0] for r in result.values()]})
                result = session.run(
                    "MATCH (n:State) with n LIMIT 1 UNWIND keys(n) as key RETURN DISTINCT key;"
                )
                j.update({'properties': [r[0] for r in result.values()]})
            except neo4j.exceptions.ServiceUnavailable as exception:
                raise exception

        return jsonify(j)


    #TODO: Refactor to be cleaner
    @app.route('/pcca', methods=['GET'])
    def pcca():
        run = request.args.get('run')
        clusters = int(request.args.get('clusters'))
        optimal = int(request.args.get('optimal'))
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        qb = querybuilder.Neo4jQueryBuilder(
            schema=[("State", "NEXT", "State", "ONE-TO-ONE"),
                    ("Atom", "PART_OF", "State", "MANY-TO-ONE")],
            constraints=[("RELATION", "NEXT", "run", run, "STRING")])
        m, idx_to_state_number = calculator.calculate_transition_matrix(
            driver, qb, True)
        gpcca = gp.GPCCA(np.array(m), z='LM', method='brandts')
        j = {}
        sets = {}
        fuzzy_memberships = {}    
        if optimal == 1:
            m_min = int(request.args.get('m_min'))
            m_max = int(request.args.get('m_max'))
            try:
                gpcca.optimize({'m_min': m_min, 'm_max': m_max})
                j.update({'optimal_value': gpcca.n_m})

                feasible_clusters = []
                for cluster_idx, val in enumerate(gpcca.crispness_values):
                    if val != 0:
                        feasible_clusters.append(cluster_idx + m_min)
                        # we still want the clustering...
                        gpcca.optimize(cluster_idx + m_min)
                        clusterings = []
                        for s in gpcca.macrostate_sets:
                            newSet = []
                            for i in s:
                                newSet.append(idx_to_state_number[i])
                            clusterings.append(newSet)
                        sets.update({cluster_idx + m_min: clusterings})
                        fuzzy_memberships.update({cluster_idx + m_min: gpcca.memberships.tolist()})
                j.update({'feasible_clusters': feasible_clusters})
            except ValueError as exception:
                print(exception)
                return {'status': 500, 'Error': str(exception)}, 500
        else:
            try:
                gpcca.optimize(clusters)
                clusterings = []
                for s in gpcca.macrostate_sets:
                    newSet = []
                    for i in s:
                        newSet.append(idx_to_state_number[i])
                    clusterings.append(newSet)
                sets.update({clusters: clusterings})
                fuzzy_memberships.update({clusters: gpcca.memberships.tolist()})
            except ValueError as exception:
                print(exception)
                return {'status': 500, 'Error': str(exception)}, 500
            
        j.update({'sets': sets})
        j.update({'fuzzy_memberships': fuzzy_memberships})

        # TODO: add as metadata in vis
        # j.update({'dominant_eigenvalues': gpcca.dominant_eigenvalues.tolist()})
        # j.update({'minChi': gpcca.minChi(m_min, m_max)})

        return jsonify(j)

    #TODO
    @app.route('/generate_ovito_image', methods=['GET'])
    def generate_ovito_image():
        run = request.args.get('run')
        sequences = request.args.get('sequences')
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        qb = querybuilder.Neo4jQueryBuilder(
            schema=[("State", "NEXT", "State", "ONE-TO-ONE"),
                    ("Atom", "PART_OF", "State", "MANY-TO-ONE")],
            constraints=[("RELATION", "NEXT", "run", run, "STRING")])
        if len(sequences) > 1:
            q = qb.generate_get_path()
            # TODO: start with modifying neomd to return the correct path
            # once that is done, figure out how to get images from the backend
            # and pass in the sequence
        else:
            raise NotImplementedError()

    @app.route('/neb_on_path', methods=['GET'])
    def neb_on_path():
        run = request.args.get('run')
        start = request.args.get('start')
        end = request.args.get('end')
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        qb = querybuilder.Neo4jQueryBuilder(
            schema=[("State", "NEXT", "State", "ONE-TO-ONE"),
                    ("Atom", "PART_OF", "State", "MANY-TO-ONE")],
            constraints=[("RELATION", "NEXT", "run", run, "STRING")])

        q = qb.generate_get_path(start,
                                 end,
                                 relation="NEXT",
                                 limit=1,
                                 optional_relations="PART_OF",
                                 returnRelationships=True)
        state_atom_dict, relationList = converter.query_to_ASE(
            driver, q, True)
        relation_list = calculator.calculate_neb_on_path(
            driver, state_atom_dict, relationList, qb, lammps_path)

    return app
