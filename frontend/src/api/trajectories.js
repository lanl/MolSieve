import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import Chunk from './chunk';
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

export const trajectories = createSlice({
    name: 'trajectories',
    initialState: {
        names: [],
        values: {},
        chunks: {},
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
                chunkingThreshold,
                currentClustering,
                colors,
                chunkList: [],
            };
            trajectories.caseReducers.setChunks(state, {
                payload: { newChunks, trajectoryName: name },
            });
        },
        // swap position?
        // overwrites chunks entirely
        setChunks: (state, action) => {
            const { newChunks, trajectoryName } = action.payload;
            const { chunks, values } = state;
            const chunkList = [];
            let lastTimestep = 0;
            for (const chunk of newChunks) {
                const newChunk = new Chunk(
                    chunk.timestep,
                    chunk.last,
                    chunk.firstID,
                    chunk.important,
                    chunk.cluster,
                    chunk.sequence,
                    chunk.selected,
                    chunk.characteristicState,
                    values[trajectoryName]
                );
                chunks[newChunk.id] = newChunk;
                chunkList.push(newChunk.id);
                lastTimestep = Math.max(lastTimestep, chunk.last);
            }
            values[trajectoryName].chunkList = chunkList;
            values[trajectoryName].extents = [0, lastTimestep];
        },
    },
});

export const { addTrajectory, setChunks } = trajectories.actions;

export default trajectories.reducer;
