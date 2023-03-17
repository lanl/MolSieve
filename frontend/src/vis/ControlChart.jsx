import { React, useMemo, memo } from 'react';
import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

import { tooltip } from '../api/myutils';

let ttInstance;

function ControlChart({
    globalScaleMin,
    globalScaleMax,
    width,
    height,
    xAttributeList,
    yAttributeList,
    ucl,
    lcl,
    margin = { top: 3, bottom: 2, left: 0, right: 5 },
    colors = {
        posDiff: '#277C3E',
        negDiff: '#A61E11',
        noDiff: '#A3A3A3',
    },
    showMedian = false,
    onClick = () => {},
}) {
    const scaleX = useMemo(
        () =>
            d3
                .scaleLinear()
                .domain([0, yAttributeList.length - 1])
                .range([margin.left, width - margin.right]),
        [yAttributeList.length, width]
    );

    const scaleY = useMemo(
        () =>
            d3
                .scaleLinear()
                .domain([globalScaleMin, globalScaleMax])
                .range([height - margin.bottom, margin.top]),
        [globalScaleMin, globalScaleMax, height]
    );

    const colorPath = (svg, color, filterFunc) => {
        const area = d3
            .area()
            .x((_, i) => scaleX(i))
            .y0(scaleY(globalScaleMin))
            .y1((d) => scaleY(d))
            .defined((d) => filterFunc(d));

        svg.append('path')
            .datum(yAttributeList)
            .attr('stroke', color)
            .attr('fill', color)
            .attr('d', area);
    };

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

            if (!yAttributeList) {
                return;
            }

            const { posDiff, negDiff, noDiff } = colors;

            if (ucl && !lcl) {
                colorPath(svg, posDiff, (d) => ucl <= d);
                colorPath(svg, noDiff, (d) => ucl > d);
            } else if (lcl && !ucl) {
                colorPath(svg, negDiff, (d) => lcl >= d);
                colorPath(svg, noDiff, (d) => lcl < d);
            } else if (ucl && lcl) {
                colorPath(svg, noDiff, (d) => lcl < d && ucl > d);
                colorPath(svg, posDiff, (d) => ucl <= d);
                colorPath(svg, negDiff, (d) => lcl >= d);
            } else {
                colorPath(svg, noDiff, () => true);
            }

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
                const i = d3.bisectCenter(
                    [...Array(yAttributeList.length).keys()],
                    scaleX.invert(d3.pointer(event)[0])
                );
                const xVal = xAttributeList ? xAttributeList[i] : i;
                const yVal = yAttributeList[i];

                tooltipCircle
                    .attr('cx', scaleX(i))
                    .attr('cy', scaleY(yVal))
                    .attr('stroke', 'gray')
                    .attr('fill', 'black')
                    .attr('r', 3);

                if (!ttInstance) {
                    ttInstance = tooltip(tooltipCircle.node(), '');
                }
                ttInstance.setContent(`<b>X</b>: ${xVal}<br/><b>Y</b>:${yVal.toFixed(2)} <br/>`);
                ttInstance.show();
            })
                .on('click', (e) => {
                    const i = d3.bisectCenter(
                        [...Array(yAttributeList.length).keys()],
                        scaleX.invert(d3.pointer(e)[0])
                    );
                    const xVal = xAttributeList ? xAttributeList[i] : i;
                    const yVal = yAttributeList[i];
                    onClick(xVal, yVal);
                })
                .on('mouseenter', () => {
                    tooltipCircle.attr('visibility', 'visible');
                })
                .on('mouseleave', () => {
                    tooltipCircle.attr('visibility', 'hidden');
                    if (ttInstance) {
                        ttInstance.destroy();
                    }
                    ttInstance = undefined;
                });
        },
        [JSON.stringify(yAttributeList), width, height]
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

export default memo(ControlChart);
