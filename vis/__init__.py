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
        
        q = qb.generate_trajectory("NEXT", "ASC", ['RELATION', 'timestep'], node_attributes=[('number', 'first'), ('occurences', 'first')], relation_attributes=['timestep'])
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
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "secret"))
        qb = querybuilder.Neo4jQueryBuilder(schema=[("State","NEXT","State","ONE-TO-ONE"),
                                                    ("Atom", "PART_OF", "State", "MANY-TO-ONE")],
                                            constraints=[("RELATION","NEXT","run",run, "STRING")])
        dtraj, idx_to_state = calculator.calculate_discrete_trajectory(driver, qb)
        mm = pyemma.msm.estimate_markov_model(np.array(dtraj), 1, reversible=True)
        clustering = mm.pcca(clusters)
        metastable_sets = clustering.metastable_sets
        sets = []
        for s in metastable_sets:
            new_set = []
            for idx in s:
                new_set.append(idx_to_state[idx])
            sets.append(new_set)
        del mm # prevents constant 100% CPU usage after clustering
        return jsonify(sets)

        
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
