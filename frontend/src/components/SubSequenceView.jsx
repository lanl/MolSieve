import { React, useState, useEffect, memo, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';

import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import ScienceIcon from '@mui/icons-material/Science';
import Tooltip from '@mui/material/Tooltip';
import * as d3 from 'd3';
import WebSocketManager from '../api/websocketmanager';
import { WS_URL } from '../api/constants';

import RemovableBox from './RemovableBox';
import SingleStateViewer from './SingleStateViewer';
import NEBModal from '../modals/NEBModal';
import NEBWrapper from '../hoc/NEBWrapper';
import Scatterplot from '../vis/Scatterplot';

import '../css/App.css';

import { apiSubsetConnectivityDifference } from '../api/ajax';
import { getStateColoringMethod } from '../api/states';

/**
 * Shows a detailed view of a set of states within the Trajectory,
 * using a 3D overview of the most important states and a 2D time vs ID plot.
 * TODO: Rename to Sub Sequence Component
 *
 * @param {Array<Number>} stateIDs - States to include.
 * @param {Array<Number>} timesteps - Timesteps of the states. TODO: can refactor
 * @param {String} trajectoryName - Name of the trajectory the states belong to.
 * @param {String} visScript - Visualization script to use when rendering 3D views.
 * @param {Function} onMouseEnter - Ran when mouse enters component.
 * @param {Function} onMouseLeave - Ran when mouse leaves component.
 * @param {Function} onClick - Ran when component is clicked.
 * @param {Function} onElementClick - Ran when a state (3D or plot) is clicked.
 * @param {Function} deleteFunc - Ran when delete button is clicked.
 * @param {String} className - CSS Class name of the component's Box.
 * @param {String} id - CSS id of the component
 */
function SubSequenceView({
    stateIDs,
    timesteps,
    trajectoryName,
    visScript,
    sx = {},
    disabled = false,
    onMouseEnter = () => { },
    onMouseLeave = () => { },
    onClick = () => { },
    onElementClick = () => { },
    deleteFunc = () => { },
    className = '',
    id = '',
}) {
    const [activeState, setActiveState] = useState({ id: stateIDs[0], trajectory: trajectoryName }); // state currently selected
    const [isLoaded, setIsLoaded] = useState(false);
    const [interestingStates, setInterestingStates] = useState([
        stateIDs[0],
        stateIDs[stateIDs.length - 1],
    ]); // states in the overview
    const [openModal, setOpenModal] = useState(false);
    const [nebPlots, setNEBPlots] = useState(null);

    const ws = useRef(null);

    const colorFunc = useSelector((state) => getStateColoringMethod(state));
    useEffect(() => {
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }
        // find interesting states
        if (!isLoaded) {
            apiSubsetConnectivityDifference(stateIDs).then((taskID) => {
                // open web socket
                ws.current = WebSocketManager.connect(
                    `${WS_URL}/worker/ws/${taskID}`,
                    'selections'
                );

                let insertAt = 1;
                ws.current.addEventListener('message', (e) => {
                    const parsedData = JSON.parse(e.data);
                    const { data, type } = parsedData;
                    if (type === 'TASK_PROGRESS') {
                        if (interestingStates[insertAt - 1] !== data) {
                            setInterestingStates((prev) => [
                                ...prev.slice(0, insertAt),
                                data,
                                ...prev.slice(insertAt),
                            ]);
                            insertAt++;
                        }
                    }

                    if (type === 'TASK_COMPLETE') {
                        ws.current.close();
                    }
                });

                ws.current.addEventListener('close', () => {
                    setIsLoaded(true);
                });
            });
        }

        return () => {
            if (ws.current) {
                ws.current.close();
                ws.current = null;
            }
        };
    }, [JSON.stringify(stateIDs)]);

    const addNEB = (nebStates, start, end, interpolate, maxSteps, fmax, saveResults) => {
        if (!nebPlots) {
            setNEBPlots([{ nebStates, start, end, interpolate, maxSteps, fmax, saveResults }]);
        } else {
            setNEBPlots([
                ...nebPlots,
                { nebStates, start, end, interpolate, maxSteps, fmax, saveResults },
            ]);
        }
    };

    useEffect(() => {
        onElementClick(activeState);
        // d3.select(`#scatterplot-${id}`).selectAll(`.y-${activeState}`).classed('clicked', true);
    }, [activeState.id]);

    const onScatterplotElementClick = useCallback(
        (_, d) => {
            setActiveState({ 'id': d.y, 'timestep': d.x, 'trajectory': trajectoryName });
        },
        [setActiveState]
    );

    return (
        <>
            <RemovableBox
                sx={sx}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onClick={onClick}
                disabled={disabled}
                deleteFunc={deleteFunc}
                className={className}
                toolbar={
                    <Tooltip title="Run NEB" arrow>
                        <IconButton
                            color="secondary"
                            size="small"
                            onClick={() => setOpenModal(!openModal)}
                        >
                            <ScienceIcon />
                        </IconButton>
                    </Tooltip>
                }
            >
                {!isLoaded && <LinearProgress />}
                <Stack direction="row" spacing={0.5}>
                    {interestingStates.map((stateID) => (
                        <SingleStateViewer
                            key={stateID}
                            activeState={{ id: stateID, trajectory: trajectoryName }}
                            visScript={visScript}
                            onClick={(e) => {
                                d3.selectAll('.clicked').classed('clicked', false);
                                // setActiveState(stateID);
                                // select matching state in scatterplot
                                d3.select(e.target).classed('clicked', true);
                            }}
                        />
                    ))}
                </Stack>
                <Divider />
                <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{
                        maxWidth: `${interestingStates.length * 100}px`,
                        overflow: 'scroll',
                        minHeight: '30px',
                        maxHeight: '30px',
                        backgroundColor: '#F8F9F9',
                    }}
                >
                    <Scatterplot
                        id={`scatterplot-${id}`}
                        width={interestingStates.length * 100}
                        height={30}
                        colorFunc={(d) => colorFunc(d.y)}
                        xAttributeList={timesteps}
                        yAttributeList={stateIDs}
                        onElementClick={onScatterplotElementClick}
                    />
                </Stack>
                {nebPlots !== null && (
                    <>
                        <Divider />
                        <Stack direction="row" spacing={0.5}>
                            {nebPlots.map((plot) => {
                                const {
                                    nebStates,
                                    start,
                                    end,
                                    interpolate,
                                    maxSteps,
                                    fmax,
                                    saveResults,
                                } = plot;
                                return (
                                    <NEBWrapper
                                        stateIDs={nebStates}
                                        trajectoryName={trajectoryName}
                                        start={start}
                                        end={end}
                                        interpolate={interpolate}
                                        maxSteps={maxSteps}
                                        fmax={fmax}
                                        saveResults={saveResults}
                                        width={(interestingStates.length * 100) / nebPlots.length}
                                        setActiveState={(stateID) => setActiveState(stateID)}
                                    />
                                );
                            })}
                        </Stack>
                    </>
                )}
            </RemovableBox>
            <NEBModal
                open={openModal}
                close={() => setOpenModal(!openModal)}
                states={stateIDs.map((d, i) => ({
                    id: d,
                    timestep: timesteps[i],
                }))}
                colorFunc={colorFunc}
                submit={addNEB}
                id={id}
            />
        </>
    );
}

export default memo(SubSequenceView);
