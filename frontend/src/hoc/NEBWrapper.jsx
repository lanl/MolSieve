import { React, useEffect, useReducer } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useSnackbar } from 'notistack';
import * as d3 from 'd3';
import Scatterplot from '../vis/Scatterplot';
import { apiCalculateNEB, onMessageHandler } from '../api/ajax';
import { WS_URL } from '../api/constants';

import { calculateGlobalUniqueStates, getStateColoringMethod } from '../api/states';

/**
 * Higher order component for rendering the results of a NEB calculation.
 * Opens a websocket and shows results progressively.
 * TODO: remove saveResults
 *
 * @param {String} trajectoryName - Name of the trajectory this NEB is associated with.
 * @param {Number} start - The first timestep of the path to run the NEB on.
 * @param {Number} end - The last timestep of the path to run the NEB on.
 * @param {Number} interpolate - The number of images placed between two steps in the path.
 * @param {Number} maxSteps - The maximum number of optimization steps before halting.
 * @param {Number} fmax - The maximum optimization value before halting.
 * @param {Bool} saveResults - Whether or not to save the results of the NEB to the database.
 * @param {Function} setActiveState - Function to set the active state in the parent component.
 */
export default function NEBWrapper({
    trajectoryName,
    width,
    start,
    end,
    interpolate,
    maxSteps,
    fmax,
    saveResults,
    setActiveState,
}) {
    const { enqueueSnackbar } = useSnackbar();
    const dispatch = useDispatch();
    const colorState = useSelector((state) => getStateColoringMethod(state));

    const [results, reduceResults] = useReducer(
        (state, action) => {
            switch (action.type) {
                case 'update': {
                    const { id, energy, timestep } = action.payload;
                    dispatch(calculateGlobalUniqueStates({ newUniqueStates: [id], run: 'NEB' }));
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
                const client = new WebSocket(`${WS_URL}/worker/ws/${id}`);
                client.onmessage = onMessageHandler(
                    () => {
                        reduceResults({ type: 'clear' });
                    },
                    (response) => {
                        const { data } = response;
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
            width={width}
            height={200}
            xAttributeList={results.values.map((d) => d.timestep)}
            yAttributeList={results.values.map((d) => d.energy)}
            additionalAttributes={results.values.map((d) => ({
                id: d.id,
            }))}
            showLine
            margin={{ top: 5, bottom: 10, left: 50, right: 7.5 }}
            onElementClick={(node, d) => {
                d3.selectAll('.clicked').classed('clicked', false);
                setActiveState(d.id);
                d3.select(node).classed('clicked', true);
            }}
            colorFunc={(d) => colorState(d.id)}
            showYAxis
        />
    );
}
