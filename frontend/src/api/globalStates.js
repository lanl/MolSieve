import State from './state';
import { ensureArray } from './myutils';
import { loadPropertiesForSubset, apiClusterStates } from './ajax';
import { structuralAnalysisProps, mpn65 } from './constants';

class GlobalStates {
    map = new Map();

    addPropToStates = (propertyList) => {
        for (const prop of propertyList) {
            if (this.map.has(prop.id)) {
                const previous = this.map.get(prop.id);
                this.map.set(prop.id, Object.assign(previous, prop));
            } else {
                this.map.set(prop.id, prop);
            }
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
            if (this.map.has(s.id)) {
                const previous = this.map.get(s.id);
                previous.seenIn = [...previous.seenIn, run];
                this.map.set(s.id, Object.assign(previous, s));
            } else {
                const state = new State(s.id);
                state.seenIn = [run];
                this.map.set(state.id, Object.assign(state, s));
            }
        }
    };

    /* Check if the states indexed by the ids provided in the subset array have the given properties loaded. */
    subsetHasProperties = (properties, subset) => {
        const vals = [];
        for (const property of properties) {
            vals.push({ val: this.subsetHasProperty(property, subset), name: property });
        }
        return {
            hasProperties: vals.every((d) => d.val),
            missingProperties: vals.filter((d) => !d.val),
        };
    };

    /* Check if the states indexed by the ids provided in the subset array have the given property loaded */
    subsetHasProperty = (property, subset) => {
        const ss = ensureArray(subset);
        const vals = [];
        for (const s of ss) {
            const state = this.map.get(s);
            vals.push(property in state);
        }
        return vals.every((d) => d);
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
        apiClusterStates(structuralAnalysisProps, states).then((d) => {
            for (const [id, clusterID] of Object.entries(d)) {
                const previous = this.map.get(parseInt(id, 10));
                previous.stateCluster = clusterID;
                this.map.set(id, Object.assign(previous, previous));
            }
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
