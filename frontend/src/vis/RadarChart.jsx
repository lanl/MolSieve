import { React, memo } from 'react';
import * as d3 from 'd3';
import '../css/vis.css';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

import { abbreviate } from '../api/myutils';

const MARGIN = { left: 10, bottom: 15 };

function RadarChart({ data, properties, width, height, globalScale, renderSingle }) {
    const buildAxis = (property, radius) => {
        const gs = globalScale[property];
        const { min, max } = gs;
        const median = d3.median(data, (d) => d[property]);
        return {
            property,
            scale: d3.scaleLinear().range([0, radius]).domain([min, max]),
            min,
            max,
            median,
        };
    };

    const ref = useTrajectoryChartRender(
        (svg) => {
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

            const absMax = d3.max(axes, (d) => d.max);
            const angleSlice = (Math.PI * 2) / axes.length;
            const rScale = d3.scaleLinear().range([0, radius]).domain([0, absMax]);

            const main = svg
                .append('g')
                .attr('transform', `translate(${width / 2}, ${height / 2})`);

            const axisGrid = main.append('g');

            // Create the straight lines radiating outward from the center
            const axis = axisGrid
                .selectAll('.axis')
                .data(axes)
                .enter()
                .append('g')
                .attr('class', 'axis');

            axis.append('line')
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', (_, i) => rScale(absMax) * Math.cos(angleSlice * i - Math.PI / 2))
                .attr('y2', (_, i) => rScale(absMax) * Math.sin(angleSlice * i - Math.PI / 2))
                .attr('class', 'line')
                .style('stroke', 'lightgray')
                .style('stroke-width', '1px');

            const angleToCoord = (angle, value) => {
                const x = Math.cos(angle) * rScale(value);
                const y = Math.sin(angle) * rScale(value);
                return { x, y };
            };

            const linesG = main.append('g');

            const points = [];
            let i = 0;
            for (const a of axes) {
                const angle = angleSlice * i - Math.PI / 2;
                const { x, y } = angleToCoord(angle, a.scale(a.median));
                points.push({ x, y, property: a.property, value: a.median });
                i++;
            }

            const line = d3
                .line()
                .x((d) => d.x)
                .y((d) => d.y)
                .curve(d3.curveCatmullRom.alpha(0.5));

            linesG
                .append('path')
                .datum(points)
                .attr('d', line)
                .attr('fill', 'lightgray')
                .style('stroke', 'black')
                .style('stroke-width', '1px')
                .classed('line', true);

            if (renderSingle) {
                const singlePoints = [];
                let j = 0;
                for (const a of axes) {
                    const angle = angleSlice * j - Math.PI / 2;
                    const { x, y } = angleToCoord(angle, a.scale(renderSingle[a.property]));
                    singlePoints.push({
                        x,
                        y,
                        property: a.property,
                        value: renderSingle[a.property],
                    });
                    j++;
                }

                linesG
                    .append('path')
                    .datum(singlePoints)
                    .attr('d', line)
                    .classed('state', true)
                    .attr('fill', renderSingle.color)
                    .attr('stroke', 'black')
                    .attr('stroke-width', '1px')
                    .classed('line', true);
            }

            // Append the labels at each axis
            axis.append('text')
                .attr('class', 'legend')
                .style('font-size', '8px')
                .attr('text-anchor', 'middle')
                .attr('dy', '0.35em')
                .attr('x', (_, k) => rScale(absMax * 0.95) * Math.cos(angleSlice * k - Math.PI / 2))
                .attr('y', (_, k) => rScale(absMax * 0.95) * Math.sin(angleSlice * k - Math.PI / 2))
                .attr('fill', 'gray')
                .text((d) => abbreviate(d.property))
                .attr('class', 'label');

            svg.on('mouseenter', function () {
                svg.selectAll('.label').attr('fill', 'black');
            }).on('mouseleave', function () {
                svg.selectAll('.label').attr('fill', 'lightgray');
            });
        },
        [data, properties, width, height, globalScale, renderSingle]
    );
    return <svg ref={ref} viewBox={[0, 0, width, height]} width={width} height={height} />;
}

export default memo(RadarChart);
