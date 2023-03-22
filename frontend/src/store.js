import { configureStore, getDefaultMiddleware } from '@reduxjs/toolkit';
import statesReducer from './api/states';
import trajectoriesReducer from './api/trajectories';
import { listenerMiddleware } from './api/listenerMiddleware';
import websocketmiddleware from './api/websocketmiddleware';

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
