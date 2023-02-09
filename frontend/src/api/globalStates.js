import State from './state';
import { loadPropertiesForSubset, apiClusterStates } from './ajax';

class GlobalStates {
    map = new Map();

    properties = [];

    addPropToStates = (propertyList) => {
        for (const prop of propertyList) {
            this.addPropToState(prop);
        }
    };

    addProperties = (propertyList) => {
        this.properties = [...new Set([...propertyList, ...this.properties])];
    };

    /**
     * Adds a new property to State objects.
     *
     * @param {Object} prop - Property to add; needs to be {property: value, id: id} to work.
     */
    addPropToState = (prop) => {
        if (prop.id === undefined) {
            throw new Error('Property missing id.');
        }
        if (this.map.has(prop.id)) {
            const previous = this.map.get(prop.id);
            this.map.set(prop.id, Object.assign(previous, prop));
        } else {
            this.map.set(prop.id, prop);
        }
    };

    removePropFromStates = (prop) => {
        for (const s of this.map.values()) {
            if (s[prop] !== undefined && s[prop] !== null) {
                delete s[prop];
                this.map.set(s.id, s);
            }
        }
    };

    calculateGlobalUniqueStates = (newUniqueStates, run) => {
        for (const s of newUniqueStates) {
            if (this.map.has(s)) {
                const previous = this.map.get(s);
                previous.seenIn = [...previous.seenIn, run];
                this.map.set(s.id, Object.assign(previous, s));
            } else {
                const state = new State(s);
                state.seenIn = [run];
                this.map.set(state.id, Object.assign(state, s));
            }
        }
    };

    /**
     * Check if the states indexed by the ids provided in the subset array have the given properties loaded.
     *
     * @param {[TODO:type]} properties - [TODO:description]
     * @param {[TODO:type]} subset - [TODO:description]
     * @returns {[TODO:type]} [TODO:description]
     */
    subsetHasProperties = (properties, subset) => {
        const vals = [];
        for (const property of properties) {
            const missing = this.findMissingPropertyInSubset(property, subset);
            vals.push({ name: property, missing, val: !missing.length });
        }
        return {
            hasProperties: vals.every((d) => d.val),
            missingProperties: [
                ...new Set(
                    vals
                        .filter((d) => !d.val)
                        .map((d) => d.missing)
                        .reduce((acc, missing) => [...acc, ...missing], [])
                ),
            ],
        };
    };

    subsetHasProperty = (property, subset) => {
        const missing = this.findMissingPropertyInSubset(property, subset);
        return !missing.length;
    };

    /**
     * Given a list of stateIDs, find the states that don't have the property loaded.
     *
     * @param {String} property - Name of property to check
     * @param {Array<Number>} subset - List of stateIDs to check
     */
    findMissingPropertyInSubset = (property, subset) => {
        const missing = [];
        for (const s of subset) {
            const state = this.map.get(s);
            if (!(property in state)) {
                missing.push(s);
            }
        }
        return missing;
    };

    /* Wrapper for hasProperties in case only one property is needed */
    ensureSubsetHasProperty = (property, subset) => {
        return this.ensureSubsetHasProperties([property], subset);
    };

    /* Ensure that the states indexed by the ids provided in the subset array have the given property loaded
     * Basically, check if the property is loaded, and if not, load it.
     */
    ensureSubsetHasProperties = (properties, subset) => {
        return new Promise((resolve, reject) => {
            if (subset.length === 0) {
                resolve();
            }

            const { hasProperties, missingProperties } = this.subsetHasProperties(
                properties,
                subset
            );
            if (!hasProperties) {
                const mp = missingProperties.map((d) => d.name);
                loadPropertiesForSubset(mp, subset)
                    .then((data) => {
                        this.addPropToStates(data);
                        resolve();
                    })
                    .catch((e) => {
                        reject(e);
                    });
            } else {
                resolve();
            }
        });
    };

    clusterStates = (states) => {
        return new Promise((resolve, reject) => {
            loadPropertiesForSubset(this.properties, states)
                .then((stateData) => {
                    this.addPropToStates(stateData);
                    apiClusterStates(this.properties, states)
                        .then((d) => {
                            for (const [id, clusterID] of Object.entries(d)) {
                                const previous = this.map.get(parseInt(id, 10));
                                previous.stateCluster = clusterID;
                                this.map.set(id, Object.assign(previous, previous));
                                resolve();
                            }
                        })
                        .catch((e) => reject(e));
                })
                .catch((e) => reject(e));
        });
    };

    clearClusterStates = () => {
        for (const [id, state] of this.map.entries()) {
            state.stateCluster = undefined;
            this.map.set(id, state);
        }
    };

    get = (id) => {
        return this.map.get(id);
    };

    // could do extends to not have to write this
    values = () => {
        return this.map.values();
    };
}

const instance = new GlobalStates();

export default instance;
