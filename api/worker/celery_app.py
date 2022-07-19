from api.models import AnalysisStep

from ..utils import get_atom_type, getMetadata
from typing import Optional, List, Dict, Any
from .celeryconfig import CeleryConfig

import neo4j
from celery import Celery, current_task, Task
from celery.utils.log import get_task_logger
from neomd import querybuilder, converter, calculator
from neomd.query import Query
from scipy import stats
import json
import requests

celery_app = Celery("tasks", backend='redis://localhost:6379/0', broker='redis://localhost:6379/0')
celery_app.config_from_object(CeleryConfig)
logger = get_task_logger(__name__)

TASK_START = 'TASK_START'
TASK_PROGRESS = 'TASK_PROGRESS'
TASK_COMPLETE = 'TASK_COMPLETE'

def send_update(task_id: str, data: Dict[Any,Any]):
    requests.post(f"http://localhost:8000/api/update_task/{task_id}", json=data)

class PostingTask(Task):
    def before_start(self, task_id, args, kwargs):
        send_update(task_id, {'type': TASK_START})
        return super().before_start(task_id,args,kwargs)
    
    def on_success(self, retval, task_id, args, kwargs):
        send_update(task_id, {'type': TASK_COMPLETE})
        return super().on_success(retval, task_id, args, kwargs)

@celery_app.task(name='run_analysis', base=PostingTask)
def run_analysis_task(steps: List[AnalysisStep],
                      run: Optional[str] = None,
                      states: Optional[List[int]] = [],
                      displayResults: bool = True,
                      saveResults: bool = True):
    
    task_id = current_task.request.id    

    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))
    state_atom_dict = None
    
    if run is not None and len(states) == 0:
        qb = querybuilder.Neo4jQueryBuilder([('State', run, 'State', 'ONE-TO-ONE'),('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')])
        q = qb.generate_trajectory(run,
                                   "ASC", ('relation', 'timestep'),
                                   include_atoms=True)

        current_task.update_state(state='PROGRESS')
        send_update(task_id, {'type': TASK_PROGRESS, 'message': 'Finished processing nodes.', 'progress': '0.25'})
        
        state_atom_dict = converter.query_to_ASE(
            driver, qb, q, get_atom_type(getMetadata(run)['parameters']))

        current_task.update_state(state='PROGRESS')
        send_update(task_id, {'type': TASK_PROGRESS, 'message': 'Finished converting nodes.', 'progress': '0.5'})
    else:
        qb = querybuilder.Neo4jQueryBuilder([('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')])
        q = qb.generate_get_node_list('State', states, "PART_OF")
        
        current_task.update_state(state='PROGRESS')
        send_update(task_id, {'type': TASK_PROGRESS, 'message': 'Finished processing nodes.', 'progress': '0.25'})
        # what if atom types are mixed?
        state_atom_dict = converter.query_to_ASE(
            driver, qb, q, 'Pt')        
        current_task.update_state(state='PROGRESS')    
        send_update(task_id, {'type': TASK_PROGRESS, 'message': 'Finished converting nodes.', 'progress': '0.5'})

    results = []
    for idx, step in enumerate(steps):
        if step.analysisType == 'ovito_modifier':
            new_attributes = calculator.apply_ovito_pipeline_modifier(
                state_atom_dict, analysisType=step.value)
            #TODO: Event that notifies pipeline has been applied
            current_task.update_state(state='PROGRESS')    
            send_update(task_id, {'type': TASK_PROGRESS, 'message': f'Pipeline step {idx + 1} {step.value} applied', 'progress': '0.5'})
            
            if saveResults:
                q = None
                uniqueAttributes = []
                with driver.session() as session:
                    tx = session.begin_transaction()
                    for state_number, data in new_attributes.items():
                        if q is None:
                            q = qb.generate_update_entity(
                                data, 'State', 'number', 'node')
                        data.update({'number': state_number})
                        for key in data.keys():
                            if key not in uniqueAttributes:
                                uniqueAttributes.append(key)
                        tx.run(q.text, data)
                    # get all the trajectories that each state belongs to
                    state_number_list = ",".join([f'"{k}"' for k in new_attributes.keys()])
                    q = """ MATCH (n:State) WHERE n.number IN [{state_number_list}]
                    RETURN DISTINCT labels(n) AS labels;
                    """.format(state_number_list=state_number_list)
                    res = tx.run(q)
                    runs = []
                    for r in res:
                        for label in r['labels']:
                            if label != 'State' and label != 'NEB' and label not in runs:
                                runs.append(label)

                    # apply property to metadata list
                    run_list = ",".join([f'"{k}"' for k in runs])
                    q = f"MATCH (m:Metadata) WHERE m.run IN [{run_list}] SET "
                    for idx, key in enumerate(uniqueAttributes):
                        q += f"m.{key} = true"
                        if idx != len(uniqueAttributes) - 1:
                            q += ", "
                        else:
                            q += ";"
                    tx.run(q)
                    tx.commit()
                    
            if displayResults:
                results.append(new_attributes)
        else:
            raise NotImplementedError()

    return json.dumps(results)

