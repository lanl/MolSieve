class Trajectory {
    // sequence is an array of ids that indexes into the globalUniqueState array
    sequence;
    properties;
    // dict of id to cluster id
    idToCluster = {};
    optimal_cluster_value;
    feasible_clusters;
    clusterings = {};
    fuzzy_memberships = {};
    current_clustering;
    colors = [];
    raw;
    atom_properties;
    LAMMPSBootstrapScript;
    // contains sequence, unique states, chunks, and the links between each object
    simplifiedSequence;
    chunkingThreshold;
    uniqueStates;
    adjacencyList = new Map();
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
                this.colors.push(`#${colorArray[i]}`);
            }
        }
    }

    setAdjacencyList(curr, next) {
        if(this.adjacencyList.has(curr)) {
            const nodeList = this.adjacencyList.get(curr);
            this.adjacencyList.set(curr, [...nodeList, next]);
        } else {
            this.adjacencyList.set(curr, [next]);
        }
    }
    
    buildAdjacencyList() {
        let i = 0;
        let j = 1;
        for(i; i < this.sequence.length - 1; i++) {
            const curr = this.sequence[i];
            const next = this.sequence[j];
            this.setAdjacencyList(curr, next);
            this.setAdjacencyList(next, curr);            
            j++;
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
            interleaved.push({"source": sorted[i].id , "target": sorted[j].id, transitionProb: this.occurrenceMap.get(Math.abs(sorted[i].id)).get(Math.abs(sorted[j].id))});
            j++;
        }

        const sequence = simplifiedSequence.map((state) => {
            return state.id;
        });

        let idToTimestep = new Map();
                                                 
        for(const s of simplifiedSequence) {
            if(idToTimestep.has(s.id)) {
                const timestepList = idToTimestep.get(s.id);
                idToTimestep.set(s.id, [...timestepList, simplifiedSequence.indexOf(s)]);
            } else {
                idToTimestep.set(s.id, [simplifiedSequence.indexOf(s)]);
            }            
        }

        // needs to be objects for force graph...
        const uniqueStates = [...new Set(sequence)].map((state) => {
                return {'id': state};
        });

        this.simplifiedSequence = { sequence: simplifiedSequence, uniqueStates: uniqueStates, chunks: chunks, interleaved: interleaved, idToTimestep: idToTimestep };        
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
