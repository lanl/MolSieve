import pickle
import json

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

def metadata_to_cmds(raw_metadata):
    """
    Converts metadata to commands to use for LAMMPSLib's lmpcmds parameters.

    :param raw_metadata: The raw metadata string to convert.

    :returns: The metadata as a list.
    """
    parameters = []
    for line in raw_metadata.splitlines():
        if line != '':
            parameters.append(line)
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
    with open('vis/testing/{run}_{t}.pickle'.format(run=run,t=t), 'wb') as f:
        pickle.dump(j,f)


def loadTestPickle(run, t):
    """
    Loads the data saved from the specified pickle file.
    
    :param run: name of the run to load
    :param t: type of sequence you're loading        
    :returns: data that was pickled
    """                

    try:
        with open('vis/testing/{run}_{t}.pickle'.format(run=run,t=t), 'rb') as f:                        
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
    with open('vis/testing/{run}_{t}.json'.format(run=run,t=t), 'w') as f:              
        json.dump(j,f, ensure_ascii=False, indent=4)


def loadTestJson(run, t):
    """
    Reads json file into memory
    
    :param run: Run to load from
    :param t: type of sequence to load
        
    :returns: Dict with sequence data

    """
    try:
        with open('vis/testing/{run}_{t}.json'.format(run=run,t=t), 'r') as f:                        
            return f.read()
    except Exception as e:            
        print("Loading from database instead...")
        return None
