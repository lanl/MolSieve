import { React } from 'react';

import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { tooltip } from '../api/myutils';

let ttInstance;

export default function ViolinPlot({
    data,
    boxStats,
    property,
    width,
    height,
    margin = { top: 3, bottom: 3, left: 0, right: 0 },
    globalScaleMin,
    globalScaleMax,
    color = 'black',
    showYAxis = true,
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

            // do we even care?
            const { q1, median, q3, iqr } = boxStats;

            const yScale = d3
                .scaleLinear()
                .domain([globalScaleMin, globalScaleMax])
                .range([height - margin.bottom, margin.top]);

            const bins = d3.bin().domain(yScale.domain())(data);

            if (showYAxis) {
                svg.call(d3.axisRight(yScale));
            }

            const xScale = d3
                .scaleLinear()
                .range([margin.left, width - margin.left])
                .domain([-data.length, data.length]);

            svg.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('height', height + 1)
                .attr('width', width)
                .attr('fill', chunk.color)
                .classed('unimportant', true);

            svg.append('line')
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', width)
                .attr('y2', 0)
                .attr('stroke', chunk.color)
                .attr('stroke-width', 1);

            svg.append('path')
                .datum(bins)
                .attr('fill', chunk.color)
                .attr('stroke', 'black')
                .attr(
                    'd',
                    d3
                        .area()
                        .x0((d) => xScale(-d.length))
                        .x1((d) => xScale(d.length))
                        .y((d) => yScale(d.x0))
                        .curve(d3.curveCatmullRom)
                );

            svg.on('mouseover', () => {
                if (!ttInstance) {
                    ttInstance = tooltip(
                        svg.node(),
                        `${chunk.toString()}<br/>
                        <em>${property}</em><br/> 
                        <b>Q1</b>: ${q1}</br> 
                        <b>Median</b>: ${median}</br> 
                        <b>Q3</b>: ${q3}</br>
                        <b>IQR</b>: ${iqr} <br/>`
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
        [
            property,
            JSON.stringify(data),
            JSON.stringify(boxStats),
            color,
            globalScaleMin,
            globalScaleMax,
            width,
            height,
        ]
    );

    return (
        <svg
            ref={ref}
            className="vis"
            viewBox={[0, 0, width, height]}
            width={width}
            height={height}
        />
    );
}
