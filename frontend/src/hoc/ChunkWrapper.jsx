import { React, useState, useEffect } from 'react';

import * as d3 from 'd3';
import Scatterplot from '../vis/Scatterplot';
import BoxPlot from '../vis/BoxPlot';
import { simpleMovingAverage, boxPlotStats } from '../api/myutils';
import GlobalStates from '../api/globalStates';
import EmbeddedChart from '../vis/EmbeddedChart';

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
    setExtents,
    chartX,
    chartY,
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [allStates, setAllStates] = useState([
        ...leftBoundary.selected,
        ...chunk.states,
        ...rightBoundary.selected,
    ]);

    const [adjWidth, setAdjWidth] = useState(0.8 * width);
    const [sliceBy, setSliceBy] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
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

    const getBoundaryStates = (lBoundary, rBoundary, i, seen) => {
        let checkStates = [];
        let leftStates = [];
        let rightStates = [];

        if (lBoundary) {
            const left = lBoundary.timestepSequence.length - moveBy * (i + 1);
            const right = lBoundary.timestepSequence.length - moveBy * i;
            // need boundary checks
            leftStates = [...lBoundary.timestepSequence.slice(left - 1, right).map((d) => d.id)];
            checkStates = [...leftStates];
        }

        if (rBoundary) {
            const left = moveBy * i;
            const right = moveBy * (i + 1);
            rightStates = [...rBoundary.timestepSequence.slice(left, right + 1).map((d) => d.id)];
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

    const render = (states, aWidth, sBy) => {
        let s = chunk.timestepSequence;
        let m = chunk.calculateMovingAverage(boxPlotAttribute, mvaPeriod, simpleMovingAverage);

        const as = states.map((id) => GlobalStates.get(id));

        const gScale = () =>
            d3
                .scaleLinear()
                .domain(d3.extent(as, (d) => d[boxPlotAttribute]))
                .range([375, 20]);

        if (isExpanded && leftBoundary) {
            const left = leftBoundary.timestepSequence.length - sBy;
            const right = leftBoundary.timestepSequence.length;
            s = [...leftBoundary.timestepSequence.slice(left - 1, right), ...s];
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

        if (isExpanded && rightBoundary) {
            const left = 0;
            const right = sBy;

            s = [...s, ...rightBoundary.timestepSequence.slice(left, right + 1)];
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
        setSliceBy(sBy);
        setSeq(s);
        setMva(m);
        setGlobalBoxScale(gScale);
        setIsLoading(false);
    };

    useEffect(() => {
        if (isLoading) {
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

                socket.addEventListener('open', () => {
                    const boundaryStates = getBoundaryStates(leftBoundary, rightBoundary, i, seen);
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

                    let sendStates = [];

                    render([...lStates, ...chunk.states, ...rStates], width, i * moveBy);

                    const boundaryStates = getBoundaryStates(leftBoundary, rightBoundary, i, seen);
                    if (!(centerMVA[0] - lStats.iqr < lStats.median < centerMVA[0] + lStats.iqr)) {
                        lStates = [...lStates, ...boundaryStates.leftStates];
                        sendStates = [...boundaryStates.leftStates];
                    }

                    if (
                        !(
                            centerMVA[centerMVA.length - 1] - rStats.iqr <
                            rStats.median <
                            centerMVA[centerMVA.length - 1] + rStats.iqr
                        )
                    ) {
                        // then request the next boundary states for right
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
                                stateIds: sendStates,
                            })
                        );
                    }
                });
            } else {
                let newAllStates = [...chunk.states];
                if (leftBoundary) {
                    newAllStates = [...leftBoundary.selected, ...allStates];
                }

                if (rightBoundary) {
                    newAllStates = [...allStates, ...rightBoundary.selected];
                }

                render(newAllStates, 0.8 * width);
            }
        }
    }, [isLoading]);

    useEffect(() => {
        setIsLoading(true);
    }, [isExpanded, boxPlotAttribute]);

    return (
        <foreignObject x={chartX} y={chartY} width={width} height={height}>
            <EmbeddedChart height={height} width={width} isLoading={isLoading}>
                {(ww, hh, isEmbeddedParentHovered) => (
                    <>
                        {leftBoundary && !isExpanded && (
                            <BoxPlot
                                showYAxis={false}
                                data={leftBoundary.calculateStats(boxPlotAttribute)}
                                color={leftBoundary.color}
                                property={boxPlotAttribute}
                                width={0.095 * ww}
                                height={hh}
                                globalScale={globalBoxScale}
                            />
                        )}

                        <Scatterplot
                            sequence={seq}
                            width={adjWidth}
                            height={hh}
                            runs={runs}
                            movingAverage={mva}
                            setExtents={setExtents}
                            trajectories={trajectories}
                            trajectoryName={trajectoryName}
                            setStateHovered={setStateHovered}
                            setStateClicked={setStateClicked}
                            isParentHovered={isEmbeddedParentHovered}
                            id={`sc_${chunk.id}`}
                            property={boxPlotAttribute}
                            globalScale={globalBoxScale}
                            toggleExpanded={() => setIsExpanded(!isExpanded)}
                            includeBoundaries={isExpanded}
                            leftBoundary={leftBoundary}
                            rightBoundary={rightBoundary}
                            sliceBy={sliceBy}
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
                )}
            </EmbeddedChart>
        </foreignObject>
    );
}
