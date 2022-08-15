import { React, useEffect, useState } from 'react';
import * as d3 from 'd3';
import '../css/vis.css';
import Box from '@mui/material/Box';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useResize } from '../hooks/useResize';

const margin = {
    top: 35,
    bottom: 20,
    left: 25,
    right: 25,
};

export default function Legend({ trajectories }) {
    const { width, height, divRef } = useResize();

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (height === undefined || width === undefined) {
                return;
            }
            // clear so we don't draw over-top and cause insane lag

            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            const scaleY = d3
                .scaleLinear()
                .range([margin.top, height - margin.bottom])
                .domain([0, Object.keys(trajectories).length]);

            const g = svg.append('g');
            let count = 0;
            for (const [name, trajectory] of Object.entries(trajectories)) {
                const { colors } = trajectory;

                const trajG = svg.append('g').classed(name, true);

                const scaleX = d3
                    .scaleLinear()
                    .range([margin.left, width - margin.right])
                    .domain([0, colors.length]);

                trajG
                    .selectAll('rect')
                    .data(colors)
                    .enter()
                    .append('rect')
                    .attr('x', (d, i) => {
                        return scaleX(i);
                    })
                    .attr('y', scaleY(count))
                    .attr('height', 5)
                    .attr('width', (_, i) => scaleX(i + 1) - scaleX(i))
                    .attr('fill', (d) => d);

                g.append('text')
                    .attr('x', width / 2)
                    .attr('y', scaleY(count) - 5)
                    .attr('text-anchor', 'middle')
                    .text(name);
                count++;
            }
        },
        [trajectories]
    );

    return (
        <Box ref={divRef}>
            <svg className="vis" id="legend" ref={ref} viewBox={[0, 0, width, height]} />
        </Box>
    );
}
