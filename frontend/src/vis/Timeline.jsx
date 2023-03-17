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
    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            if (width === undefined || height === undefined) {
                return;
            }
            const { extents } = trajectory;

            const g = svg.append('g');

            const trajG = svg.append('g').classed(trajectoryName, true);

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
                .attr('height', 5)
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

            const brushG = svg.append('g').classed('brushG', true);
            const brush = d3
                .brushX()
                .extent([
                    [margin.left, 0],
                    [width - margin.right, height],
                ])
                .on('end', function ({ selection, sourceEvent }) {
                    if (!sourceEvent) return;
                    const start = Math.trunc(scaleX.invert(selection[0]));
                    const end = Math.trunc(scaleX.invert(selection[1]));
                    dispatch(setZoom({ name: trajectoryName, extents: [start, end] }));

                    // if user double clicks, the timeline will be redrawn
                    svg.on('dblclick', () => {
                        scaleX.domain([start, end]);
                        trajG
                            .selectAll('rect')
                            .attr('x', (d) => {
                                return scaleX(d.timestep);
                            })
                            .attr('width', (d) => scaleX(d.last) - scaleX(d.timestep));
                        brushG.call(brush).call(brush.move, [scaleX(start), scaleX(end)]);
                    });
                });

            g.append('text')
                .attr('x', 0)
                .attr('y', height * 0.35)
                .text('Reset')
                .classed('clickable', true)
                .attr('fill', 'lightgray')
                .on('click', () => {
                    scaleX.domain([0, trajectory.length]);
                    trajG
                        .selectAll('rect')
                        .attr('x', (d) => {
                            return scaleX(d.timestep);
                        })
                        .attr('width', (d) => scaleX(d.last) - scaleX(d.timestep));
                    brushG.call(brush).call(brush.move, [scaleX(0), scaleX(trajectory.length)]);
                    dispatch(setZoom({ name: trajectoryName, extents: [0, trajectory.length] }));
                });

            brushG.call(brush).call(brush.move, defaultSelection);
            setBrush(() => brush);
        },
        [JSON.stringify(chunkList), width, height]
    );

    useEffect(() => {
        if (ref.current && sBrush) {
            const { extents } = trajectory;
            const [start, stop] = extents;
            const scaleX = d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([0, trajectory.length]);

            d3.select(ref.current)
                .select('.brushG')
                .call(sBrush)
                .call(sBrush.move, [scaleX(start), scaleX(stop)]);
        }
    }, [JSON.stringify(trajectory.extents)]);

    return <svg ref={ref} viewBox={[0, 0, width, height]} />;
}

export default memo(Timeline);
