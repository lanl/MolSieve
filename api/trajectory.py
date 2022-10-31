from neomd import calculator
from .graphdriver import GraphDriver

from .utils import saveTestPickle, loadTestPickle
import pygpcca as gp
import neo4j

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

    def __init__(self, name, sequence, unique_states):
        self.name = name
        self.sequence = sequence
        self.unique_states = unique_states

    def single_pcca(self, gpcca, idx_to_id, numClusters: int):

        r = loadTestPickle(self.name, f"{self.name}_pcca_cluster_{numClusters}")
        if r is not None:
            self.clusterings[numClusters] = r["clusters"]
            self.fuzzy_memberships[numClusters] = r["fuzzy_memberships"]
            return

        gpcca.optimize(numClusters)

        clusters = []
        fuzzy_memberships = {}
        for set in gpcca.macrostate_sets:
            idList = []
            for stateID in set:
                idList.append(idx_to_id[stateID])
            clusters.append(idList)
            for idx, mem in enumerate(gpcca.memberships.tolist()):
                fuzzy_memberships.update({idx_to_id[idx]: mem})

        saveTestPickle(
            self.name,
            f"{self.name}_pcca_cluster_{numClusters}",
            {"clusters": clusters, "fuzzy_memberships": fuzzy_memberships},
        )

        self.clusterings[numClusters] = clusters
        self.fuzzy_memberships[numClusters] = fuzzy_memberships

    def pcca(self, m_min: int, m_max: int):
        driver = GraphDriver()

        # attempt to re-hydrate from JSON file before running PCCA
        r = loadTestPickle(self.name, f"optimal_pcca_{m_min}_{m_max}")
        if r is not None:
            self.clusterings = r["clusterings"]
            self.fuzzy_memberships = r["fuzzy_memberships"]
            self.current_clustering = r["optimal_value"]
            self.feasible_clusters = r["feasible_clusters"]
            return

        m, idx_to_id = calculator.calculate_transition_matrix(
            driver, run=self.name, discrete=True
        )
        gpcca = gp.GPCCA(m.values, z="LM", method="brandts")

        try:
            gpcca.optimize({"m_min": m_min, "m_max": m_max})
            self.optimal_value = gpcca.n_m
            self.current_clustering = gpcca.n_m
            feasible_clusters = []
            for cluster_idx, val in enumerate(gpcca.crispness_values):
                if val != 0:
                    feasible_clusters.append(cluster_idx + m_min)
                    self.single_pcca(gpcca, idx_to_id, cluster_idx + m_min)
            self.feasible_clusters = feasible_clusters
        except ValueError as exception:
            raise exception

        # j.update({'dominant_eigenvalues': gpcca.dominant_eigenvalues.tolist()})
        # j.update({'minChi': gpcca.minChi(m_min, m_max)})
        saveTestPickle(
            self.name,
            f"optimal_pcca_{m_min}_{m_max}",
            {
                "clusterings": self.clusterings,
                "fuzzy_memberships": self.fuzzy_memberships,
                "optimal_value": self.optimal_value,
                "feasible_clusters": self.feasible_clusters,
            },
        )

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
        sizeThreshold = 250

        importance = self.calculate_sequence_importance(
            chunkingThreshold,
            sizeThreshold,
        )
        # Split into another function
        # returns 0 if unimportant, 1 if important
        first = 0
        last = 0
        important = importance[0]
        cluster = self.idToCluster[self.sequence[0]]
        for timestep, id in enumerate(self.sequence):
            isCurrImportant = importance[timestep]

            if last - first > sizeThreshold and (
                important != isCurrImportant
                or cluster != self.idToCluster[id]
                or timestep == len(self.sequence) - 1
            ):
                chunk = {
                    "timestep": first,
                    "last": last,
                    "firstID": self.sequence[first],
                    "important": important,
                    "cluster": cluster,
                }
                first = timestep
                last = timestep
                important = isCurrImportant
                cluster = self.idToCluster[id]
                chunks.append(chunk)
            else:
                last = timestep

        self.chunks = chunks

    def calculate_sequence_importance(
        self,
        chunkingThreshold: float,
        sizeThreshold: int,
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
                if j - i < sizeThreshold:
                    while i < j:
                        importance[i] = 0
                        i += 1
                i = j
            else:
                i += 1

        return importance

    def calculate_id_to_timestep(self):
        driver = GraphDriver()

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
