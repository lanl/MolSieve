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

    splitChunks(chunk, split, sizeThreshold, parentID, chunks) {
        const splitChunks = [];
        let curr_id = parentID;
        let chunkSize = parseInt((chunk.last - chunk.timestep) / split);
        for(let s = 0; s < split; s++) {
            const first = chunk.timestep + (s * chunkSize);
            const last = (s === split -1) ? chunk.last : chunk.timestep + ((s+1) * chunkSize) - 1;
            const child = {
                timestep: first,
                last: last,
                firstID: this.sequence[first],
                id: --curr_id,
                parentID: parentID,
                size: chunkSize
            };
            chunks.set(child.id, child);
            if(parseInt(chunkSize/split) > sizeThreshold) {
                const {children, childSize, newID} = this.splitChunks(child, split, sizeThreshold, child.id, chunks);
                child.children = children;
                child.childSize = childSize;
                curr_id = newID;
            }
            splitChunks.push(child.id);
        }
        return {'children': splitChunks, 'childSize': chunkSize, 'newID': curr_id};
    }
    
    simplifySet(chunkingThreshold) {     
        const chunks = new Map();
//        const simplifiedSequence = [];
        const sizeThreshold = 25;
        const epsilon = 0.0001;
        const split = 4;
        let curr_id = 0;
        let lastChunk = { timestep: null, last: null, id: null };
        for (let timestep = 0; timestep < this.sequence.length; timestep++) {
            const id = this.sequence[timestep];
            let curr_important = true;
            // go through sequence
            // if its above threshold and we've been adding to a chunk, add more, otherwise start a new unimportant chunk
            // below threshold and we've been adding, add more, otherwise start a new important chunk
            // if at least one fuzzy membership is above a threshold, add to lastChunk; i.e its not interesting
            if (Math.max(...this.fuzzy_memberships[this.current_clustering][id]) >= (chunkingThreshold + epsilon)) {
                curr_important = false;
            }            
            if (lastChunk.important === curr_important) {
                lastChunk.last = timestep;
            } else {
                if(lastChunk.timestep !== null) {
                    const parentID = curr_id--;
                    if(lastChunk.important) {                            
                        const {children, childSize, newID} = this.splitChunks(lastChunk, split, sizeThreshold, parentID, chunks);
                        lastChunk.children = children;
                        lastChunk.childSize = childSize;
                        curr_id = newID;
                    }
                    lastChunk.size = lastChunk.last - lastChunk.timestep;                        
                    chunks.set(parentID, lastChunk);
                } 
                lastChunk = { timestep: timestep, last: timestep, firstID: id, id: curr_id, important: curr_important };
            }
        }

        if (lastChunk.timestep !== null) {
            lastChunk.size = lastChunk.last - lastChunk.timestep;
            chunks.set(curr_id, lastChunk);
        }

        /*
        const topChunks = Array.from(chunks.values()).filter((d) => d.parentID === undefined);
        const sorted = [...simplifiedSequence, ...topChunks].sort((a,b) => a.timestep - b.timestep);
        const interleaved = [];

        console.log(sorted);
        
        for(let i = 0; i < sorted.length - 1; i++) {
            interleaved.push({source: sorted[i].id, target: sorted[i+1].id, transitionProb: 1.0});//this.occurrenceMap.get(Math.abs(sorted[i].id)).get(Math.abs(sorted[j].id)) });
        }
        
        const sequence = simplifiedSequence.map((state) => {
            return state.id;
        });

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
        }*/

        this.simplifiedSequence = { //sequence: simplifiedSequence, uniqueStates: uniqueStates,
            chunks: chunks,
            //interleaved: interleaved,
            //idToTimestep: idToTimestep
        };
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
