#
# © 2025. Triad National Security, LLC. All rights reserved.
# This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
#
from logging import warn
import neo4j
from neomd import calculator
from neomd import converter
from neomd.queries.querybuilder import Neo4jQueryBuilder
from neomd.constants import Transition
from neomd.graphs.graphutils import coulomb, ASE_to_laplacian

import pickle
import os
import numpy as np
from tqdm import tqdm
from ase import Atoms
from typing import Dict, List
from ase.calculators.lammpslib import LAMMPSlib
import copy

import ovito
from ovito.io.ase import ase_to_ovito
from ovito.pipeline import Pipeline, StaticSource

try:
    import lammps
    import fitsnap3
    from fitsnap3lib.fitsnap import FitSnap
    from fitsnap3lib.scrapers.ase_funcs import ase_scraper

    lmp = lammps.lammps()

    class FeatureCalculator:
        def __init__(self, name, settings, cmds, header):
            self.fitsnap = FitSnap(settings, arglist=["--overwrite"])
            self.cmds = cmds
            self.header = header
            self.name = name

    def snap_per_state(states, ase_dict, fc: FeatureCalculator):
        data = {}
        fs = fc.fitsnap
        calc = LAMMPSlib(lmpcmds=fc.cmds, keep_alive=True, lammps_header=fc.header)
        atoms = []
        for s in tqdm(states):
            a = copy.deepcopy(ase_dict[s])
            a.pbc = [True, True, True]
            a.calc = calc
            atoms.append(a)

        for i, config in enumerate(tqdm(ase_scraper(atoms))):
            a, b, w = fs.calculator.process_single(config)
            s = states[i]
            data[s] = a
        return data

    def to_LAMDA(
        trajectory_name: str,
        folder: str,
        driver,
        fc: FeatureCalculator,
        dm_items_fn=None,
        norm=lambda x, y: np.linalg.norm(y - x),
        num_processes=16,
        **kwargs,
    ):
        qb = Neo4jQueryBuilder.infer_db_structure(driver)
        transition_list = calculator.get_transitions(driver, trajectory_name)
        canonical, states = calculator.simplify_transitions(transition_list)

        print("Finished loading transitions.")
        q = qb.get_states(states, True)
        ase_dict = converter.query_to_ASE(driver, q)

        os.makedirs(folder, exist_ok=True)

        with open(f"{folder}/ase_dict.pickle", "wb") as f:
            pickle.dump(ase_dict, f)
        print(f"Saved ASE objects to {folder}/ase_dict.pickle.")

        with open(f"{folder}/transitions.pickle", "wb") as f:
            pickle.dump(canonical, f)
        print(f"Saved transitions to {folder}/transitions.pickle")

        print("Calculating SNAP features.")
        snap_features = snap_per_state(states, ase_dict, fc)
        os.makedirs(f"{folder}/alignment", exist_ok=True)

        with open(f"{folder}/alignment/{fc.name}.pickle", "wb") as f:
            pickle.dump(snap_features, f)
        print(f"Saved per-atom features to {folder}/alignment/{fc.name}.pickle")

        if dm_items_fn is None:
            print("Calculating SNAP distances.")
            dm_items = snap_features
            dm_name = fc.name
        else:
            print("Calculating user defined distances.")
            dm_name, dm_items = dm_items_fn(states, ase_dict, **kwargs)

        print("Calculating final distance matrix.")
        m = calculate_tij_dm(
            canonical, dm_items, norm=norm, num_processes=num_processes
        )

        os.makedirs(f"{folder}/dms", exist_ok=True)
        with open(f"{folder}/dms/{dm_name}.pickle", "wb") as f:
            pickle.dump(m, f)

        print(f"Saved distance matrix to {folder}/dms/{dm_name}.pickle")

        return states, canonical, ase_dict, m

except ImportError as e:
    warn(
        f"{e}\n Failed to load LAMMPS / FitSnap. The LAMDA extraction function (to_LAMDA) will be unavailable."
    )


def calc_tij(t: Transition, items, rcond=1e-7):
    s1, s2 = t
    Ai = items[s1]
    Aj = items[s2]
    return Aj @ np.linalg.pinv(Ai, rcond=rcond)


def calculate_ev(t_list: List[Transition], items, rcond=1e-7):
    specs = []
    for t in tqdm(t_list):
        tij = calc_tij(t, items, rcond=rcond)
        evals, evecs = np.linalg.eig(tij)
        order = np.argsort(evals.real)
        specs.append(evals[order].real)
    return specs


def coulombs(states, ase_dict, **kwargs):
    data = {}
    for s in tqdm(states):
        data[s] = coulomb(ase_dict[s], **kwargs)
    return "coulomb", data


def laplacian(states, ase_dict, **kwargs):
    data = {}
    for s in tqdm(states):
        data[s] = ASE_to_laplacian(ase_dict[s], **kwargs)
    return "laplacian", data


def _structural_count_preprocessing(data):
    d = np.array(data.particles["Structure Type"][:])
    other = np.where(d == 0, 1, 0)
    fcc = np.where(d == 1, 1, 0)
    hcp = np.where(d == 2, 1, 0)
    bcc = np.where(d == 3, 1, 0)
    ico = np.where(d == 4, 1, 0)
    return np.stack([other, fcc, hcp, bcc, ico]).T


def cna(states, ase_dict):
    m = ovito.modifiers.CommonNeighborAnalysisModifier()
    for x in m.structures[:5]:
        x.enabled = True
    return ovito_modifier(
        states, ase_dict, m, preprocess_fn=_structural_count_preprocessing
    )


def ptm(states, ase_dict):
    m = ovito.modifiers.PolyhedralTemplateMatchingModifier()
    for x in m.structures[:5]:
        x.enabled = True
    return ovito_modifier(
        states, ase_dict, m, preprocess_fn=_structural_count_preprocessing
    )


def ovito_modifier(states, ase_dict, modifier, preprocess_fn=lambda x: x):
    data = {}
    for s in tqdm(states):
        a = ase_to_ovito(ase_dict[s])
        pipeline = Pipeline(source=StaticSource(data=a))
        pipeline.modifiers.append(modifier)
        data[s] = preprocess_fn(pipeline.compute())

    return data


def calculate_tij_dm(
    t_list,
    items,
    norm=lambda x, y: np.linalg.norm(y - x),
    rcond=1e-7,
    num_processes=16,
):
    evs = calculate_ev(t_list, items, rcond=rcond)
    m = calculator.distance_matrix(evs, fn=norm)

    return m
