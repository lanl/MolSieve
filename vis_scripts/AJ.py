import ovito
from ovito.modifiers import AcklandJonesModifier, ExpressionSelectionModifier, ComputePropertyModifier

def modify_pipeline(pipeline):
    pipeline.modifiers.append(AcklandJonesModifier())
    pipeline.modifiers.append(ExpressionSelectionModifier(expression='StructureType == 0'))
    pipeline.modifiers.append(ComputePropertyModifier(output_property= 'Transparency', expressions=('0.9'), only_selected=True))
