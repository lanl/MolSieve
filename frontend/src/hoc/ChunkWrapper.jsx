import { React, useState, useEffect } from 'react';

import * as d3 from 'd3';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Scatterplot from '../vis/Scatterplot';

import { simpleMovingAverage, boxPlotStats } from '../api/stats';
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
    globalScale,
    stateHovered,
    updateGlobalScale,
    disableControls,
}) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const [isInterrupted, setIsInterrupted] = useState(false);

    const [isExpanded, setIsExpanded] = useState(false);
    const [showSparkLine, setSparkLine] = useState(true);

    const [scale, setScale] = useState(() =>
        d3.scaleLinear().domain([Number.MIN_VALUE, Number.MAX_VALUE]).range([height, 5])
    );

    useEffect(() => {
        const { min, max } = globalScale;
        setScale(() => d3.scaleLinear().domain([min, max]).range([height, 5]));
    }, [globalScale]);

    const [sliceBy, setSliceBy] = useState();
    const [seq, setSeq] = useState();
    const [mva, setMva] = useState();

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

    const render = (states, lSlice, rSlice) => {
        // breaks because it assumes that both sides are expanding at the same time... need to do seperately
        let s = chunk.timestepSequence;
        let m = chunk.calculateMovingAverage(property, mvaPeriod, simpleMovingAverage);

        const as = states.map((id) => GlobalStates.get(id));

        const vals = as.map((d) => d[property]);

        updateGlobalScale(d3.min(vals), d3.max(vals));

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
        setIsLoaded(true);
    };

    useEffect(() => {
        const socket = WebSocketManager.connect(
            'ws://localhost:8000/api/load_properties_for_subset'
        );
        const seen = new Set();
        let i = 0;
        let lStates = [];
        let rStates = [];

        setIsLoading(true);

        socket.addEventListener('close', ({ code }) => {
            if (code === 3001) {
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
                socket.close();
                setIsExpanded(false);
                return;
            }

            const centerMVA = chunk.calculateMovingAverage(
                property,
                mvaPeriod,
                simpleMovingAverage
            );

            socket.addEventListener('open', () => {
                const boundaryStates = getBoundaryStates(i, seen, lToDo, rToDo);
                lStates = boundaryStates.leftStates;
                rStates = boundaryStates.rightStates;
                i++;

                socket.send(
                    JSON.stringify({
                        props: [property],
                        stateIds: boundaryStates.sendStates,
                    })
                );
            });

            socket.addEventListener('message', (e) => {
                const parsedData = JSON.parse(e.data);
                GlobalStates.addPropToStates(parsedData);

                const lData = lStates.map((d) => GlobalStates.get(d)[property]);
                const rData = rStates.map((d) => GlobalStates.get(d)[property]);

                const lStats = boxPlotStats(lData);
                const rStats = boxPlotStats(rData);

                const renderStates = [...new Set(lStates), ...chunk.states, ...new Set(rStates)];

                render(renderStates, lStates.length, rStates.length);

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
                    socket.close(1000);
                    setIsLoading(false);
                } else {
                    i++;
                    socket.send(
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

            socket.addEventListener('open', () => {
                const boundaryStates = getBoundaryStates(i, seen, lToDo, rToDo);
                lStates = boundaryStates.leftStates;
                rStates = boundaryStates.rightStates;
                cStates = [...chunk.states.slice(i * moveBy, (i + 1) * moveBy)];

                i++;

                socket.send(
                    JSON.stringify({
                        props: [property],
                        stateIds: [...boundaryStates.sendStates, ...cStates],
                    })
                );
            });

            socket.addEventListener('message', (e) => {
                const parsedData = JSON.parse(e.data);
                GlobalStates.addPropToStates(parsedData);

                render(cStates);

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
                    socket.close(1000);
                    setIsLoading(false);
                } else {
                    i++;
                    socket.send(
                        JSON.stringify({
                            props: [property],
                            stateIds: [...new Set(sendStates)],
                        })
                    );
                }
            });
        }
    }, [isExpanded, property, width, height]);

    if (isInterrupted) {
        return <div>Loading interrupted</div>;
    }

    return isLoaded ? (
        <>
            <Box
                className="floatingToolBar"
                sx={{ visibility: isParentHovered ? 'visible' : 'hidden' }}
            >
                <Button color="secondary" size="small" onClick={() => setSparkLine(!showSparkLine)}>
                    {showSparkLine ? 'ShowScatter' : 'ShowSparkLine'}
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
                globalScale={scale}
                showSparkLine={showSparkLine}
                lineColor={trajectory.colorByCluster(chunk)}
            />
        </>
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
