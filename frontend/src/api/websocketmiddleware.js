/* eslint-disable-next-line */
import { addPropToStates } from './states';
import { updateRanks } from './trajectories';

// TODO: This should be decoupled from fetching States from the back-end.

export const wsConnect = (host) => ({ type: 'WS_CONNECT', host });
export const wsConnecting = (host) => ({ type: 'WS_CONNECTING', host });
export const wsConnected = (host) => ({ type: 'WS_CONNECTED', host });
export const wsDisconnect = (host) => ({ type: 'WS_DISCONNECT', host });
export const wsDisconnected = (host) => ({ type: 'WS_DISCONNECTED', host });

/* eslint-disable */
const socketMiddleware = () => {
    let socket = null;

    const onOpen = (store) => (event) => {
        // when we open the connection, send all of the unloaded states to the back-end
        // to calculate their properties
        const state = store.getState();
        const { properties, values } = state.states;
        // try to load 10% of the dataset at a time
        const stateIds = Array.from(Object.values(values))
            .filter((d) => d.loaded !== true)
            .map((d) => d.id);

        if(stateIds.length !== 0) {
            const chunkSize =
                stateIds.length > 100 ? Math.round(stateIds.length / 10) : stateIds.length;

            socket.send(
                JSON.stringify({
                    props: properties,
                    stateIds,
                    chunkSize,
                })
            );

            store.dispatch(wsConnected(event.target.url));
        } else {
            socket.close();
        }
    };

    const onClose = (store) => () => {
        store.dispatch(wsDisconnected());
    };

    const onMessage = (store) => (event) => {
        // send the newly calculated properties to the Redux store
        const payload = JSON.parse(event.data);
        store.dispatch(addPropToStates(payload));

        const state = store.getState();
        const { values } = state.states;
        store.dispatch(updateRanks({states : values}));
    };

    // the middleware part of this function
    return (store) => (next) => (action) => {
        switch (action.type) {
            case 'WS_CONNECT':
                if (socket !== null) {
                    socket.close();
                }
                socket = new WebSocket(action.host);
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
