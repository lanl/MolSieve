import WebSocketManager from './websocketmanager';
import GlobalStates from './globalStates';

/* eslint-disable no-param-reassign */
export default function loadChart(
    statesToLoad,
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

    ws.current.addEventListener('close', ({ code }) => {
        if (code === 3001 || code === 1011) {
            setIsInterrupted(true);
        }
    });

    const stateList = [...new Set(statesToLoad)];
    const total = stateList.length;

    let currentProgress = 0;

    ws.current.addEventListener('open', () => {
        ws.current.send(
            JSON.stringify({
                props: properties,
                stateIds: stateList,
            })
        );
    });

    ws.current.addEventListener('message', (e) => {
        const parsedData = JSON.parse(e.data);
        GlobalStates.addPropToStates(parsedData);

        console.log('recieved');
        currentProgress += parsedData.length;
        setProgress(currentProgress / total);

        updateGS(parsedData);
        render();

        setIsInitialized(true);

        if (currentProgress === total) {
            ws.current.close(1000);
        }
    });
}
/* eslint-enable no-param-reassign */
