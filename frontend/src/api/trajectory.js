class Trajectory {
    sequence;

    unique_states;

    optimal_cluster_value;

    feasible_clusters;

    clusterings = {};

    fuzzy_memberships = {};

    current_clustering;

    colors = [];

    properties;

    raw;

    atom_properties;

    LAMMPSBootstrapScript;

    simplifiedSequence;

    /** Loops through the sequence and applies the clustering to each state.
     * Allows us to keep track of colorings and perform other calculations.
     */
    set_cluster_info() {
        for (let i = 0; i < this.sequence.length; i++) {
            for (
                let j = 0;
                j < this.clusterings[this.current_clustering].length;
                j++
            ) {
                if (this.clusterings[this.current_clustering][j].includes(this.sequence[i].number)) {
                    this.sequence[i].cluster = j;
                }
            }
            if (this.sequence[i].cluster == null) {
                this.sequence[i].cluster = -1;
            }
        }
    }

    /** Calculates a set of all the unique states in the sequence */
    calculate_unique_states() {
        const unique_states = new Set();
        for (let i = 0; i < this.sequence.length; i++) {
            unique_states.add(this.sequence[i].number);
        }
        this.unique_states = unique_states;
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
                this.colors.push(`#${colorArray[i]}`);
            }
        }
    }

    simplifySet(chunkingThreshold) {
        const simplifiedSequence = [];
        const chunks = [];
        let lastChunk = { first: null, last: null, color: null };
        // sort of a sliding window thing

        for (const s of this.sequence) {
            // if at least one fuzzy membership is above a threshold, add to lastChunk; i.e its not interesting
            if (Math.max(...this.fuzzy_memberships[this.current_clustering][s.number]) > chunkingThreshold) {
                if (lastChunk.first === null) {
                    lastChunk.first = s.timestep;
                }
                lastChunk.last = s.timestep;
                // later on can make this more sophisticated
                lastChunk.color = s.cluster;
            } else {
                if (lastChunk.first !== null && lastChunk.last !== null) {
                    let newChunk = {};
                    newChunk.first = lastChunk.first;
                    newChunk.last = lastChunk.last;
                    newChunk.color = lastChunk.color;
                    
                    chunks.push(newChunk);
                    lastChunk = { first: null, last: null, color: null };
                }
                simplifiedSequence.push(s);
            }
        }

        if (lastChunk.first !== null && lastChunk.last !== null) {
            chunks.push(lastChunk);
        }
        
        this.simplifiedSequence = { sequence: simplifiedSequence, chunks: chunks };
        console.log(this.simplifiedSequence);
    }
    
    set_colors(colorArray) {
        let i = 0;
        
        for (i; i < Math.max(...this.feasible_clusters); i++) {
            this.colors.push(`#${colorArray[i]}`);
        }

        return i;
    }
}

export default Trajectory;
