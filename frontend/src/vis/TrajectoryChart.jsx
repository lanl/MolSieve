import { React, useEffect, useState, useLayoutEffect } from 'react';
import * as d3 from 'd3';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import ChunkWrapper from '../hoc/ChunkWrapper';
import EmbeddedChart from './EmbeddedChart';
import GlobalStates from '../api/globalStates';

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
    trajectory,
    loadingCallback,
    setStateHovered,
    stateHovered,
    visibleExtent,
    width,
    height,
    run,
    isParentHovered,
    charts,
    property
}) {
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        setIsHovered(isParentHovered);
    }, [isParentHovered]);

    const renderChunks = (data, xScale, getWidthScale) => {
        const { name } = trajectory;

        const getX = (i, w) => {
            if (i > 0) {
                const d = data[i - 1];
                const wl = xScale(getWidthScale(d));
                return getX(i - 1, w + wl);
            }
            return w;
        };

        const nodes = d3
            .select(`#c_${name}`)
            .selectAll('rect')
            .data(data, (d) => d.id);

        nodes
            .enter()
            .append('rect')
            .attr('id', (d) => `c_${d.id}`)
            .attr('x', (_, i) => getX(i, 0))
            .attr('y', height / 2)
            .attr('width', (d) => xScale(getWidthScale(d)))
            .attr('height', 35)
            .attr('fill', (d) => {
                if (!d.important) return trajectory.colorByCluster(d);
                return 'white';
            })
            .on('mouseover', function (_, d) {
                onEntityMouseOver(this, d);
                setStateHovered({
                    caller: this,
                    stateID: d.id,
                    name,
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
            .classed(name, true)
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

            const { chunkList, name } = trajectory;
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

            const tickNames = [];
            const chunkGroup = svg.append('g').attr('id', 'chunk');
            const importantGroup = svg.append('g').attr('id', 'sequence_important');

            importantGroup.append('g').attr('id', `g_${name}`).attr('name', `${name}`);
            chunkGroup.append('g').attr('id', `c_${name}`).attr('name', `${name}`);

            tickNames.push(name);

            renderChunks(topChunkList, scaleX, getWidthScale);

            loadingCallback();
        },
        [trajectory, run, width, height, charts]
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
        <svg
            className="vis"
            id={`${trajectory.name}_sequence`}
            ref={ref}
            preserveAspectRatio="none"
            viewBox={[0, 0, width, height]}
        >
            {charts.map((child) => {
                const { chunk, id, leftBoundary, rightBoundary } = child;

                const { chunkList } = trajectory;
                const topChunkList = chunkList.filter((d) => !d.hasParent);
                const uChunks = topChunkList.filter((d) => !d.important);
                const iChunks = topChunkList.filter((d) => d.important);

                const chunkIndex = topChunkList.indexOf(chunk);

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
                        y={height / 2}
                        width={chartW}
                        height={height / 2}
                    >
                        <EmbeddedChart height={height / 2} width={chartW}>
                            {(ww, hh, isPHovered) => (
                                <ChunkWrapper
                                    chunk={chunk}
                                    leftBoundary={leftBoundary}
                                    rightBoundary={rightBoundary}
                                    width={ww}
                                    height={hh}
                                    setStateHovered={setStateHovered}
                                    property={property}
                                    trajectory={trajectory}
                                    run={run}
                                    isParentHovered={isPHovered}
                                />
                            )}
                        </EmbeddedChart>
                    </foreignObject>
                );
            })}
        </svg>
    );
}

export default TrajectoryChart;
