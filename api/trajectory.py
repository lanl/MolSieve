from neomd import calculator
from .graphdriver import GraphDriver

from .utils import saveTestPickle, loadTestPickle
import pygpcca as gp
import neo4j
from scipy import sparse
from collections import Counter
import time
import logging

SIZE_THRESHOLD = 250

"""
TODO: Consider decoupling Neo4j driver from this class completely
"""


class Trajectory:
    metadata = None
    cmds = None
    sequence = []
    unique_states = None
    name: str = ""
    clusterings = {}
    fuzzy_memberships = {}
    idToCluster = {}
    chunks = []
    min_chi = []

    def __init__(self, name, sequence, unique_states):
        self.name = name
        self.sequence = sequence
        self.unique_states = unique_states

    def single_pcca(self, numClusters: int, driver):
        driver = GraphDriver()

        m, idx_to_id = calculator.calculate_transition_matrix(
            driver, run=self.name, discrete=True
        )
        gpcca = gp.GPCCA(m, z="LM", method="krylov")

        return self._single_pcca(gpcca, idx_to_id, numClusters)

    def _single_pcca(self, gpcca, idx_to_id, num_clusters: int):

        r = loadTestPickle(self.name, f"{self.name}_pcca_cluster_{num_clusters}")
        if r is not None:
            self.clusterings[num_clusters] = r["clusters"]
            self.fuzzy_memberships[num_clusters] = r["fuzzy_memberships"]
            return
        try:
            # need to run minChi before clustering
            gpcca.minChi(2, 20)
            gpcca.optimize(num_clusters)
        except ValueError as exception:
            raise exception
        self.save_membership_info(gpcca, idx_to_id, num_clusters)

        saveTestPickle(
            self.name,
            f"{self.name}_pcca_cluster_{num_clusters}",
            {
                "clusters": self.clusterings[num_clusters],
                "fuzzy_memberships": self.fuzzy_memberships[num_clusters],
            },
        )

    def pcca(self, m_min: int, m_max: int, driver):
        # attempt to re-hydrate from JSON file before running PCCA
        r = loadTestPickle(self.name, f"optimal_pcca_{m_min}_{m_max}")
        if r is not None:
            self.clusterings = r["clusterings"]
            self.fuzzy_memberships = r["fuzzy_memberships"]
            self.current_clustering = r["optimal_value"]
            self.feasible_clusters = r["feasible_clusters"]
            self.min_chi = r["min_chi"]
            return

        t0 = time.time()
        m, idx_to_id = calculator.calculate_transition_matrix(
            driver, run=self.name, discrete=True
        )
        t1 = time.time()
        logging.info(f"Loading transition matrix took {t1-t0} seconds total.")

        gpcca = gp.GPCCA(m, z="LM", method="krylov")
        try:
            mc = gpcca.minChi(m_min, m_max)
            self.optimal_value = mc.index(max(mc)) + m_min
            self.current_clustering = self.optimal_value
            gpcca.optimize(self.optimal_value)
            feasible_clusters = [self.optimal_value]
            t0 = time.time()
            self._single_pcca(gpcca, idx_to_id, self.optimal_value)
            t1 = time.time()
            logging.info(f"Clustering into {self.optimal_value} clusters took {t1-t0} seconds total")
            self.feasible_clusters = feasible_clusters
        except ValueError as exception:
            raise exception

        self.min_chi = mc
        saveTestPickle(
            self.name,
            f"optimal_pcca_{m_min}_{m_max}",
            {
                "clusterings": self.clusterings,
                "fuzzy_memberships": self.fuzzy_memberships,
                "optimal_value": self.optimal_value,
                "feasible_clusters": self.feasible_clusters,
                "min_chi": self.min_chi
            },
        )

    def save_membership_info(self, gpcca, idx_to_id, num_clusters):
        clusters = []
        fuzzy_memberships = {}
        for set in gpcca.macrostate_sets:
            idList = []
            for stateID in set:
                idList.append(idx_to_id[stateID])
            clusters.append(idList)
            for idx, mem in enumerate(gpcca.memberships.tolist()):
                fuzzy_memberships.update({idx_to_id[idx]: mem})
        self.clusterings[num_clusters] = clusters
        self.fuzzy_memberships[num_clusters] = fuzzy_memberships

    def current_cluster(self):
        return self.clusterings[self.current_clustering]

    def current_fuzzy_membership(self):
        return self.fuzzy_memberships[self.current_clustering]

    def calculateIDToCluster(self):
        for clusterIdx, cluster in enumerate(self.current_cluster()):
            for id in cluster:
                self.idToCluster[id] = clusterIdx

    def simplify_sequence(
        self,
        chunkingThreshold: float,
    ):
        chunks = []

        importance = self.calculate_sequence_importance(
            chunkingThreshold,
        )
        # Split into another function
        # returns 0 if unimportant, 1 if important
        first = 0
        last = 0
        important = importance[0]
        cluster = self.idToCluster[self.sequence[0]]
        for timestep, id in enumerate(self.sequence):
            isCurrImportant = importance[timestep]

            if last - first > SIZE_THRESHOLD and (
                important != isCurrImportant
                or cluster != self.idToCluster[id]
                or timestep == len(self.sequence) - 1
            ):

                sequence = self.sequence[first : last + 1]
                if not important and len(sequence) > 20:
                    state_counts = Counter(sequence)
                    sequence = [
                        x[0]
                        for x in state_counts.most_common(20 + int(len(sequence) * 0.1))
                    ]

                    # remove these from the list, then randomly select 10%
                    # select = int(len(stateIDs) * 0.1)
                    # state_ids = [x[0] for x in most_common]

                chunk = {
                    "timestep": first,
                    "last": last,
                    "firstID": self.sequence[first],
                    "important": important,
                    "cluster": cluster,
                    "sequence": sequence,
                }
                first = timestep
                last = timestep
                important = isCurrImportant
                cluster = self.idToCluster[id]
                chunks.append(chunk)
            else:
                last = timestep

        self.chunkingThreshold = chunkingThreshold
        self.chunks = chunks

    def calculate_sequence_importance(
        self,
        chunkingThreshold: float,
    ):
        epsilon = 0.0001

        isImportant = (
            lambda id: 1
            if max(self.current_fuzzy_membership()[id]) <= chunkingThreshold + epsilon
            else 0
        )
        importance = list(map(isImportant, self.sequence))

        i = 0
        while i != len(importance) - 1:
            if importance[i] == 1:
                j = i + 1
                while j < len(importance) - 1 and importance[j] == 1:
                    j += 1
                if j - i < SIZE_THRESHOLD:
                    while i < j:
                        importance[i] = 0
                        i += 1
                i = j
            else:
                i += 1

        return importance

    def calculate_id_to_timestep(self, driver):
        r = loadTestPickle(self.name, "idToTimestep")
        if r is not None:
            self.id_to_timestep = r
            return

        query = """MATCH (n:{run})-[r:{run}]->(:{run})
                   RETURN DISTINCT ID(n) as id, collect(r.timestep) as timesteps;""".format(
            run=self.name
        )

        j = None
        with driver.session() as session:
            try:
                result = session.run(query)
                j = result.data()
            except neo4j.exceptions.ServiceUnavailable as exception:
                raise exception

        saveTestPickle(self.name, "idToTimestep", j)
        self.id_to_timestep = j
