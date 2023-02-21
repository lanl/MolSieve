import ase
import networkx as nx

def properties():
    return [
        "Max_Graph_Eccentricity",
        "Average_Eccentricity"
    ]


def run(state_atom_dict):
    result = {}
    for id, atoms in state_atom_dict.items():
        an = ase.neighborlist.build_neighbor_list(atoms)
        cm = an.get_connectivity_matrix()
        
        g = nx.from_numpy_array(cm)
        eccentricity = list(nx.eccentricity(g).values())
        maxE = max(eccentricity)
        avgE = sum(eccentricity) / len(eccentricity)
        result[id] = {'Max_Graph_Eccentricity': maxE, 'Average_Eccentricity': avgE}
        
    return result
