import ovito
from ovito.modifiers import (
    CommonNeighborAnalysisModifier,
    ComputePropertyModifier,
    ExpressionSelectionModifier,
)


def modify_pipeline(pipeline, data):
    pipeline.modifiers.append(CommonNeighborAnalysisModifier())
    pipeline.modifiers.append(
        ExpressionSelectionModifier(expression="StructureType == 0")
    )
    pipeline.modifiers.append(
        ComputePropertyModifier(
            output_property="Transparency",
            expressions=("0.9"),
            only_selected=True,
        )
    )
