import { React, useState, useEffect } from 'react';

import * as d3 from 'd3';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Scatterplot from '../vis/Scatterplot';

import BoxPlot from '../vis/BoxPlot';
import { simpleMovingAverage, boxPlotStats } from '../api/stats';
import GlobalStates from '../api/globalStates';

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
    updateGlobalScale,
}) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showSparkLine, setSparkLine] = useState(true);

    const [scale, setScale] = useState(() =>
        d3.scaleLinear().domain([Number.MIN_VALUE, Number.MAX_VALUE]).range([height, 5])
    );

    useEffect(() => {
        const { min, max } = globalScale;
        setScale(() => d3.scaleLinear().domain([min, max]).range([height, 5]));
    }, [globalScale]);

    const toggleSparkLine = () => {
        setSparkLine(!showSparkLine);
    };

    const [adjWidth, setAdjWidth] = useState();
    const [sliceBy, setSliceBy] = useState();
    const [seq, setSeq] = useState();
    const [mva, setMva] = useState();
    const [lBoxStats, setLBoxStats] = useState();
    const [rBoxStats, setRBoxStats] = useState();

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

    const render = (states, aWidth, lSlice, rSlice) => {
        // breaks because it assumes that both sides are expanding at the same time... need to do seperately
        let s = chunk.timestepSequence;
        let m = chunk.calculateMovingAverage(property, mvaPeriod, simpleMovingAverage);

        const as = states.map((id) => GlobalStates.get(id));

        const vals = as.map((d) => d[property]);

        // alternatively, can have this be a state in the parent
        // update in parent and then push it down
        // GlobalChartScale.update(vals, property);

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

        setAdjWidth(aWidth);
        setSliceBy({ lSlice, rSlice });
        setSeq(s);
        setMva(m);
        setIsLoaded(true);
    };

    useEffect(() => {
        const socket = new WebSocket('ws://localhost:8000/api/load_properties_for_subset');
        const seen = new Set();
        let i = 0;
        let lStates = [];
        let rStates = [];

        if (isExpanded) {
            const lToDo = leftBoundary ? leftBoundary.timestepSequence.map((d) => d.id) : undefined;
            const rToDo = rightBoundary
                ? rightBoundary.timestepSequence.map((d) => d.id)
                : undefined;

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

                render(renderStates, width, lStates.length, rStates.length);

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
                    socket.close();
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

                const lData = lStates.map((d) => GlobalStates.get(d)[property]);
                const rData = rStates.map((d) => GlobalStates.get(d)[property]);

                const lStats = boxPlotStats(lData);
                const rStats = boxPlotStats(rData);
                setLBoxStats(lStats);
                setRBoxStats(rStats);

                render(cStates, 0.8 * width);

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
                    socket.close();
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

    return isLoaded ? (
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
            doubleClickAction={() => setIsExpanded(!isExpanded)}
            includeBoundaries={isExpanded}
            leftBoundary={leftBoundary}
            rightBoundary={rightBoundary}
            sliceBy={sliceBy}
            globalScale={scale}
            showSparkLine={showSparkLine}
        />
    ) : (
        <div> Loading... </div>
    );
}

/* 
    <Box
        className="floatingToolBar"
        sx={{ visibility: isParentHovered ? 'visible' : 'hidden' }}
    >
        <Button color="secondary" size="small" onClick={() => toggleSparkLine()}>
            {showSparkLine ? 'ShowScatter' : 'ShowSparkLine'}
        </Button>
    </Box>

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
