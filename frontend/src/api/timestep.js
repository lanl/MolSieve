/* call it timestep because it
 * 1. won't weirdly conflict with react
 * 2. represents a specific point in time during the simulation
 */

const TIMESTEP = 1;

const scheme = [
    '#1b9e77',
    '#d95f02',
    '#7570b3',
    '#e7298a',
    '#66a61e',
    '#e6ab02',
    '#a6761d',
    '#666666',
];

export default class Timestep {
    timestep;

    id; // id used for rendering

    stateID; // id that corresponds to a specific state object

    size = 10;

    dataType = TIMESTEP;

    constructor(timestep, id, stateID) {
        this.timestep = timestep;
        this.id = id;
        this.stateID = stateID;
    }

    get individualColor() {
        return scheme[this.id % scheme.length];
    }

    get clusterIdentifier() {
        return this.stateID;
    }
}
