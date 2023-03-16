import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import Chunk from './chunk';
import { calculateGlobalUniqueStates } from './states';
import { apiModifyTrajectory } from './ajax';

// functions that you can call on the trajectories dictionary
// no trajectories object because that would make it harder for react to diff
//
// https://redux.js.org/usage/deriving-data-selectors
const selectTrajectories = (state) => state.trajectories.values;
const selectChunks = (state) => state.trajectories.chunks;

export const getAllImportantChunks = createSelector([selectChunks], (chunks) =>
    Array.from(chunks.values()).filter((c) => c.important)
);

export const getAllImportantStates = createSelector([getAllImportantChunks], (chunks) =>
    chunks.reduce((acc, v) => [...acc, ...v.states], [])
);

// apparently don't need to memoize
export const selectTrajectory = createSelector(
    [selectTrajectories, (_, name) => name],
    (trajectories, name) => trajectories[name]
);

export const selectChunk = createSelector(
    [selectChunks, (_, id) => id],
    (chunks, id) => chunks[id]
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
        // swap position?
        // overwrites chunks entirely
        setChunks: (state, action) => {
            const { newChunks, trajectoryName, chunkingThreshold } = action.payload;
            const { chunks, values } = state;
            const trajectory = values[trajectoryName];
            const chunkList = [];
            let lastTimestep = 0;
            for (const chunk of newChunks) {
                const newChunk = new Chunk(
                    Object.keys(chunks).length,
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
    },
});

export const { addTrajectory, setChunks, setZoom } = trajectories.actions;

export default trajectories.reducer;
