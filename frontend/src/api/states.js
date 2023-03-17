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

export const clusterStates = createAsyncThunk('states/clusterStates', async (payload) => {
    const { properties, stateIDs } = payload;
    return apiClusterStates(properties, stateIDs);
});

/* Wrapper for hasProperties in case only one property is needed */
export const ensureSubsetHasProperty = (state, property, subset) => {
    return ensureSubsetHasProperties(state, [property], subset);
};

const selectStateStore = (state) => state.states.values;
export const getState = (state, id) => state.states.values[id];
export const getGlobalScale = (state, property) => state.states.globalScale[property];

export const getStates = createSelector(
    [selectStateStore, (_, stateIDList) => stateIDList],
    (values, stateIDList) => stateIDList.map((id) => values[id])
);

export const getPropList = (state, stateList, property, range) => {
    let usedStates = stateList;
    if (range) {
        usedStates = stateList.slice(range[0], range[1]);
    }

    const stateSequence = usedStates.map((id) => state.values[id]);
    return stateSequence.map((d) => d[property]);
};

export const states = createSlice({
    name: 'states',
    initialState: {
        values: {},
        properties: [],
        globalScale: {},
        colorByStateCluster: false,
    },
    reducers: {
        addProperties: (state, action) => {
            const { properties } = state;
            for (const property of action.payload) {
                properties.push(property);
                states.caseReducers.addPropertyToGlobalScale(state, { payload: { property } });
            }
        },
        addPropertyToGlobalScale: (state, action) => {
            const { globalScale } = state;
            const { property } = action.payload;

            if (!globalScale[property]) {
                globalScale[property] = { min: Number.MAX_VALUE, max: Number.MIN_VALUE };
            }
        },
        updateGlobalScale: (state, action) => {
            const { globalScale } = state;
            const { property, values } = action.payload;

            states.caseReducers.addPropertyToGlobalScale(state, { payload: { property } });
            globalScale[property] = {
                min: Math.min(globalScale[property].min, Math.min(...values)),
                max: Math.max(globalScale[property].max, Math.max(...values)),
            };
        },
        addPropToState: (state, action) => {
            const { prop } = action.payload;
            const { id } = prop;
            const { values, properties, globalScale } = state;

            if (id === undefined) {
                throw new Error('Property missing id.');
            }

            if (values[id]) {
                const previous = values[id];
                values[id] = Object.assign(previous, prop);
            } else {
                values[id] = prop;
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
            for (const s of Object.values(values)) {
                if (s[prop] !== undefined && s[prop] !== null) {
                    delete s[prop];
                    values[s.id] = s;
                }
            }
        },
        calculateGlobalUniqueStates: (state, action) => {
            const { newUniqueStates, run } = action.payload;
            const { values } = state;
            for (const s of newUniqueStates) {
                if (values[s]) {
                    const previous = values[s];
                    previous.seenIn = [...new Set([...previous.seenIn, run])];
                    values[s] = previous;
                } else {
                    const newState = new State(s);
                    newState.seenIn = [run];
                    values[newState.id] = newState;
                }
            }
        },
        clearClusterStates: (state) => {
            const { values } = state;
            for (const [id, s] of values.entries()) {
                s.stateCluster = undefined;
                values[id] = s;
            }
            return { ...state, values, colorByStateCluster: !state.colorByStateCluster };
        },
        toggleStateClustering: (state) => {
            return { ...state, colorByStateCluster: !state.colorByStateCluster };
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
            .addCase(clusterStates.rejected, (state, action) => {
                // should have a failure case, since it can sometimes fail to cluster
            })
            .addCase(clusterStates.fulfilled, (state, action) => {
                const { values, colorByStateCluster } = state;
                for (const [id, clusterID] of Object.entries(action.payload)) {
                    const intID = parseInt(id, 10);
                    const previous = values[intID];
                    previous.stateCluster = parseInt(clusterID, 10);
                    values[intID] = previous;
                    // state.caseReducers.toggleStateClustering();
                }
                return { ...state, values, colorByStateCluster: !colorByStateCluster };
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
    updateGlobalScale,
    toggleStateClustering,
} = states.actions;

export default states.reducer;
