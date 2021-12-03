import os
from flask import (render_template, Flask, jsonify, request)
from neomd import querybuilder, calculator
import neo4j
import hashlib
import numpy as np
from pydivsufsort import divsufsort, kasai, most_frequent_substrings, sa_search
import jsonpickle
from .epoch import Epoch, calculate_epoch
import pyemma
import pygpcca as gp
import json

# https://stackoverflow.com/questions/57269741/typeerror-object-of-type-ndarray-is-not-json-serializable
class NumpyEncoder(json.JSONEncoder):
    """ Special json encoder for numpy types """
    def default(self, obj):
        if isinstance(obj, (np.int_, np.intc, np.intp, np.int8,
                            np.int16, np.int32, np.int64, np.uint8,
                            np.uint16, np.uint32, np.uint64)):
            return int(obj)
        elif isinstance(obj, (np.float_, np.float16, np.float32,
                              np.float64)):
            return float(obj)
        elif isinstance(obj, (np.ndarray,)):
            return obj.tolist()
        return json.JSONEncoder.default(self, obj)


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

    @app.route('/')
    def home():
        return render_template('home.html')

    @app.route('/load_dataset', methods=['GET'])
    def load_dataset():
        run = request.args.get('run')
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "secret"))
        qb = querybuilder.Neo4jQueryBuilder([
            ('State', 'NEXT', 'State', 'ONE-TO-ONE'),
            ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')
        ], constraints=[("RELATION", "NEXT", "run", run, "STRING")])
        
        q = qb.generate_trajectory("NEXT", "ASC", ['RELATION', 'timestep'], node_attributes=[('number', 'first'), ('occurences', 'first'), ('id', 'first')], relation_attributes=['timestep'])
        oq = qb.generate_get_occurences("NEXT")
        with driver.session() as session:
            session.run(oq.text)
            result = session.run(q.text)
            j = jsonify(result.data())
        
        return j

    @app.route('/calculate_epochs', methods=['GET'])
    def calculate_epochs():
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "secret"))
        run = request.args.get('run')
        qb = querybuilder.Neo4jQueryBuilder([
            ('State', 'NEXT', 'State', 'ONE-TO-ONE'),
            ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')
        ],constraints=[("RELATION", "NEXT", "run", run, "STRING")])
        
        q = qb.generate_trajectory("NEXT", "ASC", ['RELATION', 'timestep'], node_attributes=[('number', "FIRST")], relation_attributes=['timestep'])

        traj = None
        with driver.session() as session:
            result = session.run(q.text)
            traj = result.data()

        epoch = calculate_epoch(traj, 0)

        return jsonpickle.encode(epoch)

    @app.route('/connect_to_db', methods=['GET'])
    def connect_to_db():
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "secret"))
        result = None
        with driver.session() as session:
            try:
                result = session.run("MATCH (:State)-[r]-(:State) return DISTINCT r.run;")
                return jsonify(result.values())
            except neo4j.exceptions.ServiceUnavailable as exception:
                raise exception

    @app.route('/pcca', methods=['GET'])
    def pcca():
        run = request.args.get('run')
        clusters = request.args.get('clusters')
        optimal = request.args.get('optimal')
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "secret"))
        qb = querybuilder.Neo4jQueryBuilder(schema=[("State","NEXT","State","ONE-TO-ONE"),
                                                    ("Atom", "PART_OF", "State", "MANY-TO-ONE")],
                                            constraints=[("RELATION","NEXT","run",run, "STRING")])
        m, idx_to_state_number = calculator.calculate_transition_matrix(driver,qb, True)
        gpcca = gp.GPCCA(np.array(m), z='LM', method='brandts')
        j = {}
        m_min = 2
        # make this retry if it gets stuck
        m_max = 4
        print("optimal value: " + optimal)
        if int(optimal) == 1:
            gpcca.optimize({'m_min': m_min, 'm_max': m_max})
            feasible_clusters = []
            for idx, val in enumerate(gpcca.crispness_values):
                if val != 0:
                    feasible_clusters.append(idx + m_min)
            gpcca.optimize(gpcca.n_m)
            j.update({'optimal_value': gpcca.n_m})
            j.update({'feasible_clusters': feasible_clusters})
        else:
            try:
                gpcca.optimize(int(clusters))
            except ValueError as exception:
                print(exception)
                return {
                    'status': 500,
                    'Error': str(exception)
                }, 500
        sets = {}
        for idx, s in enumerate(gpcca.macrostate_sets):
            newSet = []
            for i in s:
                newSet.append(idx_to_state_number[i])
            sets.update({idx: newSet})
        j.update({'sets': list(sets.values())})
        return jsonify(j)
        """
        dtraj, idx_to_state = calculator.calculate_discrete_trajectory(driver, qb)
        mm = pyemma.msm.estimate_markov_model(np.array(dtraj), 1, reversible=True)
        clustering = mm.pcca(clusters)
        metastable_sets = clustering.metastable_assignment.tolist()
        unique_clusters = set(metastable_sets)
        
        sets = dict(zip(unique_clusters, [[] for _ in range(len(unique_clusters))]))
        for idx, s in enumerate(metastable_sets):
            sets[s].append(idx_to_state[idx])
        
        del mm # prevents constant 100% CPU usage after clustering
        return json.dumps(list(sets.values()))
        """
        
    
    @app.route('/generate_ovito_image', methods=['GET'])
    def generate_ovito_image():
        run = request.args.get('run')
        sequences = request.args.get('sequences')
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "secret"))
        qb = querybuilder.Neo4jQueryBuilder(schema=[("State","NEXT","State","ONE-TO-ONE"),
                                                    ("Atom", "PART_OF", "State", "MANY-TO-ONE")],
                                            constraints=[("RELATION","NEXT","run",run, "STRING")])
        if len(sequences) > 1:
            q = qb.generate_get_path()
            # TODO: start with modifying neomd to return the correct path
            # once that is done, figure out how to get images from the backend
            # and pass in the sequence
        else:
            raise NotImplementedError()
        
    @app.route('/generate_subsequences', methods=['GET'])
    def generate_subsequences():
        run = request.args.get('run')
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "secret"))
        qb = querybuilder.Neo4jQueryBuilder(schema=[('State', 'NEXT', 'State', 'ONE-TO-ONE'), ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')],
                                            constraints=[("RELATION", "NEXT", "run", run, "STRING")])
        
        q = qb.generate_trajectory("NEXT", "ASC", ['RELATION', 'timestep'], node_attributes=[('number', "FIRST")], relation_attributes=['timestep'])   

        nodes = None
        with driver.session() as session:
            result = session.run(q.text)
            nodes = result.data()
        node_list = []

        for n in nodes:
            node_list.append(n['n.number'])

        hashed = np.unique(np.array(node_list), return_inverse=True)[1]

        suffix_arr = divsufsort(hashed)
        lcp = kasai(hashed, suffix_arr)

        K = 4
        pos, count = most_frequent_substrings(lcp,
                                              K,
                                              limit=999999999,
                                              minimum_count=1)

        sequences = []
        for p, c in zip(suffix_arr[pos], count):
            sequences.append(node_list[p:p + K])
        
        # TODO: Avoid repetition regions - explained in arc diagram paper
        """
        for s in sequences:
            sorted_s = s.copy()
            sorted_s.sort()
            for s2 in sequences:
                if s != s2:
                    sorted_s2 = s2.copy()
                    sorted_s2.sort()
                    if sorted_s == sorted_s2:
                        sequences.remove(s2)
        """
        json = {"K": K, "links": []}
        for s in sequences:
            idx_list = []
            seq = None
            for idx, n in enumerate(node_list):
                if node_list[idx:idx + K] == s:
                    idx_list.append(idx)
                    seq = s
            for j in range(0, len(idx_list) - 1):
                link = {}
                link.update({"source": idx_list[j]})
                link.update({"target": idx_list[j+1]})
                link.update({"sequence": seq})
                json['links'].append(link)

        return jsonify(json)

    return app
