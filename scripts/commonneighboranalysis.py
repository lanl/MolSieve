from neomd import calculator


def properties():
    return [
        "CommonNeighborAnalysis_counts_FCC",
        "CommonNeighborAnalysis_counts_HCP",
        "CommonNeighborAnalysis_counts_BCC",
        "CommonNeighborAnalysis_counts_ICO",
        "CommonNeighborAnalysis_counts_OTHER",
    ]


def run(state_atom_dict):
    return calculator.apply_ovito_pipeline_modifier(
            state_atom_dict, "CommonNeighborAnalysisModifier"
    )
