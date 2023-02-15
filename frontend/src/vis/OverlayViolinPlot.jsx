import { React, memo } from 'react';

import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

function OverlayViolinPlot({
    data,
    colors,
    width,
    height,
    scaleMin,
    scaleMax,
    margin = { top: 3, bottom: 3, left: 0, right: 0 },
    onElementMouseEnter = () => {},
    onElementMouseLeave = () => {},
}) {
    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            if (!data) {
                return;
            }

            const yScale = d3
                .scaleLinear()
                .domain([scaleMin, scaleMax])
                .range([height - margin.bottom, margin.top]);

            const largestDist = d3.max(data, (d) => d.values.length);

            const xScale = d3
                .scaleLinear()
                .range([margin.left, width - margin.left])
                .domain([-largestDist, largestDist]);

            let i = 0;
            for (const dist of data) {
                const bins = d3.bin().domain(yScale.domain())(dist.values);

                svg.append('path')
                    .datum(bins)
                    .attr('stroke', colors[i])
                    .attr('fill', 'none')
                    .attr(
                        'd',
                        d3
                            .area()
                            .x0((d) => xScale(-d.length))
                            .x1((d) => xScale(d.length))
                            .y((d) => yScale(d.x0))
                            .curve(d3.curveCatmullRom)
                    )
                    .classed('clickable', true)
                    .on('mouseenter', function () {
                        onElementMouseEnter(this, dist);
                    })
                    .on('mouseleave', function () {
                        onElementMouseLeave(this, dist);
                    });
                i++;
            }
        },
        [JSON.stringify(data), scaleMin, scaleMax, width, height]
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

export default memo(OverlayViolinPlot);
