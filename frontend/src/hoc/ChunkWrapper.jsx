import { React, useState, useEffect, useRef } from 'react';

import * as d3 from 'd3';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';

import Stack from '@mui/material/Stack';
import SparkLine from '../vis/SparkLine';

import { simpleMovingAverage, boxPlotStats } from '../api/stats';
import { abbreviate } from '../api/myutils';

import Scatterplot from '../vis/Scatterplot';
import GlobalStates from '../api/globalStates';
import WebSocketManager from '../api/websocketmanager';
import LoadingBox from '../components/LoadingBox';
import ChartBox from '../components/ChartBox';

const moveBy = 100;
const mvaPeriod = 100;

export default function ChunkWrapper({
    leftBoundary,
    chunk,
    rightBoundary,
    properties,
    width,
    height,
    trajectory,
    setStateHovered,
    setStateClicked,
    run,
    isParentHovered,
    globalScaleMin,
    globalScaleMax,
    stateHovered,
    updateGlobalScale,
    disableControls,
    setExtents,
    showStateClustering,
}) {
    const [isInitialized, setIsInitialized] = useState(false);
    const [progress, setProgress] = useState(0.0);
    const [isInterrupted, setIsInterrupted] = useState(false);

    const [showSparkLine, setSparkLine] = useState(true);
    const [selectionMode, setSelectionMode] = useState(false);
    const [colorFunc, setColorFunc] = useState(() => (d) => {
        const state = GlobalStates.get(d.id);
        return state.individualColor;
    });

    const [mva, setMva] = useState({});

    const ws = useRef(null);

    const getBoundaryStates = (i, seen, lSequence, rSequence) => {
        let checkStates = [];
        let leftStates = [];
        let rightStates = [];

        if (lSequence) {
            const left = lSequence.length - moveBy * (i + 1);
            const right = lSequence.length - moveBy * i;
            // need boundary checks
            leftStates = [...lSequence.slice(left, right)];
            checkStates = [...leftStates];
        }

        if (rSequence) {
            const left = moveBy * i;
            const right = moveBy * (i + 1);
            rightStates = [...rSequence.slice(left, right)];
            checkStates = [...checkStates, ...rightStates];
        }

        const sendStates = [];
        for (const state of checkStates) {
            if (!seen.has(state)) {
                seen.add(state);
                sendStates.push(state);
            }
        }
        return { sendStates, rightStates, leftStates };
    };

    const updateGS = (states, property) => {
        const as = states.map((id) => GlobalStates.get(id));
        const vals = as.map((d) => d[property]);
        updateGlobalScale(d3.min(vals), d3.max(vals), property);
    };

    const render = (property) => {
        const m = chunk.calculateMovingAverage(property, mvaPeriod, simpleMovingAverage);
        setMva((mvaDict) => ({ ...mvaDict, [property]: m }));
    };

    const runSocket = () => {
        ws.current = WebSocketManager.connect(
            'ws://localhost:8000/api/load_properties_for_subset',
            chunk.trajectory.name
        );

        setProgress(0.0);
        const seen = new Set();
        let i = 0;
        let lStates = [];
        let rStates = [];

        ws.current.addEventListener('close', ({ code }) => {
            if (code === 3001 || code === 1011) {
                setIsInterrupted(true);
            }
        });

        const lToDo = leftBoundary ? leftBoundary.selected : undefined;
        const rToDo = rightBoundary ? rightBoundary.selected : undefined;
        let cStates = [];

        let total = chunk.states.length;

        if (lToDo) {
            total += leftBoundary.selected.length;
        }

        if (rToDo) {
            total += rightBoundary.selected.length;
        }

        ws.current.addEventListener('open', () => {
            const boundaryStates = getBoundaryStates(i, seen, lToDo, rToDo);
            lStates = boundaryStates.leftStates;
            rStates = boundaryStates.rightStates;
            cStates = [...chunk.states.slice(i * moveBy, (i + 1) * moveBy)];

            i++;

            ws.current.send(
                JSON.stringify({
                    props: properties,
                    stateIds: [...boundaryStates.sendStates, ...cStates],
                })
            );
        });

        ws.current.addEventListener('message', (e) => {
            const parsedData = JSON.parse(e.data);
            GlobalStates.addPropToStates(parsedData);

            let currProgress = i * moveBy;
            if (lToDo) {
                currProgress += i * moveBy;
            }

            if (rToDo) {
                currProgress += i * moveBy;
            }

            setProgress(currProgress / total);

            setIsInitialized(true);

            for (const property of properties) {
                updateGS(cStates, property);
                render(property);
            }
            let sendStates = [];

            // if the chunks have not been fully loaded, continue

            if (i * moveBy < chunk.states.length) {
                const nc = [...chunk.states.slice(i * moveBy, (i + 1) * moveBy)];
                cStates = [...cStates, ...nc];
                sendStates = nc;
            }

            const bs = getBoundaryStates(i, seen, lToDo, rToDo);

            if (lToDo && i * moveBy < lToDo.length) {
                lStates = [...bs.leftStates, ...lStates];
                sendStates = [...sendStates, ...bs.leftStates];
            }

            if (rToDo && i * moveBy < rToDo.length) {
                rStates = [...rStates, ...bs.rightStates];
                sendStates = [...sendStates, ...bs.rightStates];
            }

            if (!sendStates.length) {
                ws.current.close(1000);
            } else {
                i++;
                ws.current.send(
                    JSON.stringify({
                        props: properties,
                        stateIds: [...new Set(sendStates)],
                    })
                );
            }
        });
    };

    /*useEffect(() => {
        for (const property of properties) {
            render(property);
        }
    }, [globalScaleMin, globalScaleMax, width, height]);*/

    useEffect(() => {
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }

        setIsInitialized(false);
        const { hasProperties, missingProperties } = GlobalStates.subsetHasProperties(
            properties,
            chunk.states
        );

        if (!hasProperties) {
            runSocket();
        } else {
            setProgress(1.0);
            setIsInitialized(true);
            render(chunk.states);
        }

        return () => {
            if (ws.current) {
                ws.current.close();
                ws.current = null;
            }
        };
    }, [chunk, properties]);

    useEffect(() => {
        if (showStateClustering) {
            setColorFunc(() => (d) => {
                const state = GlobalStates.get(d);
                return state.stateClusteringColor;
            });
        } else {
            setColorFunc(() => (d) => {
                const state = GlobalStates.get(d);
                return state.individualColor;
            });
        }
    }, [showStateClustering]);

    if (isInterrupted) {
        return <div>Loading interrupted</div>;
    }

    return isInitialized ? (
        <Box>
            {progress < 1.0 ? (
                <LinearProgress variant="determinate" value={progress * 100} />
            ) : null}

            <Box
                className="floatingToolBar"
                sx={{ visibility: isParentHovered ? 'visible' : 'hidden' }}
            >
                <Button color="secondary" size="small" onClick={() => setSparkLine(!showSparkLine)}>
                    V
                </Button>
                <Button
                    color="secondary"
                    size="small"
                    onClick={() => setSelectionMode(!selectionMode)}
                >
                    {selectionMode ? 'CS' : 'SS'}
                </Button>
            </Box>

            {showSparkLine ? (
                <Stack direction="column">
                    {properties.map((property) => {
                        return (
                            <SparkLine
                                globalScaleMin={globalScaleMin[property]}
                                globalScaleMax={globalScaleMax[property]}
                                width={width}
                                movingAverage={mva[property]}
                                xAttributeList={chunk.timesteps}
                                lineColor={trajectory.colorByCluster(chunk)}
                                title={abbreviate(property)}
                            />
                        );
                    })}
                </Stack>
            ) : (
                <Box>Scatterplot</Box>
            )}
        </Box>
    ) : (
        <LoadingBox />
    );
}
