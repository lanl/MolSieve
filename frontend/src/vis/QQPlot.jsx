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

export default function QQPlot({ dist1, dist2, width, height }) {
    // stolen from https://observablehq.com/@d3/q-q-plot
    const q = (Q, i, n) => {
        if (Q.length === n) return Q[i];
        const j = (i / (n - 1)) * (Q.length - 1);
        const j0 = Math.floor(j);
        const t = j - j0;
        return t ? Q[j0] * (1 - t) + Q[j0 + 1] * t : Q[j0];
    };

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (height === undefined || width === undefined) {
                return;
            }
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            const qx = dist1.sort(d3.ascending);
            const qy = dist2.sort(d3.ascending);

            const qmin = Math.min(d3.min(qx), d3.min(qy));
            const qmax = Math.max(d3.max(qx), d3.max(qy));

            const n = Math.min(qx.length, qy.length);

            const scaleX = d3
                .scaleLinear()
                .domain([qmin, qmax])
                .range([margin.left, width - margin.right]);

            const scaleY = d3
                .scaleLinear()
                .domain([qmin, qmax])
                .range([height - margin.bottom, margin.top]);

            // draw q line
            svg.append('g')
                .append('line')
                .attr('stroke', '#8b8b8b')
                .attr('x1', scaleX(qmin))
                .attr('x2', scaleX(qmax))
                .attr('y1', scaleY(qmin))
                .attr('y2', scaleY(qmax));

            // draw points
            svg.append('g')
                .attr('stroke', '#8b8b8b')
                .attr('fill', 'none')
                .attr('stroke-width', 1.5)
                .selectAll('circle')
                .data(d3.range(n))
                .join('circle')
                .attr('cx', (i) => scaleX(q(qx, i, n)))
                .attr('cy', (i) => scaleY(q(qy, i, n)))
                .attr('opacity', 0.6)
                .attr('r', 2);
        },
        [dist1, dist2, width, height]
    );

    return <svg ref={ref} viewBox={[0, 0, width, height]} />;
}
