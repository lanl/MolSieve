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

    id; // id that corresponds to a specific state object

    size = 5;

    dataType = TIMESTEP;

    constructor(timestep, id) {
        this.timestep = timestep;
        this.id = id;
    }

    static withParent(timestep, id, parentID) {
        const t = new Timestep(timestep, id);
        t.parentID = parentID;
        return t;
    }

    get individualColor() {
        return scheme[this.id % scheme.length];
    }

    get clusterIdentifier() {
        return this.id;
    }
}
