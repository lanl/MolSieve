import os
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
import pygpcca as gp
import base64

from .epoch import Epoch, calculate_epoch
from .config import Config
from .trajectory import Trajectory
from .utils import metadata_to_parameters, get_atom_type

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
        
    @app.errorhandler(Exception)
    def handle_exception(error):        
        response = {
            'success': False,
            'error': {
                'type': error.__class__.__name__,
                'message': [str(x) for x in error.args]
            }
        }
        return jsonify(response), 500
    
    @app.route('/')
    def home():
        return render_template('home.html')

    @app.route('/get_ovito_modifiers', methods=['GET'])
    def get_ovito_modifiers():
        return jsonify(neomd.utils.return_ovito_modifiers())
    
    @app.route('/load_sequence', methods=['GET'])
    def load_sequence(): 
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
            [('State', run, 'State', 'ONE-TO-ONE'),
             ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')])

        q = qb.generate_trajectory(run,
                                   "ASC", ['RELATION', 'timestep'],
                                   node_attributes=node_attributes,
                                   relation_attributes=['timestep'])
        oq = qb.generate_get_occurences(run)
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
            [('State', run, 'State', 'ONE-TO-ONE'),
             ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')])

        q = qb.generate_trajectory(run,
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
                    "MATCH (:State)-[r]-(:State) RETURN DISTINCT TYPE(r)")
                # gets rid of ugly syntax on js side - puts everything in one array; probably a better more elegant way to do this
                runs = []
                for r in result.values():
                    runs.append(r[0])
                    trajectories.update({r[0] : Trajectory()})                    
                j.update({'runs': runs})
                result = session.run(
                    "MATCH (n:State) with n LIMIT 1 UNWIND keys(n) as key RETURN DISTINCT key;"
                )
                j.update({'properties': [r[0] for r in result.values()]})
            except neo4j.exceptions.ServiceUnavailable as exception:
                raise exception
        
        return jsonify(j)

    @app.route('/get_metadata', methods=['GET'])
    def get_metadata():
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        j = {}
        run = request.args.get('run')
        with driver.session() as session:
            try:
                result = session.run(
                    "MATCH (n:Metadata {{run: {run} }}) RETURN n".format(run='"' +  run +'"'))
                record = result.single()
                for n in record.values():
                    for key,value in n.items():                        
                        if key == "LAMMPSBootstrapScript" and trajectories is not None and trajectories[run] is not None:                            
                            trajectories[run].metadata = metadata_to_parameters(value)
                        j.update({key:value})                    
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
        state_atom_dict = converter.query_to_ASE(driver, q, get_atom_type(trajectories[run].metadata), False)        
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
        atomType = request.args.get('atomType')
        interpolate = int(request.args.get('interpolate'))
        potential_path = request.args.get('potential_path')
        pair_coeff = request.args.get('pair_coeff')
        pair_style = request.args.get('pair_style')
        
        driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))
        
        qb = querybuilder.Neo4jQueryBuilder(
            schema=[("State", run, "State", "ONE-TO-ONE"),
                    ("Atom", "PART_OF", "State", "MANY-TO-ONE")])

        # hack at the end here so that the final node in the sequence is filled out
        # saves the trouble of modifying query_to_ASE + generate_get_path
        # needs to be fixed in the future though
        end = str(int(end) + 1)
        q = qb.generate_get_path(start,end,run=run)

        if atomType == None or atomType == '':
            atomType = get_atom_type(trajectories[run].metadata)

        if potential_path == None or potential_path == '':
            potential_path = calculator.retrieve_potentials_file(driver,run)            

        if pair_coeff == None or pair_coeff == '' or pair_style == None or pair_style == "":
            metadata = trajectories[run].metadata
        else:
            metadata = {}
            metadata.update({"pair_coeff": [pair_coeff.replace("_", " ")]})
            metadata.update({"pair_style": pair_style})                            
            
        state_atom_dict, relationList = converter.query_to_ASE(driver, q, atomType, True)        
        
        ef_list, de_list = calculator.calculate_neb_on_path(driver, state_atom_dict, relationList,
                                                            qb, run, metadata, ASE_LAMMPSRUN_COMMAND_PATH=app.config["LAMMPS_RUN"],
                                                            interpolate=interpolate, LAMMPS_POTENTIALS=potential_path)                       

        j = {}
        j.update({"ef_list":ef_list})
        j.update({"de_list":de_list})
        return jsonify(j)
    return app
