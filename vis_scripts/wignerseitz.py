import ovito
import ase
from ase.io import lammpsdata
from ovito.io import *
from ovito.io.ase import ase_to_ovito
from ovito.data import *
from ovito.modifiers import *
from ovito.pipeline import *

def modify_pipeline(pipeline):
    reference_cell = lammpsdata.read_lammps_data("vis_scripts/reference_cell.dat", style='atomic')
    o_reference_cell = ase_to_ovito(reference_cell)

    ws = WignerSeitzAnalysisModifier(
        affine_mapping = ReferenceConfigurationModifier.AffineMapping.ToReference
    )
      
    #ws.output_displaced = True
    ws.reference = StaticSource(data=o_reference_cell)
 
    pipeline.modifiers.append(ws)
    #pipeline.modifiers.append(ExpressionSelectionModifier(expression = 'Occupancy > 1'))
    pipeline.modifiers.append(ColorCodingModifier(
        property = 'Occupancy',
        gradient = ColorCodingModifier.Hot(),
    ))
