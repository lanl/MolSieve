import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import Chunk from './chunks';

export const getStates = createSelector(
    [(state) => state.states.values, (_, stateIDList) => stateIDList],
    (values, stateIDList) => stateIDList.map((id) => values.get(id))
);

export const getChunkList = createSelector(
    [(state) => state.chunks.values, (_, name) => name],
    (values, name) =>
        Array.from(values.values())
            .map((c) => c)
            .filter((c) => c.trajectory.name === name)
);

export const getVisibleChunks = createSelector(
    [(state) => state.chunks.values, (_, extents) => extents, (_, __, name) => name],
    (values, extents, name) => {
        const [start, end] = extents;
        return getChunkList(values, name).filter((c) => !(start > c.last || end < c.timestep));
    }
);

export const getChunk = createSelector(
    [(state) => state.chunks.values, (_, id) => id],
    (values, id) => values.get(id)
);

export const globalChunks = createSlice({
    name: 'chunks',
    initialState: {
        values: {},
    },
    reducers: {
        addChunks: (state, action) => {
            const { chunks } = action.payload;
            const { values } = state;
            for (const chunk of chunks) {
                values[chunk.id] = chunk;
            }
        },
    },
});

export const { addChunks } = globalChunks.actions;

export default globalChunks.reducer;
