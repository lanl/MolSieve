import * as d3 from 'd3';
import Chunk from './chunk';
import Timestep from './timestep';
import GlobalStates from './globalStates';
import { structuralAnalysisProps } from './constants';
import { chunkSimilarity } from './myutils';
import { zTest } from './stats';

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

    reservedColors = [];

    raw;

    atom_properties;

    LAMMPSBootstrapScript;

    chunks = new Map();

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
                this.reservedColors.push(colorArray[i]);
            }
        }
    }

    splitChunks(chunk, split, sizeThreshold, parentID, chunks) {
        const splitChunks = [];
        const chunkSize = parseInt((chunk.last - chunk.timestep) / split, 10);
        for (let s = 0; s < split; s++) {
            const first = chunk.timestep + s * chunkSize;
            const last = s === split - 1 ? chunk.last : first + chunkSize - 1;
            // new Chunk with parent, no children guaranteed
            const child = Chunk.withParent(first, last, this.sequence[first], true, parentID, this);
            chunks.set(child.id, child);
            if (child.size > sizeThreshold) {
                const { children, childSize } = this.splitChunks(
                    child,
                    split,
                    sizeThreshold,
                    child.id,
                    chunks
                );
                child.children = children;
                child.childSize = childSize;
            }
            splitChunks.push(child.id);
        }
        return { children: splitChunks, childSize: chunkSize };
    }

    // convert calculated chunks into chunk objects
    simplifySet(simplifiedSet) {
        for (const chunk of simplifiedSet) {
            const newChunk = new Chunk(
                chunk.timestep,
                chunk.last,
                chunk.firstID,
                chunk.important,
                chunk.cluster,
                this
            );
            this.chunks.set(newChunk.id, newChunk);
            if (!newChunk.important) {
                newChunk.calculateSelected();
            }
            // for now, set chunk properties here
            newChunk.properties = [...newChunk.properties, ...structuralAnalysisProps];
        }
    }
    /* simplifySet(chunkingThreshold) {
        // reset, we're dealing with a new set of chunks
        const chunks = new Map();
        const sizeThreshold = 250;
        const epsilon = 0.0001;

        // returns 0 if unimportant, 1 if important
        const importance = this.sequence.map(
            (id) =>
                Math.max(...this.fuzzy_memberships[this.current_clustering][id]) <=
                chunkingThreshold + epsilon
        );

        // go through importance array, and if a 1 occurs without at least sizeThreshold more 1s
        // convert it into a 0
        for (let i = 0; i < importance.length; i++) {
            if (importance[i] === 1) {
                let j = i + 1;
                while (j < importance.length && importance[j] === 1) {
                    j++;
                }
                if (j - i < sizeThreshold) {
                    while (i < j) {
                        importance[i] = 0;
                        i++;
                    }
                }
                i = j;
            }
        }

        let first = 0;
        let last = 0;
        let important = importance[0];
        let cluster = this.idToCluster[this.sequence[0]];

        for (let timestep = 0; timestep < this.sequence.length; timestep++) {
            const id = this.sequence[timestep];
            const isCurrImportant = importance[timestep];

            // if the current timestep is not in the same cluster or importance
            if (
                last - first > sizeThreshold &&
                (important !== isCurrImportant ||
                    cluster !== this.idToCluster[id] ||
                    timestep === this.sequence.length - 1)
            ) {
                // save this chunk if its important, and above the cluster size
                if (important) {
                    // create new important chunk
                    const chunk = new Chunk(
                        first,
                        last,
                        this.sequence[first],
                        important,
                        cluster,
                        this
                    );
                     const { children, childSize } = this.splitChunks(
                            chunk,
                            split,
                            sizeThreshold,
                            chunk.id,
                            chunks
                        );
                        chunk.children = children;
                        chunk.childSize = childSize; 
                    chunks.set(chunk.id, chunk);
                } else {
                    const chunk = new Chunk(
                        first,
                        last,
                        this.sequence[first],
                        important,
                        cluster,
                        this
                    );
                    chunks.set(chunk.id, chunk);
                }

                first = timestep;
                last = timestep;
                important = isCurrImportant;
                cluster = this.idToCluster[id];
            } else {
                last = timestep;
            }
        }

        this.chunks = chunks;
        this.chunkingThreshold = chunkingThreshold;

        const chartChunks = Array.from(this.chunks.values()).filter((d) => !d.hasParent);

        for (const chunk of chartChunks) {
            if (!chunk.important) {
                chunk.calculateSelected();
            }

            // for now, set chunk properties here
            chunk.properties = [...chunk.properties, ...structuralAnalysisProps];
        }
    } */

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

    /* Returns the length of the trajectory. */
    length() {
        return this.sequence.length;
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

    getItems(childArray) {
        const newList = [];

        // check if the array contains indices for chunks or states
        if (childArray.every((v) => v > 0)) {
            for (let i = childArray[0]; i <= childArray.at(-1); i++) {
                newList.push(new Timestep(i, this.sequence[i]));
            }
        } else {
            for (const c of childArray) {
                newList.push(this.chunks.get(c));
            }
        }
        return newList;
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
}

export default Trajectory;
