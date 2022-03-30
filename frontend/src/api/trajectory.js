class Trajectory {
    sequence;    
    properties;
    uniqueStates;
    currentClusteringArray = [];

    optimal_cluster_value;

    feasible_clusters;

    clusterings = {};

    fuzzy_memberships = {};

    current_clustering;

    colors = [];

    raw;

    atom_properties;

    LAMMPSBootstrapScript;

    simplifiedSequence;

    chunkingThreshold;

    /** Loops through the sequence and applies the clustering to each state.
     * Allows us to keep track of colorings and perform other calculations.
     */
    set_cluster_info() {
        const currentClusteringArray = {};
        for (let i = 0; i < this.uniqueStates.length; i++) {
            for (
                let j = 0;
                j < this.clusterings[this.current_clustering].length;
                j++
            ) {
                if (this.clusterings[this.current_clustering][j].includes(this.uniqueStates[i])) {
                    currentClusteringArray[this.uniqueStates[i]] = j;
                }
            }
            
        }
        this.currentClusteringArray = currentClusteringArray;
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
        let lastChunk = { timestep: null, last: null, id: null };
        
        for (const [timestep,id] of this.sequence.entries()) {
            // if at least one fuzzy membership is above a threshold, add to lastChunk; i.e its not interesting
            if (Math.max(...this.fuzzy_memberships[this.current_clustering][id]) >= chunkingThreshold) {
                if (lastChunk.timestep === null) {
                    lastChunk.timestep = timestep;
                    lastChunk.id = -id; //figure out clever transform later
                }
                lastChunk.last = timestep;            
            } else {
                if (lastChunk.timestep !== null && lastChunk.last !== null) {
                    let newChunk = {};
                    newChunk.timestep = lastChunk.timestep;
                    newChunk.last = lastChunk.last;
                    newChunk.id = lastChunk.id;                                       
                    chunks.push(newChunk);
                    
                    lastChunk = { timestep: null, last: null,  id: null };
                }
                simplifiedSequence.push({'timestep': timestep, 'id': id});
            }
        }

        if (lastChunk.timestep !== null) {
            chunks.push(lastChunk);
        }                
       
        let sorted = [...simplifiedSequence, ...chunks].sort((a,b) => a.timestep - b.timestep);
        let interleaved = [];
        let i = 0;
        let j = 1;

        for(i; i < sorted.length - 1; i++) {
            interleaved.push({"source": sorted[i].id, "target": sorted[j].id});
            j++;
        }

        const sequence = simplifiedSequence.map((state) => {
            return state.id;
        });
        
        this.simplifiedSequence = { sequence: simplifiedSequence, uniqueStates: [...new Set(sequence)], chunks: chunks, interleaved: interleaved };        
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
