from api.models import AnalysisStep

from ..utils import get_atom_type, getMetadata
from typing import Optional, List, Dict, Any
from .celeryconfig import CeleryConfig

import neo4j
from celery import Celery, current_task, Task
from celery.utils.log import get_task_logger
from neomd import querybuilder, converter, calculator
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

    current_task.update_state(state='PROGRESS')    
    send_update(task_id, {'type': TASK_START})

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

    results = {}
    for idx, step in enumerate(steps):
        if step.analysisType == 'ovito_modifier':
            new_attributes = calculator.apply_ovito_pipeline_modifier(
                state_atom_dict, analysisType=step.value)
            #TODO: Event that notifies pipeline has been applied
            if saveResults:
                q = None
                with driver.session() as session:
                    tx = session.begin_transaction()
                    for state_number, data in new_attributes.items():
                        if q is None:
                            q = qb.generate_update_entity(
                                data, 'State', 'number', 'node')
                        data.update({'number': state_number})
                        tx.run(q.text, data)
                    tx.commit()
            if displayResults:
                results.update({idx: new_attributes})
            #TODO: Notify user that everything has been written to the database
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

@celery_app.task(name='perform_KS_Test')
def perform_KSTest(data: dict):
    cdf = data['cdf']
    rvs = data['rvs']
    prop = data['property']

    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))

    qb = querybuilder.Neo4jQueryBuilder()
    
    q = qb.generate_get_node_list('State', rvs, attributeList=[prop])

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

    return {'statistic': statistic, 'pvalue': pvalue}

@celery_app.task(name='calculate_neb_on_path')
def calculate_neb_on_path(run: str,
                          start: str,
                          end: str,
                          interpolate: int = 3,
                          maxSteps: int = 2500,
                          fmax: float = 0.01,
                          saveResults: bool = True):

    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))

    qb = querybuilder.Neo4jQueryBuilder(
        schema=[("State", run, "State",
                 "ONE-TO-ONE"), ("Atom", "PART_OF", "State", "MANY-TO-ONE")])

    q = qb.generate_get_path(start, end, run, 'timestep')

    metadata = getMetadata(run)
    atomType = get_atom_type(metadata['parameters'])

    # converting atoms...
    # current_status = 'converting atoms'

    attr_atom_dict, relationList = converter.query_to_ASE(driver,
                                                          qb,
                                                          q,
                                                          atomType,
                                                          getRelationList=True)

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
                    print(
                        "Detected symmetry in transition between {start} and {end}, skipping..."
                        .format(start=relation['start']['number'],
                                end=relation['end']['number']))
                    skip = True

            if skip:
                energyVal = energyList[-1][-1] if len(energyList) > 0 else 0
                energyList.append([energyVal for x in range(interpolate + 1)])
                continue

            # between state x and y...
            #current_status = 'calculating NEB btwn ' + relation['start']['number'] + ' and an end state'
            energies = calculator.calculate_neb_for_pair(
                attr_atom_dict[relation['start']['number']],
                attr_atom_dict[relation['end']['number']], run, atomType,
                metadata['cmds'], interpolate, maxSteps, fmax)

            if idx < len(relationList) - 2:
                energies.pop()

            energyList.append(energies)

        if saveResults:
            # update by timestep
            q = None

            with driver.session() as session:
                tx = session.begin_transaction()
                for idx, energies in enumerate(energyList):
                    r = relationList[idx]
                    timestep = ''
                    for prop in r['properties']:
                        if prop[0] == 'timestep':
                            timestep = prop[1]

                    q = '''MATCH (a:State),
                                 (b:State)
                           WHERE a.number = '{state_n1}' AND b.number = '{state_n2}'
                           MERGE (a)-[:{run}_NEB {{timestep: {timestep}, interpolate: {interpolate},
                                              maxSteps: {maxSteps}, fmax: {fmax}, energies: '{energies}'}}]->(b);                    
                        '''.format(state_n1=r['start']['number'],
                                   state_n2=r['end']['number'],
                                   run=run,
                                   timestep=timestep,
                                   interpolate=interpolate,
                                   maxSteps=maxSteps,
                                   fmax=fmax,
                                   energies=json.dumps(energies))

                    tx.run(q)
                tx.commit()

    #current_status = 'complete'

    j = {'energies': energyList}

    return j
