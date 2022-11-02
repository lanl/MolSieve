import * as d3 from 'd3';
import Chunk from './chunk';
import Timestep from './timestep';
import GlobalStates from './globalStates';
import { structuralAnalysisProps } from './constants';
import { chunkSimilarity } from './myutils';
import { zTest } from './stats';

class Trajectory {
    // dict of id to cluster id
    idToCluster = {};

    idToTimestep = new Map();

    optimal_cluster_value;

    feasible_clusters;

    clusterings = {};

    fuzzy_memberships = {};

    current_clustering;

    reservedColors = [];

    raw;

    atom_properties;

    LAMMPSBootstrapScript;

    chunks = new Map();

    chunkingThreshold;

    uniqueStates;

    occurrenceMap = new Map();

    get currentClusterArray() {
        return this.clusterings[this.current_clustering];
    }

    /** Sets the metadata for the run in the this object
     * data - metadata for the run retrieved from get_metadata
     */
    set_metadata(data) {
        this.raw = data.raw;
        this.LAMMPSBootstrapScript = data.LAMMPSBootstrapScript;
    }

    add_colors(colorArray, newClustering) {
        const howMany = newClustering - Math.max(...this.feasible_clusters);

        if (newClustering > 0) {
            for (let i = 0; i < howMany; i++) {
                this.reservedColors.push(colorArray[i]);
            }
        }
    }

    // convert calculated chunks into chunk objects
    simplifySet(simplifiedSet) {
        this.chunks.clear();
        for (const chunk of simplifiedSet) {
            const newChunk = new Chunk(
                chunk.timestep,
                chunk.last,
                chunk.firstID,
                chunk.important,
                chunk.cluster,
                chunk.sequence,
                this
            );
            this.chunks.set(newChunk.id, newChunk);
            // for now, set chunk properties here
            newChunk.properties = [...newChunk.properties, ...structuralAnalysisProps];
        }
    }

    /**
     * Calculates the distribution difference between unimportant chunks for each property.
     * This generates an array of objects; each object is a dictionary of z-scores for each property.
     * This array is then aggregated in a seperate object, and stored in the trajectory.
     */
    calculateFeatureImportance() {
        const { chunkList } = this;
        const pairs = chunkList
            .filter((d) => !d.hasParent && !d.important)
            .reduce((result, _, i, array) => {
                result.push(array.slice(i, i + 2));
                return result;
            }, [])
            .filter((a) => a.length > 1);

        const differences = pairs.map((pair) => {
            const pairDifferences = {};
            const c1 = pair[0].selected.map((id) => GlobalStates.get(id));
            const c2 = pair[1].selected.map((id) => GlobalStates.get(id));

            for (const prop of structuralAnalysisProps) {
                const s1 = c1.map((d) => d[prop]);
                const s2 = c2.map((d) => d[prop]);
                pairDifferences[prop] = zTest(s1, s2);
            }
            return pairDifferences;
        });

        const aggregateDifferences = {};
        for (const prop of structuralAnalysisProps) {
            aggregateDifferences[prop] = d3.mean(differences, (d) => d[prop]);
        }

        this.featureImportance = aggregateDifferences;
    }

    set_colors(colorArray) {
        let i = 0;
        for (i; i < Math.max(...this.feasible_clusters); i += 1) {
            this.reservedColors.push(colorArray[i]);
        }
        return i;
    }

    get colors() {
        return this.reservedColors.slice(0, this.current_clustering);
    }

    /**
     * Colors an entity based on its cluster identifier (for chunks, its id; for timesteps, its stateID)
     * Will probably change to id once the mess with chunks / states is sorted
     */
    colorByCluster(entity) {
        return this.colors[this.idToCluster[entity.clusterIdentifier]];
    }

    /* Calculates the similarities between chunks and returns a 2D matrix of similarity scores
     * idList - list of chunk ids to perform a pair-wise comparison on
     */
    calculateChunkSimilarities(idList) {
        const matrix = Array.from(Array(idList.length), () => new Array(idList.length));
        for (let i = 0; i < idList.length; i++) {
            for (let j = 0; j < idList.length; j++) {
                if (i === j) {
                    matrix[i][j] = 0;
                } else {
                    const simScore = this.calculateChunkSimilarity(idList[i], idList[j]);
                    matrix[i][j] = simScore;
                }
            }
        }
        return matrix;
    }

    /* Chunk similarity is currently calculated as the size of the intersection of the states between chunks and the size of their union */
    calculateChunkSimilarity(i, j) {
        const iChunk = this.chunks.get(i);
        const jChunk = this.chunks.get(j);

        return chunkSimilarity(iChunk, jChunk);
    }

    /**
     * Get chunk map as array.
     *
     * @returns {Map(Int, Chunk)} List of chunks within trajectory.
     */
    get chunkList() {
        return Array.from(this.chunks.values()).map((c) => c);
    }

    /**
     * Gets the length of the trajectory from the last timestep of the last chunk.
     *
     * @returns {Number} Length of the trajectory.
     */
    get length() {
        const { chunkList } = this;
        const lastArray = chunkList.map((c) => c.last);
        return Math.max(...lastArray);
    }
}

export default Trajectory;
