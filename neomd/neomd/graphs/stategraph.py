import networkx as nx
from ase import Atoms, neighborlist
import numpy as np
from typing import Dict, Any

"""
StateGraphs are networkx representations of Atoms objects.
"""


def _update_nodes(g, atoms):
    for idx, a in enumerate(atoms):
        g.nodes[idx]["id"] = a.tag

        x, y, z = a.position
        g.nodes[idx]["p_x"] = x
        g.nodes[idx]["p_y"] = y
        g.nodes[idx]["p_z"] = z


class StateGraph:
    def __init__(self, atoms: Atoms, id: int):
        # will break when fed something other than Pt atoms
        an = neighborlist.build_neighbor_list(
            atoms, [1.5] * len(atoms), skin=0, bothways=True
        )

        cm = an.get_connectivity_matrix()
        g = nx.from_numpy_array(cm)
        m = atoms.get_all_distances()

        # calculate once to save time
        _update_nodes(g, atoms)

        # remove self-loops
        for u, v in g.edges:
            if u == v:
                g.remove_edge(u, v)
            else:
                # 1/3 is the threshold, make this a parameter
                # 5 is bond_weight scaling factor
                g[u][v]["bond_weight"] = max(1 / m[u][v] - 1 / 3.0, 0) * 5

        self.graph = g
        self.atoms = atoms
        self.id = id
        self.dm = m

    # overload subtraction to get difference between two states
    def __sub__(self, other) -> Dict[int, Dict[str, Any]]:
        """
        Subtraction yields the difference the atom positions
        of the two states.

        :param other: A StateGraph
        :returns: A dictionary of differences, keyed by atom number.
        """
        transform = {}
        for n in self.graph.nodes:
            dx = self.graph.nodes[n]["p_x"] - other.graph.nodes[n]["p_x"]
            dy = self.graph.nodes[n]["p_y"] - other.graph.nodes[n]["p_y"]
            dz = self.graph.nodes[n]["p_z"] - other.graph.nodes[n]["p_z"]
            transform[n] = {"dx": dx, "dy": dy, "dz": dz}
        return transform

    def __lshift__(self, other):
        """
        Get the labels from another StateGraph and relabel self.
        :param other: The other StateGraph.
        :returns: The mapping used to relabel self.
        """
        mapping = self.map_from(other)
        self.graph = nx.relabel_nodes(self.graph, mapping)
        self.atoms = self.remap_atoms(mapping)
        return mapping

    def remap_atoms(self, mapping):
        """
        Relabels atoms given a mapping, which is a dictionary of
        node labels to node labels.

        :param mapping: Mapping to relabel atoms with.
        """
        atoms = Atoms(pbc=self.atoms.get_pbc(), cell=self.atoms.cell.cellpar())
        for i in range(0, len(self.atoms)):
            atoms.append(self.atoms[mapping[i]])
        return atoms

    def set_atoms(self, atoms):
        _update_nodes(self.graph, atoms)
        self.atoms = atoms

    # TODO: turn Dict[str, Any] into a type for better checks
    def __add__(self, transform: Dict[int, Dict[str, Any]]):
        """
        Adds a dictionary keyed by atom number where each value
        is a dictionary {"dx": x, "dy": y, "dz": z} to each atom's
        positions.

        :param transform: Dictionary of transformations.
        """
        for n in self.graph.nodes:
            self.graph.nodes[n]["p_x"] += transform[n]["dx"]
            self.graph.nodes[n]["p_y"] += transform[n]["dy"]
            self.graph.nodes[n]["p_z"] += transform[n]["dz"]

    def map_from(self, other) -> Dict[Any, Any]:
        """
        Generates a mapping from another isomorphic graph.

        :param other: StateGraph to map to.
        :raises ValueError: Raised if self and other are not isomorphic.
        """
        graph = nx.isomorphism.GraphMatcher(self.graph, other.graph)
        iso = graph.is_isomorphic()
        if not iso:
            raise ValueError(f"Graphs {self.id} and {other.id} are not isomorphic.")
        return graph.mapping

    def get_distance_matrix(self):
        """
        Returns the distance matrix of the graph.
        """
        return self.dm

    def size(self):
        return len(self.graph.nodes)

    def draw(self):
        """
        Draws a representation of the graph with labels. Best in Jupyter
        notebooks.
        """
        xy = {}
        for n in self.graph:
            xy[n] = [self.graph.nodes[n]["p_x"], self.graph.nodes[n]["p_y"]]
        nx.draw_networkx(self.graph, pos=xy, with_labels=True)
