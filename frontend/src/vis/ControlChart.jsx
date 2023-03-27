import { React, useMemo, memo } from 'react';
import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
// definitely contributes to slowness
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
        pos: '#67A9CF',
        neg: '#EF8A62',
        norm: '#C6C6C6',
    },
    onClick = () => {},
    onMouseOver = () => {},
    onMouseOut = () => {},
    renderCallback = () => {},
    extents = [0, yAttributeList.length],
}) {
    const scaleX = useMemo(
        () =>
            d3
                .scaleLinear()
                .domain([0, yAttributeList.length - 1])
                .range([margin.left, width - margin.right]),
        []
    );

    const scaleY = useMemo(
        () =>
            d3
                .scaleLinear()
                .domain([globalScaleMin, globalScaleMax])
                .range([height - margin.bottom, margin.top]),
        []
    );

    const colorPath = (svg, color, filterFunc) => {
        const area = d3
            .area()
            .x((_, i) => scaleX(i))
            .y0(height)
            .y1((d) => scaleY(d))
            .defined((d) => !Number.isNaN(d) && filterFunc(d));
        svg.select(`.${color}`).datum(yAttributeList).attr('d', area);
    };

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!yAttributeList) {
                return;
            }
            scaleX.domain([extents[0], extents[1]]).range([margin.left, width - margin.right]);

            scaleY
                .domain([globalScaleMin, globalScaleMax])
                .range([height - margin.bottom, margin.top]);

            if (ucl && !lcl) {
                colorPath(svg, 'ucl', (d) => ucl <= d);
                colorPath(svg, 'norm', (d) => ucl > d);
            } else if (lcl && !ucl) {
                colorPath(svg, 'lcl', (d) => lcl >= d);
                colorPath(svg, 'norm', (d) => lcl < d);
            } else if (ucl && lcl) {
                colorPath(svg, 'norm', (d) => lcl < d && ucl > d);
                colorPath(svg, 'ucl', (d) => ucl <= d);
                colorPath(svg, 'lcl', (d) => lcl >= d);
            } else {
                colorPath(svg, 'norm', () => true);
            }

            const tooltipCircle = svg.select('.tooltipCircle');
            // add value tooltip
            svg.on('mouseenter mousemove', (event) => {
                tooltipCircle.attr('visibility', 'visible');
                const i = Math.trunc(scaleX.invert(d3.pointer(event)[0]));

                const xVal = xAttributeList ? xAttributeList[i] : i;
                const yVal = yAttributeList[i];

                tooltipCircle
                    .attr('cx', scaleX(i))
                    .attr('cy', scaleY(yVal)) // - 2
                    .attr('stroke', 'gray')
                    .attr('fill', 'black')
                    .attr('r', 3);
                onMouseOver(tooltipCircle.node(), [xVal, yVal]);
                // ttInstance.setContent(`<b>X</b>: ${xVal}<br/><b>Y</b>:${yVal.toFixed(2)} <br/>`);
                // ttInstance.show();
            })
                .on('click', (event) => {
                    const i = Math.trunc(scaleX.invert(d3.pointer(event)[0]));
                    const xVal = xAttributeList ? xAttributeList[i] : i;
                    const yVal = yAttributeList[i];
                    onClick(xVal, yVal);
                })
                .on('mouseleave', () => {
                    tooltipCircle.attr('visibility', 'hidden');
                    onMouseOut(tooltipCircle.node());
                    // ttInstance.hide();
                });

            renderCallback();
        },
        [
            JSON.stringify(yAttributeList),
            globalScaleMin,
            globalScaleMax,
            width,
            height,
            extents[0],
            extents[1],
        ]
    );

    const { pos, neg, norm } = colors;
    return (
        <svg
            ref={ref}
            className="vis filterable"
            viewBox={[0, 0, width, height]}
            width={width}
            height={height}
        >
            <path className="ucl" stroke={pos} fill={pos} />
            <path className="lcl" stroke={neg} fill={neg} />
            <path className="norm" stroke={norm} fill={norm} />
            <circle className="tooltipCircle" />
        </svg>
    );
}

export default memo(ControlChart);
