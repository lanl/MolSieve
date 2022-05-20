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
    //occurrenceMap = new Map();

    
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
        const simplifiedSequence = [];        
        const chunks = [];
        let lastChunk = { timestep: null, last: null, id: null };
        
        for (let timestep = 0; timestep < this.sequence.length; timestep++) {
            const id = this.sequence[timestep];
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
            interleaved.push({"source": sorted[i].id , "target": sorted[j].id, transitionProb: 1});//this.occurrenceMap.get(Math.abs(sorted[i].id)).get(Math.abs(sorted[j].id))});
            j++;
        }


        const sequence = simplifiedSequence.map((state) => {
            return state.id;
        });
        
        // needs to be objects for force graph...
        const uniqueStates = [...new Set(sequence)].map((state) => {
                return {'id': state};
        });

        const idToTimestep = new Map();
        for(let i = 0; i < uniqueStates.length; i++) {
            idToTimestep.set(uniqueStates[i].id, []);
        }        
        
        for(let i = 0; i < simplifiedSequence; i++) {
            const id = simplifiedSequence[i];
            const timestepList = idToTimestep.get(id);
            idToTimestep.set(id, [...timestepList, i]);                  
        }
        
        this.simplifiedSequence = { sequence: simplifiedSequence, uniqueStates: uniqueStates, chunks: chunks, interleaved: interleaved, idToTimestep: idToTimestep };
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
