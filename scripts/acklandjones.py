"""
properties() should return a list of attributes that this script produces per element. 
This will determine the name the property is saved as in the database.

run() should return a dictionary of state ID to attribute.
"""
from neomd import calculator


def properties():
    return [
        "AcklandJones_counts_OTHER",
        "AcklandJones_counts_FCC",
        "AcklandJones_counts_HCP",
        "AcklandJones_counts_BCC",
    ]


def run(state_atom_dict):
    return calculator.apply_ovito_pipeline_modifier(
            state_atom_dict, "AcklandJonesModifier"
    )
