import { configureStore, getDefaultMiddleware } from '@reduxjs/toolkit';
import statesReducer from './api/states';
import chunksReducer from './api/chunks';

import websocketmiddleware from './api/websocketmiddleware';

export default configureStore({
    reducer: {
        states: statesReducer,
        chunks: chunksReducer,
    },
    middleware: [websocketmiddleware, ...getDefaultMiddleware()],
});
