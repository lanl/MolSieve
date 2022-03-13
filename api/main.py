from fastapi import FastAPI, Request
import asyncio
from pydantic import BaseModel, BaseSettings
from typing import Optional, Dict, List

import neo4j
import ovito
import neomd
from neomd import querybuilder, converter, calculator, query, visualizations
import os
from scipy import stats
import pygpcca as gp
import numpy as np

from sse_starlette.sse import EventSourceResponse

from timeit import default_timer as timer
from datetime import timedelta

# image rendering
from PIL import Image
import io
import base64

from .config import config
from .trajectory import Trajectory
from .utils import *

class AnalysisStep(BaseModel):
    analysisType: str
    value: str

class AnalysisRequest(BaseModel):        
    pathStart: Optional[str] = None
    pathEnd: Optional[str] = None

os.environ['OVITO_THREAD_COUNT'] = '1'
os.environ['DISPLAY'] = ''

trajectories = {}

app = FastAPI()

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

@app.get('/get_scipy_distributions')
def get_scipy_distributions():
    return getScipyDistributions()
    
@app.get('/get_ovito_modifiers')
def get_ovito_modifiers():
    return neomd.utils.return_ovito_modifiers()

@app.get("/generate_ovito_image")
async def generate_ovito_image(number: str):
    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))
    
    qb = querybuilder.Neo4jQueryBuilder(
        schema=[("State", "nano_pt", "State", "ONE-TO-ONE"),
                ("Atom", "PART_OF", "State", "MANY-TO-ONE")])
    
    q = qb.generate_get_node('State', ("number", number), 'PART_OF')               

    state_atom_dict = converter.query_to_ASE(driver, qb, q, 'Pt', False)        

    qimg = None

    for atoms in state_atom_dict.values():            
        qimg = visualizations.render_ASE(atoms)        

    img = Image.fromqimage(qimg)
    rawBytes = io.BytesIO()
    img.save(rawBytes, "PNG")
    rawBytes.seek(0)
    img_base64 = base64.b64encode(rawBytes.read())

    image_string = str(img_base64)
    image_string = image_string.removesuffix("'")
    image_string = image_string.removeprefix("b'")
    return {'image': image_string}

@app.get('/generate_ovito_animation')
async def generate_ovito_animation(run: str, start: int, end: int):            
    
    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                            auth=("neo4j", "secret"))

    qb = querybuilder.Neo4jQueryBuilder(
        schema=[("State", run, "State", "ONE-TO-ONE"),
                    ("Atom", "PART_OF", "State", "MANY-TO-ONE")])
        
    q = qb.generate_get_path(start, end, run, 'timestep')

    metadata = getMetadata(run)
    atomType = get_atom_type(metadata['parameters'])        

    state_atom_dict = neomd.converter.query_to_ASE(driver, qb, q, atomType, dictKey=('Relation', 'timestep'))
    
    output_path = neomd.visualizations.render_ASE_list(state_atom_dict.values(), list(state_atom_dict.keys()))
        
    video_string = ""
    with open(output_path, "rb") as video:
        video_string = base64.b64encode(video.read())                                

    os.remove(output_path)

    return {'video': video_string}

