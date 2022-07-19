import os
import pickle
import json
import scipy.stats
import inspect
import neo4j

from .config import Config

def metadata_to_parameters(raw_metadata):
    """
    Converts metadata to parameters to use for LAMMPSRun parameters.
    
    :param raw_metadata: The raw metadata string to convert.

    :returns: The metadata as a dictionary.
    """
    parameters = {}
    for line in raw_metadata.splitlines():
        if line != '':            
            (firstWord, rest) = line.split(maxsplit=1)
            # for some reason, pair_coeff needs to be a list
            if firstWord == "pair_coeff":
                rest = [rest]
            parameters.update({firstWord: rest})
    return parameters

def metadata_to_cmds(metadata_dict):
    """
    Converts metadata to commands to use for LAMMPSLib's lmpcmds parameters.

    :param raw_metadata: The metadata dict to convert.

    :returns: The metadata as a list.
    """
    parameters = []
    parameters.append("pair_style {rest}".format(rest=metadata_dict["pair_style"]))
    parameters.append("pair_coeff {rest}".format(rest=metadata_dict["pair_coeff"][0]))
    return parameters

def get_atom_type(parameters):
    if type(parameters) is not dict:
        raise ValueError("This only works with dict parameters.")
    return parameters['pair_coeff'][-1].split(' ')[-1]

def saveTestPickle(run, t, j):        
    """
    Saves the dictionary supplied into a pickle file for later use.
    
    :param run: name of the run you're saving
    :param t: type of sequence you're saving
    :param j: dictionary to save
    """

    createDir('api/testing')
    
    with open('api/testing/{run}_{t}.pickle'.format(run=run,t=t), 'wb') as f:
        pickle.dump(j,f)

def createDir(path):
    if not os.path.exists(path):
        os.mkdir(path)

        
def loadTestPickle(run, t):
    """
    Loads the data saved from the specified pickle file.
    
    :param run: name of the run to load
    :param t: type of sequence you're loading        
    :returns: data that was pickled
    """                

    try:
        with open('api/testing/{run}_{t}.pickle'.format(run=run,t=t), 'rb') as f:                        
            return pickle.load(f)
    except Exception as e:            
        print("Loading from database instead...")
        return None


def saveTestJson(run, t, j):
    """
    Saves the dictionary supplied into a json file for later use.
    
    :param run: name of the run you're saving
    :param t: type of sequence you're saving
    :param j: dictionary to save
        """

    createDir('api/testing')
    
    with open('api/testing/{run}_{t}.json'.format(run=run,t=t), 'w') as f:              
        json.dump(j,f, ensure_ascii=False, indent=4)


def getMetadata(run, getJson=False):
    """
        Gets the metadata of a run. If the metadata has not been loaded yet, loads it into memory. There is an option
        to return a JSON string that can be passed back to the front-end.

        :param string run: Run to retrieve metadata for
        :param bool getJson: Whether or not to return a JSON string with the metadata information.

        :returns: a dict of metadata parameters and optionally a JSON string with the metadata information.
        """
    j = {}
    metadata = None
    driver = neo4j.GraphDatabase.driver("bolt://127.0.0.1:7687",
                                        auth=("neo4j", "secret"))
    with driver.session() as session:
        try:
            result = session.run(
                "MATCH (n:Metadata {{run: '{run}' }}) RETURN n".format(
                    run=run))
            record = result.single()
            for n in record.values():
                for key, value in n.items():
                    if key == "LAMMPSBootstrapScript":
                        params = metadata_to_parameters(value)
                        cmds = metadata_to_cmds(params)
                        metadata = {
                            'parameters': params,
                            'cmds': cmds
                        }
                        j.update({key: value})
        except neo4j.exceptions.ServiceUnavailable as exception:
            raise exception

        if getJson:
            return metadata, j
        else:
            return metadata
                          
def loadTestJson(run, t):
    """
    Reads json file into memory
    
    :param run: Run to load from
    :param t: type of sequence to load
        
    :returns: Dict with sequence data

    """    
    try:
        with open('api/testing/{run}_{t}.json'.format(run=run,t=t), 'r') as f:                        
            return json.loads(f.read())
    except Exception:            
        print("Loading from database instead...")
        return None

def isContinuousDistribution(c):
    return isinstance(c, scipy.stats._continuous_distns)

def connect_to_db(c: Config):
    return neo4j.GraphDatabase.driver(c.NEO4J_ADDRESS, auth=c.NEO4J_AUTH)

def getScipyDistributions():
    modifiers = []
    
    dists = [value for _, value in inspect.getmembers(scipy.stats._continuous_distns)]        
    
    for name, value in inspect.getmembers(scipy.stats):
        if value in dists and callable(value):                                    
            modifiers.append(name)
            
    return modifiers
