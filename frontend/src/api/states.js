import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import State from './state';
import { loadPropertiesForSubset, apiClusterStates } from './ajax';
/**
 * Given a list of stateIDs, find the states that don't have the property loaded.
 *
 * @param {String} property - Name of property to check
 * @param {Array<Number>} subset - List of stateIDs to check
 */
export const findMissingPropertyInSubset = (property, subset) => {
    const missing = [];

    for (const s of subset) {
        if (!(property in s)) {
            missing.push(s);
        }
    }
    return missing;
};

/**
 * Check if the states indexed by the ids provided in the subset array have the given properties loaded.
 *
 * @param {[TODO:type]} properties - [TODO:description]
 * @param {[TODO:type]} subset - [TODO:description]
 * @returns {[TODO:type]} [TODO:description]
 */
export const subsetHasProperties = (properties, subset) => {
    const vals = [];
    for (const property of properties) {
        const missing = findMissingPropertyInSubset(property, subset);
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

export const subsetHasProperty = (state, property, subset) => {
    const missing = findMissingPropertyInSubset(state, property, subset);
    return !missing.length;
};

/* Ensure that the states indexed by the ids provided in the subset array have the given property loaded
 * Basically, check if the property is loaded, and if not, load it.
 */
export const ensureSubsetHasProperties = createAsyncThunk(
    'states/ensureSubsetHasProperties',
    async (properties, subset) => {
        const { hasProperties, missingProperties } = subsetHasProperties(properties, subset);

        if (!hasProperties) {
            const mp = missingProperties.map((d) => d.name);
            const data = await loadPropertiesForSubset(mp, subset);
            return data;
        }
        return [];
    }
);

/* Wrapper for hasProperties in case only one property is needed */
export const ensureSubsetHasProperty = (state, property, subset) => {
    return ensureSubsetHasProperties(state, [property], subset);
};

export const getStates = createSelector(
    [(state) => state.states.values, (_, stateIDList) => stateIDList],
    (values, stateIDList) => stateIDList.map((id) => values.get(id))
);

export const getState = createSelector(
    [(state) => state.states.values, (_, id) => id],
    (values, id) => values.get(id)
);

export const getGlobalScale = createSelector(
    [(state) => state.states.globalScale, (_, property) => property],
    (globalScale, property) => globalScale[property]
);

export const getPropList = (state, stateList, property, range) => {
    let usedStates = stateList;
    if (range) {
        usedStates = stateList.slice(range[0], range[1]);
    }

    const stateSequence = usedStates.map((id) => state.values.get(id));
    return stateSequence.map((d) => d[property]);
};

export const clusterStates = createAsyncThunk(
    'states/clusterStates',
    async (properties, states) => {
        const response = await apiClusterStates(properties, states);
        return response;
    }
);

// immutable.js if need map
// should have globalScale as part of it
export const states = createSlice({
    name: 'states',
    initialState: {
        values: new Map(),
        properties: [],
        globalScale: {},
    },
    reducers: {
        addProperties: (state, action) => {
            const { properties, globalScale } = state;
            for (const property of action.payload) {
                properties.push(property);
                if (!globalScale[property]) {
                    globalScale[property] = { min: Number.MAX_VALUE, max: Number.MIN_VALUE };
                }
            }
        },
        addPropToState: (state, action) => {
            const { prop } = action.payload;
            const { id } = prop;
            const { values, properties, globalScale } = state;

            if (id === undefined) {
                throw new Error('Property missing id.');
            }

            if (values.has(id)) {
                const previous = values.get(id);
                values.set(id, Object.assign(previous, prop));
            } else {
                values.set(id, prop);
            }

            for (const property of properties) {
                if (prop[property]) {
                    globalScale[property] = {
                        min: Math.min(globalScale[property].min, prop[property]),
                        max: Math.max(globalScale[property].max, prop[property]),
                    };
                }
            }
        },
        addPropToStates: (state, action) => {
            for (const prop of action.payload) {
                prop.loaded = true;
                states.caseReducers.addPropToState(state, { payload: { prop } });
            }
        },
        removePropFromStates: (state, action) => {
            const { values } = state;
            const { prop } = action.payload;
            for (const s of state.values.values()) {
                if (s[prop] !== undefined && s[prop] !== null) {
                    delete s[prop];
                    values.set(s.id, s);
                }
            }
        },
        calculateGlobalUniqueStates: (state, action) => {
            const { newUniqueStates, run } = action.payload;
            const { values } = state;
            for (const s of newUniqueStates) {
                if (values.has(s)) {
                    const previous = values.get(s);
                    previous.seenIn = [...previous.seenIn, run];
                    values.set(s, previous);
                } else {
                    const newState = new State(s);
                    newState.seenIn = [run];
                    values.set(newState.id, newState);
                }
            }
        },
        clearClusterStates: (state) => {
            const { values } = state;
            for (const [id, s] of values.entries()) {
                s.stateCluster = undefined;
                values.set(id, s);
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(ensureSubsetHasProperties.pending, (state) => {
                state.status = 'fetchingProps';
            })
            .addCase(ensureSubsetHasProperties.fulfilled, (state, action) =>
                state.caseReducers.addPropToState(action.payload)
            )
            .addCase(clusterStates.fulfilled, (state, action) => {
                for (const [id, clusterID] of Object.entries(action.payload)) {
                    const previous = state.values.get(parseInt(id, 10));
                    previous.stateCluster = clusterID;
                    state.values.set(id, previous);
                }
            });
    },
});

export const {
    addPropToState,
    addPropToStates,
    removePropFromStates,
    calculateGlobalUniqueStates,
    clearClusterStates,
    addProperties,
} = states.actions;

export default states.reducer;
