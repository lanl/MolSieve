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
            for (
                let j = 0;
                j < this.clusterings[this.current_clustering].length;
                j++
            ) {
                if (this.clusterings[this.current_clustering][j].includes(uniqueStates[i])) {
                    currentClusteringArray[uniqueStates[i]] = j;
                }
            }            
        }
        this.idToCluster = currentClusteringArray;
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

    // biggest bottleneck atm
    calculateIDToTimestepMap() {
        /*console.log(this.sequence);
        const seqLen = this.sequence.length;
        for(let i = 0; i < seqLen; i++) {
            if(this.idToTimestep.has(this.sequence[i])) {
                const timestepList = this.idToTimestep.get(this.sequence[i]);
                this.idToTimestep.set(this.sequence[i], [...timestepList, i]);
            } else {
                this.idToTimestep.set(this.sequence[i], [i]);
            }
        }*/
    }
    
    simplifySet(chunkingThreshold) {     
        const chunks = [];
        let lastChunk = { timestep: null, last: null, id: null };
        let curr_id = 0;
        for (let timestep = 0; timestep < this.sequence.length; timestep++) {
            const id = this.sequence[timestep];
            // go through sequence
            // if its above threshold and we've been adding to a chunk, add more, otherwise start a new unimportant chunk
            // below threshold and we've been adding, add more, otherwise start a new important chunk
            // if at least one fuzzy membership is above a threshold, add to lastChunk; i.e its not interesting
            if (Math.max(...this.fuzzy_memberships[this.current_clustering][id]) >= chunkingThreshold) {
                if (lastChunk.important === false) {
                    lastChunk.last = timestep;
                } else {
                    if(lastChunk.timestep !== null) {
                        chunks.push(Object.assign({}, lastChunk));
                    }
                    lastChunk = { timestep: timestep, last: timestep, firstID: id, id: curr_id++, important: false };
                }
            } else {
                if (lastChunk.important === true) {
                    lastChunk.last = timestep;
                } else {
                    if(lastChunk.timestep !== null) {
                        chunks.push(Object.assign({}, lastChunk));
                    }
                    lastChunk = { timestep: timestep, last: timestep,  firstID: id, id: curr_id++, important: true };
                }
            }
        }

        if (lastChunk.timestep !== null) {
            chunks.push(lastChunk);
        }
       
        const interleaved = [];
        
        for(let i = 0; i < chunks.length - 1; i++) {
            interleaved.push({"source": i, "target": i+1, transitionProb: 1.0});//this.occurrenceMap.get(Math.abs(sorted[i].id)).get(Math.abs(sorted[j].id)) });
        }

        this.simplifiedSequence = { sequence: [], uniqueStates: [], chunks: chunks, interleaved: interleaved, idToTimestep: new Map() };
        this.chunkingThreshold = chunkingThreshold;
    }    
    
    set_colors(colorArray) {
        let i = 0;        
        for (i; i < Math.max(...this.feasible_clusters); i++) {
            this.colors.push(colorArray[i]);
        }
        return i;
    }
}

export default Trajectory;
