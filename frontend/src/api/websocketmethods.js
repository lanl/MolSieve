import WebSocketManager from './websocketmanager';
import GlobalStates from './globalStates';
import { setDifference } from './myutils';

/* eslint-disable no-param-reassign */
export default function loadChart(
    statesToLoad,
    moveBy,
    ws,
    websocketName,
    properties,
    setProgress,
    setIsInterrupted,
    updateGS,
    render,
    setIsInitialized
) {
    ws.current = WebSocketManager.connect(
        'ws://localhost:8000/api/load_properties_for_subset',
        websocketName
    );

    setProgress(0.0);
    let seen;
    let i = 0;

    ws.current.addEventListener('close', ({ code }) => {
        if (code === 3001 || code === 1011) {
            setIsInterrupted(true);
        }
    });

    let currentStates = [];
    const total = statesToLoad.length;

    ws.current.addEventListener('open', () => {
        currentStates = [...statesToLoad.slice(i * moveBy, (i + 1) * moveBy)];
        i++;

        seen = new Set(currentStates);

        ws.current.send(
            JSON.stringify({
                props: properties,
                stateIds: [...seen],
            })
        );
    });

    ws.current.addEventListener('message', (e) => {
        const parsedData = JSON.parse(e.data);
        GlobalStates.addPropToStates(parsedData);

        const currProgress = i * moveBy;
        setProgress(currProgress / total);

        updateGS(parsedData);
        render();

        setIsInitialized(true);
        let sendStates = [];

        // if the chunks have not been fully loaded, continue
        if (i * moveBy < statesToLoad.length) {
            const newStateSet = new Set(statesToLoad.slice(i * moveBy, (i + 1) * moveBy));
            // only send states that exist in newStateSet and not seen
            const diffSet = setDifference(newStateSet, seen);
            sendStates = [...diffSet];
            seen = new Set([...diffSet, ...seen]);
        }

        if (!sendStates.length) {
            ws.current.close(1000);
        } else {
            i++;
            ws.current.send(
                JSON.stringify({
                    props: properties,
                    stateIds: sendStates,
                })
            );
        }
    });
}
/* eslint-enable no-param-reassign */
