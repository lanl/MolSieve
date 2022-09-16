import { React, useEffect, useState } from 'react';
import * as d3 from 'd3';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Select from '@mui/material/Select';

import { structuralAnalysisProps } from '../api/constants';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useContextMenu } from '../hooks/useContextMenu';

import '../css/vis.css';
import { onEntityMouseOver, simpleMovingAverage, boxPlotStats } from '../api/myutils';
import GlobalStates from '../api/globalStates';

import Scatterplot from './Scatterplot';
import EmbeddedChart from './EmbeddedChart';

const margin = {
    top: 25,
    bottom: 20,
    left: 25,
    right: 25,
};

const minimumChartWidth = 100;
const mvaPeriod = 100;

function TrajectoryChart({
    trajectories,
    loadingCallback,
    setStateHovered,
    setStateClicked,
    stateHovered,
    setExtents,
    visibleExtent,
    width,
    height,
    runs,
    isParentHovered,
}) {
    const { contextMenu, toggleMenu } = useContextMenu();

    const [charts, setCharts] = useState([]);
    const [isHovered, setIsHovered] = useState(false);
    const [boxPlotAttribute, setBoxPlotAttribute] = useState(structuralAnalysisProps[0]);
    const [expandedChunks, setExpandedChunks] = useState([]);

    const expandChunk = (chunk) => {
        if (expandedChunks.includes(chunk.id)) {
            setExpandedChunks(expandedChunks.filter((id) => id !== chunk.id));
        } else {
            setExpandedChunks([...expandedChunks, chunk.id]);
        }
    };

    useEffect(() => {
        setIsHovered(isParentHovered);
    }, [isParentHovered]);

    const renderChunks = (data, trajectoryName, count, xScale, yScale, getWidthScale) => {
        const trajectory = trajectories[trajectoryName];

        const nodes = d3
            .select(`#c_${trajectoryName}`)
            .selectAll('rect')
            .data(data, (d) => d.id);

        function getX(i, w) {
            if (i > 0) {
                const d = data[i - 1];
                const wl = xScale(getWidthScale(d));
                return getX(i - 1, w + wl);
            }
            return w;
        }

        nodes
            .enter()
            .append('rect')
            .attr('id', (d) => `c_${d.id}`)
            .attr('x', (_, i) => getX(i, 0))
            .attr('y', yScale(count))
            .attr('width', (d) => xScale(getWidthScale(d)))
            .attr('height', 25)
            .attr('fill', (d) => {
                if (!d.important) return trajectory.colorByCluster(d);
                return 'white';
            })
            .on('mouseover', function (_, d) {
                onEntityMouseOver(this, d);
                setStateHovered({
                    caller: this,
                    stateID: d.id,
                    name: trajectoryName,
                    timestep: d.timestep,
                });
            })
            .on('mouseout', function () {
                setStateHovered(null);
            })
            .classed('chunk', true)
            .classed(trajectoryName, true)
            .classed('unimportant', (d) => !d.important)
            .classed('important', (d) => d.important)
            .classed('breakdown', (d) => d.parentID);

        nodes.exit().remove();
    };

    const renderChunkChart = (
        chunk,
        allStateIds,
        isExpanded,
        chartX,
        chartY,
        chartWidth,
        trajectoryName,
        leftBoundary,
        rightBoundary,
        sliceBy
    ) => {
        const allStates = allStateIds.map((id) => GlobalStates.get(id));

        const globalBoxScale = d3
            .scaleLinear()
            .domain(d3.extent(allStates, (d) => d[boxPlotAttribute]))
            .range([375, 20]);

        const w = chartWidth; // scaleX(getWidthScale(chunk));
        const h = 400;

        let seq = chunk.timestepSequence;
        let mva = chunk.calculateMovingAverage(boxPlotAttribute, mvaPeriod, simpleMovingAverage);

        if (isExpanded && leftBoundary) {
            const left = leftBoundary.timestepSequence.length - sliceBy;
            const right = leftBoundary.timestepSequence.length;
            seq = [...leftBoundary.timestepSequence.slice(left - 1, right), ...seq];
            mva = [
                ...leftBoundary.calculateMovingAverage(
                    boxPlotAttribute,
                    mvaPeriod,
                    simpleMovingAverage,
                    [left, right]
                ),
                ...mva,
            ];
        }

        if (isExpanded && rightBoundary) {
            const left = 0;
            const right = sliceBy;

            seq = [...seq, ...rightBoundary.timestepSequence.slice(left, right + 1)];
            mva = [
                ...mva,
                ...rightBoundary.calculateMovingAverage(
                    boxPlotAttribute,
                    mvaPeriod,
                    simpleMovingAverage,
                    [left, right]
                ),
            ];
        }

        const chart = (
            <foreignObject key={`chart_${chunk.id}`} x={chartX} y={chartY} width={w} height={h}>
                <EmbeddedChart key={`div_${chunk.id}`} height={h} width={w}>
                    {(ww, hh, isEmbeddedParentHovered) => (
                        <Scatterplot
                            key={`sc_${chunk.id}`}
                            sequence={seq}
                            width={ww}
                            height={hh}
                            runs={runs}
                            movingAverage={mva}
                            setExtents={setExtents}
                            trajectories={trajectories}
                            trajectoryName={trajectoryName}
                            setStateHovered={setStateHovered}
                            setStateClicked={setStateClicked}
                            stateHovered={stateHovered}
                            isParentHovered={isEmbeddedParentHovered}
                            id={`sc_${chunk.id}`}
                            property={boxPlotAttribute}
                            globalScale={globalBoxScale}
                            toggleExpanded={() => expandChunk(chunk)}
                            includeBoundaries={isExpanded}
                            leftBoundary={leftBoundary}
                            rightBoundary={rightBoundary}
                            sliceBy={sliceBy}
                        />
                    )}
                </EmbeddedChart>
            </foreignObject>
        );
        setCharts([...charts, chart]);
    };

    const getBoundaryStates = (leftBoundary, rightBoundary, i, seen) => {
        const moveBy = 100;
        let checkStates = [];
        let leftStates = [];
        let rightStates = [];

        if (leftBoundary) {
            const left = leftBoundary.timestepSequence.length - moveBy * (i + 1);
            const right = leftBoundary.timestepSequence.length - moveBy * i;
            // need boundary checks
            leftStates = [...leftBoundary.timestepSequence.slice(left - 1, right).map((d) => d.id)];
            checkStates = [...leftStates];
        }

        if (rightBoundary) {
            const left = moveBy * i;
            const right = moveBy * (i + 1);
            rightStates = [
                ...rightBoundary.timestepSequence.slice(left, right + 1).map((d) => d.id),
            ];
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

    const renderCharts = (data, trajectoryName, count, scaleX, scaleY, getWidthScale) => {
        function getX(i, w) {
            if (i > 0) {
                const d = data[i - 1];
                const wl = scaleX(getWidthScale(d));
                return getX(i - 1, w + wl);
            }
            return w;
        }

        data.filter((d) => d.important).map((chunk) => {
            const chunkIndex = data.indexOf(chunk);
            const isExpanded = expandedChunks.includes(chunk.id);
            let leftBoundary;
            let rightBoundary;
            if (chunkIndex > 0) {
                // get -1
                leftBoundary = data[chunkIndex - 1];
            }

            if (chunkIndex < data.length - 1) {
                // get +1
                rightBoundary = data[chunkIndex + 1];
            }

            // start here
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

                socket.addEventListener('open', (e) => {
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

                    renderChunkChart(
                        chunk,
                        [...lStates, ...chunk.states, ...rStates],
                        isExpanded,
                        getX(chunkIndex, 0),
                        scaleY(count) + 12.5,
                        scaleX(getWidthScale(chunk)),
                        trajectoryName,
                        leftBoundary,
                        rightBoundary,
                        i * 100
                    );

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
                let allStates = [...chunk.states];
                if (leftBoundary) {
                    allStates = [...leftBoundary.selected, ...allStates];
                }

                if (rightBoundary) {
                    allStates = [...allStates, ...rightBoundary.selected];
                }

                renderChunkChart(
                    chunk,
                    allStates,
                    isExpanded,
                    getX(chunkIndex, 0),
                    scaleY(count) + 12.5,
                    scaleX(getWidthScale(chunk)),
                    trajectoryName,
                    leftBoundary,
                    rightBoundary
                );
            }

            // compare <DIRECTION>-most average - median <DIRECTION> vs IQR of direction
            // if within range, stop expansion
            // else include state, push <DIRECTION>
            // send request for subset, render and then await message
            // wait only for first message - no need actually, these properties are guaranteed to be when chunks were being split

            // need list of all states within (leftBoundary, rightBoundary, center)
        });
        // set up global scale for the boxPlots
        // try to make global scale correct for when boundaries are expanded
    };

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (height === undefined || width === undefined) {
                return;
            }
            // clear so we don't draw over-top and cause insane lag
            if (!svg.empty()) {
                svg.selectAll('*').remove();
                // setCharts([]);
            }

            let y = 0;

            const scaleY = d3
                .scaleLinear()
                .range([margin.top, height - margin.bottom])
                .domain([0, Object.keys(trajectories).length]);

            const tickNames = [];
            const chunkGroup = svg.append('g').attr('id', 'chunk');
            const importantGroup = svg.append('g').attr('id', 'sequence_important');

            for (const [name, trajectory] of Object.entries(trajectories)) {
                // trajectory.name = name;

                const { chunkList } = trajectory;
                const topChunkList = chunkList.filter((d) => !d.hasParent);
                const uChunks = topChunkList.filter((d) => !d.important);
                const iChunks = topChunkList.filter((d) => d.important);

                const unimportantWidthScale = d3
                    .scaleLinear()
                    .range([minimumChartWidth, (width - margin.right) * 0.1])
                    .domain([0, d3.max(uChunks, (d) => d.size)]);

                const importantWidthScale = d3
                    .scaleLinear()
                    .range([minimumChartWidth, width - margin.right])
                    .domain([0, d3.max(iChunks, (d) => d.size)]);

                const getWidthScale = (data) => {
                    if (data.important) {
                        return importantWidthScale(data.size);
                    }
                    return unimportantWidthScale(data.size);
                };

                const totalSum = d3.sum(topChunkList, (d) => getWidthScale(d));

                const scaleX = (w) => {
                    // given a width, scale it down so that it will fit within 1 screen
                    const per = w / totalSum;
                    return per * (width - margin.right);
                };

                importantGroup.append('g').attr('id', `g_${name}`).attr('name', `${name}`);
                chunkGroup.append('g').attr('id', `c_${name}`).attr('name', `${name}`);

                tickNames.push(name);

                renderChunks(topChunkList, name, y, scaleX, scaleY, getWidthScale);
                renderCharts(topChunkList, name, y, scaleX, scaleY, getWidthScale);

                y++;
            }

            loadingCallback();
        },
        // charts need to be drawn at a different time...
        [trajectories, runs, boxPlotAttribute, expandedChunks]
    );

    useEffect(() => {
        /* if (stateHovered) {
            if (stateHighlight) {
                d3.select(ref.current)
                    .selectAll('rect:not(.invisible)')
                    .filter(function (dp) {
                        return dp.id !== stateHovered.id;
                    })
                    .classed('highlightedInvisible', true);

                d3.select('#sequence_important')
                    .selectAll('rect:not(.highlightedInvisible)')
                    .classed('highlightedStates', true);
            }

            if (stateHovered.timestep !== null && stateHovered.timestep !== undefined) {
                d3.select(ref.current)
                    .selectAll('rect:not(.invisible)')
                    .filter((d) => d.timestep === stateHovered.timestep)
                    .classed('highlightedState', true);
            }

            if (stateHovered.timesteps) {
                d3.select(ref.current)
                    .selectAll('rect:not(.invisible)')
                    .filter((d) => stateHovered.timesteps.includes(d.timestep))
                    .classed('highlightedState', true);
            }
        } else {
            d3.select(ref.current)
                .selectAll('.highlightedInvisible')
                .classed('highlightedInvisible', false);
            d3.select(ref.current)
                .selectAll('.highlightedStates')
                .classed('highlightedStates', false);
            d3.select(ref.current)
                .selectAll('.highlightedState')
                .classed('highlightedState', false);
        } */
    }, [stateHovered]);

    useEffect(() => {
        d3.select(ref.current).selectAll('.currentSelection').classed('currentSelection', false);

        if (visibleExtent) {
            for (const e of visibleExtent) {
                let filterFunc = null;

                if (e.begin && e.end) {
                    filterFunc = function (d) {
                        return d.timestep >= e.begin && d.timestep <= e.end;
                    };
                } else {
                    filterFunc = function (d) {
                        const ids = e.states.map((s) => s.id);
                        return ids.includes(d.id);
                    };
                }
                d3.select(ref.current)
                    .select('#sequence_important')
                    .selectAll('rect')
                    .filter((d) => {
                        return filterFunc(d);
                    })
                    .classed('currentSelection', true);
            }
        }
    }, [visibleExtent]);

    // render properties in properties menu
    return (
        <>
            <Box className="floatingToolBar" sx={{ visibility: isHovered ? 'visible' : 'hidden' }}>
                <Button color="secondary" size="small" onClick={(e) => toggleMenu(e)}>
                    BoxPlotAttributes
                </Button>
            </Box>

            <svg
                className="vis"
                id="sequence"
                ref={ref}
                preserveAspectRatio="none"
                viewBox={[0, 0, width, height]}
            >
                {charts}
            </svg>

            <Menu
                open={contextMenu !== null}
                onClose={toggleMenu}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
            >
                <MenuItem>
                    <Select
                        value={boxPlotAttribute}
                        onChange={(e) => {
                            setBoxPlotAttribute(e.target.value);
                        }}
                    >
                        {structuralAnalysisProps.map((property) => {
                            return (
                                <MenuItem key={property} value={property}>
                                    {property}
                                </MenuItem>
                            );
                        })}
                    </Select>
                </MenuItem>
            </Menu>
        </>
    );
}

export default TrajectoryChart;
