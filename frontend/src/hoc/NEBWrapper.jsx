import { React, useEffect, useReducer } from 'react';

import { useSnackbar } from 'notistack';
import * as d3 from 'd3';
import Scatterplot from '../vis/Scatterplot';
import { apiCalculateNEB, onMessageHandler } from '../api/ajax';
import GlobalStates from '../api/globalStates';
import { WS_URL } from '../api/constants';

export default function NEBWrapper({
    trajectoryName,
    // stateIDs,
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
                    const { id, energy, timestep } = action.payload;
                    GlobalStates.calculateGlobalUniqueStates([id], 'NEB');
                    return { values: [...state.values, { id, energy, timestep }] };
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
                const client = new WebSocket(`${WS_URL}/api/ws/${id}`);
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
                                payload: data,
                                type: 'update',
                            });
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
            additionalAttributes={results.values.map((d) => ({
                id: d.id,
            }))}
            margin={{ top: 5, bottom: 10, left: 50, right: 7.5 }}
            onElementClick={(node, d) => {
                d3.selectAll('.clicked').classed('clicked', false);
                setActiveState(d.id);
                d3.select(node).classed('clicked', true);
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
