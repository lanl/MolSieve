import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import State from './state';
import { apiClusterStates } from './ajax';
/* eslint-disable-next-line */
import { wsConnect } from './websocketmiddleware';
import { startListening } from './listenerMiddleware';
import { mpn65, WS_URL } from './constants';

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

export const clusterStates = createAsyncThunk('states/clusterStates', async (payload) => {
    const { properties, stateIDs } = payload;
    return apiClusterStates(properties, stateIDs);
});

const selectStateStore = (state) => state.states.values;
export const getState = (state, id) => state.states.values[id];
export const getGlobalScale = (state, property) => state.states.globalScale[property];

// all selectors with arguments need factory functions

export const makeGetStates = () => {
    return createSelector(
        [selectStateStore, (_, stateIDList) => stateIDList],
        (values, stateIDList) => stateIDList.map((id) => values[id])
    );
};

// some super fun functional programming
// a function that returns a function that returns a color
// the first layer can use the redux state to do things
// the second does something based on that information
const USE_MPN = 0;
const USE_CLUSTERING = 1;
const withMpn = () => (id) => mpn65[id % mpn65.length];
const withClustering = (state) => {
    const { stateClustering } = state.states;
    return (id) => (id !== -1 ? withMpn()(stateClustering[id]) : 'black');
};
const colorMethods = [withMpn, withClustering];
export const getStateColoringMethod = (state) => colorMethods[state.states.colorState](state);

export const states = createSlice({
    name: 'states',
    initialState: {
        values: {},
        properties: [],
        globalScale: {},
        colorState: USE_MPN,
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
        resetGlobalScaleProperty: (state, action) => {
            const { globalScale } = state;
            const { property } = action.payload;

            delete globalScale[property];
            states.caseReducers.addPropertyToGlobalScale(state, { payload: { property } });
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
                if (prop[property] !== undefined && prop[property] !== null) {
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
            return { ...state, colorState: USE_MPN, stateClustering: null };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(clusterStates.fulfilled, (state, action) => {
            return { ...state, stateClustering: action.payload, colorState: USE_CLUSTERING };
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

startListening({
    actionCreator: calculateGlobalUniqueStates,
    effect: (_, listenerAPI) => {
        const { dispatch } = listenerAPI;
        dispatch(wsConnect(`${WS_URL}/api/load_properties_for_subset`));
    },
});
export default states.reducer;