"""
Unused for now, load property usually is pretty fast
@celery_app.task(name='load_property', base=PostingTask)
def load_property_task(prop: str):
    uniqueStateAttributes = ["id", prop]
    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))
    task_id = current_task.request.id
    
    qb = querybuilder.Neo4jQueryBuilder()

    query = qb.generate_get_all_nodes(
        "State", node_attributes=uniqueStateAttributes, ignoreNull = True)

    send_update(task_id, {'type': TASK_PROGRESS, 'message': 'Retrieved all nodes', 'progress': 0.5})
    current_task.update_state(state='PROGRESS')  
    j = {}
    with driver.session() as session:
        result = session.run(query.text)
        j["propertyList"] = result.data()

    send_update(task_id, {'type': TASK_PROGRESS, 'message': 'Retrieved all properties', 'progress': 1})
    current_task.update_state(state='PROGRESS')  

    return json.dumps(j)
"""

@celery_app.task(name='perform_KS_Test', base=PostingTask)
def perform_KSTest(data: dict):
    cdf = data['cdf']
    rvs = data['rvs']
    prop = data['property']
    
    task_id = current_task.request.id

    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))

    qb = querybuilder.Neo4jQueryBuilder()    
    q = qb.generate_get_node_list('State', rvs, attributeList=[prop])

    current_task.update_state(state='PROGRESS')
    send_update(task_id, {'type': TASK_PROGRESS, 'message': 'Finished processing nodes.', 'progress': '0.5'})
        
    rvs_df = converter.query_to_df(driver, q)
    rvs_final = rvs_df[prop].to_numpy()    
    cdf_final = None

    if (type(data['cdf']) is dict):
        q = qb.generate_get_node_list('State', cdf)
        cdf_df = converter.query_to_df(driver, q)
        cdf_final = cdf_df[prop].to_numpy()
    else:
        cdf_final = cdf

    statistic, pvalue = stats.kstest(rvs_final, cdf_final)

    
    return json.dumps({'statistic': statistic, 'pvalue': pvalue})

