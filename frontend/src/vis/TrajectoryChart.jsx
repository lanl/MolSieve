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
import ChunkWrapper from '../hoc/ChunkWrapper';
import EmbeddedChart from './EmbeddedChart';
import '../css/vis.css';
import { onEntityMouseOver, normalizeDict } from '../api/myutils';

const margin = {
    top: 25,
    bottom: 20,
    left: 25,
    right: 0,
};

const minimumChartWidth = 200;

function TrajectoryChart({
    trajectories,
    loadingCallback,
    setStateHovered,
    stateHovered,
    visibleExtent,
    width,
    height,
    runs,
    isParentHovered,
    charts,
}) {
    const { contextMenu, toggleMenu } = useContextMenu();

    const [isHovered, setIsHovered] = useState(false);
    const [boxPlotAttribute, setBoxPlotAttribute] = useState(structuralAnalysisProps[0]);

    useEffect(() => {
        setIsHovered(isParentHovered);
    }, [isParentHovered]);

    const renderChunks = (data, trajectoryName, count, xScale, yScale, getWidthScale) => {
        const trajectory = trajectories[trajectoryName];

        const getX = (i, w) => {
            if (i > 0) {
                const d = data[i - 1];
                const wl = xScale(getWidthScale(d));
                return getX(i - 1, w + wl);
            }
            return w;
        };

        const nodes = d3
            .select(`#c_${trajectoryName}`)
            .selectAll('rect')
            .data(data, (d) => d.id);

        nodes
            .enter()
            .append('rect')
            .attr('id', (d) => `c_${d.id}`)
            .attr('x', (_, i) => getX(i, 0))
            .attr('y', yScale(count) + 200)
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
            .attr('visibility', (d) => {
                return d.important ? 'hidden' : 'visible';
            })
            .classed('chunk', true)
            .classed(trajectoryName, true)
            .classed('unimportant', (d) => !d.important)
            .classed('important', (d) => d.important)
            .classed('breakdown', (d) => d.parentID);

        nodes.exit().remove();
    };

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (height === undefined || width === undefined) {
                return;
            }
            // clear so we don't draw over-top and cause insane lag
            if (!svg.empty()) {
                svg.selectAll('g').remove();
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

                y++;
            }
            loadingCallback();
        },
        [trajectories, runs]
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
                {charts.map((child) => {
                    const { chunk, id, leftBoundary, rightBoundary, trajectoryName } = child;
                    const { trajectory } = chunk;
                    const scaleY = d3
                        .scaleLinear()
                        .range([margin.top, height - margin.bottom])
                        .domain([0, Object.keys(trajectories).length]);

                    const { chunkList } = trajectory;
                    const topChunkList = chunkList.filter((d) => !d.hasParent);
                    const uChunks = topChunkList.filter((d) => !d.important);
                    const iChunks = topChunkList.filter((d) => d.important);

                    const chunkIndex = topChunkList.indexOf(chunk);

                    // these values could all be calculated pre-render...

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
                    const getX = (i, w) => {
                        if (i > 0) {
                            const d = topChunkList[i - 1];
                            const wl = scaleX(getWidthScale(d));
                            return getX(i - 1, w + wl);
                        }
                        return w;
                    };

                    const chartW = scaleX(getWidthScale(chunk));
                    return (
                        <foreignObject
                            key={id}
                            x={getX(chunkIndex, 0, topChunkList, scaleX, getWidthScale)}
                            y={scaleY(0) + 12.5}
                            width={chartW}
                            height={400}
                        >
                            <EmbeddedChart height={400} width={chartW}>
                                {(ww, hh, isPHovered) => (
                                    <ChunkWrapper
                                        chunk={chunk}
                                        leftBoundary={leftBoundary}
                                        rightBoundary={rightBoundary}
                                        width={ww}
                                        height={hh}
                                        setStateHovered={setStateHovered}
                                        boxPlotAttribute={boxPlotAttribute}
                                        trajectories={trajectories}
                                        trajectoryName={trajectoryName}
                                        runs={runs}
                                        isParentHovered={isPHovered}
                                    />
                                )}
                            </EmbeddedChart>
                        </foreignObject>
                    );
                })}
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
                            // move z-score into menuitem
                            const zScores = [];
                            for (const trajectoryName of Object.keys(trajectories)) {
                                const trajectory = trajectories[trajectoryName];
                                const { featureImportance } = trajectory;
                                if (featureImportance) {
                                    const normDict = normalizeDict(featureImportance, [-1, 1]);
                                    zScores.push(
                                        <>
                                            <span> </span>
                                            <span
                                                key={`${property}_${trajectoryName}`}
                                                style={{
                                                    color: d3.interpolateRdBu(normDict[property]),
                                                }}
                                            >
                                                {featureImportance[property].toFixed(2)}
                                            </span>
                                        </>
                                    );
                                }
                            }
                            return (
                                <MenuItem dense divider key={property} value={property}>
                                    {property} {zScores}
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
