import { React, useEffect, useReducer } from 'react';

import { useSnackbar } from 'notistack';
import Scatterplot from '../vis/Scatterplot';
import { apiCalculateNEB, onMessageHandler } from '../api/ajax';
import GlobalStates from '../api/globalStates';

export default function NEBWrapper({
    trajectoryName,
    stateIDs,
    start,
    end,
    interpolate,
    maxSteps,
    fmax,
    saveResults,
    setActiveState,
}) {
    const { enqueueSnackbar } = useSnackbar();
    const [results, reduceResults] = useReducer(
        (state, action) => {
            switch (action.type) {
                case 'update': {
                    const { energies, count } = action.payload;

                    let corrected = [];
                    if (count < stateIDs.length - 1) {
                        corrected = energies.slice(0, -1);
                    } else {
                        corrected = [energies[0]];
                    }
                    const data = corrected.map((d, i) => ({
                        energy: d,
                        timestep: state.values.length + i,
                        id: stateIDs[count],
                    }));
                    return { values: [...state.values, ...data] };
                }
                case 'clear': {
                    return {
                        values: [],
                    };
                }
                default:
                    throw new Error('Unknown action');
            }
        },
        { values: [] }
    );
    useEffect(() => {
        apiCalculateNEB(trajectoryName, start, end, interpolate, maxSteps, fmax, saveResults)
            .then((id) => {
                const client = new WebSocket(`ws://localhost:8000/api/ws/${id}`);
                let count = 0;
                client.onmessage = onMessageHandler(
                    () => {
                        enqueueSnackbar(`Task ${id} started.`);
                        reduceResults({ type: 'clear' });
                    },
                    (response) => {
                        const { message, data } = response;
                        enqueueSnackbar(`Task ${id}: ${message}`);
                        if (data !== undefined) {
                            reduceResults({
                                payload: { energies: data, count },
                                type: 'update',
                            });
                            count++;
                        }
                    },
                    () => {
                        enqueueSnackbar(`Task ${id} complete.`);
                    }
                );
            })
            .catch((e) => {
                alert(e);
            });
    }, []);

    return (
        <Scatterplot
            width={250}
            height={200}
            xAttributeList={results.values.map((d) => d.timestep)}
            yAttributeList={results.values.map((d) => d.energy)}
            additionalAttributes={results.values.map((d) => d.id)}
            margin={{ top: 5, bottom: 10, left: 50, right: 7.5 }}
            onElementMouseOver={(_, d) => {
                if (d.id) {
                    setActiveState(d.id);
                }
            }}
            colorFunc={(d) => {
                if (d.id) {
                    const state = GlobalStates.get(d.id);
                    return state.individualColor;
                }
                return 'black';
            }}
            showYAxis
        />
    );
}
