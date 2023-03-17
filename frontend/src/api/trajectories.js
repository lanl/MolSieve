import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import Chunk from './chunk';
import { calculateGlobalUniqueStates } from './states';
import { apiModifyTrajectory } from './ajax';
import { getNeighbors } from './myutils';
import { WS_URL } from './constants';
import { wsConnect } from './websocketmiddleware';

// functions that you can call on the trajectories dictionary
// no trajectories object because that would make it harder for react to diff
//
// https://redux.js.org/usage/deriving-data-selectors
const selectTrajectories = (state) => state.trajectories.values;
const selectChunks = (state) => state.trajectories.chunks;
export const selectTrajectory = (state, name) => state.trajectories.values[name];
export const selectChunk = (state, id) => state.trajectories.chunks[id];

export const getAllImportantChunks = createSelector([selectChunks], (chunks) =>
    Array.from(Object.values(chunks)).filter((c) => c.important)
);

export const getAllImportantStates = createSelector([getAllImportantChunks], (chunks) =>
    chunks.reduce((acc, v) => [...acc, ...v.states], [])
);

export const getChunkList = createSelector(
    [selectTrajectory, selectChunks],
    (trajectory, chunks) => {
        return trajectory.chunkList.map((id) => chunks[id]);
    }
);

export const getImportantChunkList = createSelector([getChunkList], (chunkList) =>
    chunkList.filter((c) => c.important)
);
// could be more flexible if chunkList gets passed in
export const isTimestepsWithinChunks = createSelector(
    [getImportantChunkList, (_, timesteps) => timesteps],
    (chunkList, timesteps) => {
        const start = Math.min(...timesteps);
        const end = Math.max(...timesteps);

        return chunkList.some((c) => c.timestep <= start && c.last >= end);
    }
);

export const getLength = createSelector([getChunkList], (chunkList) => {
    const lastArray = chunkList.map((c) => c.last);
    return Math.max(...lastArray);
});

export const getVisibleChunks = createSelector(
    [selectTrajectory, getChunkList],
    (trajectory, chunkList) => {
        const { extents } = trajectory;
        const [start, end] = extents;
        const topChunkList = chunkList.filter((c) => !(start > c.last || end < c.timestep));
        return topChunkList;
    }
);

export const getAllVisibleChunks = createSelector(
    [selectTrajectories, selectChunks],
    (trajectories, chunks) => {
        let totalList = [];
        for (const trajectory of Object.values(trajectories)) {
            const { extents, chunkList } = trajectory;
            const [start, end] = extents;
            totalList = [
                ...totalList,
                ...chunkList
                    .map((id) => chunks[id])
                    .filter((c) => !(start > c.last || end < c.timestep)),
            ];
        }
        return totalList;
    }
);

export const simplifySet = createAsyncThunk('trajectories/simplifySet', async (args, thunkAPI) => {
    const { name, threshold } = args;
    const { getState, dispatch } = thunkAPI;
    const state = getState();

    const trajectory = state.trajectories.values[name];
    const data = await apiModifyTrajectory(name, trajectory.currentClustering, threshold);
    dispatch(
        calculateGlobalUniqueStates({
            newUniqueStates: data.uniqueStates,
            run: name,
        })
    );
    return { simplified: data.simplified, name, threshold };
});

export const expand = createAsyncThunk('trajectories/expand', async (args, thunkAPI) => {
    const { id, sliceSize, name } = args;
    const { getState, dispatch } = thunkAPI;

    const state = getState();
    const { chunks, values } = state.trajectories;
    const trajectory = values[name];

    const { chunkList } = trajectory;

    const chunkIndex = chunkList.indexOf(id);

    const neighbors = getNeighbors(chunkList, chunkIndex);
    const [leftID, rightID] = neighbors;
    const left = chunks[leftID];
    const right = chunks[rightID];

    const loadNeighbors = (l, r) => {
        return new Promise((resolve, reject) => {
            if (l) {
                l.loadSequence(name).then((lData) => {
                    if (r) {
                        r.loadSequence(name).then((rData) => {
                            resolve({ lData, rData });
                        });
                    } else {
                        resolve({ lData });
                    }
                });
            } else if (r) {
                r.loadSequence(name).then((rData) => {
                    resolve({ rData });
                });
            } else {
                reject();
            }
        });
    };

    const { lData, rData } = await loadNeighbors(left, right);
    // update global states with any new data
    dispatch(
        calculateGlobalUniqueStates({
            newUniqueStates: [...lData, ...rData],
            run: name,
        })
    );
    dispatch(wsConnect(`${WS_URL}/api/load_properties_for_subset`));

    return { left, lData, rData, right, sliceSize, id, name };
});

