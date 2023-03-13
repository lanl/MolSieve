import { React, useEffect, memo, useMemo, startTransition } from 'react';
import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import ChunkWrapper from '../hoc/ChunkWrapper';
import ViolinPlotWrapper from '../hoc/ViolinPlotWrapper';

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
    properties,
    selectObject,
    chunkSelectionMode,
    selectedObjects,
    addSelection,
    showTop,
    expand,
    propertyCombos,
    scatterplotHeight = 50,
    extents,
    setZoom,
}) {
    const ref = useTrajectoryChartRender((svg) => {
        // clear so we don't draw over-top and cause insane lag
        if (!svg.empty()) {
            // NOTE: deletes all g elements, even ones inside foreignObjects!
            svg.selectAll('g:not(.brush, .rankList)').remove();
        }
    }, []);

    const { ranks, reduceRanks } = useRanks(properties, trajectory.chunkOrder(0));

    const updateRanks = (values, id) => {
        startTransition(() => {
            reduceRanks({ type: 'updateValues', payload: { values, id } });
        });
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

    const scales = useMemo(() => {
        const { iChunks, uChunks, topChunkList } = trajectory.getVisibleChunks();

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
        return { getX, getWidthScale, scaleX };
    }, [JSON.stringify(trajectory.chunkList), JSON.stringify(extents), width]);

    // here we can filter out the un-rendered charts right away since we only care about rendering here
    const topChunkList = useMemo(() => {
        const { topChunkList: tcl } = trajectory.getVisibleChunks();
        return tcl;
    }, [JSON.stringify(extents), JSON.stringify(trajectory.chunkList)]);

    const cutRanks = useMemo(
        () => ranks.ordered.slice(0, showTop),
        [showTop, JSON.stringify(ranks.ordered)]
    );

    return (
        <svg
            className="vis"
            id={`${trajectory.name}_sequence`}
            ref={ref}
            viewBox={[0, 0, width, height]}
            onClick={() => {
                if (chunkSelectionMode === 3) {
                    selectObject(trajectory);
                }
            }}
        >
            {topChunkList.map((chunk) => {
                const { scaleX, getWidthScale, getX } = scales;
                const chartW = scaleX(getWidthScale(chunk));

                const chunkIndex = topChunkList.indexOf(chunk);
                const h = chunk.important ? height : height - scatterplotHeight;

                return (
                    <foreignObject
                        key={chunk.id}
                        x={getX(chunkIndex, 0, topChunkList, scaleX, getWidthScale) + MARGIN.right}
                        y={0}
                        width={chartW}
                        height={h}
                    >
                        {chunk.important ? (
                            <ChunkWrapper
                                chunk={chunk}
                                width={chartW}
                                height={h}
                                setStateHovered={setStateHovered}
                                properties={properties}
                                trajectory={trajectory}
                                ranks={cutRanks}
                                selections={selections}
                                addSelection={addSelection}
                                selectObject={selectObject}
                                selectedObjects={selectedObjects}
                                chunkSelectionMode={chunkSelectionMode}
                                doubleClickAction={() => expand(chunk.id, 100, trajectory)}
                                propertyCombos={propertyCombos}
                                extents={extents}
                                scatterplotHeight={scatterplotHeight}
                                setZoom={setZoom}
                            />
                        ) : (
                            <ViolinPlotWrapper
                                chunk={chunk}
                                width={chartW}
                                height={h} // to accomodate for no scatterplot
                                updateRanks={updateRanks}
                                selectObject={selectObject}
                                selectedObjects={selectedObjects}
                                chunkSelectionMode={chunkSelectionMode}
                                ranks={cutRanks}
                                properties={properties}
                                propertyCombos={propertyCombos}
                                onClick={() => setStateHovered(chunk.characteristicState)}
                            />
                        )}
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
                opacity={selectedObjects.map((d) => d.id).includes(trajectory.id) ? 1.0 : 0.0}
            />
        </svg>
    );
}
export default memo(TrajectoryChart);