@app.post('/run_analysis')
async def run_analysis(steps: List[AnalysisStep], run: str, pathStart: int = None, pathEnd: int = None, displayResults: bool = True, saveResults: bool = True):
    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "secret"))
    
    qb = querybuilder.Neo4jQueryBuilder(
        [('State', run, 'State', 'ONE-TO-ONE'),
         ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')])        

    state_atom_dict = None

    start = timer()
    
    if pathStart is None or pathEnd is None:
        if config.IMPATIENT:
            state_atom_dict = loadTestPickle(run, 'state_atom_dict')
        else:
            q = qb.generate_trajectory(run,
                               "ASC", ['RELATION', 'timestep'],
                               node_attributes=[],
                               relation_attributes=[],
                               include_atoms=True)                
            state_atom_dict = converter.query_to_ASE(driver, qb, q, get_atom_type(getMetadata(run)['parameters']))
            saveTestPickle(run, 'state_atom_dict', state_atom_dict)
    else:
        if pathStart == pathEnd:
            q = qb.generate_get_node('State', ('timestep', pathStart), 'PART_OF')
            state_atom_dict = converter.query_to_ASE(driver, qb, q, get_atom_type(getMetadata(run)['parameters']))
        else:
            q = qb.generate_get_path(pathStart, pathEnd, run, 'timestep')
            state_atom_dict = converter.query_to_ASE(driver, qb, q, get_atom_type(getMetadata(run)['parameters']))

    # TODO: Server-sent event to notify atoms have been converted

    results = {}
    for idx, step in enumerate(steps):
        if step.analysisType == 'ovito_modifier':
            new_attributes = calculator.apply_ovito_pipeline_modifier(state_atom_dict, analysisType=step.value)
            #TODO: Event that notifies pipeline has been applied
            if saveResults:
                q = None
                with driver.session() as session:
                    tx = session.begin_transaction()
                    for state_number, data in new_attributes.items():
                        if q is None:
                            q = qb.generate_update_entity(data, 
                                                      'State', 
                                                      'number', 
                                                      'NODE')
                        data.update({'number': state_number})
                        tx.run(q.text, data)
                    tx.commit()
            if displayResults:
                results.update({idx: new_attributes})
            #TODO: Notify user that everything has been written to the database
        else:
            raise NotImplementedError()

    end = timer()
    results.update({'info': 'Finished analysis in {time} seconds.'.format(time=timedelta(seconds=end-start))})

    return str(results)
    
@app.post('/perform_KS_Test')
def perform_KSTest(data: dict):

    cdf = data['cdf']
    rvs = data['rvs']
    prop = data['property']

    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "secret"))

    rvs_run = rvs['name']
    rvs_start = rvs['begin']['timestep']
    rvs_end = rvs['end']['timestep']

    rvs_qb = querybuilder.Neo4jQueryBuilder(
        [('State', rvs_run, 'State', 'ONE-TO-ONE'),
         ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')]) 

    q = rvs_qb.generate_get_path(rvs_start, rvs_end, rvs_run, 'timestep', include_atoms=False)                
    rvs_df = neomd.converter.query_to_df(driver, q)
    rvs_final = rvs_df[prop].to_numpy()        

    cdf_final = None

    if(type(data['cdf']) is dict):
        cdf_run = cdf['name']
        cdf_start = cdf['begin']['timestep']
        cdf_end = cdf['end']['timestep']

        cdf_qb = querybuilder.Neo4jQueryBuilder(
            [('State', cdf_run, 'State', 'ONE-TO-ONE'),
             ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')]) 

        q = cdf_qb.generate_get_path(cdf_start, cdf_end, cdf_run, 'timestep', include_atoms=False)                
        cdf_df = neomd.converter.query_to_df(driver, q)
        cdf_final = cdf_df[prop].to_numpy()            
    else:
        cdf_final = cdf

    statistic, pvalue = stats.kstest(rvs_final, cdf_final)

    return {'statistic': statistic, 'pvalue': pvalue}


@app.post('/calculate_path_similarity')
def calculate_path_similarity(extents: dict):            
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

    return score


@app.get('/load_sequence')
def load_sequence(run: str, properties: str):
    if config.IMPATIENT:
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

    return j

@app.get('/get_property_list')
def get_property_list(run: str):    
    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))
    j = []
    with driver.session() as session:
        try:    
            result = session.run(
                "MATCH (n:State)-[:{run}]-(:State) with n LIMIT 1 UNWIND keys(n) as key RETURN DISTINCT key;".format(run=run)
            )
            j = [r[0] for r in result.values()]

        except neo4j.exceptions.ServiceUnavailable as exception:
            raise exception

    return j

@app.get('/get_atom_properties')
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
        
    return j

@app.get('/get_run_list')
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
        
    return j

@app.get('/get_metadata')
def get_metadata(run: str):
    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))    
    metadata, j = getMetadata(run, getJson=True)
    
    return j

@app.get('/pcca')
def pcca(run: str, clusters: int, optimal: int, m_min: int, m_max: int):            
    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))
    if config.IMPATIENT:            
        r = loadTestJson(run, 'optimal_pcca')        
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

    return j


async def count(count):
    count += 1
    return count

async def event_generator(request: Request):
    previous_status = None
    count = 0    

    while True:
        if await request.is_disconnected():
            print('request d/c')
            break

        if previous_status and previous_status == 'complete':
            print('state changed to completed')
            yield {
                "event": "end",
                "data": ""
            }
            break

        current_status = await count(previous_status)

        if previous_status != current_status:
            print('new status: ' + current_status)
            yield {
                "event": "update",
                "id": "message_id",
                "retry": 15000,
                "data": str(current_status)
            }
            previous_status = current_status
            #current_status += 1

        #await asyncio.sleep(1)

@app.get('/stream')
async def message_stream(request: Request):
    e_gen = event_generator(request)
    return EventSourceResponse(e_gen)

@app.get('/calculate_neb_on_path')
async def calculate_neb_on_path(run: str, start: str, end: str, interpolate: int, maxSteps: int):                

    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))

    qb = querybuilder.Neo4jQueryBuilder(
        schema=[("State", run, "State", "ONE-TO-ONE"),
                ("Atom", "PART_OF", "State", "MANY-TO-ONE")])

    q = qb.generate_get_path(start, end, run, 'timestep')

    metadata = getMetadata(run)
    atomType = get_atom_type(metadata['parameters'])        

    
    # converting atoms...
#    current_status = 'converting atoms'
    
    state_atom_dict, relationList = converter.query_to_ASE(driver, qb, q, atomType, getRelationList=True)        

    # calculating NEB...    
#    current_status = 'calculating NEB'
    
    energyList = []                
    if interpolate < 0:
        interpolate = 0

    for idx, relation in enumerate(relationList):
        if idx < len(relationList) - 1:
            skip = False

            for prop in relation['properties']:
                if prop[0] == 'symmetry':
                    print("Detected symmetry in transition between {start} and {end}, skipping...".format(start=relation['start']['number'], end=relation['end']['number']))
                    skip = True                            
             
            if skip:
                energyVal = energyList[-1][-1] if len(energyList) > 0 else 0                                    
                energyList.append([energyVal for x in range(interpolate + 1)])
                continue

            # between state x and y...
            #current_status = 'calculating NEB btwn ' + relation['start']['number'] + ' and an end state'
            energies = calculator.calculate_neb_for_pair(state_atom_dict[relation['start']['number']], state_atom_dict[relation['end']['number']], run, atomType, metadata['cmds'], interpolate, maxSteps)

            if idx < len(relationList) - 2:
                energies.pop()
                
            energyList.append(energies)                                                                                            

    #current_status = 'complete'
    
    j = {'energies': energyList}    

    return j