export const trajectories = createSlice({
    name: 'trajectories',
    initialState: {
        names: [],
        values: {},
        chunks: {},
        counter: 0,
        /*
        extents: {},
        current_clustering: {},
        colors: {},
        raw: {},
        LAMMPSBootstrapScript: {},
        chunkingThreshold: {},
        chunks: {}, */
    },
    reducers: {
        addTrajectory: (state, action) => {
            const { name, id, chunkingThreshold, currentClustering, newChunks, colors } =
                action.payload;
            const { values, names } = state;
            names.push(name);
            values[name] = {
                id,
                name,
                currentClustering,
                colors,
                chunkList: [],
            };
            trajectories.caseReducers.setChunks(state, {
                payload: {
                    newChunks,
                    trajectoryName: name,
                    chunkingThreshold,
                },
            });
        },
        swapPositions: (state, action) => {
            const { names } = state;
            const { a, b } = action.payload;
            const aIdx = names.indexOf(a);
            const bIdx = names.indexOf(b);
            names[aIdx] = b;
            names[bIdx] = a;
        },
        // swap position?
        // overwrites chunks entirely
        setChunks: (state, action) => {
            const { newChunks, trajectoryName, chunkingThreshold } = action.payload;
            const { chunks, values } = state;
            let { counter } = state;
            const trajectory = values[trajectoryName];
            const chunkList = [];
            let lastTimestep = 0;
            for (const chunk of newChunks) {
                const newChunk = new Chunk(
                    counter,
                    chunk.timestep,
                    chunk.last,
                    chunk.firstID,
                    chunk.important,
                    chunk.cluster,
                    chunk.sequence,
                    chunk.selected,
                    chunk.characteristicState,
                    trajectory.colors[chunk.cluster]
                );
                chunks[newChunk.id] = newChunk;
                chunkList.push(newChunk.id);
                lastTimestep = Math.max(lastTimestep, chunk.last);
                counter++;
            }
            values[trajectoryName].length = lastTimestep;
            values[trajectoryName].extents = [0, lastTimestep];
            values[trajectoryName].chunkingThreshold = chunkingThreshold;
            values[trajectoryName].chunkList = chunkList;
        },
        setZoom: (state, action) => {
            const { name, extents } = action.payload;
            const { values } = state;
            values[name].extents = extents;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(simplifySet.fulfilled, (state, action) => {
            const { name, simplified, threshold } = action.payload;
            trajectories.caseReducers.setChunks(state, {
                payload: {
                    newChunks: simplified,
                    trajectoryName: name,
                    chunkingThreshold: threshold,
                },
            });
        });
        builder.addCase(expand.fulfilled, (state, action) => {
            const { chunks: oldChunks, values } = state;
            const chunks = { ...oldChunks };
            const { left, lData, rData, right, id, sliceSize, name } = action.payload;
            const chunk = chunks[id];
            const chunkList = [...values[name].chunkList];

            if (left) {
                if (!left.loaded && !left.important) {
                    left.sequence = lData;
                    left.loaded = true;
                }
                const leftVals = left.takeFromSequence(sliceSize, 'back');
                chunk.addToSequence(leftVals, 'front');
                if (!left.sequence.length) {
                    delete chunks[left.id];
                    chunkList.splice(chunkList.indexOf(left.id), 1);
                } else {
                    chunks[left.id] = left;
                }
            }

            if (right) {
                if (!right.loaded && !right.important) {
                    right.sequence = rData;
                    right.loaded = true;
                }
                const rightVals = right.takeFromSequence(sliceSize, 'front');
                chunk.addToSequence(rightVals, 'back');
                if (!right.sequence.length) {
                    delete chunks[right.id];
                    chunkList.splice(chunkList.indexOf(right.id), 1);
                } else {
                    chunks[right.id] = right;
                }
            }

            chunks[chunk.id] = chunk;
            return {
                ...state,
                chunks,
                values: { ...values, [name]: { ...values[name], chunkList } },
            };
        });
    },
});

export const { addTrajectory, setChunks, setZoom, swapPositions } = trajectories.actions;

export default trajectories.reducer;
