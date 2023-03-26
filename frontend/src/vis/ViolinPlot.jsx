import { React, memo } from 'react';

import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

function ViolinPlot({
    data,
    property,
    width,
    height,
    globalScaleMin,
    globalScaleMax,
    color = 'black',
    showYAxis = true,
    margin = { top: 3, bottom: 3, left: 3, right: 3 },
    onMouseEnter = () => {},
    onMouseLeave = () => {},
}) {
    const ref = useTrajectoryChartRender(
        (svg) => {
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

            svg.classed('clickable', true);

            svg.select('path')
                .datum(bins)
                .attr(
                    'd',
                    d3
                        .area()
                        .x0((d) => xScale(-d.length))
                        .x1((d) => xScale(d.length))
                        .y((d) => yScale(d.x0))
                        .curve(d3.curveCatmullRom)
                );

            svg.on('mouseenter', () => {
                onMouseEnter(svg.node());
            });
            svg.on('mouseleave', () => {
                onMouseLeave(svg.node());
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
        >
            <rect x={0} y={0} height={height} width={width} fill={color} className="unimportant" />
            <line x1={0} y1={0} x2={width} y2={0} stroke={color} strokeWidth={1} />
            <path fill={color} stroke="black" />
        </svg>
    );
}

export default memo(ViolinPlot);
