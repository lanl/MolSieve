import { React, memo } from 'react';

import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { tooltip } from '../api/myutils';

let ttInstance;

function ViolinPlot({
    data,
    property,
    width,
    height,
    globalScaleMin,
    globalScaleMax,
    mouseOverText,
    color = 'black',
    showYAxis = true,
    margin = { top: 3, bottom: 3, left: 0, right: 0 },
}) {
    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            if (!data || !data.length) {
                return;
            }

            const yScale = d3
                .scaleLinear()
                .domain([globalScaleMin, globalScaleMax])
                .range([height - margin.bottom, margin.top]);

            let bins = null;
            try {
                bins = d3.bin().domain(yScale.domain())(data);
            } catch (error) {
                return;
            }
            if (showYAxis) {
                svg.call(d3.axisRight(yScale));
            }

            const xScale = d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([-data.length, data.length]);

            svg.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('height', height)
                .attr('width', width)
                .attr('fill', color)
                .classed('unimportant', true);

            svg.append('line')
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', width)
                .attr('y2', 0)
                .attr('stroke', color)
                .attr('stroke-width', 1);

            svg.classed('clickable', true);

            svg.append('path')
                .datum(bins)
                .attr('fill', color)
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
                    ttInstance = tooltip(svg.node(), mouseOverText);
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
        [property, data.length, color, globalScaleMin, globalScaleMax, width, height]
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

export default memo(ViolinPlot);
