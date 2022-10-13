import GlobalChunks from './globalChunks';
import GlobalStates from './globalStates';
import Timestep from './timestep';
import { boxPlotStats } from './stats';
import { cyrb128, mulberry32 } from './random';

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

    constructor(timestep, last, firstID, important, cluster, trajectory) {
        this.timestep = timestep;
        this.last = last;
        this.firstID = firstID;
        this.important = important;
        this.cluster = cluster;
        this.id = GlobalChunks.generateID();
        // seems to be way slower...
        this.trajectory = trajectory;
    }

    /* Returns array of 20 + 10% of chunk states that are characteristic of it.
     * Used to select states for display in a box plot.
     * NOTE: not a getter because otherwise the results would be randomly recalculated
     */
    calculateSelected() {
        const entries = [...this.stateCounts.entries()].sort((a, b) => b[1] - a[1]);

        const seed = cyrb128('molecular dynamics');
        const rand = mulberry32(seed[0]);

        if (entries.length < 20) {
            this.selected = this.states;
            return;
        }
        // 0 returns only state ID
        const selected = [];
        for (let i = 0; i < 20; i++) {
            selected.push(entries[i][0]);
        }

        for (let j = 0; j < Math.floor(0.1 * entries.length); j++) {
            // select 10% of the chunk randomly for the distribution; ignore top 20 in selection
            const random = Math.floor(rand() * (entries.length - 20)) + 20;
            selected.push(entries[random][0]);
        }

        this.selected = selected;
    }

    static withParent(timestep, last, firstID, important, parentID, trajectory) {
        const newChunk = new Chunk(timestep, last, firstID, important, undefined, trajectory);
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

    // returns an array of unique state ids within a chunk
    get states() {
        return [...new Set(this.sequence)];
    }

    // returns a Set of unique states id within a chunk
    get statesSet() {
        return new Set(this.sequence);
    }

    // gets the ids inside a chunk in order
    get sequence() {
        const { timesteps, trajectory } = this;
        const ids = [];
        for (let i = 0; i < timesteps.length; i++) {
            ids.push(trajectory.sequence[timesteps[i]]);
        }
        return ids;
    }

    // gets the states within the sequence as Timestep objects, useful for rendering
    get timestepSequence() {
        const { timesteps, trajectory } = this;
        const t = [];
        for (let i = 0; i < timesteps.length; i++) {
            t.push(new Timestep(timesteps[i], trajectory.sequence[timesteps[i]]));
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
        let { sequence } = this;
        if (range) {
            sequence = sequence.slice(range[0], range[1]);
        }
        const stateSequence = sequence.map((id) => GlobalStates.get(id));
        const propertyList = stateSequence.map((d) => d[property]);
        return mf(propertyList, n);
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
        return `<b>Timesteps</b>: ${this.timestep} - ${this.last}<br><b>Length</b>: ${this.size}`;
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
}
