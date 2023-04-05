import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
// import * as d3 from 'd3';
import Chunk from './chunk';
/* eslint-disable-next-line */
import { calculateGlobalUniqueStates } from './states';
import { apiModifyTrajectory } from './ajax';
import { getNeighbors, buildDictFromArray, normalizeDict } from './myutils';
import { zTest } from './math/stats';

// import { startListening } from './listenerMiddleware';

const clusterColors = [
    '#e15759',
    '#76b7b2',
    '#59a14f',
    '#edc949',
    '#af7aa1',
    '#ff9da7',
    '#9c755f',
    '#bab0ab',
];

// functions that you can call on the trajectories dictionary
// no trajectories object because that would make it harder for react to diff
//
// https://redux.js.org/usage/deriving-data-selectors
export const selectTrajectories = (state) => state.trajectories.values;
export const selectChunks = (state) => state.trajectories.chunks;
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

export const getUnimportantChunkList = createSelector([getChunkList], (chunkList) =>
    chunkList.filter((c) => !c.important)
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

// TODO: maybe somehow merge these two?
export const simplifySet = createAsyncThunk('trajectories/simplifySet', async (args, thunkAPI) => {
    const { name, threshold } = args;
    const { getState, dispatch } = thunkAPI;
    const state = getState();

    const trajectory = state.trajectories.values[name];
    const { mMin, mMax, currentClustering } = trajectory;
    const data = await apiModifyTrajectory(name, mMin, mMax, currentClustering, threshold);
    dispatch(
        calculateGlobalUniqueStates({
            newUniqueStates: data.uniqueStates,
            run: name,
        })
    );
    return { simplified: data.simplified, name, threshold };
});

export const recluster = createAsyncThunk('trajectories/recluster', async (args, thunkAPI) => {
    const { name, clusters } = args;
    const { getState, dispatch } = thunkAPI;

    const state = getState();

    const trajectory = state.trajectories.values[name];
    const { mMin, mMax, chunkingThreshold } = trajectory;

    const data = await apiModifyTrajectory(name, mMin, mMax, clusters, chunkingThreshold);
    dispatch(
        calculateGlobalUniqueStates({
            newUniqueStates: data.uniqueStates,
            run: name,
        })
    );
    return { simplified: data.simplified, name, currentClustering: clusters };
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
    let toSend = [];

    if (lData) {
        toSend = [...lData];
    }

    if (rData) {
        toSend = [...toSend, ...rData];
    }
    dispatch(
        calculateGlobalUniqueStates({
            newUniqueStates: toSend,
            run: name,
        })
    );

    return { left, lData, rData, right, sliceSize, id, name };
});

export const trajectories = createSlice({
    name: 'trajectories',
    initialState: {
        names: [],
        values: {},
        chunks: {},
    },
    reducers: {
        addTrajectory: (state, action) => {
            const {
                name,
                id,
                chunkingThreshold,
                currentClustering,
                newChunks,
                properties,
                mMin,
                mMax,
            } = action.payload;

            const colors = clusterColors.splice(0, currentClustering);
            const { values, names } = state;
            names.push(name);
            values[name] = {
                id,
                name,
                colors,
                chunkList: [],
                ranks: [...properties],
                mMin,
                mMax,
            };
            trajectories.caseReducers.setChunks(state, {
                payload: {
                    newChunks,
                    trajectoryName: name,
                    chunkingThreshold,
                    currentClustering,
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
        setChunks: (state, action) => {
            const { newChunks, trajectoryName, chunkingThreshold, currentClustering } =
                action.payload;
            const { chunks, values } = state;
            const trajectory = values[trajectoryName];

            if (chunkingThreshold !== undefined && chunkingThreshold !== null) {
                trajectory.chunkingThreshold = chunkingThreshold;
            }

            if (currentClustering !== undefined && currentClustering !== null) {
                // will be false if trajectory.currentClustering is undefined
                if (trajectory.currentClustering < currentClustering) {
                    const colors = clusterColors.splice(
                        0,
                        currentClustering - trajectory.currentClustering
                    );

                    for (const color of colors) {
                        trajectory.colors.push(color);
                    }
                }
                trajectory.currentClustering = currentClustering;
            }

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
            trajectory.length = lastTimestep;
            if (!values[trajectoryName].extents) {
                trajectory.extents = [0, lastTimestep];
            }
            trajectory.chunkList = chunkList;
        },
        setZoom: (state, action) => {
            const { name, extents } = action.payload;
            const { values } = state;
            if (extents) {
                values[name].extents = extents;
            } else {
                values[name].extents = [0, values[name].length];
            }
        },
        updateRank: (state, action) => {
            const { states, name } = action.payload;
            const { values, chunks } = state;

            const trajectory = values[name];
            const { ranks, chunkList } = trajectory;
            const uChunks = chunkList.map((id) => chunks[id]).filter((c) => !c.important);
            // .filter((c) => c.timestep >= extents[0] && c.last <= extents[1]);

            const zScores = buildDictFromArray(ranks, []);
            for (let i = 0; i < uChunks.length - 1; i++) {
                const curr = uChunks[i];
                const next = uChunks[i + 1];
                for (const prop of ranks) {
                    const currValues = curr.selected.map((d) => states[d]).map((d) => d[prop]);
                    const nextValues = next.selected.map((d) => states[d]).map((d) => d[prop]);
                    zScores[prop] = [...zScores[prop], Math.abs(zTest(currValues, nextValues))];
                }
            }
            // for each property, calculate the zScore
            const newRanks = Object.keys(zScores)
                .map((prop) => ({
                    [prop]: zScores[prop].reduce((acc, v) => acc + v, 0),
                }))
                .reduce((acc, arr) => ({ ...acc, ...arr }), {});

            trajectory.ranks = Object.entries(normalizeDict(newRanks, [0, 1]))
                .sort((a, b) => a[1] < b[1])
                .map((d) => d[0]);
        },
        updateRanks: (state, action) => {
            const { states } = action.payload;
            const { values } = state;
            for (const name of Object.keys(values)) {
                trajectories.caseReducers.updateRank(state, { payload: { states, name } });
            }
        },
        updateClusterRange: (state, action) => {
            const { name, currentClustering } = action.payload;
            const { values } = state;

            const trajectory = values[name];
            const { mMin, mMax } = trajectory;

            // can be minimum 2; no upper limit for mMax
            trajectory.mMin = Math.max(2, Math.min(currentClustering, mMin));
            trajectory.mMax = Math.max(currentClustering, mMax);
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
        builder.addCase(recluster.fulfilled, (state, action) => {
            const { name, simplified, currentClustering } = action.payload;
            trajectories.caseReducers.setChunks(state, {
                payload: {
                    newChunks: simplified,
                    trajectoryName: name,
                    currentClustering,
                },
            });
            trajectories.caseReducers.updateClusterRange(state, {
                payload: {
                    name,
                    currentClustering,
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

export const { addTrajectory, setChunks, setZoom, swapPositions, updateRanks, updateRank } =
    trajectories.actions;

export default trajectories.reducer;

/* updates ranks whenever extents change, cool idea but laggy
startListening({
    actionCreator: setZoom,
    effect: async (action, listenerAPI) => {
        const { name } = action.payload;
        const { getState, dispatch } = listenerAPI;
        const state = getState();
        const { values } = state.states;
        dispatch(updateRank({ states: values, name }));
    },
}); */
