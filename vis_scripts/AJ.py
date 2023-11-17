import ovito
from ovito.modifiers import (
    AcklandJonesModifier,
    ComputePropertyModifier,
    ExpressionSelectionModifier,
)


def modify_pipeline(pipeline, data):
    pipeline.modifiers.append(AcklandJonesModifier())
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