@celery_app.task(name='calculate_neb_on_path', base=PostingTask)
def calculate_neb_on_path(run: str,
                          start: str,
                          end: str,
                          interpolate: int = 3,
                          maxSteps: int = 2500,
                          fmax: float = 0.01,
                          saveResults: bool = True):
    
    task_id = current_task.request.id
    
    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))

    qb = querybuilder.Neo4jQueryBuilder(
        schema=[("Atom", "PART_OF", "State", "MANY-TO-ONE")])

    current_task.update_state(state='PROGRESS')    
    send_update(task_id, {'type': TASK_PROGRESS, 'message': 'Finished getting nodes.', 'progress': '0.1'})

    metadata = getMetadata(run)
    atomType = get_atom_type(metadata['parameters'])

    # messy, ugly way of doing it, will fix later
    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))

    path = {}
    allStates = []
    with driver.session() as session:
        # get the path first, just the ids 
        q = f"""MATCH (n:{run})-[r:{run}]->(n2:{run}) 
        WHERE r.timestep >= {start} AND r.timestep <= {end}
        RETURN n.number AS first, r.timestep AS timestep, n2.number AS second, ID(n2) AS secondID"""
        res = session.run(q)
        for r in res:       
            path.update({r['timestep']: (r['first'], r['second'], r['secondID'])})

        # get their canonical representations - this is a seperate query
        q = f"""OPTIONAL MATCH (n:{run})-[r:canon_rep_{run}]->(n2:State)
            WHERE r.timestep >= {start} AND r.timestep <= {end} AND ID(n) IN ["""
        count = 0
        for timestep, relation in path.items():
            q += str(relation[2]) 
            path[timestep] = (relation[0], relation[1])
            if count != len(path.items()) - 1:
                q += ","
            count += 1
        q += "] RETURN DISTINCT r.timestep AS timestep, n2.number AS sym_state ORDER BY r.timestep"
        res = session.run(q)    
        for r in res:

            if r['timestep'] in path:
                curr_tuple = path[r['timestep']] 
                path[r['timestep']] = (curr_tuple[0], r['sym_state'])
            
        for timestep, relation in path.items():
            if relation[0] not in allStates:
                allStates.append(relation[0])
            if relation[1] not in allStates:
                allStates.append(relation[1])
    full_atom_dict = {}
    for stateID in allStates:
        q = f"""MATCH (a:Atom)-[:PART_OF]->(n:State) WHERE n.number = "{stateID}" 
        WITH n,a ORDER BY a.internal_id WITH collect(DISTINCT a) AS atoms, n
        RETURN n, atoms
        """  
        attr_atom_dict = converter.query_to_ASE(driver,
                                                qb,
                                                Query(q, ["ASE"]),
                                                atomType)
        
        for state, atoms in attr_atom_dict.items():
            full_atom_dict.update({state: atoms})    
    energyList = []
    if interpolate < 0:
        interpolate = 0

    idx = 0
    for timestep, relation in path.items():
        energies = calculator.calculate_neb_for_pair(
            full_atom_dict[relation[0]],
            full_atom_dict[relation[1]], atomType,
            metadata['cmds'], interpolate, maxSteps, fmax)

        if idx < len(path) - 2:
            energies.pop()

        energyList.append(energies)
            
        current_task.update_state(state='PROGRESS')    
        send_update(task_id, {'type': TASK_PROGRESS, 'message': f'Image {idx + 1} of {len(path)} processed.',
                              'progress': f'{0.2 + ((idx+1/len(path)) - 0.2)}'})
            
        if saveResults:
                # update by timestep
            q = None

            with driver.session() as session:
                tx = session.begin_transaction()
                for idx, energies in enumerate(energyList):                                               
                    q = '''MATCH (a:State),
                    (b:State)
                    WHERE a.number = '{state_n1}' AND b.number = '{state_n2}'
                    MERGE (a)-[:{run}_NEB {{timestep: {timestep}, interpolate: {interpolate},
                    maxSteps: {maxSteps}, fmax: {fmax}, energies: '{energies}'}}]->(b);                    
                    '''.format(state_n1=relation[0],
                               state_n2=relation[1],
                               run=run,
                               timestep=timestep,
                               interpolate=interpolate,
                               maxSteps=maxSteps,
                               fmax=fmax,
                               energies=json.dumps(energies))
                    tx.run(q)
                tx.commit()

    j = {'energies': energyList}

    return json.dumps(j)

@celery_app.task(name='calculate_path_similarity', base=PostingTask)
def calculate_path_similarity(
        p1: List[int],
        p2: List[int],
        state_attributes: List[str] = [],
        atom_attributes: List[str] = []):

    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))
    
    generation_state_attributes = state_attributes.copy()
    generation_state_attributes.append('id')
    
    qb = querybuilder.Neo4jQueryBuilder([    
        ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')
    ])

    q1 = qb.generate_get_node_list('State', p1,                                   
                                   attributeList = generation_state_attributes)

    q2 = qb.generate_get_node_list('State', p2,
                                   attributeList = generation_state_attributes)


    score = calculator.calculate_path_similarity(driver,
                                                 q1,
                                                 q2,
                                                 state_attributes,
                                                 atom_attributes)
    
    return json.dumps({'score': score})
