import neo4j
import ovito
import pickle
from neomd import querybuilder, converter, calculator, visualizations
import os

# image rendering
from PIL import Image
import io, sys
import base64

os.environ['OVITO_THREAD_COUNT'] = '1'

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

def saveTestPickle(run, t, j):        
    """
    Saves the dictionary supplied into a pickle file for later use.
    
    :param run: name of the run you're saving
    :param t: type of sequence you're saving
    :param j: dictionary to save
    """                
    with open('{run}_{t}.pickle'.format(run=run,t=t), 'wb') as f:
        pickle.dump(j,f)


def loadTestPickle(run, t):
    """
    Loads the data saved from the specified pickle file.
    
    :param run: name of the run to load
    :param t: type of sequence you're loading        
    :returns: data that was pickled
    """                

    try:
        with open('{run}_{t}.pickle'.format(run=run,t=t), 'rb') as f:                        
            return pickle.load(f)
    except Exception as e:            
        print("Loading from database instead...")
        return None

@app.get("/generate_ovito_image/{number}")
async def generate_ovito_image(number: str):        
    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))
    
    qb = querybuilder.Neo4jQueryBuilder(
        schema=[("State", "nano_pt", "State", "ONE-TO-ONE"),
                ("Atom", "PART_OF", "State", "MANY-TO-ONE")])
    
    q = qb.generate_get_node('State', ("number", number), 'PART_OF')               

    state_atom_dict = converter.query_to_ASE(driver, qb, q, 'Pt', False)        

    print(state_atom_dict)

    qimg = None

    for atoms in state_atom_dict.values():            
        qimg = visualizations.render_ASE(atoms)        

    img = Image.fromqimage(qimg)
    rawBytes = io.BytesIO()
    img.save(rawBytes, "PNG")
    rawBytes.seek(0)
    img_base64 = base64.b64encode(rawBytes.read())
    print(img_base64)

    return True
    #return jsonify({'image': str(img_base64)})

    

@app.post('/run_preprocessing')
async def run_preprocessing(data: dict):
    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "secret"))        
    #        data = request.get_json(force=True)        

    run = data['run']
    steps = data['steps']

    qb = querybuilder.Neo4jQueryBuilder(
        [('State', data['run'], 'State', 'ONE-TO-ONE'),
         ('Atom', 'PART_OF', 'State', 'MANY-TO-ONE')])        

    #state_atom_dict = None
    state_atom_dict = loadTestPickle(run, 'state_atom_dict')
    """
    if app.config['IMPATIENT']:
        state_atom_dict = loadTestPickle(run, 'state_atom_dict')
    else:
    """
    #q = qb.generate_trajectory(run,
    #                           "ASC", ['RELATION', 'timestep'],
    #                           node_attributes=[],
    #                           relation_attributes=[],
    #                           include_atoms=True)        

    #print("before query to ase")
    #state_atom_dict = converter.query_to_ASE(driver, qb, q, get_atom_type(getMetadata(run)), False)
    #state_atom_dict = converter.query_to_ASE(driver, qb, q, 'Pt', False)
    #print("after query to ase")
    #saveTestPickle(run, 'state_atom_dict', state_atom_dict)

    for step in steps:
        print(step)
        if step['type'] == 'ovito_modifier':
            new_attributes = calculator.apply_ovito_pipeline_modifier(state_atom_dict, analysisType=step['value'])
            print(new_attributes)
        else:
            raise NotImplementedError()

    return 'Ran preprocessing steps'
