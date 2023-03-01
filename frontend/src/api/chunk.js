import GlobalChunks from './globalChunks';
import GlobalStates from './globalStates';
import Timestep from './timestep';
import { boxPlotStats } from './math/stats';
import { apiGetSequence } from './ajax';

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

    // chunk states are guaranteed to have these properties
    properties = ['timestep', 'id'];

    sequence = [];

    characteristicState;

    constructor(
        timestep,
        last,
        firstID,
        important,
        cluster,
        sequence,
        selected,
        characteristicState,
        trajectory
    ) {
        this.timestep = timestep;
        this.last = last;
        this.firstID = firstID;
        this.important = important;
        this.cluster = cluster;
        this.id = GlobalChunks.generateID();
        this.selected = selected;
        this.sequence = sequence;
        this.characteristicState = characteristicState;
        this.trajectory = trajectory;
    }

    slice(start, end) {
        if (start <= this.timestep && end >= this.last) {
            return this;
        }

        const sliceStart = start <= this.timestep ? 0 : start - this.timestep;
        const sliceEnd = end >= this.last ? this.last : this.last - this.timestep;

        return new Chunk(
            start > this.timestep ? start : this.timestep,
            end < this.last ? end : this.last,
            this.firstID,
            this.important,
            this.cluster,
            this.sequence.slice(sliceStart, sliceEnd),
            this.selected,
            this.characteristicState,
            this.trajectory
        );
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

    // returns an array of unique state ids within a chunk
    get states() {
        return [...new Set(this.sequence)];
    }

    // returns a Set of unique states id within a chunk
    get statesSet() {
        return new Set(this.sequence);
    }

    loadSequence() {
        return new Promise((resolve, reject) => {
            apiGetSequence(this.trajectory.name, [this.timestep, this.last])
                .then((data) => {
                    this.sequence = data;
                    resolve(this.sequence);
                })
                .catch((e) => reject(e));
        });
    }

    // gets the states within the sequence as Timestep objects, useful for rendering
    get timestepSequence() {
        const { timesteps } = this;
        const t = [];
        for (let i = 0; i < timesteps.length; i++) {
            t.push(new Timestep(timesteps[i], this.sequence[i]));
        }
        return t;
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

    /**
     * Calculates the moving average for the given property within the chunk.
     *
     * @param {String} property - The property to calculate the moving average for.
     * @param {Int} n - The length of the moving average period.
     * @param {Function} mf - A function that takes (data, n) and returns an array of moving averages.
     * @param {Array} range - Optional, if specified, calculates the moving average only for the given timestep range
     * @returns {Array} Array of moving averages.
     */
    calculateMovingAverage(property, n, mf, range) {
        const propertyList = this.getPropList(property, range);
        return mf(propertyList, n);
    }

    /**
     * Depending on if the chunk is important or not, returns either this.sequence or this.selected.
     *
     * @returns {Array<Number>} Array of IDs to use for whatever calculation you need them for.
     */
    getMainValues() {
        return this.important ? this.sequence : this.selected;
    }

    getPropList(property, range) {
        let states = this.getMainValues();

        if (range) {
            states = states.slice(range[0], range[1]);
        }

        const stateSequence = states.map((id) => GlobalStates.get(id));
        return stateSequence.map((d) => d[property]);
    }

    /**
     * Gets the color of the current chunk.
     *
     * @returns {String} Hexadecimal color code of the chunk.
     */
    get color() {
        const { colors, idToCluster } = this.trajectory;
        return colors[idToCluster[this.clusterIdentifier]];
    }

    toString() {
        return `<b>Timesteps</b>: ${this.timestep} - ${this.last}<br><b>Length</b>: ${this.size}<br><b>ID</b>: ${this.id}`;
    }

    /**
     * Calculates box plot stats for the given chunk.
     *
     * @returns {Object} Contains q1, median, q3, IQR, and max / min thresholds.
     */
    calculateStats(property) {
        const data = this.selected ? this.selected : this.states;
        const states = data.map((id) => GlobalStates.get(id)[property]);
        return boxPlotStats(states);
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
        const where = direction === 'front' ? 0 : this.sequence.length - sliceSize;
        if (this.sequence.length > 0) {
            const deleted = this.sequence.splice(where, sliceSize);

            // update timestep, last, firstID

            if (direction === 'front') {
                this.timestep += deleted.length;
            } else {
                this.last -= deleted.length;
            }

            return deleted;
        }

        return [];
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
