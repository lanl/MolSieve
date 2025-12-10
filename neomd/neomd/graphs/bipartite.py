#
# © 2025. Triad National Security, LLC. All rights reserved.
# This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
#
"""
Wrapper over networkx.graph that builds an n-partite graph from n StateGraphs.
Each "layer" of the n-partite graph corresponds to one StateGraph,
so each node is an atom.
Atoms between layers are connected iff the difference in the bond
lengths is above the threshold set.
"""
import networkx as nx
from neomd.graphs import StateGraph, graphutils
import copy
from typing import Set, List, Union, Tuple
import math

class TransitionGraph:
    def __init__(self, *args: StateGraph, threshold=0.1):
        self.graph = nx.Graph()
        for i, sg in enumerate(args):
            self.__stack_graph(sg)

        for i in range(0, len(args) - 1):
            g1 = args[i]
            g2 = args[i + 1]
            self.__connect_edges(g1, g2, threshold)

        self.graphs = [a for a in args]
        self.threshold = threshold

    def __connect_edges(self, g1: StateGraph, g2: StateGraph, threshold):
        """
        Connects two layers of the graph.

        :param g1: First state graph to connect.
        :param g2: Second state graph to connect.
        :param threshold: Relative bond delta threshold.
        """
        bond_delta = graphutils.calculate_rel_bond_delta(g1, g2)

        def get_graph_nodes(g):
            return list(
                map(
                    lambda e: e[0],
                    filter(
                        lambda n: n[1]["bipartite"] == g.id,
                        self.graph.nodes(data=True),
                    ),
                )
            )

        g1_nodes = get_graph_nodes(g1)
        g2_nodes = get_graph_nodes(g2)

        for n1, n2 in zip(g1_nodes, g2_nodes):
            atom_number = self.graph.nodes[n1]["atom_number"]

            # find neighbor max delta
            n1n = list(nx.neighbors(g1.graph, atom_number))
            n2n = list(nx.neighbors(g2.graph, atom_number))

            delta = list(
                map(lambda n: bond_delta[atom_number][n], list(set(n1n + n2n)))
            )

            bd = max(delta)
            bd = max(0, bd - threshold)

            self.graph.add_edge(
                n1,
                n2,
                bond_delta=bd,
            )

        self.__calculate_weights()

    # adds a graph layer without edges
    def __stack_graph(self, sg: StateGraph):
        for n in sg.graph.nodes:
            key = f"{str(n)}_{sg.id}"
            self.graph.add_node(key, bipartite=sg.id, atom_number=n)

        for u, v in sg.graph.edges:
            bl = sg.graph[u][v]["bond_weight"]
            self.graph.add_edge(
                f"{str(u)}_{sg.id}",
                f"{str(v)}_{sg.id}",
                bond_weight=bl,
            )

    def stack_graphs(self, *args: StateGraph):
        """
        Takes any number of state graphs and adds them to the n-partite
        graph.

        :param args: The state graphs to add.
        :param threshold : Threshold sets whether or not two atoms are
        connected.
        """
        for sg in args:
            self.__stack_graph(sg)
            last = self.graphs[-1]
            self.__connect_edges(last, sg, self.threshold)
            self.graphs.append(sg)

    def get_graph_ids(self) -> List[int]:
        """
        Returns a list of stateIDs that belong to the graph.

        :return: A list of stateIDs.
        """
        return list(map(lambda g: g.id, self.graphs))

    def reduce(self):
        """
        Reduces the transition graph to only the atoms that moved.
        """
        g = copy.deepcopy(self)
        moved = self.get_moved()
        for n in self.graph.nodes:
            if n["atom_number"] not in moved:
                g.graph.remove_node(n)
        g.remove_unconnected()
        return g

    def reduce_by_edge(self):
        g = copy.deepcopy(self)
        g.remove_null_edges()
        g.remove_unconnected()
        return g

    def __calculate_weights(self):
        """
        Calculates the weights for each edge. Each inter-state edge
        is weighed by how much the bond length changes between its
        bipartite equivalent in the graph.
        """
        inner_edges = list(
            filter(
                lambda e: "bond_delta" not in self.graph.edges[e], self.graph.edges
            )
        )

        for u, v in inner_edges:
            edge = self.graph[u][v]
            # get the bipartite edge for each node
            bp1 = list(filter(lambda e: "bond_delta" in self.graph.edges[e], self.graph.edges(u)))[0]
            bp2 = list(filter(lambda e: "bond_delta" in self.graph.edges[e], self.graph.edges(v)))[0]
            edge["weighted_distance"] = math.sqrt(edge["bond_weight"] * math.sqrt(self.graph.edges[bp1]["bond_delta"] * self.graph.edges[bp2]["bond_delta"]))
            self.graph.edges[bp1]["weighted_distance"] = self.graph.edges[bp1]["bond_delta"]  
            self.graph.edges[bp2]["weighted_distance"] = self.graph.edges[bp2]["bond_delta"]
    
    def remove_unconnected(self):
        """
        Removes any nodes from that graph that are not connected
        """
        g = copy.deepcopy(self.graph)
        for n in self.graph.nodes:
            if self.graph.degree[n] == 0:
                g.remove_node(n)
        self.graph = g

    def remove_null_edges(self):
        """
        Removes edges that have 0 weight.
        """
        graph_edges = list(
            filter(
                lambda e: "weighted_distance" in self.graph.edges[e]
                and self.graph.edges[e]["weighted_distance"] == 0.0,
                self.graph.edges,
            )
        )
        self.graph.remove_edges_from(graph_edges)
        graph_edges = list(
            filter(
                lambda e: "bond_delta" in self.graph.edges[e]
                and self.graph.edges[e]["bond_delta"] == 0.0,
                self.graph.edges,
            )
        )
        self.graph.remove_edges_from(graph_edges)

    def get_transitions(self) -> Union[Tuple[int, int], List[Tuple[int, int]]]:
        """
        Gets the transitions contained in the graph.

        :return: A tuple or list of tuples of state IDs contained in
        the graph.
        """
        id_list = self.get_graph_ids()
        transitions = [
            ((i), (i + 1) % len(id_list)) for i in range(len(id_list))
        ]
        if len(transitions) == 1:
            return transitions[0]
        else:
            return transitions

    def get_moved(self) -> Set[int]:
        """
        Gets the atoms that moved during the transition.

        :return: A set of atom ids that moved during the transition.
        """
        moved = set()
        for e in self.graph.edges:
            edge = self.graph.edges[e]
            if "bond_delta" in edge and edge["bond_delta"] > 0:
                moved.add(self.graph.nodes[e[0]]["atom_number"])
        return moved

    def draw(self, x_gap: int = 10, y_gap: int = 5):
        """
        Rendering function for debugging, only really works inside
        Jupyter notebooks.

        :param x_gap: Space between layers.
        :param y_gap: Space between atoms within layers.
        """
        graph_ids = self.get_graph_ids()
        y_counter = [0] * len(graph_ids)

        xy = {}
        for n in self.graph:
            x = graph_ids.index(
                self.graph.nodes[n]["bipartite"]
            )  # get which state it belongs to
            xy[n] = [x * x_gap, y_counter[x] * y_gap]
            y_counter[x] += 1
        nx.draw_networkx(self.graph, pos=xy)
