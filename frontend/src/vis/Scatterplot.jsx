import { React, useEffect, useState } from 'react';
import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

import '../css/vis.css';
import '../css/App.css';

export default function Scatterplot({
    width,
    height,
    colorFunc = () => 'black',
    xAttributeList,
    yAttributeList,
    additionalAttributes,
    onElementClick = () => {},
    onElementMouseOver = () => {},
    onElementMouseOut = () => {},
    selected,
    brush,
    margin = { top: 5, bottom: 10, left: 0, right: 7.5 },
    showYAxis = false,
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

            svg.selectAll('rect')
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
                .on('click', function (_, d) {
                    onElementClick(this, d);
                })
                .on('mouseover', function (_, d) {
                    onElementMouseOver(this, d);
                })
                .on('mouseout', function (_, d) {
                    onElementMouseOut(this, d);
                });

            if (showYAxis) {
                const yAxis = d3
                    .axisLeft()
                    .scale(scaleY)
                    .ticks(height / 30);
                svg.append('g').attr('transform', `translate(${margin.left},0)`).call(yAxis);
            }

            if (brush) {
                const brushG = svg.append('g').classed('brush', true);
                brushG.call(brush);
            }
            // applyFilters(trajectories, runs, ref);
        },
        [JSON.stringify(data), scaleX, scaleY, colorFunc]
    );

    // this should be decoupled
    useEffect(() => {
        d3.select(ref.current).selectAll('.currentSelection').classed('currentSelection', false);

        if (selected) {
            for (const s of selected) {
                const { set, active, highlightValue } = s;
                const start = Math.min(...set);
                const end = Math.max(...set);

                console.log(s);

                if (active) {
                    let states = d3
                        .select(ref.current)
                        .selectAll('.state')
                        .filter((d) => d.x >= start && d.x <= end);

                    if (highlightValue !== undefined) {
                        states = states.filter((d) => d.y === highlightValue);
                    }

                    states.classed('currentSelection', true);
                }
            }
        } else {
            d3.select(ref.current).selectAll('.selection').remove();
        }

        return () => {
            d3.select(ref.current).selectAll('.selection').remove();
            d3.select(ref.current)
                .selectAll('.currentSelection')
                .classed('currentSelection', false);
        };
    }, [JSON.stringify(selected)]);

    return (
        <svg
            ref={ref}
            className="vis filterable"
            viewBox={[0, 0, width, height]}
            width={width}
            height={height}
            onClick={(e) => {
                // on double click
                if (e.detail === 2) {
                    // doubleClickAction();
                }
            }}
        />
    );
}
