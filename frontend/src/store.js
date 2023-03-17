import { configureStore, getDefaultMiddleware } from '@reduxjs/toolkit';
import statesReducer from './api/states';
import trajectoriesReducer from './api/trajectories';

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
                ignoredActions: ['trajectories/updateRanks'],
                ignoredPaths: ['states.values', 'trajectories.values', 'trajectories.chunks'],
            },
        }),
    ],
});
