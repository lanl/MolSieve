import { React, useState, useEffect } from 'react';

import * as d3 from 'd3';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Scatterplot from '../vis/Scatterplot';

import BoxPlot from '../vis/BoxPlot';
import { simpleMovingAverage, boxPlotStats } from '../api/myutils';
import GlobalStates from '../api/globalStates';

const moveBy = 100;
const mvaPeriod = 100;

export default function ChunkWrapper({
    leftBoundary,
    chunk,
    rightBoundary,
    boxPlotAttribute,
    trajectoryName,
    width,
    height,
    trajectories,
    setStateHovered,
    setStateClicked,
    runs,
    isParentHovered,
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showSparkLine, setSparkLine] = useState(true);

    const toggleSparkLine = () => {
        setSparkLine(!showSparkLine);
    };

    // allStates should be dependent on left & right boundaries
    const [allStates, setAllStates] = useState([...chunk.states]);
    const [adjWidth, setAdjWidth] = useState(0.8 * width);
    const [sliceBy, setSliceBy] = useState({ lSlice: 0, rSlice: 0 });
    const [globalBoxScale, setGlobalBoxScale] = useState(() =>
        d3
            .scaleLinear()
            .domain(
                d3.extent(
                    allStates.map((id) => GlobalStates.get(id)),
                    (d) => d[boxPlotAttribute]
                )
            )
            .range([375, 20])
    );
    const [seq, setSeq] = useState(chunk.timestepSequence);
    const [mva, setMva] = useState(
        chunk.calculateMovingAverage(boxPlotAttribute, mvaPeriod, simpleMovingAverage)
    );

    const getBoundaryStates = (i, seen) => {
        let checkStates = [];
        let leftStates = [];
        let rightStates = [];

        if (leftBoundary) {
            const left = leftBoundary.timestepSequence.length - moveBy * (i + 1);
            const right = leftBoundary.timestepSequence.length - moveBy * i;
            // need boundary checks
            leftStates = [...leftBoundary.timestepSequence.slice(left, right).map((d) => d.id)];
            checkStates = [...leftStates];
        }

        if (rightBoundary) {
            const left = moveBy * i;
            const right = moveBy * (i + 1);
            rightStates = [...rightBoundary.timestepSequence.slice(left, right).map((d) => d.id)];
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
        let m = chunk.calculateMovingAverage(boxPlotAttribute, mvaPeriod, simpleMovingAverage);

        const as = states.map((id) => GlobalStates.get(id));

        const gScale = () =>
            d3
                .scaleLinear()
                .domain(d3.extent(as, (d) => d[boxPlotAttribute]))
                .range([375, 20]);

        if (leftBoundary && isExpanded) {
            const left = leftBoundary.timestepSequence.length - lSlice;
            const right = leftBoundary.timestepSequence.length;
            s = [...leftBoundary.timestepSequence.slice(left), ...s];
            m = [
                ...leftBoundary.calculateMovingAverage(
                    boxPlotAttribute,
                    mvaPeriod,
                    simpleMovingAverage,
                    [left, right]
                ),
                ...m,
            ];
        }

        if (rightBoundary && isExpanded) {
            const left = 0;
            const right = rSlice;

            s = [...s, ...rightBoundary.timestepSequence.slice(left, right)];
            m = [
                ...m,
                ...rightBoundary.calculateMovingAverage(
                    boxPlotAttribute,
                    mvaPeriod,
                    simpleMovingAverage,
                    [left, right]
                ),
            ];
        }

        setAllStates(states);
        setAdjWidth(aWidth);
        setSliceBy({ lSlice, rSlice });
        setSeq(s);
        setMva(m);
        setGlobalBoxScale(gScale);
    };

    useEffect(() => {
        if (isExpanded) {
            const socket = new WebSocket('ws://localhost:8000/api/load_properties_for_subset');
            const seen = new Set();
            let i = 0;
            let lStates = [];
            let rStates = [];

            const centerMVA = chunk.calculateMovingAverage(
                boxPlotAttribute,
                mvaPeriod,
                simpleMovingAverage
            );

            // TODO check if median has been reached, then open calculation
            socket.addEventListener('open', () => {
                const boundaryStates = getBoundaryStates(i, seen);
                lStates = boundaryStates.leftStates;
                rStates = boundaryStates.rightStates;
                i++;

                socket.send(
                    JSON.stringify({
                        props: [boxPlotAttribute],
                        stateIds: boundaryStates.sendStates,
                    })
                );
                // should set state to loading or something
            });

            socket.addEventListener('message', (e) => {
                const parsedData = JSON.parse(e.data);
                GlobalStates.addPropToStates(parsedData);

                const lData = lStates.map((d) => GlobalStates.get(d)[boxPlotAttribute]);
                const rData = rStates.map((d) => GlobalStates.get(d)[boxPlotAttribute]);

                const lStats = boxPlotStats(lData);
                const rStats = boxPlotStats(rData);

                const renderStates = [...new Set(lStates), ...chunk.states, ...new Set(rStates)];

                render(renderStates, width, lStates.length, rStates.length);

                let sendStates = [];
                const boundaryStates = getBoundaryStates(i, seen);
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
                            props: [boxPlotAttribute],
                            stateIds: [...new Set(sendStates)],
                        })
                    );
                }
            });
        } else {
            let newAllStates = [...chunk.states];
            if (leftBoundary) {
                newAllStates = [...leftBoundary.selected, ...newAllStates];
            }

            if (rightBoundary) {
                newAllStates = [...newAllStates, ...rightBoundary.selected];
            }

            render(newAllStates, 0.8 * width);
        }
    }, [isExpanded, boxPlotAttribute]);

    return (
        <>
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
                    data={leftBoundary.calculateStats(boxPlotAttribute)}
                    color={leftBoundary.color}
                    property={boxPlotAttribute}
                    width={0.095 * width}
                    height={height}
                    globalScale={globalBoxScale}
                />
            )}

            <Scatterplot
                sequence={seq}
                width={adjWidth}
                height={height}
                runs={runs}
                movingAverage={mva}
                trajectories={trajectories}
                trajectoryName={trajectoryName}
                setStateHovered={setStateHovered}
                setStateClicked={setStateClicked}
                id={`sc_${chunk.id}`}
                property={boxPlotAttribute}
                globalScale={globalBoxScale}
                doubleClickAction={() => setIsExpanded(!isExpanded)}
                includeBoundaries={isExpanded}
                leftBoundary={leftBoundary}
                rightBoundary={rightBoundary}
                sliceBy={sliceBy}
                showSparkLine={showSparkLine}
            />

            {rightBoundary && !isExpanded && (
                <BoxPlot
                    showYAxis={false}
                    data={rightBoundary.calculateStats(boxPlotAttribute)}
                    color={rightBoundary.color}
                    property={boxPlotAttribute}
                    width={0.1 * width}
                    height={height}
                    globalScale={globalBoxScale}
                />
            )}
        </>
    );
}
