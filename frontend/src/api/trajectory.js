import Chunk from './chunk';
import { chunkSimilarity } from './myutils';

class Trajectory {
    idToTimestep = new Map();

    feasible_clusters;

    current_clustering;

    colors = [];

    raw;

    LAMMPSBootstrapScript;

    chunks = new Map();

    chunkingThreshold;

    occurrenceMap = new Map();

    extents;

    /** Sets the metadata for the run in the this object
     * data - metadata for the run retrieved from get_metadata
     */
    set_metadata(data) {
        this.raw = data.raw;
        this.LAMMPSBootstrapScript = data.LAMMPSBootstrapScript;
    }

    add_colors(colorArray) {
        for (const c of colorArray) {
            this.colors.push(c);
        }
    }

    // convert calculated chunks into chunk objects
    simplifySet(simplifiedSet) {
        this.chunks.clear();
        for (const chunk of simplifiedSet) {
            this.chunks.set(chunk.id, chunk);
        }
        // set extents here
        this.extents = [0, this.length];
    }

    /**
     * Calculates the distribution difference between unimportant chunks for each property.
     * This generates an array of objects; each object is a dictionary of z-scores for each property.
     * This array is then aggregated in a seperate object, and stored in the trajectory.
     */
    /* calculateFeatureImportance() {
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
            const c1 = pair[0].selected.map((id) => States.get(id));
            const c2 = pair[1].selected.map((id) => States.get(id));

            for (const prop of States.properties) {
                const s1 = c1.map((d) => d[prop]);
                const s2 = c2.map((d) => d[prop]);
                pairDifferences[prop] = zTest(s1, s2);
            }
            return pairDifferences;
        });

        const aggregateDifferences = {};
        for (const prop of States.properties) {
            aggregateDifferences[prop] = d3.mean(differences, (d) => d[prop]);
        }

        this.featureImportance = aggregateDifferences;
    } */

    /**
     * Gets the chunk ids in the trajectory in temporal order
     *
     * @param {Number} type - which function to use
     * @returns {Array<Chunk>} The chunks in order.
     */
    chunkOrder(type) {
        let filterFunc;
        switch (type) {
            case 0: // not important
                filterFunc = (d) => !d.hasParent && !d.important;
                break;
            case 1: // important
                filterFunc = (d) => !d.hasParent && d.important;
                break;
            default: // both
                filterFunc = (d) => !d.hasParent;
        }

        return this.chunkList.filter(filterFunc).map((d) => d.id);
    }

    /**
     * Get chunk map as array.
     *
     * @returns {Map(Int, Chunk)} List of chunks within trajectory.
     */
    get chunkList() {
        return Array.from(this.chunks.values()).map((c) => c);
    }

    get importantChunkList() {
        return this.chunkList.filter((c) => c.important);
    }

    // could be more flexible if chunkList gets passed in
    isTimestepsWithinChunks(timesteps) {
        const start = Math.min(...timesteps);
        const end = Math.max(...timesteps);

        return this.importantChunkList.some((c) => c.timestep <= start && c.last >= end);
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

    /**
     * Gets all of the currently rendered chunks for a trajectory.
     *
     * @param {Trajectory} trajectory - The trajectory to retrieve the chunks from.
     * @returns {Array<Chunk>} Array of visible chunks.
     */
    getVisibleChunks() {
        const { chunkList, extents } = this;
        const [start, end] = extents;
        // this is all of the chunks we need for data
        const topChunkList = chunkList.filter((d) => {
            return !(start > d.last || end < d.timestep);
        });

        // the important chunks we will render
        const iChunks = topChunkList.filter((d) => d.important);
        // the unimportant chunks we will render
        const uChunks = topChunkList.filter((d) => !d.important);

        return { iChunks, uChunks, topChunkList };
    }
}

export default Trajectory;
