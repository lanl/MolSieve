import Chunk from './chunk';
import Timestep from './timestep';
import { setIntersection, setUnion } from './myutils';

class Trajectory {
    // sequence is an array of ids that indexes into the globalUniqueState array
    sequence;

    // dict of id to cluster id
    idToCluster = {};

    idToTimestep = new Map();

    optimal_cluster_value;

    feasible_clusters;

    clusterings = {};

    fuzzy_memberships = {};

    current_clustering;

    colors = [];

    raw;

    atom_properties;

    LAMMPSBootstrapScript;

    // contains sequence, unique states, chunks, and the links between each object -> should be a seperate object
    simplifiedSequence;

    chunkingThreshold;

    uniqueStates;

    occurrenceMap = new Map();

    /** Loops through the sequence and applies the clustering to each state.
     * Allows us to keep track of colorings and perform other calculations.
     */
    set_cluster_info() {
        const currentClusteringArray = {};
        // alternatively, just stick in the global unique state array - may take a few more comparisons
        // but will still give the correct answer
        const uniqueStates = [...new Set(this.sequence)];

        for (let i = 0; i < uniqueStates.length; i++) {
            for (let j = 0; j < this.currentClusterArray.length; j++) {
                if (this.currentClusterArray[j].includes(uniqueStates[i])) {
                    currentClusteringArray[uniqueStates[i]] = j;
                }
            }
        }
        this.idToCluster = currentClusteringArray;
        this.uniqueStates = uniqueStates;
    }

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
                this.colors.push(colorArray[i]);
            }
        }
    }

    splitChunks(chunk, split, sizeThreshold, parentID, chunks) {
        const splitChunks = [];
        let currID = parentID;
        const chunkSize = parseInt((chunk.last - chunk.timestep) / split, 10);
        for (let s = 0; s < split; s++) {
            const first = chunk.timestep + s * chunkSize;
            const last = s === split - 1 ? chunk.last : first + chunkSize - 1;
            // new Chunk with parent, no children guaranteed
            const child = Chunk.withParent(
                first,
                last,
                this.sequence[first],
                --currID,
                true,
                parentID
            );
            chunks.set(child.id, child);
            if (child.size > sizeThreshold) {
                const { children, childSize, newID } = this.splitChunks(
                    child,
                    split,
                    sizeThreshold,
                    child.id,
                    chunks
                );
                child.children = children;
                child.childSize = childSize;
                currID = newID;
            }
            splitChunks.push(child.id);
        }
        return { children: splitChunks, childSize: chunkSize, newID: --currID };
    }

    simplifySet(chunkingThreshold) {
        const chunks = new Map();
        //        const simplifiedSequence = [];
        const sizeThreshold = 250;
        const epsilon = 0.0001;
        const split = 4;
        let currID = 0;
        let lastChunk = Chunk.initEmpty(); // { timestep: null, last: null, id: null };
        for (let timestep = 0; timestep < this.sequence.length; timestep += 1) {
            const id = this.sequence[timestep];
            let isCurrImportant = true;
            // go through sequence
            // if its above threshold and we've been adding to a chunk, add more, otherwise start a new unimportant chunk
            // below threshold and we've been adding, add more, otherwise start a new important chunk
            // if at least one fuzzy membership is above a threshold, add to lastChunk; i.e its not interesting
            if (
                Math.max(...this.fuzzy_memberships[this.current_clustering][id]) >=
                chunkingThreshold + epsilon
            ) {
                isCurrImportant = false;
            }

            if (
                lastChunk.important === isCurrImportant &&
                lastChunk.cluster === this.idToCluster[id]
            ) {
                lastChunk.last = timestep;
            } else {
                if (lastChunk.timestep !== null) {
                    const parentID = currID--;
                    if (lastChunk.important) {
                        const { children, childSize, newID } = this.splitChunks(
                            lastChunk,
                            split,
                            sizeThreshold,
                            parentID,
                            chunks
                        );
                        lastChunk.children = children;
                        lastChunk.childSize = childSize;
                        currID = newID;
                    }
                    chunks.set(parentID, lastChunk);
                }
                // new Chunk that will change over time, children not guaranteed
                lastChunk = new Chunk(
                    timestep,
                    timestep,
                    id,
                    currID,
                    isCurrImportant,
                    this.idToCluster[id]
                );
            }
        }

        if (lastChunk.timestep !== null) {
            chunks.set(currID, lastChunk);
        }

        this.simplifiedSequence = {
            chunks,
        };
        this.chunkingThreshold = chunkingThreshold;
    }

    /* Returns the length of the trajectory. */
    length() {
        return this.sequence.length;
    }

    set_colors(colorArray) {
        let i = 0;
        for (i; i < Math.max(...this.feasible_clusters); i += 1) {
            this.colors.push(colorArray[i]);
        }
        return i;
    }

    getItems(childArray) {
        const newList = [];

        // check if the array contains indices for chunks or states
        if (childArray.every((v) => v > 0)) {
            for (let i = childArray[0]; i <= childArray.at(-1); i++) {
                newList.push(new Timestep(i, this.sequence[i]));
            }
        } else {
            for (const c of childArray) {
                newList.push(this.simplifiedSequence.chunks.get(c));
            }
        }
        return newList;
    }

    // returns a Set of state ids within a chunk
    getChunkStates(chunk) {
        const { timesteps } = chunk;
        const ids = new Set();
        for (let i = 0; i < timesteps.length; i++) {
            ids.add(this.sequence[timesteps[i]]);
        }
        return ids;
    }

    /* Colors an entity based on its cluster identifier (for chunks, its id; for timesteps, its stateID)
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
        const iChunk = this.simplifiedSequence.chunks.get(i);
        const jChunk = this.simplifiedSequence.chunks.get(j);

        if (!iChunk.important || !jChunk.important) {
            return 0;
        }
        const iSet = this.getChunkStates(iChunk);
        const jSet = this.getChunkStates(jChunk);

        const inter = setIntersection(iSet, jSet);
        const union = setUnion(iSet, jSet);

        return inter.size / union.size;
    }
}

export default Trajectory;
