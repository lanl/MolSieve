import { React, useEffect, useState } from 'react';
import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { SPARKLINE_CHART_HEIGHT } from '../api/constants';

import { tooltip } from '../api/myutils';

let ttInstance;
const MARGIN = { top: 5, bottom: 10, left: 0, right: 5 };

export default function SparkLine({
    globalScaleMin,
    globalScaleMax,
    width,
    height,
    xAttributeList,
    yAttributeList,
    lineColor,
    title,
    showMedian,
}) {
    const buildScaleX = () => {
        return () => d3.scaleLinear().domain(d3.extent(xAttributeList)).range([MARGIN.left, width]);
    };

    const buildScaleY = () => {
        return () => d3.scaleLinear().domain([globalScaleMin, globalScaleMax]).range([height, 5]);
    };

    const [scaleX, setScaleX] = useState(buildScaleX());

    useEffect(() => {
        setScaleX(buildScaleX());
    }, [xAttributeList, width]);

    const [scaleY, setScaleY] = useState(buildScaleY());

    useEffect(() => {
        setScaleY(buildScaleY());
    }, [height, globalScaleMin, globalScaleMax]);

    const buildData = () => {
        if (!yAttributeList) {
            return undefined;
        }
        const mv = [];
        for (let i = 0; i < yAttributeList.length; i++) {
            const d = { x: xAttributeList[i], y: yAttributeList[i] };
            mv.push(d);
        }
        return mv;
    };

    const [data, setData] = useState(buildData());

    useEffect(() => {
        setData(buildData());
    }, [xAttributeList, yAttributeList]);

    const line = d3
        .line()
        .x((d) => scaleX(d.x))
        .y((d) => scaleY(d.y))
        .curve(d3.curveCatmullRom.alpha(0.5));

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                // clean up listeners
                if (ttInstance) {
                    ttInstance.hide();
                    ttInstance.destroy();
                    ttInstance = undefined;
                }
                svg.on('mouseenter', null);
                svg.on('mousemove', null);
                svg.on('mouseleave', null);

                svg.selectAll('*:not(.brush)').remove();
            }

            if (!data) {
                return;
            }

            // moving average line
            svg.append('path')
                .datum(data)
                .attr('d', line)
                .attr('stroke', '#8b8b8b')
                .attr('fill', lineColor)
                .attr(
                    'd',
                    d3
                        .area()
                        .x((d) => scaleX(d.x))
                        .y0(scaleY(0))
                        .y1((d) => scaleY(d.y))
                );

            if (showMedian) {
                const median = d3.median(yAttributeList);
                svg.selectAll('median')
                    .data([median])
                    .enter()
                    .append('line')
                    .attr('x1', scaleX(0))
                    .attr('x2', width)
                    .attr('y1', (d) => scaleY(d))
                    .attr('y2', (d) => scaleY(d))
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', 4)
                    .attr('stroke', 'red');
            }

            const tooltipCircle = svg.selectAll('circle').data([0]).enter().append('circle');

            // add value tooltip
            svg.on('mousemove', (event) => {
                const i = d3.bisectCenter(xAttributeList, scaleX.invert(d3.pointer(event)[0]));
                const xVal = xAttributeList[i];
                const yVal = yAttributeList[i];

                tooltipCircle
                    .attr('cx', scaleX(xVal))
                    .attr('cy', scaleY(yVal))
                    .attr('stroke', 'gray')
                    .attr('fill', 'black')
                    .attr('r', 3);

                if (!ttInstance) {
                    ttInstance = tooltip(tooltipCircle.node(), '');
                }
                ttInstance.setContent(`<b>X</b>: ${xVal}<br/><b>Y</b>:${yVal.toFixed(2)} <br/>`);
                ttInstance.show();
            });

            svg.on('mouseenter', () => {
                tooltipCircle.attr('visibility', 'visible');
            });
            // clean up memory
            svg.on('mouseleave', () => {
                tooltipCircle.attr('visibility', 'hidden');
                if (ttInstance) {
                    ttInstance.destroy();
                }
                ttInstance = undefined;
            });

            svg.append('text')
                .attr('x', width / 2)
                .attr('y', MARGIN.top + MARGIN.bottom)
                .text(`${title}`);
        },
        [scaleX, scaleY, data]
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

SparkLine.defaultProps = {
    lineColor: 'black',
    height: SPARKLINE_CHART_HEIGHT,
    showMedian: false,
};
