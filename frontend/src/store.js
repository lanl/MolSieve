/*
 * © 2025. Triad National Security, LLC. All rights reserved.
 * This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
 */
import { configureStore, getDefaultMiddleware } from '@reduxjs/toolkit';
import statesReducer from './api/states';
import trajectoriesReducer from './api/trajectories';
import { listenerMiddleware } from './api/listenerMiddleware';
import websocketmiddleware from './api/websocketmiddleware';

// puts the store together from the various reducers
export default configureStore({
    reducer: {
        states: statesReducer,
        trajectories: trajectoriesReducer,
    },
    middleware: [
        websocketmiddleware,
        ...getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: ['trajectories/updateRanks', 'trajectories/updateRank'],
                ignoredPaths: ['states.values', 'trajectories.values', 'trajectories.chunks'],
            },
        }).prepend(listenerMiddleware.middleware),
    ],
});
