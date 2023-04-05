import random
from collections import Counter
from typing import List
import neo4j
import pygpcca as gp
from scipy import sparse

from neomd import calculator

from .config import config
from .utils import load_pickle, save_pickle

# needs more comments, testing
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
    simplified_unique_states = None

    def __init__(self, name, sequence, unique_states):
        self.name = name
        self.sequence = sequence
        self.unique_states = unique_states

    @classmethod
    def load_sequence(cls, driver: neo4j.Driver, run: str):
        """
        Constructs a new Trajectory using the name provided.

        :param cls: Class instance; call w/ Trajectory.load_sequence(driver, run)
        :param driver neo4j.Driver: Driver to access the database with
        :param run str: Name of the trajectory to load.
        """

        # maybe move this query to neomd?
        q = f"""
        MATCH (n:State:{run})-[r:{run}]->(:State:{run})
        RETURN n.id as id
        ORDER BY r.timestep ASC;
        """

        sequence = []
        unique_states = set()
        with driver.session() as session:
            result = session.run(q)
            sequence = result.value()
            unique_states = set(sequence)

        if len(sequence) == 0 or len(unique_states) == 0:
            raise ValueError(f"Trajectory {run} not found.")

        return cls(run, sequence, unique_states)

    def single_pcca(self, driver, num_clusters: int):
        """
        Attempts to run PCCA for the user-specified number of clusters and updates the Trajectory object.
        Calculates min_chi before running _single_pcca.

        :param numClusters int: Number of clusters to try and cluster the sequence into.
        :param driver neo4j.Driver: Neo4j connection to use for connecting to the database.
        """
        m, idx_to_id = calculator.calculate_transition_matrix(driver, run=self.name)
        gpcca = gp.GPCCA(m, z="LM", method="krylov")
        self.check_min_chi_range(gpcca, num_clusters)
        self._single_pcca(gpcca, idx_to_id, num_clusters)

    def _single_pcca(self, gpcca, idx_to_id, num_clusters: int):
        """
        Runs PCCA for a user-specified number of clusters and updates the Trajectory object.
        This function assumes that you have a GPCCA object which already has the min_chi indicator
        calculated.

        :param gpcca : GPCCA object to use
        :param idx_to_id: [TODO:description]
        :param num_clusters: Number of clusters to cluster the trajectory into.
        """
        r = load_pickle(self.name, f"pcca_cluster_{num_clusters}")
        if r is not None:
            self.clusterings[num_clusters] = r["clusters"]
            self.fuzzy_memberships[num_clusters] = r["fuzzy_memberships"]
            return
        gpcca.optimize(num_clusters)
        self.save_membership_info(gpcca, idx_to_id, num_clusters)
        save_pickle(
            self.name,
            f"pcca_cluster_{num_clusters}",
            {
                "clusters": self.clusterings[num_clusters],
                "fuzzy_memberships": self.fuzzy_memberships[num_clusters],
            },
        )

    # needs testing
    def check_min_chi_range(self, gpcca, num_clusters: int):
        """
        Checks if the min_chi indicator needs to be updated based on the cluster specified.

        :param gpcca: GPCCA object to update
        :param num_clusters int: The number of clusters that will be tested.
        """

        if len(self.min_chi) > 0:
            m_min = self.m_min
            m_max = self.m_max
            if m_min > num_clusters:
                self.update_optimal_clustering(gpcca, num_clusters, m_max)
            elif m_max < num_clusters:
                self.update_optimal_clustering(gpcca, m_min, num_clusters)
            else:
                # don't need to update, but need to run it anyway for GPCCA to work
                gpcca.minChi(m_min, m_max)
        else:
            self.update_optimal_clustering(gpcca, 2, min(max(3, num_clusters), 20))

    # needs testing
    def update_optimal_clustering(self, gpcca, m_min: int, m_max: int):
        """
        Finds the optimal clustering from the provided minChi indicators;
        the values closest to 0 indicate an optimal clustering.
        Updates the Trajectory object with the optimal clustering to use.
        If the minChi has already been calculated, check the range of the previous
        indicators and update if 1.) the range is greater and 2.) the minChi in the new range is better.

        :param gpcca: The GPCCA object to use.
        :param m_min: The minimum clustering count.
        :param m_max: The maximum clustering count.
        """
        mc = gpcca.minChi(m_min, m_max)
        self.min_chi = mc
        self.m_min = m_min
        self.m_max = m_max

        clusterings = [
            {"indicator": abs(m), "cluster": m_min + idx} for idx, m in enumerate(mc)
        ]
        self.optimal_value = min(clusterings, key=lambda e: e["indicator"])["cluster"]
        return self.optimal_value

    def pcca(self, m_min: int, m_max: int, driver):
        r = load_pickle(self.name, f"optimal_pcca_{m_min}_{m_max}")
        if r is not None:
            self.clusterings = r["clusterings"]
            self.fuzzy_memberships = r["fuzzy_memberships"]
            self.current_clustering = r["optimal_value"]
            self.min_chi = r["min_chi"]
            self.m_min = m_min
            self.m_max = m_max
            return

        m, idx_to_id = calculator.calculate_transition_matrix(driver, run=self.name)

        gpcca = gp.GPCCA(m, z="LM", method="krylov")
        ov = self.update_optimal_clustering(gpcca, m_min, m_max)

        self.current_clustering = ov
        self._single_pcca(gpcca, idx_to_id, ov)

        save_pickle(
            self.name,
            f"optimal_pcca_{m_min}_{m_max}",
            {
                "clusterings": self.clusterings,
                "fuzzy_memberships": self.fuzzy_memberships,
                "optimal_value": self.optimal_value,
                "min_chi": self.min_chi,
            },
        )

    def save_membership_info(self, gpcca, idx_to_id, num_clusters):
        """
        Saves the clustering membership information from GPCCA in the Trajectory object.

        :param gpcca [TODO:type]: The GPCCA object to use.
        :param idx_to_id [TODO:type]: [TODO:description]
        :param num_clusters int: The number of clusters that were found.
        """
        clusters = []
        fuzzy_memberships = {}
        for s in gpcca.macrostate_sets:
            idList = []
            for stateID in s:
                idList.append(idx_to_id[stateID])
            clusters.append(idList)
        for idx, mem in enumerate(gpcca.memberships.tolist()):
            fuzzy_memberships.update({idx_to_id[idx]: mem})
        self.clusterings[num_clusters] = clusters
        self.fuzzy_memberships[num_clusters] = fuzzy_memberships

    def current_cluster(self):
        """
        Returns the current clustering being used, a list of lists of IDs that 
        describe which cluster a state belongs to.

        :returns: List[List[int]]
        """
        return self.clusterings[self.current_clustering]

    def current_fuzzy_membership(self):
        """
        Returns the cluster membership probabilities for the clustering being used,
        a list of lists of probabilities, where each list of probabilities describes
        the probability that a given state will belong to a cluster.
        """
        return self.fuzzy_memberships[self.current_clustering]

    def calculateIDToCluster(self):
        """
        Updates idToCluster, which a dictionary indexed by state ID which returns the cluster
        to which the state ID is assigned.

        """
        for clusterIdx, cluster in enumerate(self.current_cluster()):
            for id in cluster:
                self.idToCluster[id] = clusterIdx

    # needs testing
    def simplify_sequence(
        self,
        simpThreshold: float,
    ):
        """
        The simplification algorithm described in the paper.
        Takes the fuzzy membership probabilities currently assigned to the Trajectory object,
        and first calculates whether or not a state is important (transition region).
        Then, iterates through the array and splits the sequence into "chunks" (regions in the paper),
        where groups of "important" states are transition regions, and "unimportant" states are 
        super-states.

        :param simpThreshold: The simplification threshold specified by the user.
        """
        chunks = []

        importance = self.calculate_sequence_importance(
            simpThreshold,
        )
        first = 0
        last = 0
        important = importance[0]
        cluster = self.idToCluster[self.sequence[0]]

        random.seed(3735928559)
        for timestep, id in enumerate(self.sequence):
            isCurrImportant = importance[timestep]

            # chunks are split based on size, their importance and cluster
            # this is so no chunks have states from more than one cluster
            if last - first > config.SIZE_THRESHOLD and (
                important != isCurrImportant
                or cluster != self.idToCluster[id]
                or timestep == len(self.sequence) - 1
            ):

                sequence = self.sequence[first : last + 1]
                selected = sequence

                # calculates the states that will be used for calculating
                # distributions in super-state views
                state_counts = Counter(sequence)
                top = [x[0] for x in state_counts.most_common(min(len(sequence), 20))]

                sequence_set = set(sequence)
                # remove top 20 that were selected
                sequence_set.difference_update(top)
                random_selection = []

                if len(sequence_set) > 20:
                    # randomly select 10%
                    random_selection = random.sample(
                        list(sequence_set), int(len(sequence_set) * 0.1)
                    )

                selected = [*top, *random_selection]
                characteristic_state = top[0]
                # non-important chunks i.e., super-states do not save sequence information
                if not important:
                    sequence = []

                chunk = {
                    "timestep": first,
                    "last": last,
                    "firstID": self.sequence[first],
                    "important": important,
                    "cluster": cluster,
                    "sequence": sequence,
                    "selected": selected,
                    "characteristicState": characteristic_state,
                }
                first = timestep
                last = timestep
                important = isCurrImportant
                cluster = self.idToCluster[id]
                chunks.append(chunk)
            else:
                last = timestep

        self.chunkingThreshold = simpThreshold
        self.chunks = chunks
        uniqueStates = set()
        for chunk in self.chunks:
            chunkUniqueStates = set()
            if chunk["important"]:
                chunkUniqueStates = set(chunk["sequence"])
            else:
                chunkUniqueStates = set(chunk["selected"])
            uniqueStates.update(chunkUniqueStates)
        self.simplified_unique_states = uniqueStates

    # needs testing
    def calculate_sequence_importance(
        self,
        simpThreshold: float,
    ):
        """
        Calculates the importance of each state based on the simplification threshold.
        Important = transition region, unimportant = super-state

        :param simpThreshold: Threshold at which a state becomes unimportant.
        """
        epsilon = 0.0001

        # if the maximum cluster membership probability is less than the simplification threshold,
        # it is important else unimportant
        isImportant = (
            lambda id: 1
            if max(self.current_fuzzy_membership()[id]) <= simpThreshold + epsilon
            else 0
        )
        importance = list(map(isImportant, self.sequence))

        i = 0
        while i != len(importance) - 1:
            if importance[i] == 1:
                j = i + 1
                while j < len(importance) - 1 and importance[j] == 1:
                    j += 1
                # make sure that important regions have a minimum size
                if j - i < config.SIZE_THRESHOLD:
                    while i < j:
                        importance[i] = 0
                        i += 1
                i = j
            else:
                i += 1

        return importance

    # move to neomd?
    def calculate_id_to_timestep(self, driver):
        r = load_pickle(self.name, "idToTimestep")
        if r is not None:
            self.id_to_timestep = r
            return

        query = """MATCH (n:{run})-[r:{run}]->(:{run})
                   RETURN DISTINCT n.id as id, collect(r.timestep) as timesteps;""".format(
            run=self.name
        )

        j = None
        with driver.session() as session:
            result = session.run(query)
            j = result.data()

        save_pickle(self.name, "idToTimestep", j)
        self.id_to_timestep = j
