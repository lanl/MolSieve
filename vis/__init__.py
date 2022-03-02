import os
os.environ['OVITO_THREAD_COUNT']='1'
import json
from flask import (render_template, Flask, jsonify, request)
import neomd
from neomd import querybuilder, calculator, converter, query, visualizations
import neo4j
import numpy as np
from PIL import Image
import io, sys
from pydivsufsort import divsufsort, kasai, most_frequent_substrings, sa_search
import jsonpickle
import pickle
import pygpcca as gp
import base64

from .epoch import Epoch, calculate_epoch
from .config import Config
from .trajectory import Trajectory
from .utils import *

trajectories = {}

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
                
    app.config.from_object(Config())

    if not os.path.isdir(app.config["LD_LIBRARY_PATH"]):
        raise FileNotFoundError("Error: {LD_LIBRARY_PATH} does not exist.".format(LD_LIBRARY_PATH=app.config["LD_LIBRARY_PATH"]))

    os.environ['LD_LIBRARY_PATH'] = app.config["LD_LIBRARY_PATH"]
    
    if not os.path.isfile(app.config["LAMMPS_PATH"]):
        raise FileNotFoundError("Error: LAMMPS binary not found at {lammps_path}".format(lammps_path=app.config["LAMMPS_PATH"]))

    # could later use this as a cache feature

    def getMetadata(run, getJson=False):
        """
        Gets the metadata of a run. If the metadata has not been loaded yet, loads it into memory. There is an option
        to return a JSON string that can be passed back to the front-end.

        :param string run: Run to retrieve metadata for
        :param bool getJson: Whether or not to return a JSON string with the metadata information.

        :returns: a dict of metadata parameters and optionally a JSON string with the metadata information.
        """
        if run not in trajectories:
            trajectories.update({run: Trajectory()})
        
        if getJson or trajectories[run].metadata is None:
            j = {}            
            driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
            with driver.session() as session:
                try:
                    result = session.run(
                        "MATCH (n:Metadata {{run: {run} }}) RETURN n".format(run='"' +  run +'"'))
                    record = result.single()
                    for n in record.values():
                        for key,value in n.items():                        
                            if key == "LAMMPSBootstrapScript":
                                params = metadata_to_parameters(value)
                                cmds = metadata_to_cmds(params)
                                trajectories[run].metadata = {'parameters': params, 'cmds': cmds}                                
                            j.update({key:value})                    
                except neo4j.exceptions.ServiceUnavailable as exception:
                    raise exception

                if getJson:
                    return trajectories[run].metadata, j
                else:
                    return trajectories[run].metadata                               
        else:
            return trajectories[run].metadata

    def getSequence(run):
        """TODO: Unfinished"""
        if run not in trajectories:
            trajectories.update({run: Trajectory()})
        
        
    @app.errorhandler(neo4j.exceptions.ServiceUnavailable)
    def handle_service_not_available(error):
        response = {
            'success': False,
            'error': {
                'type': error.__class__.__name__,
                'message': [str(x) for x in error.args]
            }
        }
        print(response)
        return jsonify(response), 503
    
    @app.errorhandler(Exception)
    def handle_exception(error):        
        response = {
            'success': False,
            'error': {
                'type': error.__class__.__name__,
                'message': [str(x) for x in error.args]
            }
        }
        print(response)
        return jsonify(response), 500
    
    @app.route('/')
    def home():
        return render_template('home.html')

    @app.route('/get_ovito_modifiers', methods=['GET'])
    def get_ovito_modifiers():
        return jsonify(neomd.utils.return_ovito_modifiers())

    @app.route('/run_preprocessing', methods=['POST'])
    def run_preprocessing():
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "secret"))        
        data = request.get_json(force=True)        
        
        run = data['run']
        steps = data['steps']

        qb = querybuilder.Neo4jQueryBuilder(
            [('State', data['run'], 'State', 'ONE-TO-ONE'),
             ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')])        

        state_atom_dict = None

        if app.config['IMPATIENT']:
            state_atom_dict = loadTestPickle(run, 'state_atom_dict')
        else:
            q = qb.generate_trajectory(run,
                                       "ASC", ['RELATION', 'timestep'],
                                       node_attributes=[],
                                       relation_attributes=[],
                                       include_atoms=True)        
            
            state_atom_dict = converter.query_to_ASE(driver, qb, q, get_atom_type(getMetadata(run)), False)
            saveTestPickle(run, 'state_atom_dict', state_atom_dict)
            
        for step in steps:
            if step['type'] == 'ovito_modifier':
                calculator.apply_ovito_pipeline_modifer(driver, state_atom_dict, qb, analysisType=step['value'])                
            else:
                raise NotImplementedError()
    
        return 'Ran preprocessing steps'
    
    @app.route('/calculate_path_similarity', methods=['POST'])
    def calculate_path_similarity():        
        extents = request.get_json(force=True)        
        
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))

        qb1 = querybuilder.Neo4jQueryBuilder(
            [('State', extents['p1']['name'], 'State', 'ONE-TO-ONE'),
             ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')])
        
        q1 = qb1.generate_get_path(extents['p1']['begin']['timestep'], extents['p1']['end']['timestep'], extents['p1']['name'], 'timestep', include_atoms=False)        

        qb2 = querybuilder.Neo4jQueryBuilder(
            [('State', extents['p1']['name'], 'State', 'ONE-TO-ONE'),
             ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')])

        q2 = qb2.generate_get_path(extents['p2']['begin']['timestep'], extents['p2']['end']['timestep'], extents['p2']['name'], 'timestep', include_atoms=False)                
        
        score = neomd.calculator.calculate_path_similarity(driver,q1,q2,qb2, extents['state_attributes'], extents['atom_attributes'])

        return jsonify(score)
            
    @app.route('/load_sequence', methods=['GET'])
    def load_sequence(): 
        run = request.args.get('run')
        properties = request.args.get('properties')
        
        if app.config['IMPATIENT']:
            r = loadTestJson(run, 'sequence')
            if r != None:
                return r

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
            [('State', run, 'State', 'ONE-TO-ONE'),
             ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')])

        
        
        q = qb.generate_trajectory(run,
                                   "ASC", ['RELATION', 'timestep'],
                                   node_attributes=node_attributes,
                                   relation_attributes=['timestep'])

        # place this into one function
        oq = qb.generate_get_occurrences(run)
        oq2 = qb.generate_calculate_many_to_one_count("PART_OF")
        with driver.session() as session:
            session.run(oq.text)
            result = session.run(q.text)
            j = result.data()
            saveTestJson(run, 'sequence', j)
            j = jsonify(j)

        return j

    @app.route('/get_property_list', methods=['GET'])
    def get_property_list():
        run = request.args.get('run')
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        j = []
        with driver.session() as session:
            try:
                """
                NOTE: Technically, this would produce invalid properties if for some reason the database returns a state / atom
                that has properties that are undefined everywhere else. A way to get around this is to have a "model" state / atom
                that has properties that are guaranteed to be in each state / atom. It would make sense to update this "model" state / atom
                whenever a query is run that affects the entire database, as they will be guaranteed to be correct.
                """
                                
                result = session.run(
                    "MATCH (n:State)-[:{run}]-(:State) with n LIMIT 1 UNWIND keys(n) as key RETURN DISTINCT key;".format(run=run)
                )
                j = [r[0] for r in result.values()]

            except neo4j.exceptions.ServiceUnavailable as exception:
                raise exception
        
        return jsonify(j)


    @app.route('/get_atom_properties', methods=['GET'])
    def get_atom_properties():
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        j = []
        with driver.session() as session:
            try:
                result = session.run(
                    "MATCH (n:Atom) WITH n LIMIT 1 UNWIND keys(n) as key RETURN DISTINCT key;"                    
                )
                j = [r[0] for r in result.values()]
            except neo4j.exceptions.ServiceUnavailable as exception:
                raise exception                

        return jsonify(j)


    @app.route('/get_run_list', methods=['GET'])
    def get_run_list():
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        j = []
        with driver.session() as session:
            try:
                # get all the types of relations between states - our runs!
                result = session.run(
                    "MATCH (:State)-[r]-(:State) RETURN DISTINCT TYPE(r)")
                # gets rid of ugly syntax on js side - puts everything in one array; probably a better more elegant way to do this
                runs = []
                for r in result.values():
                    runs.append(r[0])
                    trajectories.update({r[0] : Trajectory()})                    
                j = runs
            except neo4j.exceptions.ServiceUnavailable as exception:
                raise exception
        
        return jsonify(j)

    @app.route('/get_metadata', methods=['GET'])
    def get_metadata():
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        run = request.args.get('run')
        metadata, j = getMetadata(run, getJson=True)
        
        return jsonify(j)

    #TODO: Refactor to be cleaner
    @app.route('/pcca', methods=['GET'])
    def pcca():
        run = request.args.get('run')
        clusters = int(request.args.get('clusters'))
        optimal = int(request.args.get('optimal'))
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        if app.config['IMPATIENT']:            
            r = loadTestJson(run, 'optimal_pcca')
            # TODO read JSON into cache trajectories dictionary
            if r != None:
                return r                             
            
        qb = querybuilder.Neo4jQueryBuilder(
            schema=[("State", run, "State", "ONE-TO-ONE"),
                    ("Atom", "PART_OF", "State", "MANY-TO-ONE")])
        m, idx_to_state_number = calculator.calculate_transition_matrix(
            driver, qb, run=run, discrete=True)
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
                        state_to_membership = {}
                        for idx,m in enumerate(gpcca.memberships.tolist()):
                            state_to_membership.update({idx_to_state_number[idx]: m})                        
                        fuzzy_memberships.update({cluster_idx + m_min: state_to_membership})
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
                state_to_membership = {}
                for idx,m in enumerate(gpcca.memberships.tolist()):
                    state_to_membership.update({idx_to_state_number[idx]: m})                        
                fuzzy_memberships.update({clusters: state_to_membership})
            except ValueError as exception:
                print(exception)
                return {'status': 500, 'Error': str(exception)}, 500
            
        j.update({'sets': sets})
        j.update({'fuzzy_memberships': fuzzy_memberships})        
        # TODO: add as metadata in vis
        # j.update({'dominant_eigenvalues': gpcca.dominant_eigenvalues.tolist()})
        # j.update({'minChi': gpcca.minChi(m_min, m_max)})

        saveTestJson(run, 'optimal_pcca', j)
        
        return jsonify(j)


    @app.route('/generate_ovito_image', methods=['GET'])
    def generate_ovito_image():        
        number = request.args.get('number')
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        
        qb = querybuilder.Neo4jQueryBuilder(
            schema=[("State", "NEXT", "State", "ONE-TO-ONE"),
                    ("Atom", "PART_OF", "State", "MANY-TO-ONE")])
        
        q = qb.generate_get_node('State', ("number", number), 'PART_OF')               
        state_atom_dict = converter.query_to_ASE(driver, qb, q, get_atom_type(trajectories[run].metadata), False)        
        qimg = None
        for atoms in state_atom_dict.values():            
            qimg = visualizations.render_ASE(atoms)        

        img = Image.fromqimage(qimg)
        rawBytes = io.BytesIO()
        img.save(rawBytes, "PNG")
        rawBytes.seek(0)
        img_base64 = base64.b64encode(rawBytes.read())
        print(img_base64)
        
        return jsonify({'image': str(img_base64)})
        
        
    @app.route('/generate_ovito_animation', methods=['GET'])
    def generate_ovito_animation():
        run = request.args.get('run')
        start = request.args.get('start')
        end = request.args.get('end')
        
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))

        qb = querybuilder.Neo4jQueryBuilder(
            schema=[("State", run, "State", "ONE-TO-ONE"),
                    ("Atom", "PART_OF", "State", "MANY-TO-ONE")])
        
        q = qb.generate_get_path(start,end)

        # TODO: start with modifying neomd to return the correct path
        # once that is done, figure out how to get images from the backend
        # and pass in the sequence
                                
    @app.route('/calculate_neb_on_path', methods=['GET'])
    def calculate_neb_on_path():
        run = request.args.get('run')
        start = request.args.get('start')
        end = request.args.get('end')        
        interpolate = int(request.args.get('interpolate'))

        # if app.config['IMPATIENT']:
        #     r = loadTestJson('nano_pt', 'energies')
        #     if r is not None:
        #         return r
            
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        
        qb = querybuilder.Neo4jQueryBuilder(
            schema=[("State", run, "State", "ONE-TO-ONE"),
                    ("Atom", "PART_OF", "State", "MANY-TO-ONE")])

        q = qb.generate_get_path(start, end, run, 'timestep')

        metadata = getMetadata(run)
        atomType = get_atom_type(metadata['parameters'])        
        
        state_atom_dict, relationList = converter.query_to_ASE(driver, qb, q, atomType, True)        
        
        energies = calculator.calculate_neb_on_path(state_atom_dict,
                                                            relationList,
                                                            run,
                                                            atomType,
                                                            metadata['cmds'],
                                                            interpolate=interpolate)                       

        j = {'energies': energies}

        saveTestJson('nano_pt', 'energies', j)        
                
        return jsonify(j)
    
    return app
