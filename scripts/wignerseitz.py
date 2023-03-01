import ovito
import ase
from ase.io import lammpsdata
from ovito.io import *
from ovito.io.ase import ase_to_ovito
from ovito.data import *
from ovito.modifiers import *
from ovito.pipeline import *
def properties():
    return [
        "Vacancy_Count",
        "Interstitial_Count"
    ]

def sanitize_neo4j_string(string):
    """
    Converts a string to one that is safe for neo4j to use in attribute / label names.
    Based on https://neo4j.com/docs/cypher-manual/current/syntax/naming/
    
    :param string: the string to convert

    :returns: a safe string for neo4j to consume
    """
    return re.sub('[^A-Za-z0-9]+', '_', string)



def run(state_atom_dict):
    result = {}
    for id, atoms in state_atom_dict.items():
        
        o_atoms = ase_to_ovito(atoms)
        # load reference cell
        reference_cell = lammpsdata.read_lammps_data("scripts/reference_cell.dat", style='atomic')
        o_reference_cell = ase_to_ovito(reference_cell)

        pipeline = Pipeline(source=StaticSource(data=o_atoms))

        ws = WignerSeitzAnalysisModifier(
            per_type_occupancies = True,
            affine_mapping = ReferenceConfigurationModifier.AffineMapping.ToReference
        )
       
        ws.reference = StaticSource(data=o_reference_cell)
 
        pipeline.modifiers.append(ws)
        data = pipeline.compute()
        
        cleanDict = {
            utils.sanitize_neo4j_string(k): v for k, v in data.attributes.items()
        } 
        print(cleanDict)
        result.update({id: {'Vacancy_Count': cleanDict['WignerSeitz_vacancy_count'],
                            'Interstitial_Count': cleanDict['WignerSeitz_interstitial_count']
        }})

    return result
