import { addPropToStates } from './states';

export const wsConnect = (host) => ({ type: 'WS_CONNECT', host });
export const wsConnecting = (host) => ({ type: 'WS_CONNECTING', host });
export const wsConnected = (host) => ({ type: 'WS_CONNECTED', host });
export const wsDisconnect = (host) => ({ type: 'WS_DISCONNECT', host });
export const wsDisconnected = (host) => ({ type: 'WS_DISCONNECTED', host });

const socketMiddleware = () => {
    let socket = null;

    const onOpen = (store) => (event) => {
        console.log('websocket open', event.target.url);
        const state = store.getState();
        const { properties, values } = state.states;
        socket.send(
            JSON.stringify({
                props: properties,
                stateIds: Array.from(values.values()).map((d) => d.id),
                chunkSize: 100,
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
                console.log('websocket closed');
                break;
            case 'NEW_MESSAGE':
                console.log('sending a message', action.msg);
                socket.send(JSON.stringify({ command: 'NEW_MESSAGE', message: action.msg }));
                break;
            default:
                console.log('the next action:', action);
                return next(action);
        }
    };
};

export default socketMiddleware();
