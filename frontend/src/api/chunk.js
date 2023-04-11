import { apiGetSequence } from './ajax';

/**
 * Chunks correspond to regions in the paper; they are mapped into views in the main screen.
 * Unimportant chunk = super-state
 * Important chunk = transition region
 */
export default class Chunk {
    timestep; // first timestep

    last; // last timestep

    firstID; // id for first state in chunk

    id; // id for chunk

    important; // whether or not it is important i.e., transition region

    cluster; // PCCA cluster it belongs to

    sequence = []; // sequence of states belonging to the chunk

    selected = []; // randomly selected states used in super-state views

    characteristicState; // the most commonly occurring state in the chunk's sequence

    color; // color for chunk TODO: decouple from chunk

    constructor(
        id,
        timestep,
        last,
        firstID,
        important,
        cluster,
        sequence,
        selected,
        characteristicState,
        color
    ) {
        this.id = id;
        this.timestep = timestep;
        this.last = last;
        this.firstID = firstID;
        this.important = important;
        this.cluster = cluster;
        this.selected = selected;
        this.sequence = sequence;
        this.characteristicState = characteristicState;
        this.color = color;
    }

    /**
     * Builds a new Chunk from a slice of this one. Used in zooming in Trajectory Components.
     *
     * @param {Number} start - First timestep.
     * @param {Number} end - Last timestep.
     * @returns {Chunk} New chunk
     */
    slice(start, end) {
        if (start <= this.timestep && end >= this.last) {
            return this;
        }

        const sliceStart = start <= this.timestep ? 0 : start - this.timestep;
        const sliceEnd = end >= this.last ? this.last : this.last - this.timestep;
        return new Chunk(
            this.id,
            start > this.timestep ? start : this.timestep,
            end < this.last ? end : this.last,
            this.firstID,
            this.important,
            this.cluster,
            this.sequence.slice(sliceStart, sliceEnd),
            this.selected,
            this.characteristicState
        );
    }

    /**
     * Gets the length of the chunk.
     *
     * @returns {Number} Length of the chunk.
     */
    get size() {
        return this.last - this.timestep + 1;
    }

    /**
     * Returns an array of the underlying timesteps within the chunk, ordered temporally
     *
     * @returns {Array<Number>} The timesteps within the chunk.
     */
    get timesteps() {
        const timesteps = [];
        for (let i = this.timestep; i <= this.last; i++) {
            timesteps.push(i);
        }
        return timesteps;
    }

    /**
     * Returns an array of unique state IDs within a chunk.
     * @returns {Array<Number>} The unique state IDs within a chunk.
     */
    get states() {
        return [...this.statesSet];
    }

    /**
     * Returns a Set of unique states id within a chunk.
     *
     * @returns {Set<Number>} Set of unique state IDs.
     */
    get statesSet() {
        return new Set(this.sequence);
    }

    /**
     * Loads the sequence for the chunk if it hasn't been loaded.
     * Used when expanding into unimportant chunks.
     *
     * @param {String} name - Name of the trajectory the chunk belongs to.
     * @returns {Array<Number>} The state IDs within the chunk's sequence.
     */
    loadSequence(name) {
        return new Promise((resolve, reject) => {
            if (!this.loaded && !this.important) {
                apiGetSequence(name, [this.timestep, this.last])
                    .then((data) => {
                        resolve(data);
                    })
                    .catch((e) => reject(e));
            } else {
                resolve([]);
            }
        });
    }

    /**
     * Counts all of the occurrences of the unique states within a chunk.
     *
     * @returns {Map<Number,Number>} - A map containing the state counts for each unique state within the chunk.
     */
    get stateCounts() {
        const { sequence } = this;
        const stateCounts = new Map();
        for (const id of sequence) {
            if (stateCounts.has(id)) {
                const val = stateCounts.get(id);
                stateCounts.set(id, val + 1);
            } else {
                stateCounts.set(id, 1);
            }
        }

        return stateCounts;
    }

    /**
     * Returns the percentage of time the chunk spent in each unique state.
     *
     * @returns {Map<Number,Number>} - A map of stateID : percent occurence within a chunk.
     */
    get stateRatios() {
        const { stateCounts, sequence } = this;
        const stateRatios = new Map();

        for (const [id, count] of stateCounts) {
            stateRatios.set(id, count / sequence.length);
        }

        return stateRatios;
    }

    toString() {
        return `<em>Timesteps:</em> ${this.timestep} - ${this.last}<br><em>Length:</em> ${this.size}`;
    }

    /**
     * Checks if the chunk contains the timesteps provided.
     *
     * @param {Array<Number>} timesteps - Timesteps to check within the chunk
     * @returns {Bool} True if timesteps are contained within the chunk.
     */
    containsSequence(timesteps) {
        const start = Math.min(...timesteps);
        const end = Math.max(...timesteps);

        return start >= this.timestep && end <= this.last;
    }

    /**
     * Removes sliceSize of the sequence in the given direction
     *
     * @param {Number} sliceSize - Number of states to remove.
     * @param {String} direction - Which side to delete from front (left) or back (right)
     * @returns {Array<Number} - The states deleted from this sequence.
     */
    takeFromSequence(sliceSize, direction) {
        if (this.sequence.length >= sliceSize) {
            const where = direction === 'front' ? 0 : this.sequence.length - sliceSize;
            const deleted = this.sequence.splice(where, sliceSize);

            // update timestep, last, firstID

            if (direction === 'front') {
                this.timestep += deleted.length;
            } else {
                this.last -= deleted.length;
            }

            return deleted;
        }
        return this.sequence.splice(0, this.sequence.length);
    }

    /**
     * Adds states to a chunk's sequence in the direction provided.
     *
     * @param {[TODO:type]} values - The states to add to the chunk.
     * @param {[TODO:type]} direction - Which side to add to - front (left) or back (right)
     * @throws {Error} - Thrown if unknown direction specified.
     */
    addToSequence(values, direction) {
        switch (direction) {
            case 'front': {
                this.timestep -= values.length;
                this.sequence = [...values, ...this.sequence];
                break;
            }
            case 'back': {
                this.last += values.length;
                this.sequence = [...this.sequence, ...values];
                break;
            }
            default:
                throw new Error("Unknown direction, please choose either 'front', or 'back'");
        }
    }
}
