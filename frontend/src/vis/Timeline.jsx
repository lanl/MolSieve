import { React, useState, useEffect, memo, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';

import { getChunkList, selectTrajectory, setZoom } from '../api/trajectories';
import '../css/vis.css';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

function Timeline({
    trajectoryName,
    width,
    height,
    margin = { top: 5, bottom: 5, left: 25, right: 25 },
    brushMargin = { top: 3, bottom: 3, left: 0, right: 0 },
}) {
    const dispatch = useDispatch();
    const trajectory = useSelector((state) => selectTrajectory(state, trajectoryName));
    const chunkList = useSelector((state) => getChunkList(state, trajectoryName));

    const [sBrush, setBrush] = useState(null);
    const scaleX = useMemo(
        () =>
            d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([0, trajectory.length]),
        [trajectory.length, width]
    );

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                svg.selectAll('*:not(.icon)').remove();
            }

            if (width === undefined || height === undefined) {
                return;
            }

            // this is so if the trajectory does re-render, we don't move the timeline view
            // this should just be set once, but this will get fixed later
            const { extents } = trajectory;
            const defaultSelection = [scaleX(extents[0]), scaleX(extents[1])];

            const adjustedHeight = height - margin.top - margin.bottom - brushMargin.bottom;

            const defs = svg.append('defs');
            const filter = defs.append('filter').attr('id', 'brushBrightness');
            filter
                .append('feColorMatrix')
                .attr('in', `unSatMask_${trajectoryName}`)
                .attr('result', 'A')
                .attr('type', 'saturate')
                .attr('values', 0.25);
            filter
                .append('feComposite')
                .attr('operator', 'in')
                .attr('in', 'A')
                .attr('in2', 'SourceGraphic');

            const saturatedMask = defs.append('mask').attr('id', `satMask_${trajectoryName}`);
            saturatedMask
                .append('rect')
                .attr('id', 'satMaskRect')
                .attr('width', width)
                .attr('fill', 'white')
                .attr('height', height);

            const unSaturatedMask = defs.append('mask').attr('id', `unSatMask_${trajectoryName}`);
            unSaturatedMask.append('rect').attr('id', `unSatMaskRect_0`);
            unSaturatedMask.append('rect').attr('id', `unSatMaskRect_1`);

            // two copies of the same group for the mask trick to work
            svg.append('g')
                .classed(trajectoryName, true)
                .attr('mask', `url(#satMask_${trajectoryName})`);

            svg.append('g')
                .classed(trajectoryName, true)
                .attr('mask', `url(#unSatMask_${trajectoryName})`)
                .attr('filter', 'url(#brushBrightness)');

            svg.selectAll(`.${trajectoryName}`)
                .selectAll('rect')
                .data(chunkList)
                .enter()
                .append('rect')
                .attr('x', (d) => scaleX(d.timestep))
                .attr('id', (d) => `chunk_${d.id}`)
                .attr('y', margin.top + brushMargin.top)
                .attr('height', adjustedHeight - brushMargin.bottom)
                .attr('width', (d) => scaleX(d.last) - scaleX(d.timestep))
                .attr('fill', (d) => d.color)
                .classed('unimportant', (d) => !d.important)
                .classed('blurry', (d) => !d.important)
                .classed('important', (d) => d.important);

            // TODO: get rid of this duplicate
            const updateScale = (start, end) => {
                if (ref) {
                    scaleX.domain([start, end]);

                    d3.select(ref.current)
                        .selectAll(`.${trajectoryName}`)
                        .selectAll('rect')
                        .attr('x', (d) => {
                            return scaleX(d.timestep);
                        })
                        .attr('width', (d) => scaleX(d.last) - scaleX(d.timestep));
                }
            };

            const brushG = svg.append('g').classed('brushG', true);
            const brush = d3
                .brushX()
                .extent([
                    [margin.left, 1],
                    [width - 1, height * 0.99],
                ])
                .on('brush', function ({ selection }) {
                    const [start, end] = selection;
                    svg.select('#satMaskRect')
                        .attr('x', start)
                        .attr('width', end - start)
                        .attr('fill', 'white')
                        .attr('height', height);

                    svg.select('#unSatMaskRect_0')
                        .attr('x', 0)
                        .attr('width', start)
                        .attr('fill', 'white')
                        .attr('height', height);

                    svg.select('#unSatMaskRect_1')
                        .attr('x', end)
                        .attr('width', width - end)
                        .attr('fill', 'white')
                        .attr('height', height);
                })
                .on('end', function ({ selection, sourceEvent }) {
                    if (!sourceEvent) return;
                    const start = Math.trunc(scaleX.invert(selection[0]));
                    const end = Math.trunc(scaleX.invert(selection[1]));
                    dispatch(setZoom({ name: trajectoryName, extents: [start, end] }));

                    // if user double clicks, the timeline will be redrawn
                    svg.on('dblclick', () => {
                        updateScale(start, end);
                        brushG.call(brush).call(brush.move, [scaleX(start), scaleX(end)]);
                    });
                });

            brushG.call(brush).call(brush.move, defaultSelection);

            setBrush(() => brush);
        },
        [JSON.stringify(chunkList), width, height]
    );

    const updateScale = (start, end) => {
        if (ref.current) {
            scaleX.domain([start, end]);

            d3.select(ref.current)
                .selectAll(`.${trajectoryName}`)
                .selectAll('rect')
                .attr('x', (d) => {
                    return scaleX(d.timestep);
                })
                .attr('width', (d) => scaleX(d.last) - scaleX(d.timestep));
        }
    };

    useEffect(() => {
        if (ref.current && sBrush) {
            const { extents } = trajectory;
            const [start, stop] = extents;

            if (start === 0 && stop === trajectory.length) {
                updateScale(start, stop);
            }

            d3.select(ref.current)
                .select('.brushG')
                .call(sBrush)
                .call(sBrush.move, [scaleX(start), scaleX(stop)]);
        }
    }, [JSON.stringify(trajectory.extents)]);

    return <svg ref={ref} viewBox={[0, 0, width, height]} />;
}

export default memo(Timeline);
