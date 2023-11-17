import copy
import glob
import os

import ase.io.lammpsdata
import neo4j
import networkx as nx
import numpy as np
import ovito.io
from ase import Atoms, neighborlist
from ovito.data import *
from ovito.modifiers import ColorCodingModifier

from neomd import converter
from neomd.graphs import StateGraph, TransitionGraph, graphutils
from neomd.queries import Neo4jQueryBuilder


def modify_pipeline(pipeline, data):
    prev = data.get("prev", None)
    # next = data.get('next', None)

    if prev is not None:
        driver = neo4j.GraphDatabase.driver(
            "bolt://127.0.0.1:7687", auth=("neo4j", "secret")
        )
        qb = Neo4jQueryBuilder(
            [("Atom", "PART_OF", "State", "MANY-TO-ONE")], ["State"]
        )

        q = qb.generate_get_node_list("State", [int(prev)], "PART_OF")
        atom_dict = converter.query_to_ASE(driver, q)

        ov = pipeline.source.data

        s1 = StateGraph(ovito.io.ase.ovito_to_ase(ov), 0)
        s2 = StateGraph(atom_dict[int(prev)], 1)
        b = TransitionGraph(s1, s2)
        b.remove_null_edges()
        b.remove_unconnected()
        bonds = ov.particles_.create_bonds()
        weights = []
        for e in b.graph.edges:
            edge = b.graph.edges[e]
            u, v = e
            u_node = b.graph.nodes[u]
            v_node = b.graph.nodes[v]
            u_n = u_node["atom_number"]
            v_n = v_node["atom_number"]
            if (
                "weighted_distance" in edge
                and u_node["bipartite"] == v_node["bipartite"]
            ):
                bonds.add_bond(u_n, v_n, type=0)
                w = float(edge["weighted_distance"])
                weights.append(w)
        bonds.create_property("weight", data=weights)

        pipeline.modifiers.append(
            ColorCodingModifier(
                property="weight",
                operate_on="bonds",
                gradient=ColorCodingModifier.Magma(),
            )
        )
