import { React } from 'react';
import * as d3 from 'd3';
import '../css/vis.css';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

const margin = {
    top: 25,
    bottom: 20,
    left: 25,
    right: 25,
};

export default function Timeline({ trajectory, width, height, run, setExtent }) {
    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            if (width === undefined || height === undefined) {
                return;
            }

            const g = svg.append('g');
            const { chunkList, sequence, name } = trajectory;
            const { extents } = run;

            const topChunkList = chunkList.filter((d) => !d.hasParent);
            const trajG = svg.append('g').classed(name, true);

            const scaleX = d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([0, sequence.length]);

            trajG
                .selectAll('rect')
                .data(topChunkList)
                .enter()
                .append('rect')
                .attr('x', (d) => {
                    return scaleX(d.timestep);
                })
                .attr('y', height / 2)
                .attr('height', 5)
                .attr('width', (d) => scaleX(d.last) - scaleX(d.timestep))
                .attr('fill', (d) => trajectory.colorByCluster(d))
                .classed('unimportant', (d) => !d.important)
                .classed('important', (d) => d.important);

            g.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2 - 5)
                .attr('text-anchor', 'middle')
                .text(name);

            const defaultSelection = [scaleX(extents[0]), scaleX(extents[1])];

            const brushG = svg.append('g');

            const brush = d3
                .brushX()
                .extent([
                    [margin.left, 0],
                    [width - margin.right, height],
                ])
                .on('brush', function ({ selection }) {
                    const start = Math.round(scaleX.invert(selection[0]));
                    const end = Math.round(scaleX.invert(selection[1]));
                    setExtent(name, [start, end]);
                })
                .on('end', function ({ selection }) {
                    if (!selection) {
                        brushG.call(brush.move, defaultSelection);
                    }
                });

            brushG.call(brush).call(brush.move, defaultSelection);
        },
        [trajectory, width, height, run, run.chunkingThreshold, trajectory.current_clustering]
    );

    return <svg id={`timeline_${trajectory.name}`} ref={ref} viewBox={[0, 0, width, height]} />;
}
