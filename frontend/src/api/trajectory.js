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

    chunkingThreshold;

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
        let lastChunk = { timestep: null, last: null, color: null, number: null };                
            
        for (const s of this.sequence) {
            // if at least one fuzzy membership is above a threshold, add to lastChunk; i.e its not interesting
            if (Math.max(...this.fuzzy_memberships[this.current_clustering][s.number]) > chunkingThreshold) {
                if (lastChunk.timestep === null) {
                    lastChunk.timestep = s.timestep;
                    lastChunk.number = s.number + "_c";
                }
                lastChunk.last = s.timestep;
                // later on can make this more sophisticated
                lastChunk.color = s.cluster;
            } else {
                if (lastChunk.timestep !== null && lastChunk.last !== null) {
                    let newChunk = {};
                    newChunk.timestep = lastChunk.timestep;
                    newChunk.last = lastChunk.last;
                    newChunk.color = lastChunk.color;
                    newChunk.number = lastChunk.number;
                    
                    chunks.push(newChunk);
                    lastChunk = { timestep: null, last: null, color: null, number: null };
                }                
                simplifiedSequence.push(s);
            }
        }

        if (lastChunk.timestep !== null && lastChunk.last !== null) {
            chunks.push(lastChunk);
        }
        
        let l_count = simplifiedSequence.length;
        let r_count = chunks.length;
        let l = 0;
        let r = 0;
        let interleaved = [];
        let lastObj = (simplifiedSequence[0].timestep < chunks[0].timestep) ? simplifiedSequence[0] : chunks[0];

        if(lastObj === simplifiedSequence[0]) {
            l++;
        } else {
            r++;
        }
        
        while (l != l_count && r != r_count) {
            if (simplifiedSequence[l].timestep < chunks[r].timestep) {
                interleaved.push({ source: lastObj.number, target: simplifiedSequence[l].number });
                lastObj = simplifiedSequence[l];
                l++;
            } else {
                interleaved.push({ source: lastObj.number, target: chunks[r].number });
                lastObj = chunks[r];
                r++;
            }
        }
        
        this.simplifiedSequence = { sequence: simplifiedSequence, chunks: chunks, interleaved: interleaved };        
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
