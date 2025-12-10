#
# © 2025. Triad National Security, LLC. All rights reserved.
# This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
#
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
