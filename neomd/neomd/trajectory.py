"""
Class for managing and analyzing trajectories.
"""
from neomd import calculator, converter


# Keep it simple, use this class only for data storage
# have static methods to do things to the trajectory
# basically just grab the various members of this class to do analyses
class Trajectory:
    sequence = []
    name: str = ""
    transitions = []
    ase_atoms = {}
    state_graphs = {}
    transition_graphs = {}

    def __init__(self, driver, qb, name):
        self.driver = driver
        self.qb = qb
        self.name = name

        self.sequence = calculator.get_sequence(driver, name)
        self.transitions = calculator.get_transitions(driver, name) 
        unique_states = list(set(self.sequence))

        # TODO: how do we guarantee labels are correct for each trajectory?
        calculator.relabel_trajectory(driver, qb, name)

        q = qb.get_states(unique_states, True, order_by=f"{name}_label")

        self.ase_atoms = converter.query_to_ASE(driver, q)
        graph_dict, transition_dict = calculator.transitions_to_graphs(
            self.transitions, self.ase_atoms
        )

        self.state_graphs = graph_dict
        self.transition_graphs = transition_dict
