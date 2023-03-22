import { React, useEffect, memo, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import Box from '@mui/material/Box';
import { selectTrajectory, getVisibleChunks, setZoom, expand } from '../api/trajectories';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import ChunkWrapper from '../hoc/ChunkWrapper';
import ViolinPlotWrapper from '../hoc/ViolinPlotWrapper';
import Timeline from './Timeline';

import TrajectoryControls from '../components/TrajectoryControls';
import { abbreviate } from '../api/myutils';
import '../css/vis.css';

const minimumChartWidth = 200;

function TrajectoryChart({
    trajectoryName,
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
    propertyCombos,
    recalculateClustering,
    simplifySet,
    scatterplotHeight = 50,
    margin = { left: 75, right: 10, top: 0, bottom: 5 },
}) {
    const trajectory = useSelector((state) => selectTrajectory(state, trajectoryName));
    const dispatch = useDispatch();
    const setZoomCallback = (extents) => dispatch(setZoom({ name: trajectoryName, extents }));

    const { extents, ranks } = trajectory;
    const topChunkList = useSelector((state) => getVisibleChunks(state, trajectoryName));

    const ref = useTrajectoryChartRender((svg) => {
        // clear so we don't draw over-top and cause insane lag
        if (!svg.empty()) {
            // NOTE: deletes all g elements, even ones inside foreignObjects!
            svg.selectAll('g:not(.brush, .rankList)').remove();
        }
    }, []);

    const controlChartHeight = (height - scatterplotHeight) / (propertyCombos.length + showTop);

    useEffect(() => {
        if (ref) {
            d3.select(ref.current).select('.rankList').remove();

            const rankList = d3.select(ref.current).append('g').classed('rankList', true);
            const propertyComboText = propertyCombos.map((combo, idx) => `MV ${idx + 1}`);
            const textRanks = rankList
                .selectAll('text')
                .data([...ranks.slice(0, showTop), ...propertyComboText]);

            textRanks
                .enter()
                .append('text')
                .attr('x', 35)
                // dependent on spark chart height
                .attr('y', (_, i) => (i + 1) * controlChartHeight - controlChartHeight / 2 + 7)
                .attr('font-size', '10px')
                .attr('font-family', 'Arial')
                .attr('text-anchor', 'middle')
                .attr('fill', '#394043')
                .attr('font-weight', 700)
                .text((d) => abbreviate(d));

            textRanks.exit().remove();
        }
    }, [JSON.stringify(ranks), ref, showTop, JSON.stringify(propertyCombos), height]);

    const adjWidth = width - margin.left - margin.right;

    const scales = useMemo(() => {
        const iChunks = topChunkList.filter((d) => d.important);
        const uChunks = topChunkList.filter((d) => !d.important);
        const unimportantWidthExtent = iChunks.length > 0 ? adjWidth * 0.1 : adjWidth;

        const unimportantWidthScale = d3
            .scaleLinear()
            .range([minimumChartWidth, unimportantWidthExtent])
            .domain([0, d3.max(uChunks, (d) => d.size)]);

        const importantWidthScale = d3
            .scaleLinear()
            .range([minimumChartWidth, adjWidth])
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
            return per * adjWidth;
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
    }, [JSON.stringify(topChunkList), width]);

    // here we can filter out the un-rendered charts right away since we only care about rendering here
    const cutRanks = useMemo(() => ranks.slice(0, showTop), [showTop, JSON.stringify(ranks)]);

    const highlight = (chunk) => {
        d3.select(`.${trajectory.name}`).selectAll('.clicked').classed('clicked', false);
        d3.select(`.${trajectory.name}`).select(`#chunk_${chunk.id}`).classed('clicked', true);
    };

    const unhighlightTimeline = () => {
        d3.select(`.${trajectory.name}`).selectAll('.clicked').classed('clicked', false);
    };

    return (
        <Box
            border={selectedObjects.map((d) => d.id).includes(trajectory.id) ? 1.0 : 0.0}
            onClick={() => {
                if (chunkSelectionMode === 3) {
                    selectObject(trajectory);
                }
            }}
        >
            <TrajectoryControls
                name={trajectory.name}
                simplifySet={simplifySet}
                recalculateClustering={recalculateClustering}
                sx={{
                    marginTop: '0px',
                    marginBottom: '0px',
                    marginLeft: '75px',
                    marginRight: '10px',
                    alignItems: 'center',
                    display: 'flex',
                }}
            />
            <Timeline
                key={trajectory.name}
                width={width}
                setZoom={setZoom}
                height={25}
                trajectoryName={trajectory.name}
                margin={{ left: 75, right: 10, top: 0, bottom: 0 }}
            />
            <svg
                className="vis"
                id={`${trajectory.name}_sequence`}
                ref={ref}
                viewBox={[0, 0, width, height]}
            >
                {topChunkList.map((chunk) => {
                    const { scaleX, getWidthScale, getX } = scales;
                    const chartW = scaleX(getWidthScale(chunk));

                    const chunkIndex = topChunkList.indexOf(chunk);
                    const h = chunk.important
                        ? height
                        : height - scatterplotHeight - propertyCombos.length * controlChartHeight;

                    return (
                        <foreignObject
                            key={chunk.id}
                            x={
                                getX(chunkIndex, 0, topChunkList, scaleX, getWidthScale) +
                                margin.left
                            }
                            y={0}
                            width={chartW}
                            height={height}
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
                                    doubleClickAction={() =>
                                        dispatch(
                                            expand({
                                                id: chunk.id,
                                                sliceSize: 100,
                                                name: trajectoryName,
                                            })
                                        )
                                    }
                                    propertyCombos={propertyCombos}
                                    extents={extents}
                                    scatterplotHeight={scatterplotHeight}
                                    setZoom={setZoomCallback}
                                    onMouseEnter={highlight}
                                    onMouseLeave={unhighlightTimeline}
                                />
                            ) : (
                                <ViolinPlotWrapper
                                    chunk={chunk}
                                    width={chartW}
                                    height={h}
                                    selectObject={selectObject}
                                    selectedObjects={selectedObjects}
                                    chunkSelectionMode={chunkSelectionMode}
                                    ranks={cutRanks}
                                    properties={properties}
                                    onMouseEnter={highlight}
                                    onMouseLeave={unhighlightTimeline}
                                    onClick={() => setStateHovered(chunk.characteristicState)}
                                />
                            )}
                        </foreignObject>
                    );
                })}
            </svg>
        </Box>
    );
}
export default memo(TrajectoryChart);
