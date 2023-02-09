from neomd import calculator


def properties():
    return [
        "PolyhedralTemplateMatching_counts_OTHER",
        "PolyhedralTemplateMatching_counts_FCC",
        "PolyhedralTemplateMatching_counts_HCP",
        "PolyhedralTemplateMatching_counts_BCC",
    ]


def run(state_atom_dict):
    return calculator.apply_ovito_pipeline_modifier(
            state_atom_dict, "PolyhedralTemplateMatchingModifier"
    )
