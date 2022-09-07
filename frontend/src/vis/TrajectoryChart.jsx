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
import { onEntityMouseOver, simpleMovingAverage } from '../api/myutils';
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

    const renderCharts = (data, trajectoryName, count, scaleX, scaleY, getWidthScale) => {
        function getX(i, w) {
            if (i > 0) {
                const d = data[i - 1];
                const wl = scaleX(getWidthScale(d));
                return getX(i - 1, w + wl);
            }
            return w;
        }

        // set up global scale for the boxPlots

        const uStateIds = data.filter((d) => !d.important).map((d) => d.selected);
        const iStateIds = data.filter((d) => d.important).map((d) => d.states);
        const allStateIds = [...uStateIds, ...iStateIds];
        const boxPlotStateIds = [].concat.apply([], allStateIds);

        const boxPlotStates = boxPlotStateIds.map((id) => GlobalStates.get(id));

        // range may not always be constant...
        const globalBoxScale = d3
            .scaleLinear()
            .domain(d3.extent(boxPlotStates, (d) => d[boxPlotAttribute]))
            .range([375, 20]);

        Promise.all(
            data
                .filter((d) => d.important)
                .map((chunk) => {
                    let checkStates = [];
                    const chunkIndex = data.indexOf(chunk);
                    const isExpanded = expandedChunks.includes(chunk.id);
                    let leftBoundary;
                    if (chunkIndex > 0) {
                        // get -1
                        leftBoundary = data[chunkIndex - 1];
                    }

                    let rightBoundary;
                    if (chunkIndex < data.length - 1) {
                        // get +1
                        rightBoundary = data[chunkIndex + 1];
                    }

                    if (isExpanded) {
                        if (leftBoundary) {
                            checkStates = [...leftBoundary.states];
                        }

                        if (rightBoundary) {
                            checkStates = [...checkStates, ...rightBoundary.states];
                        }
                    }
                    return GlobalStates.ensureSubsetHasProperty(boxPlotAttribute, checkStates);
                })
        ).then(() => {
            const scatterCharts = data
                .filter((d) => d.important)
                .map((chunk) => {
                    const w = scaleX(getWidthScale(chunk));
                    const h = 400;
                    const chunkIndex = data.indexOf(chunk);
                    const isExpanded = expandedChunks.includes(chunk.id);

                    let leftBoundary;
                    if (chunkIndex > 0) {
                        // get -1
                        leftBoundary = data[chunkIndex - 1];
                    }

                    let rightBoundary;
                    if (chunkIndex < data.length - 1) {
                        // get +1
                        rightBoundary = data[chunkIndex + 1];
                    }

                    let seq = chunk.timestepSequence;
                    let mva = chunk.calculateMovingAverage(
                        boxPlotAttribute,
                        100,
                        simpleMovingAverage
                    );

                    if (isExpanded && leftBoundary) {
                        seq = [...leftBoundary.timestepSequence, ...seq];
                        mva = [
                            ...leftBoundary.calculateMovingAverage(
                                boxPlotAttribute,
                                100,
                                simpleMovingAverage
                            ),
                            ...mva,
                        ];
                    }

                    if (isExpanded && rightBoundary) {
                        seq = [...seq, ...rightBoundary.timestepSequence];
                        mva = [
                            ...mva,
                            ...rightBoundary.calculateMovingAverage(
                                boxPlotAttribute,
                                100,
                                simpleMovingAverage
                            ),
                        ];
                    }

                    return (
                        <foreignObject
                            key={`chart_${chunk.id}`}
                            x={getX(chunkIndex, 0)}
                            y={scaleY(count) + 12.5}
                            width={w}
                            height={h}
                        >
                            <EmbeddedChart key={`div_${chunk.id}`} height={h} width={w}>
                                {(ww, hh, isEmbeddedParentHovered) => (
                                    <Scatterplot
                                        key={`sc_${chunk.id}`}
                                        sequence={seq}
                                        width={ww}
                                        height={hh}
                                        runs={runs}
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
                                        movingAverage={mva}
                                        toggleExpanded={() => expandChunk(chunk)}
                                        includeBoundaries={isExpanded}
                                        leftBoundary={leftBoundary}
                                        rightBoundary={rightBoundary}
                                    />
                                )}
                            </EmbeddedChart>
                        </foreignObject>
                    );
                });
            setCharts([...charts, scatterCharts]);
        });
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
