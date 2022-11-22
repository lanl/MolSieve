import { React, useEffect } from 'react';
import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import ChunkWrapper from '../hoc/ChunkWrapper';
import BoxPlotWrapper from '../hoc/BoxPlotWrapper';

import EmbeddedChart from './EmbeddedChart';

import useRanks from '../hooks/useRanks';
import { abbreviate } from '../api/myutils';
import '../css/vis.css';

const MARGIN = {
    top: 30,
    bottom: 20,
    left: 5,
    right: 5,
};

const minimumChartWidth = 200;

function TrajectoryChart({
    trajectory,
    setStateHovered,
    stateHovered,
    currentSelection,
    width,
    height,
    run,
    charts,
    properties,
    chunkSelectionMode,
    trajectorySelectionMode,
    selectObject,
    selectedObjects,
    setExtents,
    updateGlobalScale,
    globalScale,
    showStateClustering,
    showTop,
}) {
    const ref = useTrajectoryChartRender(
        (svg) => {
            if (height === undefined || width === undefined) {
                return;
            }
            // clear so we don't draw over-top and cause insane lag
            if (!svg.empty()) {
                // NOTE: deletes all g elements, even ones inside foreignObjects!
                svg.selectAll('g:not(.brush, .rankList)').remove();
            }
        },
        [trajectory, run, width, height, charts]
    );

    const { ranks, reduceRanks } = useRanks(properties);

    const updateRanks = (values, weight) => {
        reduceRanks({ type: 'updateValues', payload: { values, weight } });
    };

    useEffect(() => {
        if (ref) {
            d3.select(ref.current).select('.rankList').remove();

            const rankList = d3.select(ref.current).append('g').classed('rankList', true);
            const textRanks = rankList.selectAll('text').data(ranks.ordered.slice(0, showTop));

            textRanks
                .enter()
                .append('text')
                .attr('x', MARGIN.left)
                .attr('y', (_, i) => MARGIN.top + (i + 1) * 20 - 5)
                .attr('font-size', '10px')
                .text((d) => abbreviate(d));

            textRanks.exit().remove();
        }
    }, [ranks.ordered, ref, showTop]);

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

    /* useEffect(() => {
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
    }, [visibleExtent]); */

    const { chunkList } = trajectory;

    // here we can filter out the un-rendered charts right away since we only care about rendering here
    const topChunkList = chunkList
        .filter((d) => !d.hasParent)
        .filter((d) => {
            const { extents } = run;
            return extents[0] <= d.timestep && extents[1] >= d.last;
        });
    const uChunks = topChunkList.filter((d) => !d.important);
    const iChunks = topChunkList.filter((d) => d.important);

    const unimportantWidthExtent =
        iChunks.length > 0 ? (width - MARGIN.right) * 0.1 : width - MARGIN.right;

    const unimportantWidthScale = d3
        .scaleLinear()
        .range([minimumChartWidth, unimportantWidthExtent])
        .domain([0, d3.max(uChunks, (d) => d.size)]);

    const importantWidthScale = d3
        .scaleLinear()
        .range([minimumChartWidth, width - MARGIN.right])
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
        return per * (width - MARGIN.right);
    };

    const getX = (i, w) => {
        if (i > 0) {
            const d = topChunkList[i - 1];
            const wl = scaleX(getWidthScale(d));
            return getX(i - 1, w + wl);
        }
        return w;
    };

    return (
        <svg
            className="vis"
            id={`${trajectory.name}_sequence`}
            ref={ref}
            preserveAspectRatio="none"
            viewBox={[0, 0, width, height]}
            onClick={() => {
                if (trajectorySelectionMode) {
                    selectObject(trajectory);
                }
            }}
        >
            {charts.map((child) => {
                const { chunk, id, leftBoundary, rightBoundary, important } = child;

                const chunkIndex = topChunkList.indexOf(chunk);

                const chartW = scaleX(getWidthScale(chunk));
                return (
                    <foreignObject
                        key={id}
                        x={getX(chunkIndex, 0, topChunkList, scaleX, getWidthScale)}
                        y={MARGIN.top}
                        width={chartW}
                        height={height - MARGIN.top}
                    >
                        <EmbeddedChart
                            height={height - MARGIN.top}
                            width={chartW}
                            color={chunk.color}
                            onChartClick={() => {
                                if (chunkSelectionMode && !trajectorySelectionMode) {
                                    selectObject(chunk);
                                }
                            }}
                            id={`ec_${chunk.id}`}
                            selected={
                                chunkSelectionMode &&
                                !trajectorySelectionMode &&
                                selectedObjects.map((d) => d.id).includes(chunk.id)
                            }
                        >
                            {(ww, hh, isPHovered) =>
                                important ? (
                                    <ChunkWrapper
                                        chunk={chunk}
                                        leftBoundary={leftBoundary}
                                        rightBoundary={rightBoundary}
                                        width={ww}
                                        height={hh}
                                        setStateHovered={setStateHovered}
                                        stateHovered={stateHovered}
                                        properties={properties}
                                        trajectory={trajectory}
                                        run={run}
                                        isParentHovered={isPHovered}
                                        globalScale={globalScale}
                                        updateGlobalScale={updateGlobalScale}
                                        updateRanks={updateRanks}
                                        ranks={ranks.ordered.slice(0, showTop)}
                                        disableControls={chunkSelectionMode}
                                        setExtents={setExtents}
                                        currentSelection={currentSelection}
                                        showStateClustering={showStateClustering}
                                        showTop={showTop}
                                    />
                                ) : (
                                    <BoxPlotWrapper
                                        chunk={chunk}
                                        width={ww}
                                        height={hh}
                                        updateRanks={updateRanks}
                                        ranks={ranks.ordered.slice(0, showTop)}
                                        properties={properties}
                                        globalScale={globalScale}
                                        updateGlobalScale={updateGlobalScale}
                                        showTop={showTop}
                                    />
                                )
                            }
                        </EmbeddedChart>
                    </foreignObject>
                );
            })}
            <rect
                x={0}
                y={MARGIN.top}
                width={width}
                height={height - MARGIN.top}
                stroke="gray"
                fill="none"
                strokeWidth={2}
                opacity={
                    trajectorySelectionMode &&
                    selectedObjects.map((d) => d.id).includes(trajectory.id)
                        ? 1.0
                        : 0.0
                }
            />
        </svg>
    );
}
export default TrajectoryChart;
