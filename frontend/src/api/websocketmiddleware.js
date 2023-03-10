import { addPropToStates } from './states';

export const wsConnect = (host) => ({ type: 'WS_CONNECT', host });
export const wsConnecting = (host) => ({ type: 'WS_CONNECTING', host });
export const wsConnected = (host) => ({ type: 'WS_CONNECTED', host });
export const wsDisconnect = (host) => ({ type: 'WS_DISCONNECT', host });
export const wsDisconnected = (host) => ({ type: 'WS_DISCONNECTED', host });

const socketMiddleware = () => {
    let socket = null;

    const onOpen = (store) => (event) => {
        const state = store.getState();
        const { properties, values } = state.states;
        // try to load 10% of the dataset at a time
        const stateIds = Array.from(values.values()).map((d) => d.id);
        const chunkSize = Math.round(stateIds.length / 10);
        socket.send(
            JSON.stringify({
                props: properties,
                stateIds,
                chunkSize,
            })
        );

        store.dispatch(wsConnected(event.target.url));
    };

    const onClose = (store) => () => {
        store.dispatch(wsDisconnected());
    };

    const onMessage = (store) => (event) => {
        const payload = JSON.parse(event.data);
        store.dispatch(addPropToStates(payload));
    };

    // the middleware part of this function
    return (store) => (next) => (action) => {
        switch (action.type) {
            case 'WS_CONNECT':
                if (socket !== null) {
                    socket.close();
                }

                // connect to the remote host
                socket = new WebSocket(action.host);

                // websocket handlers
                socket.onmessage = onMessage(store);
                socket.onclose = onClose(store);
                socket.onopen = onOpen(store);
                break;
            case 'WS_DISCONNECT':
                if (socket !== null) {
                    socket.close();
                }
                socket = null;
                break;
            case 'NEW_MESSAGE':
                socket.send(JSON.stringify({ command: 'NEW_MESSAGE', message: action.msg }));
                break;
            default:
                return next(action);
        }
    };
};

export default socketMiddleware();
