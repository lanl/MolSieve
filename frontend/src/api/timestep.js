/* call it timestep because it
 * 1. won't weirdly conflict with react
 * 2. represents a specific point in time during the simulation
 */
import State from './state';

const TIMESTEP = 1;

export default class Timestep extends State {
    timestep;

    id; // id that corresponds to a specific state object

    size = 5;

    dataType = TIMESTEP;

    constructor(timestep, id) {
        super(id);
        this.timestep = timestep;
    }

    // parentID?
    static withParent(timestep, id, parentID) {
        const t = new Timestep(timestep, id);
        t.parentID = parentID;
        return t;
    }
}
