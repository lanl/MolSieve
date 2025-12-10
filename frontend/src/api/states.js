/*
 * © 2025. Triad National Security, LLC. All rights reserved.
 * This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
 */
import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import State from './state';
import { apiClusterStates } from './ajax';
/* eslint-disable-next-line */
import { wsConnect } from './websocketmiddleware';
import { startListening } from './listenerMiddleware';
import { mpn65, WS_URL } from './constants';

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

/*
 * a function that returns a function that returns a color
 * the first layer can use the redux state to do things
 * the second does something based on that information
 * Allows UI to reactively color states.
 */
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
        values: {}, // the data associated with each State object
        properties: [],
        globalScale: {}, // min and max value of properties
        colorState: USE_MPN, // what function to use when coloring states in the UI
    },
    reducers: {
        /**
         * Adds a property to the State store.
         *
         * @param {Object} state - Currently existing properties.
         * @param {Object} action - The properties to add.
         */
        addProperties: (state, action) => {
            const { properties } = state;
            for (const property of action.payload) {
                properties.push(property);
                states.caseReducers.addPropertyToGlobalScale(state, { payload: { property } });
            }
        },
        /**
         * Adds property to globalScale; initialized with min and max.
         *
         * @param {Object} state - The globalScale object for all States.
         * @param {Object} action - The new property to update.
         */
        addPropertyToGlobalScale: (state, action) => {
            const { globalScale } = state;
            const { property } = action.payload;

            if (!globalScale[property]) {
                globalScale[property] = { min: Number.MAX_VALUE, max: Number.MIN_VALUE };
            }
        },
        /**
         * Updates the globalScale object if it is beyond the min / max values for the specified property.
         *
         * @param {Object} state - The globalScale object.
         * @param {Object} action - The property and new values to update globalScale with.
         */
        updateGlobalScale: (state, action) => {
            const { globalScale } = state;
            const { property, values } = action.payload;

            states.caseReducers.addPropertyToGlobalScale(state, { payload: { property } });
            globalScale[property] = {
                min: Math.min(globalScale[property].min, Math.min(...values)),
                max: Math.max(globalScale[property].max, Math.max(...values)),
            };
        },
        /**
         * Resets the globalScale for a property.
         *
         * @param {Object} state - The globalScale object.
         * @param {Object} action - The property to reset.
         */
        resetGlobalScaleProperty: (state, action) => {
            const { globalScale } = state;
            const { property } = action.payload;

            delete globalScale[property];
            states.caseReducers.addPropertyToGlobalScale(state, { payload: { property } });
        },
        /**
         * Adds a property to a State object.
         *
         * @param {Object} state - The state objects, properties list and global scale.
         * @param {Object} action - Object with mandatory ID field to join to state object list.
         * @throws {Error} - Raised if prop is missing ID.
         */
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
        /**
         * Adds property to multiple states. Sets states to be loaded.
         *
         * @param {Object} state - The States reducer slice.
         * @param {Object} action - A list of props to add.
         */
        addPropToStates: (state, action) => {
            for (const prop of action.payload) {
                prop.loaded = true;
                states.caseReducers.addPropToState(state, { payload: { prop } });
            }
        },
        /**
         * Deletes a property from every state.
         *
         * @param {Object} state - The state values list.
         * @param {Object} action - The property to delete.
         */
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
        /**
         * Adds new State objects from the back-end if they do not exist.
         * TODO: Perhaps delete seenIn?
         *
         * @param {Object} state - The state values list.
         * @param {Object} action - The new states and the trajectory they belong to.
         */
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
        /**
         * Removes the state clustering assigned to each state from the clusterStates action.
         *
         * @param {Object} state - The States reducer slice.
         * @returns {Object} - The States reducer slice without any state clustering.
         */
        clearClusterStates: (state) => {
            return { ...state, colorState: USE_MPN, stateClustering: null };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(clusterStates.fulfilled, (state, action) => {
            // updates state clustering with back-end results
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

// whenever calculateGlobalUniqueStates is ran, the websocket for load_properties is also initalized
startListening({
    actionCreator: calculateGlobalUniqueStates,
    effect: (_, listenerAPI) => {
        const { dispatch } = listenerAPI;
        dispatch(wsConnect(`${WS_URL}/data/load_properties_for_subset`));
    },
});
export default states.reducer;
