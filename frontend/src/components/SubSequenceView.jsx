import { React, useState, useEffect, memo, useCallback, useMemo, useRef } from 'react';
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
import RadarChart from '../vis/RadarChart';
import NEBModal from '../modals/NEBModal';
import NEBWrapper from '../hoc/NEBWrapper';
import Scatterplot from '../vis/Scatterplot';

import '../css/App.css';

import { oneShotTooltip } from '../api/myutils';
import { apiSubsetConnectivityDifference } from '../api/ajax';
import { getStates } from '../api/states';

function SubSequenceView({
    stateIDs,
    timesteps,
    trajectoryName,
    properties,
    visScript,
    sx = {},
    disabled = false,
    onMouseEnter = () => {},
    onMouseLeave = () => {},
    onClick = () => {},
    onElementClick = () => {},
    deleteFunc = () => {},
    className = '',
    id = '',
}) {
    const [activeState, setActiveState] = useState(stateIDs[0]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [interestingStates, setInterestingStates] = useState([
        stateIDs[0],
        stateIDs[stateIDs.length - 1],
    ]);
    const [openModal, setOpenModal] = useState(false);
    const [nebPlots, setNEBPlots] = useState(null);

    const ws = useRef(null);

    const states = useSelector((state) => getStates(state, stateIDs));
    const globalScale = useSelector((state) => state.states.globalScale);

    const stateMap = useMemo(
        () =>
            states.reduce((acc, v) => {
                acc[v.id] = { color: v.color };
                return acc;
            }, {}),
        []
    );

    const colorFunc = useCallback((d) => {
        const state = stateMap[d.y];
        return state.color;
    }, []);

    useEffect(() => {
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }
        // find interesting states
        if (!isLoaded) {
            apiSubsetConnectivityDifference(stateIDs).then((taskID) => {
                // open web socket
                ws.current = WebSocketManager.connect(`${WS_URL}/api/ws/${taskID}`, 'selections');

                let insertAt = 1;
                ws.current.addEventListener('message', (e) => {
                    const parsedData = JSON.parse(e.data);
                    const { data, type } = parsedData;
                    if (type === 'TASK_PROGRESS') {
                        setInterestingStates((prev) => [
                            ...prev.slice(0, insertAt),
                            data,
                            ...prev.slice(insertAt),
                        ]);
                        insertAt++;
                    }

                    if (type === 'TASK_COMPLETE') {
                        ws.current.close();
                    }
                });

                ws.current.addEventListener('close', () => {
                    setIsLoaded(true);
                });
                // setInterestingStates(iStates);
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
    }, [activeState]);

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
                            stateID={stateID}
                            visScript={visScript}
                            onClick={(e) => {
                                d3.selectAll('.clicked').classed('clicked', false);
                                setActiveState(stateID);
                                // select matching state in scatterplot
                                d3.select(`#scatterplot-${id}`)
                                    .selectAll(`.y-${stateID}`)
                                    .classed('clicked', true);
                                d3.select(e.target).classed('clicked', true);
                            }}
                        />
                    ))}

                    <RadarChart
                        data={states}
                        properties={properties}
                        width={200}
                        height={200}
                        globalScale={globalScale}
                        onElementMouseOver={(node, d) => {
                            oneShotTooltip(node, `${d.value}`);
                        }}
                        // renderSingle={States.get(activeState)}
                    />
                </Stack>
                <Divider />
                <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{
                        maxWidth: `${interestingStates.length * 100 + 220}px`,
                        overflow: 'scroll',
                        minHeight: '30px',
                        maxHeight: '30px',
                        backgroundColor: '#F8F9F9',
                    }}
                >
                    <Scatterplot
                        id={`scatterplot-${id}`}
                        width={interestingStates.length * 100 + 220}
                        height={30}
                        colorFunc={colorFunc}
                        xAttributeList={timesteps}
                        yAttributeList={stateIDs}
                        onElementClick={(node, d) => {
                            d3.selectAll('.clicked').classed('clicked', false);
                            setActiveState(d.y);
                            d3.select(node).classed('clicked', true);
                        }}
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
                stateMap={stateMap}
                submit={addNEB}
            />
        </>
    );
}

export default memo(SubSequenceView);
