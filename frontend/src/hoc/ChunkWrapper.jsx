import { React, useState, useEffect, useRef } from 'react';

import * as d3 from 'd3';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';

import { simpleMovingAverage, boxPlotStats } from '../api/stats';

import Scatterplot from '../vis/Scatterplot';
import GlobalStates from '../api/globalStates';
import WebSocketManager from '../api/websocketmanager';
import LoadingBox from '../components/LoadingBox';

const moveBy = 100;
const mvaPeriod = 100;

export default function ChunkWrapper({
    leftBoundary,
    chunk,
    rightBoundary,
    property,
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

    const [isExpanded, setIsExpanded] = useState(false);
    const [showSparkLine, setSparkLine] = useState(true);
    const [selectionMode, setSelectionMode] = useState(false);
    const [colorFunc, setColorFunc] = useState(() => (d) => {
        const state = GlobalStates.get(d.id);
        return state.individualColor;
    });

    const [sliceBy, setSliceBy] = useState();
    const [seq, setSeq] = useState();
    const [mva, setMva] = useState();

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

    const updateGS = (states) => {
        const as = states.map((id) => GlobalStates.get(id));
        const vals = as.map((d) => d[property]);
        updateGlobalScale(d3.min(vals), d3.max(vals));
    };

    const render = (lSlice, rSlice) => {
        let s = chunk.timestepSequence;
        let m = chunk.calculateMovingAverage(property, mvaPeriod, simpleMovingAverage);

        if (leftBoundary && isExpanded) {
            const left = leftBoundary.timestepSequence.length - lSlice;
            const right = leftBoundary.timestepSequence.length;
            s = [...leftBoundary.timestepSequence.slice(left), ...s];
            m = [
                ...leftBoundary.calculateMovingAverage(property, mvaPeriod, simpleMovingAverage, [
                    left,
                    right,
                ]),
                ...m,
            ];
        }

        if (rightBoundary && isExpanded) {
            const left = 0;
            const right = rSlice;

            s = [...s, ...rightBoundary.timestepSequence.slice(left, right)];
            m = [
                ...m,
                ...rightBoundary.calculateMovingAverage(property, mvaPeriod, simpleMovingAverage, [
                    left,
                    right,
                ]),
            ];
        }

        setSliceBy({ lSlice, rSlice });
        setSeq(s);
        setMva(m);
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

        if (isExpanded) {
            const lToDo = leftBoundary ? leftBoundary.timestepSequence.map((d) => d.id) : undefined;
            const rToDo = rightBoundary
                ? rightBoundary.timestepSequence.map((d) => d.id)
                : undefined;

            // should expansion be allowed if neither are visible?
            if (!lToDo && !rToDo) {
                ws.current.close();
                ws.current = null;
                setIsExpanded(false);
                return;
            }
            let total = 0;

            if (lToDo) {
                total += leftBoundary.selected.length;
            }

            if (rToDo) {
                total += rightBoundary.selected.length;
            }

            const centerMVA = chunk.calculateMovingAverage(
                property,
                mvaPeriod,
                simpleMovingAverage
            );

            ws.current.addEventListener('open', () => {
                const boundaryStates = getBoundaryStates(i, seen, lToDo, rToDo);
                lStates = boundaryStates.leftStates;
                rStates = boundaryStates.rightStates;
                i++;

                ws.current.send(
                    JSON.stringify({
                        props: [property],
                        stateIds: boundaryStates.sendStates,
                    })
                );
            });

            ws.current.addEventListener('message', (e) => {
                const parsedData = JSON.parse(e.data);
                GlobalStates.addPropToStates(parsedData);

                const lData = lStates.map((d) => GlobalStates.get(d)[property]);
                const rData = rStates.map((d) => GlobalStates.get(d)[property]);

                const lStats = boxPlotStats(lData);
                const rStats = boxPlotStats(rData);

                const renderStates = [...new Set(lStates), ...chunk.states, ...new Set(rStates)];

                let currProgress = 0;

                if (lToDo) {
                    currProgress += i * moveBy;
                }

                if (rToDo) {
                    currProgress += i * moveBy;
                }

                setProgress(currProgress / total);
                setIsInitialized(true);
                updateGS(renderStates);
                render(lStates.length, rStates.length);

                let sendStates = [];
                const boundaryStates = getBoundaryStates(i, seen, lToDo, rToDo);
                if (!(lStats.q1 <= centerMVA[0] && lStats.q3 >= centerMVA[0])) {
                    lStates = [...boundaryStates.leftStates, ...lStates];
                    sendStates = [...boundaryStates.leftStates];
                }

                if (
                    !(
                        rStats.q1 <= centerMVA[centerMVA.length - 1] &&
                        rStats.q3 >= centerMVA[centerMVA.length - 1]
                    )
                ) {
                    rStates = [...rStates, ...boundaryStates.rightStates];
                    sendStates = [...sendStates, ...boundaryStates.rightStates];
                }

                // send requested states, if not, close connection
                if (!sendStates.length) {
                    ws.current.close(1000);
                    ws.current = null;
                } else {
                    i++;
                    ws.current.send(
                        JSON.stringify({
                            props: [property],
                            stateIds: [...new Set(sendStates)],
                        })
                    );
                }
            });
        } else {
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
                        props: [property],
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
                updateGS(cStates);
                render();

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
                            props: [property],
                            stateIds: [...new Set(sendStates)],
                        })
                    );
                }
            });
        }
    };

    useEffect(() => {
        render();
    }, [globalScaleMin, globalScaleMax, width, height]);

    useEffect(() => {
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }

        // check if property already exists first
        if (isExpanded || !GlobalStates.subsetHasProperty(property, chunk.states)) {
            setIsInitialized(false);
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
    }, [isExpanded, property]);

    useEffect(() => {
        if (showStateClustering) {
            setColorFunc(() => (d) => {
                const state = GlobalStates.get(d.id);
                return state.stateClusteringColor;
            });
        } else {
            setColorFunc(() => (d) => {
                const state = GlobalStates.get(d.id);
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

            <Scatterplot
                sequence={seq}
                width={width}
                height={height}
                run={run}
                movingAverage={mva}
                trajectory={trajectory}
                setStateHovered={setStateHovered}
                setStateClicked={setStateClicked}
                id={`sc_${chunk.id}`}
                property={property}
                doubleClickAction={() => {
                    if (!disableControls) {
                        setIsExpanded(!isExpanded);
                    }
                }}
                includeBoundaries={isExpanded}
                leftBoundary={leftBoundary}
                rightBoundary={rightBoundary}
                stateHovered={stateHovered}
                sliceBy={sliceBy}
                globalScaleMin={globalScaleMin}
                globalScaleMax={globalScaleMax}
                showSparkLine={showSparkLine}
                lineColor={trajectory.colorByCluster(chunk)}
                colorFunc={colorFunc}
                setExtents={setExtents}
                onSetExtentsComplete={() => setSelectionMode(false)}
                selectionMode={selectionMode}
            />
        </Box>
    ) : (
        <LoadingBox />
    );
}

/* 
                {leftBoundary && !isExpanded && (
                <BoxPlot
                    showYAxis={false}
                    data={lBoxStats}
                    color={leftBoundary.color}
                    property={property}
                    width={0.1 * width}
                    height={height}
                    globalScale={GlobalChartScale.scale}
                />
            )}
            {rightBoundary && !isExpanded && (
                <BoxPlot
                    showYAxis={false}
                    data={rBoxStats}
                    color={rightBoundary.color}
                    property={property}
                    width={0.1 * width}
                    height={height}
                    globalScale={GlobalChartScale.scale}
                />
            )}
        </>
 
 

    */
