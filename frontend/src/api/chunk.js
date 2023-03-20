import { apiGetSequence } from './ajax';

export default class Chunk {
    timestep;

    last;

    firstID; // id for first state in chunk

    id; // id for chunk

    important;

    cluster;

    sequence = [];

    selected = [];

    characteristicState;

    color;

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

    get size() {
        return this.last - this.timestep + 1;
    }

    // returns an array of the underlying timesteps within the chunk, ordered temporally
    get timesteps() {
        const timesteps = [];
        for (let i = this.timestep; i <= this.last; i++) {
            timesteps.push(i);
        }
        return timesteps;
    }

    // returns an array of unique state ids within a chunk
    get states() {
        return [...this.statesSet];
    }

    // returns a Set of unique states id within a chunk
    get statesSet() {
        return new Set(this.sequence);
    }

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

    containsSequence(timesteps) {
        const start = Math.min(...timesteps);
        const end = Math.max(...timesteps);

        return start >= this.timestep && end <= this.last;
    }

    /**
     * Removes sliceSize of the sequence in the given direction
     *
     * @param {[TODO:type]} sliceSize - [TODO:description]
     * @param {[TODO:type]} direction - [TODO:description]
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
