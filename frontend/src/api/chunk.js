import GlobalChunks from './globalChunks';

const CHUNK = 0;

export default class Chunk {
    timestep;

    last;

    firstID; // id for first state in chunk

    id; // id for chunk

    important;

    cluster;

    childSize;

    children;

    dataType = CHUNK;

    constructor(timestep, last, firstID, important, cluster) {
        this.timestep = timestep;
        this.last = last;
        this.firstID = firstID;
        this.important = important;
        this.cluster = cluster;
        this.id = GlobalChunks.generateID();
    }

    static withParent(timestep, last, firstID, important, parentID) {
        const newChunk = new Chunk(timestep, last, firstID, important, undefined, parentID);
        newChunk.parentID = parentID;
        return newChunk;
    }

    static initEmpty() {
        return new Chunk(null, null, null, null, null, null, null);
    }

    get clusterIdentifier() {
        return this.firstID;
    }

    get size() {
        return this.last - this.timestep + 1;
    }

    get hasParent() {
        return this.parentID !== undefined;
    }

    // returns an array of the chunk's children
    // might want to change this later to be less confusing
    // i.e just returns either undefined for no children, or the chunk children
    getChildren() {
        if (this.childSize) {
            return this.children;
        }

        return this.timesteps;
    }

    // returns an array of the underlying timesteps within the chunk, ordered temporally
    get timesteps() {
        const timesteps = [];
        for (let i = this.timestep; i <= this.last; i++) {
            timesteps.push(i);
        }
        return timesteps;
    }

    toString() {
        return `<b>Timesteps</b>: ${this.timestep} - ${this.last}<br><b>Length</b>: ${this.size}`;
    }
}
