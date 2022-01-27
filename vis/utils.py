def metadata_to_parameters(raw_metadata):    
    parameters = {}    
    for line in raw_metadata.splitlines():
        if line != '':            
            (firstWord, rest) = line.split(maxsplit=1)
            # for some reason, pair_coeff needs to be a list
            if firstWord == "pair_coeff":
                rest = [rest]
            parameters.update({firstWord: rest})
    return parameters

def get_atom_type(parameters):
    return parameters['pair_coeff'][-1].split(' ')[-1]
