import { React, useEffect, useState } from 'react';
import * as d3 from 'd3';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

import '../css/vis.css';
import '../css/App.css';

import { useExtents } from '../hooks/useExtents';

const MARGIN = { top: 5, bottom: 10, left: 0, right: 5 };

export default function Scatterplot({
    setExtents,
    width,
    height,
    selectionMode,
    onSetExtentsComplete,
    colorFunc,
    xAttributeList,
    yAttributeList,
    onElementClick,
    onElementMouseOver,
    onElementMouseOut,
    selected,
}) {
    const { setInternalExtents, completeSelection } = useExtents(setExtents, onSetExtentsComplete);

    const buildData = () => {
        let listLength;
        if (xAttributeList.length === yAttributeList.length) {
            listLength = xAttributeList.length;
        } else {
            return undefined;
        }

        const dataList = [];
        for (let i = 0; i < listLength; i++) {
            const d = { x: xAttributeList[i], y: yAttributeList[i] };
            dataList.push(d);
        }

        return dataList;
    };
    const [data, setData] = useState(buildData());

    const buildScaleX = () => {
        return () =>
            d3
                .scaleLinear()
                .domain(d3.extent(data, (d) => d.x))
                .range([MARGIN.left, width]);
    };

    const buildScaleY = () => {
        return () =>
            d3
                .scaleLinear()
                .domain(d3.extent(data, (d) => d.y))
                .range([height - MARGIN.bottom, MARGIN.top]);
    };

    useState(() => {
        setData(buildData());
    }, [xAttributeList, yAttributeList]);

    const [scaleX, setScaleX] = useState(buildScaleX());

    useEffect(() => {
        setScaleX(buildScaleX());
    }, [data, width]);

    const [scaleY, setScaleY] = useState(buildScaleY());

    useEffect(() => {
        setScaleY(buildScaleY());
    }, [JSON.stringify(data), height]);

    /* const renderBackgroundColor = (svg, data, color) => {
        svg.append('rect')
            .attr('x', scaleX(data[0]))
            .attr('y', 0)
            .attr('height', height)
            .attr('width', scaleX(data[data.length - 1]) - scaleX(data[0]))
            .attr('fill', color)
            .classed('unimportant', true);
    }; */

    const [sBrush, setSBrush] = useState(null);

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                svg.selectAll('*:not(.brush)').remove();
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

            setSBrush(() =>
                d3
                    .brushX()
                    .keyModifiers(false)
                    .on('start brush', function ({ selection }) {
                        const start = Math.round(scaleX.invert(selection[0]));
                        const end = Math.round(scaleX.invert(selection[1]));

                        d3.select(ref.current)
                            .selectAll('.currentSelection')
                            .classed('currentSelection', false);

                        d3.select(ref.current)
                            .selectAll('.state')
                            .filter((d) => start <= d.x && d.x <= end)
                            .classed('currentSelection', true);
                    })
                    .on('end', function ({ selection }) {
                        const start = Math.round(scaleX.invert(selection[0]));
                        const end = Math.round(scaleX.invert(selection[1]));

                        d3.select(ref.current)
                            .selectAll('.currentSelection')
                            .classed('currentSelection', false);

                        const nodes = data.filter((d) => start <= d.x && d.x <= end);
                        setInternalExtents(nodes);
                        completeSelection();
                    })
            );

            // applyFilters(trajectories, runs, ref);
        },
        [scaleX, scaleY, colorFunc]
    );

    const selectionBrush = () => {
        if (sBrush != null) {
            if (!d3.selectAll('.brush').empty()) {
                d3.selectAll('.brush').remove();
            }

            d3.select(ref.current).append('g').attr('class', 'brush').call(sBrush);
        }
    };

    useEffect(() => {
        if (selectionMode) {
            selectionBrush();
        }
    }, [selectionMode]);

    useEffect(() => {
        d3.select(ref.current).selectAll('.currentSelection').classed('currentSelection', false);

        if (selected) {
            for (const s of selected) {
                const { set, active, highlightValue } = s;
                const start = Math.min(...set);
                const end = Math.max(...set);

                if (active) {
                    d3.select(ref.current)
                        .selectAll('.state')
                        .filter((d) => d.x >= start && d.x <= end)
                        .filter((d) => d.y === highlightValue)
                        .classed('currentSelection', true);
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

Scatterplot.defaultProps = {
    onElementClick: () => {},
    onElementMouseOver: () => {},
    onElementMouseOut: () => {},
    colorFunc: () => 'black',
};
