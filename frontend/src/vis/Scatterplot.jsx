import { React, useEffect, useState, memo } from 'react';
import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

import '../css/vis.css';
import '../css/App.css';

/**
 * A scatterplot of x vs y values.
 *
 * TODO: Rename
 * @param {Array<Number>} xAttributeList - X values for the sequence.
 * @param {Array<Number>} yAttributeList - Y values for the sequence.
 * @param {Array<Object>} additionalAttributes - Additional values for each x-y pair.
 * @param {Function} brush - Brush function that can be called.
 * @param {Function} colorFunc - Function to color each x-y pair.
 * @param {Function} onElementClick - Function called when an element is clicked.
 * @param {Function} onElementMouseOver - Function called when an element is moused over.
 * @param {Function} onElementMouseOut - Function called when an element is left.
 * @param {Bool} showLine - Draw lines between adjacent elements?
 * @param {Bool} showYAxis - Show Y Axis?
 * @param {String} id - This plot's unique ID.
 */
function Scatterplot({
    width,
    height,
    xAttributeList,
    yAttributeList,
    additionalAttributes,
    brush,
    colorFunc = () => 'black',
    onElementClick = () => {},
    onElementMouseOver = () => {},
    onElementMouseOut = () => {},
    margin = { top: 5, bottom: 10, left: 0, right: 7.5 },
    showLine = false,
    showYAxis = false,
    id = '',
}) {
    const buildScaleX = () => {
        const marginLeft = showYAxis ? margin.left + 7.5 : margin.left;
        return () =>
            d3
                .scaleLinear()
                .domain(d3.extent(xAttributeList))
                .range([marginLeft, width - margin.right]);
    };

    const buildScaleY = () => {
        return () =>
            d3
                .scaleLinear()
                .domain(d3.extent(yAttributeList))
                .range([height - margin.bottom, margin.top]);
    };

    const buildData = () => {
        if (!xAttributeList || !yAttributeList) {
            return undefined;
        }
        const mv = [];
        for (let i = 0; i < yAttributeList.length; i++) {
            const d = { x: xAttributeList[i], y: yAttributeList[i] };
            if (additionalAttributes) {
                mv.push(Object.assign(d, additionalAttributes[i]));
            } else {
                mv.push(d);
            }
        }
        return mv;
    };

    const [data, setData] = useState(buildData());

    useEffect(() => {
        setData(buildData());
    }, [
        JSON.stringify(xAttributeList),
        JSON.stringify(yAttributeList),
        JSON.stringify(additionalAttributes),
    ]);

    const [scaleX, setScaleX] = useState(buildScaleX());

    useEffect(() => {
        setScaleX(buildScaleX());
    }, [JSON.stringify(data), width]);

    const [scaleY, setScaleY] = useState(buildScaleY());

    useEffect(() => {
        setScaleY(buildScaleY());
    }, [JSON.stringify(data), height]);

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            if (!data) {
                return;
            }

            const points = svg
                .selectAll('rect')
                .data(data)
                .enter()
                .append('rect')
                .attr('x', (d) => {
                    return scaleX(d.x);
                })
                .attr('y', (d) => {
                    return scaleY(d.y);
                })
                .attr('width', 5)
                .attr('height', 5)
                .attr('fill', (d) => {
                    return colorFunc(d);
                })
                .classed('state', true)
                .classed('clickable', true)
                .on('click', function (e, d) {
                    onElementClick(this, d);
                })
                .on('mouseover', function (_, d) {
                    onElementMouseOver(this, d);
                })
                .on('mouseout', function (_, d) {
                    onElementMouseOut(this, d);
                });

            points.each(function (d, i, nodes) {
                d3.select(nodes[i]).classed(`x-${d.x}`, true).classed(`y-${d.y}`, true);
            });

            if (showYAxis) {
                const yAxis = d3
                    .axisLeft()
                    .scale(scaleY)
                    .ticks(height / 30);
                svg.append('g').attr('transform', `translate(${margin.left},0)`).call(yAxis);
            }

            if (showLine) {
                const line = d3
                    .line()
                    .x((d) => scaleX(d.x))
                    .y((d) => scaleY(d.y) + 2.5)
                    .curve(d3.curveBumpX);

                svg.append('path')
                    .datum(data)
                    .attr('d', (d) => {
                        return line(d);
                    })
                    .attr('stroke', '#C6C6C6')
                    .attr('fill', 'none');
            }

            if (brush) {
                const brushG = svg.append('g').classed('brush', true);
                brushG.call(brush);
            }
        },
        [scaleX, scaleY, colorFunc]
    );

    return (
        <svg
            id={id}
            ref={ref}
            className="vis filterable scatterplot"
            viewBox={[0, 0, width, height]}
            width={width}
            height={height}
        />
    );
}

export default memo(Scatterplot);
