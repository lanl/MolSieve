import { React } from 'react';

import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { tooltip } from '../api/myutils';

const margin = { top: 20, bottom: 20, left: 15, right: 20 };

export default function BoxPlot({ data, property, width, height, globalScale, color, showYAxis }) {
    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            if (!data) {
                return;
            }

            const { q1, median, q3, iqr, minThreshold, maxThreshold } = data;
            const adjWidth = width - margin.left - margin.right;
            const center = width / 2;

            const yScale = globalScale;

            if (showYAxis) {
                svg.call(d3.axisRight(yScale));
            }

            // center line
            svg.append('line')
                .attr('x1', center)
                .attr('x2', center)
                .attr('y1', yScale(minThreshold))
                .attr('y2', yScale(maxThreshold))
                .attr('stroke', color);

            // box
            svg.append('rect')
                .attr('x', center - adjWidth / 2)
                .attr('y', yScale(q3))
                .attr('height', yScale(q1) - yScale(q3))
                .attr('width', adjWidth)
                .attr('fill', 'none')
                .attr('stroke', color);

            svg.selectAll('outliers')
                .data([minThreshold, median, maxThreshold])
                .enter()
                .append('line')
                .attr('x1', center - adjWidth / 2)
                .attr('x2', center + adjWidth / 2)
                .attr('y1', (d) => yScale(d))
                .attr('y2', (d) => yScale(d))
                .attr('stroke', color);

            svg.on('mouseover', () =>
                tooltip(
                    svg.node(),
                    `<em>${property}</em><br/> <b>Q1</b>: ${q1} <b>Median</b>: ${median} <b>Q3</b>: ${q3} <b>IQR</b>: ${iqr}`
                )
            );
        },
        [property, data, color]
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
};
