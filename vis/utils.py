def metadata_to_parameters(raw_metadata):    
    parameters = {}    
    for line in raw_metadata.splitlines():
        if line != '':
            (firstWord, rest) = line.split(maxsplit=1)
            parameters.update({firstWord: rest})    
    return parameters

def get_atom_type(parameters):
    return parameters['pair_coeff'].split(' ')[-1]
