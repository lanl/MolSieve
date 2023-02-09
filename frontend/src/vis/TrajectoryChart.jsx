import { React, useEffect } from 'react';
import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import ChunkWrapper from '../hoc/ChunkWrapper';
import ViolinPlotWrapper from '../hoc/ViolinPlotWrapper';
import GlobalStates from '../api/globalStates';

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

export default function TrajectoryChart({
    trajectory,
    setStateHovered,
    selections,
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
        [JSON.stringify(trajectory), JSON.stringify(run), JSON.stringify(charts)]
    );

    const { ranks, reduceRanks } = useRanks(properties, trajectory.chunkOrder());

    const updateRanks = (values, weight) => {
        reduceRanks({ type: 'updateValues', payload: { values, weight } });
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
    }, [JSON.stringify(ranks.ordered), ref, showTop, propertyCombos, height]);

    const { extents } = run;
    // here we can filter out the un-rendered charts right away since we only care about rendering here
    const { iChunks, uChunks } = charts;

    const topChunkList = [...iChunks, ...uChunks].sort((a, b) => a.timestep > b.timestep);

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
        if (data.important) {
            return importantWidthScale(data.slice(extents[0], extents[1]).size);
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

    const finishBrush = (chunk, { selection }, chartWidth) => {
        // extents determines the zoom level
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
            {topChunkList.map((chunk) => {
                const chunkIndex = topChunkList.indexOf(chunk);
                const slicedChunk = chunk.slice(extents[0], extents[1]);

                const chartW = scaleX(getWidthScale(chunk));
                const { values, current } = selections;

                const chartSelections = Object.keys(values)
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

                const h = chunk.important ? height : height - scatterplotHeight;

                return (
                    <foreignObject
                        key={chunk.id}
                        x={getX(chunkIndex, 0, topChunkList, scaleX, getWidthScale) + MARGIN.right}
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
                                    ? d3.brushX().on('end', (e) => finishBrush(chunk, e, chartW))
                                    : undefined
                            }
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
                            selections={chartSelections}
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
                                        updateRanks={updateRanks}
                                        ranks={ranks.ordered.slice(0, showTop)}
                                        selections={chartSelections}
                                        showStateClustering={showStateClustering}
                                        showTop={showTop}
                                        doubleClickAction={() => expand(chunk.id, 100, trajectory)}
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
