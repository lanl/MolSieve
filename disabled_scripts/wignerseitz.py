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
        "X_Com",
        "Y_Com",
        "Z_Com"
    ]

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
        
        pipeline.modifiers.append(ExpressionSelectionModifier(expression = 'Occupancy == 1'))     
        pipeline.modifiers.append(DeleteSelectedModifier())     
        pipeline.modifiers.append(ClusterAnalysisModifier(cutoff = 8.0, sort_by_size = True, unwrap_particles = True, compute_com = True, cluster_coloring = True)) 
        data = pipeline.compute() 
        cluster_table = data.tables['clusters'] 
        xcom=cluster_table['Center of Mass'][...][0][0] 
        ycom=cluster_table['Center of Mass'][...][0][1] 
        zcom=cluster_table['Center of Mass'][...][0][2]

        data = pipeline.compute()
        result.update({id: {'X_Com': xcom,
                            'Y_Com': ycom,                
                            'Z_Com': zcom}})

    return result
