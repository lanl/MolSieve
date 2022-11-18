import { React } from 'react';

import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { tooltip } from '../api/myutils';

const MARGIN = { top: 5, bottom: 10, left: 0, right: 0 };

const BOXPLOT_HEIGHT = 20;

let ttInstance;

export default function BoxPlot({
    data,
    property,
    width,
    height,
    globalScaleMin,
    globalScaleMax,
    color,
    showYAxis,
    chunk,
}) {
    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            if (!data) {
                return;
            }

            const { q1, median, q3, iqr, minThreshold, maxThreshold } = data;
            const adjWidth = width - MARGIN.left - MARGIN.right;
            const center = width / 2;

            const yScale = d3
                .scaleLinear()
                .domain([globalScaleMin, globalScaleMax])
                .range([height, MARGIN.top]);

            if (showYAxis) {
                svg.call(d3.axisRight(yScale));
            }

            // center line
            /* svg.append('line')
                .attr('x1', center)
                .attr('x2', center)
                .attr('y1', yScale(minThreshold))
                .attr('y2', yScale(maxThreshold))
                .attr('stroke', color); */

            // background color
            svg.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('height', height)
                .attr('width', width)
                .attr('fill', chunk.color)
                .classed('unimportant', true);

            // box
            svg.append('rect')
                .attr('x', center - adjWidth / 2)
                .attr('y', yScale(q3))
                .attr('height', yScale(q1) - yScale(q3))
                .attr('width', adjWidth)
                .attr('fill', '#ededed');

            svg.selectAll('outliers')
                .data([q1, q3])
                .enter()
                .append('line')
                .attr('x1', center - adjWidth / 2)
                .attr('x2', center + adjWidth / 2)
                .attr('y1', (d) => yScale(d))
                .attr('y2', (d) => yScale(d))
                .attr('stroke-width', 1.5)
                .attr('stroke', '#8b8b8b');

            svg.selectAll('median')
                .data([median])
                .enter()
                .append('line')
                .attr('x1', center - adjWidth / 2)
                .attr('x2', center + adjWidth / 2)
                .attr('y1', (d) => yScale(d))
                .attr('y2', (d) => yScale(d))
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', 4)
                .attr('stroke', 'red');

            svg.on('mouseover', () => {
                if (!ttInstance) {
                    ttInstance = tooltip(
                        svg.node(),
                        `${chunk.toString()}<br/><em>${property}</em><br/> <b>Q1</b>: ${q1} <b>Median</b>: ${median} <b>Q3</b>: ${q3} <b>IQR</b>: ${iqr}`
                    );
                }
                ttInstance.show();
            });
            svg.on('mouseleave', () => {
                if (ttInstance) {
                    ttInstance.destroy();
                }
                ttInstance = undefined;
            });
        },
        [property, data, color, globalScaleMin, globalScaleMax, width, height]
    );

    return (
        <svg
            ref={ref}
            className="vis filterable"
            viewBox={[0, 0, width, height]}
            width={width}
            height={height}
        />
    );
}

BoxPlot.defaultProps = {
    color: 'black',
    showYAxis: true,
    height: BOXPLOT_HEIGHT,
};
