import { React, useState, useEffect, memo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';

import { getChunkList, selectTrajectory, setZoom } from '../api/trajectories';
import '../css/vis.css';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

const margin = {
    top: 25,
    bottom: 20,
    left: 25,
    right: 25,
};

function Timeline({ trajectoryName, width, height }) {
    const dispatch = useDispatch();
    const trajectory = useSelector((state) => selectTrajectory(state, trajectoryName));
    const chunkList = useSelector((state) => getChunkList(state, trajectoryName));

    const [sBrush, setBrush] = useState(null);
    const [xScale, setXScale] = useState(null);
    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                svg.selectAll('*:not(.icon)').remove();
            }

            if (width === undefined || height === undefined) {
                return;
            }
            const { extents } = trajectory;

            const g = svg.append('g');

            const trajG = svg
                .append('g')
                .classed(trajectoryName, true)
                .attr('mask', 'url(#satMask)');
            const defs = svg.append('defs');
            const filter = defs.append('filter').attr('id', 'brushBrightness');
            filter
                .append('feColorMatrix')
                .attr('in', 'unSatMask')
                .attr('result', 'A')
                .attr('type', 'saturate')
                .attr('values', 0.5);
            filter
                .append('feComposite')
                .attr('operator', 'in')
                .attr('in', 'A')
                .attr('in2', 'SourceGraphic');

            const saturatedMask = defs.append('mask').attr('id', 'satMask');
            saturatedMask
                .append('rect')
                .attr('id', 'satMaskRect')
                .attr('x', 0)
                .attr('y', height / 2)
                .attr('width', width)
                .attr('fill', 'white')
                .attr('height', height / 2);

            const unSaturatedMask = defs.append('mask').attr('id', 'unSatMask');
            unSaturatedMask.append('rect').attr('id', `unSatMaskRect_0`);
            unSaturatedMask.append('rect').attr('id', `unSatMaskRect_1`);

            const scaleX = d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([0, trajectory.length]);

            trajG
                .selectAll('rect')
                .data(chunkList)
                .enter()
                .append('rect')
                .attr('x', (d) => scaleX(d.timestep))
                .attr('y', height / 2)
                .attr('height', height / 2)
                .attr('width', (d) => scaleX(d.last) - scaleX(d.timestep))
                .attr('fill', (d) => d.color)
                .classed('unimportant', (d) => !d.important)
                .classed('important', (d) => d.important);

            const unSatTrajG = svg
                .append('g')
                .attr('mask', 'url(#unSatMask)')
                .attr('filter', 'url(#brushBrightness)');

            unSatTrajG
                .selectAll('rect')
                .data(chunkList)
                .enter()
                .append('rect')
                .attr('x', (d) => scaleX(d.timestep))
                .attr('y', height / 2)
                .attr('height', height / 2)
                .attr('width', (d) => scaleX(d.last) - scaleX(d.timestep))
                .attr('fill', (d) => d.color)
                .classed('unimportant', (d) => !d.important)
                .classed('important', (d) => d.important);

            g.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2 - 5)
                .attr('text-anchor', 'middle')
                .text(trajectoryName);

            const defaultSelection = [scaleX(extents[0]), scaleX(extents[1])];

            const updateScale = (start, end) => {
                scaleX.domain([start, end]);
                setXScale(() => scaleX);

                trajG
                    .selectAll('rect')
                    .attr('x', (d) => {
                        return scaleX(d.timestep);
                    })
                    .attr('width', (d) => scaleX(d.last) - scaleX(d.timestep));

                unSatTrajG
                    .selectAll('rect')
                    .attr('x', (d) => {
                        return scaleX(d.timestep);
                    })
                    .attr('width', (d) => scaleX(d.last) - scaleX(d.timestep));
            };

            const brushG = svg.append('g').classed('brushG', true);
            const brush = d3
                .brushX()
                .extent([
                    [0, height * 0.5],
                    [width, height * 0.99],
                ])
                .on('brush', function ({ selection }) {
                    const [start, end] = selection;
                    svg.select('#satMaskRect')
                        .attr('x', start)
                        .attr('y', height / 2)
                        .attr('width', end - start)
                        .attr('fill', 'white')
                        .attr('height', height / 2);

                    svg.select('#unSatMaskRect_0')
                        .attr('x', 0)
                        .attr('y', height / 2)
                        .attr('width', start)
                        .attr('fill', 'white')
                        .attr('height', height / 2);

                    svg.select('#unSatMaskRect_1')
                        .attr('x', end)
                        .attr('y', height / 2)
                        .attr('width', width - end)
                        .attr('fill', 'white')
                        .attr('height', height / 2);
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

            svg.select('.icon')
                .classed('clickable', true)
                .attr('fill', 'lightgray')
                .attr('transform', `translate(${scaleX(0)}, 0)`)
                .on('click', () => {
                    updateScale(0, trajectory.length);
                    trajG.selectAll('.outsideExtent').classed('outsideExtent', false);

                    brushG.call(brush).call(brush.move, [scaleX(0), scaleX(trajectory.length)]);
                    dispatch(setZoom({ name: trajectoryName, extents: [0, trajectory.length] }));
                });

            brushG.call(brush).call(brush.move, defaultSelection);
            setBrush(() => brush);
            setXScale(() => scaleX);
        },
        [JSON.stringify(chunkList), width, height]
    );

    useEffect(() => {
        if (ref.current && sBrush) {
            const { extents } = trajectory;
            const [start, stop] = extents;
            d3.select(ref.current)
                .select('.brushG')
                .call(sBrush)
                .call(sBrush.move, [xScale(start), xScale(stop)]);
        }
    }, [JSON.stringify(trajectory.extents)]);

    // stupid hack but it works
    return (
        <svg ref={ref} viewBox={[0, 0, width, height]}>
            <path
                className="icon"
                d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z"
            />
        </svg>
    );
}

export default memo(Timeline);
