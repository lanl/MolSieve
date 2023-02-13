import { React, useEffect, useState, memo, useCallback } from 'react';
import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import ChunkWrapper from '../hoc/ChunkWrapper';
import GlobalStates from '../api/globalStates';
import ViolinPlotWrapper from '../hoc/ViolinPlotWrapper';

import EmbeddedChart from './EmbeddedChart';

import useRanks from '../hooks/useRanks';
import { abbreviate } from '../api/myutils';
import '../css/vis.css';

const MARGIN = {
    top: 30,
    bottom: 20,
    left: 5,
    right: 75,
};

const minimumChartWidth = 200;

function TrajectoryChart({
    trajectory,
    setStateHovered,
    selections,
    width,
    height,
    run,
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
    expand,
    propertyCombos,
    scatterplotHeight = 50,
}) {
    const ref = useTrajectoryChartRender(
        (svg) => {
            // clear so we don't draw over-top and cause insane lag
            if (!svg.empty()) {
                // NOTE: deletes all g elements, even ones inside foreignObjects!
                svg.selectAll('g:not(.brush, .rankList)').remove();
            }
        },
        [JSON.stringify(trajectory), JSON.stringify(run)]
    );

    const { ranks, reduceRanks } = useRanks(properties, trajectory.chunkOrder(0));

    const [scales, setScales] = useState(null);
    const [chartSelections, setChartSelections] = useState({});

    const updateRanks = (values, id) => {
        reduceRanks({ type: 'updateValues', payload: { values, id } });
    };

    useEffect(() => {
        if (ref) {
            d3.select(ref.current).select('.rankList').remove();

            const rankList = d3.select(ref.current).append('g').classed('rankList', true);
            const propertyComboText = propertyCombos.map((combo) => combo.properties.join('+'));
            const textRanks = rankList
                .selectAll('text')
                .data([...ranks.ordered.slice(0, showTop), ...propertyComboText]);

            const controlChartHeight =
                (height - scatterplotHeight) / (propertyCombos.length + showTop);

            textRanks
                .enter()
                .append('text')
                .attr('x', MARGIN.left)
                // dependent on spark chart height
                .attr('y', (_, i) => (i + 1) * controlChartHeight - controlChartHeight / 2)
                .attr('font-size', '10px')
                .text((d) => abbreviate(d));

            textRanks.exit().remove();
        }
    }, [JSON.stringify(ranks.ordered), ref, showTop, JSON.stringify(propertyCombos), height]);

    useEffect(() => {
        const { extents } = run;
        const { iChunks, uChunks, topChunkList } = trajectory.getVisibleChunks(extents);

        const unimportantWidthExtent =
            iChunks.length > 0 ? (width - MARGIN.right) * 0.1 : width - MARGIN.right;

        const unimportantWidthScale = d3
            .scaleLinear()
            .range([minimumChartWidth, unimportantWidthExtent])
            .domain([0, d3.max(uChunks, (d) => d.size)]);

        const importantWidthScale = d3
            .scaleLinear()
            .range([minimumChartWidth, width - MARGIN.right])
            .domain([0, d3.max(iChunks, (d) => d.slice(extents[0], extents[1]).size)]);

        const getWidthScale = (data) => {
            if (data) {
                if (data.important) {
                    return importantWidthScale(data.slice(extents[0], extents[1]).size);
                }
                return unimportantWidthScale(data.size);
            }
            return undefined;
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
        setScales({ getX, getWidthScale, scaleX });
    }, [JSON.stringify(trajectory.chunkList), JSON.stringify(run), width]);

    useEffect(() => {
        if (scales) {
            const { chunkList } = trajectory;
            const { extents } = run;

            // fill this dict with selection data for each chunk
            const chartSelectionDict = {};
            for (const chunk of chunkList) {
                const { scaleX, getWidthScale } = scales;
                const chartW = scaleX(getWidthScale(chunk));

                const slicedChunk = chunk.slice(extents[0], extents[1]);
                const { values, current } = selections;

                const chartSel = Object.keys(values)
                    .filter((selectionID) => {
                        const selection = values[selectionID];
                        const timesteps = selection.extent.map((d) => d.timestep);
                        return (
                            selection.trajectoryName === trajectory.name &&
                            slicedChunk.containsSequence(timesteps)
                        );
                    })
                    .map((selectionID) => {
                        const selection = values[selectionID];
                        const { start, end } = selection.originalExtent;
                        const [chunkSliceStart, chunkSliceEnd] = extents;

                        // this needs to be done so that the selection can rescale
                        const x = d3
                            .scaleLinear()
                            .domain(
                                d3.extent(
                                    chunk.timesteps.filter(
                                        (d) => d >= chunkSliceStart && d <= chunkSliceEnd
                                    )
                                )
                            )
                            .range([0, chartW - 7.5]);

                        const active = current && selectionID === current.id;

                        return {
                            set: selection.extent.map((d) => d.timestep),
                            active,
                            highlightValue: active ? current.activeState : null,
                            brushValues: { start: x(start), end: x(end) },
                        };
                    });
                chartSelectionDict[chunk.id] = chartSel;
            }
            setChartSelections(chartSelectionDict);
        }
    }, JSON.stringify(selections));

    // here we can filter out the un-rendered charts right away since we only care about rendering here
    const finishBrush = (chunk, { selection }, chartWidth) => {
        // extents determines the zoom level
        const { extents } = run;
        const [chunkSliceStart, chunkSliceEnd] = extents;

        const x = d3
            .scaleLinear()
            .domain(
                d3.extent(chunk.timesteps.filter((d) => d >= chunkSliceStart && d <= chunkSliceEnd))
            )
            .range([0, chartWidth - 7.5]); // 7.5 to match margin on scatterplot

        const startTimestep = x.invert(selection[0]);
        const endTimestep = x.invert(selection[1]);

        const states = chunk.sequence
            .map((sID) => GlobalStates.get(sID))
            .map((s, i) => ({
                timestep: chunk.timestep + i,
                id: s.id,
            }))
            .filter(
                (d) =>
                    d.timestep >= Math.trunc(startTimestep) && d.timestep <= Math.trunc(endTimestep)
            );

        setExtents(
            states,
            trajectory.name,
            { start: startTimestep, end: endTimestep },
            { start: selection[0], end: selection[1] }
        );
    };

    const { extents } = run;
    const { topChunkList } = trajectory.getVisibleChunks(extents);

    const selectChart = useCallback(
        (chunk) => {
            if (chunkSelectionMode && !trajectorySelectionMode) {
                selectObject(chunk);
            }
        },
        [chunkSelectionMode, trajectorySelectionMode]
    );

    return (
        <svg
            className="vis"
            id={`${trajectory.name}_sequence`}
            ref={ref}
            viewBox={[0, 0, width, height]}
            onClick={() => {
                if (trajectorySelectionMode) {
                    selectObject(trajectory);
                }
            }}
        >
            {scales &&
                topChunkList.map((chunk) => {
                    const { scaleX, getWidthScale, getX } = scales;
                    const chartW = scaleX(getWidthScale(chunk));

                    const chunkIndex = topChunkList.indexOf(chunk);
                    const h = chunk.important ? height : height - scatterplotHeight;

                    return (
                        <foreignObject
                            key={chunk.id}
                            x={
                                getX(chunkIndex, 0, topChunkList, scaleX, getWidthScale) +
                                MARGIN.right
                            }
                            y={0}
                            width={chartW}
                            height={h}
                        >
                            <EmbeddedChart
                                height={h}
                                width={chartW}
                                color={chunk.color}
                                brush={
                                    chunk.important
                                        ? d3
                                              .brushX()
                                              .on('end', (e) => finishBrush(chunk, e, chartW))
                                        : undefined
                                }
                                onChartClick={selectChart(chunk)}
                                id={`ec_${chunk.id}`}
                                selected={
                                    chunkSelectionMode &&
                                    !trajectorySelectionMode &&
                                    selectedObjects.map((d) => d.id).includes(chunk.id)
                                }
                                selections={chartSelections[chunk.id]}
                            >
                                {(ww, hh) =>
                                    chunk.important ? (
                                        <ChunkWrapper
                                            chunk={chunk}
                                            width={ww}
                                            height={hh}
                                            setStateHovered={setStateHovered}
                                            properties={properties}
                                            trajectory={trajectory}
                                            run={run}
                                            globalScale={globalScale}
                                            updateGlobalScale={updateGlobalScale}
                                            ranks={ranks.ordered.slice(0, showTop)}
                                            selections={chartSelections}
                                            showStateClustering={showStateClustering}
                                            showTop={showTop}
                                            doubleClickAction={useCallback(
                                                () => expand(chunk.id, 100, trajectory),
                                                []
                                            )}
                                            propertyCombos={propertyCombos}
                                            extents={extents}
                                            scatterplotHeight={scatterplotHeight}
                                        />
                                    ) : (
                                        <ViolinPlotWrapper
                                            chunk={chunk}
                                            width={ww}
                                            height={hh} // to accomodate for no scatterplot
                                            updateRanks={updateRanks}
                                            ranks={ranks.ordered.slice(0, showTop)}
                                            properties={properties}
                                            globalScale={globalScale}
                                            updateGlobalScale={updateGlobalScale}
                                            showTop={showTop}
                                            propertyCombos={propertyCombos}
                                        />
                                    )
                                }
                            </EmbeddedChart>
                        </foreignObject>
                    );
                })}
            <rect
                x={0}
                y={0}
                width={width}
                height={height}
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
// memo breaks re-rendering when simplification changes
export default TrajectoryChart;
