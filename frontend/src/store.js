import { configureStore, getDefaultMiddleware } from '@reduxjs/toolkit';
import statesReducer from './api/states';
import websocketmiddleware from './api/websocketmiddleware';

export default configureStore({
    reducer: {
        states: statesReducer,
    },
    middleware: [websocketmiddleware, ...getDefaultMiddleware()],
});
