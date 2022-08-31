import { React } from 'react';

import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import GlobalStates from '../api/globalStates';
import { tooltip } from '../api/myutils';

const margin = { top: 20, bottom: 20, left: 25, right: 25 };

export default function BoxPlot({ data, property, width, height, globalScale }) {
    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            const adjWidth = width - margin.left - margin.right;
            const center = width / 2;

            const accessor = (d) => d[property];

            // technically, we would want the higher level components to manage the data...
            const states = data.map((id) => GlobalStates.get(id));
            const sorted = d3.sort(states, accessor);

            const q1 = d3.quantile(sorted, 0.25, accessor);
            const median = d3.median(sorted, accessor);
            const q3 = d3.quantile(sorted, 0.75, accessor);
            // const iqr = q3 - q1;
            const minThreshold = d3.min(sorted, accessor); // q1 - 1.5 * iqr;
            const maxThreshold = d3.max(sorted, accessor); // q1 + 1.5 * iqr;

            // calculate correct scale - do the outliers go past the threshold lines?
            /* const domain = [];
            domain.push(minThreshold < min ? minThreshold : min);
            domain.push(maxThreshold < max ? max : maxThreshold); */

            // could be an option later
            /* const yScale = d3
                .scaleLinear()
                .domain([minThreshold, maxThreshold])
                .range([height - margin.bottom, margin.top]); */

            const yScale = globalScale;

            svg.call(d3.axisRight(yScale));

            // center line
            svg.append('line')
                .attr('x1', center)
                .attr('x2', center)
                .attr('y1', yScale(minThreshold))
                .attr('y2', yScale(maxThreshold))
                .attr('stroke', 'black');

            // box
            svg.append('rect')
                .attr('x', center - adjWidth / 2)
                .attr('y', yScale(q3))
                .attr('height', yScale(q1) - yScale(q3))
                .attr('width', adjWidth)
                .attr('fill', 'none')
                .attr('stroke', 'black');

            svg.selectAll('outliers')
                .data([minThreshold, median, maxThreshold])
                .enter()
                .append('line')
                .attr('x1', center - adjWidth / 2)
                .attr('x2', center + adjWidth / 2)
                .attr('y1', (d) => yScale(d))
                .attr('y2', (d) => yScale(d))
                .attr('stroke', 'black');

            svg.on('mouseover', () => tooltip(svg.node(), `${property}`));
        },
        [property, data]
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
