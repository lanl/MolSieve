import { React } from 'react';
import * as d3 from 'd3';
import '../css/vis.css';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { wrap } from '../api/myutils';

const MARGIN = { left: 0, bottom: 5 };

export default function Legend({ data, properties, width, height }) {
    const buildAxis = (property, radius) => {
        const x = d3.extent(data, (d) => d[property]);
        return { property, scale: d3.scaleLinear().range([0, radius]).domain([x[0], x[1]]) };
    };

    const ref = useTrajectoryChartRender((svg) => {
        if (!svg.empty()) {
            svg.selectAll('*').remove();
        }

        if (width === undefined || height === undefined) {
            return;
        }

        if (!data || data.length === 0) {
            return;
        }

        const radius = Math.min(width / 2 - MARGIN.left, height / 2 - MARGIN.bottom);

        const axes = properties.map((property) => buildAxis(property, radius));

        const absMax = axes.reduce(
            (previousScale, thisScale) =>
                previousScale > thisScale.scale.domain()[1]
                    ? previousScale
                    : thisScale.scale.domain()[1],
            axes[0].scale.domain()
        );

        const angleSlice = (Math.PI * 2) / axes.length;

        const rScale = d3.scaleLinear().range([0, radius]).domain([0, absMax]);

        const main = svg
            .append('g')
            .attr(
                'transform',
                `translate(${width / 2 + MARGIN.left}, ${height / 2 - MARGIN.bottom})`
            );

        const axisGrid = main.append('g');

        // Create the straight lines radiating outward from the center
        const axis = axisGrid
            .selectAll('.axis')
            .data(axes)
            .enter()
            .append('g')
            .attr('class', 'axis');

        // Append the lines
        axis.append('line')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', (_, i) => rScale(absMax * 1.1) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr('y2', (_, i) => rScale(absMax * 1.1) * Math.sin(angleSlice * i - Math.PI / 2))
            .attr('class', 'line')
            .style('stroke', 'lightgray')
            .style('stroke-width', '1px');

        // Append the labels at each axis
        axis.append('text')
            .attr('class', 'legend')
            .style('font-size', '9px')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('x', (_, i) => rScale(absMax * 1.25) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr('y', (_, i) => rScale(absMax * 1.25) * Math.sin(angleSlice * i - Math.PI / 2))
            .text((d) => d.property)
            .call(wrap, 10);

        // for each state, get its xy position for each property, then draw a line between each point

        const angleToCoord = (angle, value) => {
            const x = Math.cos(angle) * rScale(value);
            const y = Math.sin(angle) * rScale(value);
            return { x, y };
        };

        const gLines = main.append('g');
        const lines = [];
        for (const d of data) {
            const points = [];
            let i = 0;
            for (const a of axes) {
                const angle = angleSlice * i - Math.PI / 2;
                points.push(angleToCoord(angle, d[a.property]));
                i++;
            }
            lines.push({ points, color: d.individualColor });
        }

        const lineGen = d3
            .line()
            .x((d) => d.x)
            .y((d) => d.y);

        gLines
            .selectAll('.line')
            .data(lines)
            .enter()
            .append('path')
            .attr('d', (d) => lineGen(d.points))
            .attr('stroke', (d) => d.color)
            .attr('fill', 'none');
    });
    return <svg ref={ref} viewBox={[0, 0, width, height]} width={width} height={height} />;
}
