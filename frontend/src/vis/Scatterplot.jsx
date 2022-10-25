import { React, useEffect, useState } from 'react';
import * as d3 from 'd3';

import GlobalStates from '../api/globalStates';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

import { onEntityMouseOver, getScale, tooltip } from '../api/myutils';

import '../css/vis.css';
import '../css/App.css';

import { useExtents } from '../hooks/useExtents';

const margin = { top: 5, bottom: 5, left: 0, right: 5 };

let sBrush = null;
let ttInstance;

export default function Scatterplot({
    sequence,
    trajectory,
    stateHovered,
    id,
    trajectoryName,
    setStateClicked,
    setStateHovered,
    setExtents,
    yAttributeListProp = null,
    visibleExtent,
    width,
    height,
    run,
    property,
    movingAverage,
    leftBoundary,
    rightBoundary,
    doubleClickAction,
    includeBoundaries,
    sliceBy,
    showSparkLine,
    globalScale,
    lineColor,
    selectionMode,
    onSetExtentsComplete,
}) {
    const [yAttributeList, setYAttributeList] = useState(yAttributeListProp);

    const { setInternalExtents, completeSelection } = useExtents(setExtents, onSetExtentsComplete);

    const selectionBrush = () => {
        if (sBrush != null) {
            if (!d3.selectAll('.brush').empty()) {
                d3.selectAll('.brush').remove();
            }

            d3.select(ref.current).append('g').attr('class', 'brush').call(sBrush);
        }
    };

    const useAttributeList = (setAttributeList, attribute) => {
        useEffect(() => {
            const uniqueStates = sequence.map((t) => {
                return GlobalStates.get(t.id);
            });

            setAttributeList(
                uniqueStates.map((s) => {
                    return s[attribute];
                })
            );
        }, [attribute, sequence]);
    };

    useEffect(() => {
        if (selectionMode) {
            selectionBrush();
        }
    }, [selectionMode]);

    useAttributeList(setYAttributeList, property);

    useEffect(() => {
        ref.current.setAttribute('id', id);
    }, [id]);

    const renderBackgroundColor = (svg, scaleX, data, color) => {
        svg.append('rect')
            .attr('x', scaleX(data[0]))
            .attr('y', 0)
            .attr('height', height)
            .attr('width', scaleX(data[data.length - 1]) - scaleX(data[0]))
            .attr('fill', color)
            .classed('unimportant', true);
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

                svg.selectAll('*').remove();
            }

            if (yAttributeList === null) {
                return;
            }

            const xAttributeList = sequence.map((d) => {
                return d.timestep;
            });

            const scaleX = d3
                .scaleLinear()
                .domain(d3.extent(xAttributeList))
                .range([margin.left, width]);

            const yAttributeListRender = showSparkLine ? yAttributeList : sequence.map((d) => d.id);
            const yAttributeRender = showSparkLine ? property : 'id';

            const scaleY = showSparkLine
                ? globalScale
                : getScale(yAttributeListRender, yAttributeRender === 'id').range([
                      height - margin.bottom - 5,
                      margin.top,
                  ]);

            if (!showSparkLine) {
                svg.selectAll('rect')
                    .data(sequence)
                    .enter()
                    .append('rect')
                    .attr('x', (_, i) => {
                        return scaleX(xAttributeList[i]);
                    })
                    .attr('y', (_, i) => {
                        return scaleY(yAttributeListRender[i]);
                    })
                    .attr('width', 5)
                    .attr('height', 5)
                    .attr('fill', (d) => {
                        const state = GlobalStates.get(d.id);
                        return state.individualColor;
                    })
                    .classed('state', true)
                    .classed('clickable', true)
                    .on('click', function (_, d) {
                        setStateClicked(d);
                    })
                    .on('mouseover', function (_, d) {
                        const state = GlobalStates.get(d.id);
                        setStateHovered({
                            caller: this,
                            stateID: d,
                            name: trajectoryName,
                        });

                        /* if (trajectory !== undefined) {
                            const fuzzyMemberships =
                                trajectory.fuzzy_memberships[trajectory.current_clustering][d.id];
                            content += `<b>Fuzzy memberships</b>: ${fuzzyMemberships}<br/>`;
                        } */
                        onEntityMouseOver(this, state);
                    })
                    .on('mouseout', function () {
                        setStateHovered(null);
                    });
            } else {
                let leftTimestep;
                let rightTimestep;
                if (includeBoundaries) {
                    const { lSlice, rSlice } = sliceBy;
                    if (leftBoundary) {
                        leftTimestep = leftBoundary.timesteps.slice(
                            leftBoundary.timesteps.length - lSlice,
                            leftBoundary.timesteps.length
                        );
                        renderBackgroundColor(svg, scaleX, leftTimestep, leftBoundary.color);
                    }
                    if (rightBoundary) {
                        rightTimestep = rightBoundary.timesteps.slice(0, rSlice);
                        renderBackgroundColor(svg, scaleX, rightTimestep, rightBoundary.color);
                    }
                }

                // color background with the color of the next chunk
                // helps user see what the chunk is transitioning to
                if (rightBoundary) {
                    let colorBackground = xAttributeList;
                    if (includeBoundaries) {
                        // need to remove this from the list so that the colors do not overlap
                        if (leftBoundary) {
                            colorBackground = colorBackground.slice(leftTimestep.length + 1);
                        }
                        colorBackground = colorBackground.slice(
                            0,
                            colorBackground.length - rightTimestep.length + 1
                        );
                    }
                    renderBackgroundColor(svg, scaleX, colorBackground, rightBoundary.color);
                }

                const mv = [];

                const line = d3
                    .line()
                    .x((d) => scaleX(d.x))
                    .y((d) => scaleY(d.y))
                    .curve(d3.curveCatmullRom.alpha(0.5));

                /*                for (let i = 0; i < sequence.length; i++) {
                    const d = { x: xAttributeList[i], y: yAttributeListRender[i] };
                    if (d.y === undefined) {
                        console.log(sequence[i], GlobalStates.get(sequence[i].id));
                    }

                    datum.push(d);
                } */

                for (let i = 0; i < movingAverage.length; i++) {
                    const d = { x: xAttributeList[i], y: movingAverage[i] };
                    mv.push(d);
                }
                // sparkline
                /* svg.append('path')
                    .datum(datum)
                    .attr('d', line)
                    .attr('stroke', 'black')
                    .attr('fill', 'none'); */

                // moving average line
                svg.append('path')
                    .datum(mv)
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

                // median line
                const median = d3.median(yAttributeListRender);
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

                const tooltipCircle = svg.selectAll('circle').data([0]).enter().append('circle');

                // add value tooltip
                svg.on('mousemove', (event) => {
                    const i = d3.bisectCenter(xAttributeList, scaleX.invert(d3.pointer(event)[0]));
                    const timestep = xAttributeList[i];
                    const value = movingAverage[i];
                    const stateID = trajectory.sequence[i];

                    tooltipCircle
                        .attr('cx', scaleX(timestep))
                        .attr('cy', scaleY(value))
                        .attr('stroke', 'gray')
                        .attr('fill', 'black')
                        .attr('r', 3);

                    if (!ttInstance) {
                        ttInstance = tooltip(tooltipCircle.node(), '');
                    }
                    ttInstance.setContent(
                        `<b>Timestep</b>: ${timestep}<br/><b>${property}</b>: ${value.toFixed(
                            2
                        )} <br/><b>ID</b>: ${stateID}<br/>`
                    );
                    ttInstance.show();
                });

                svg.on('mouseenter', () => {
                    tooltipCircle.attr('visibility', 'visible');
                });
                // clean up memory
                svg.on('mouseleave', () => {
                    tooltipCircle.attr('visibility', 'hidden');
                    ttInstance.destroy();
                    ttInstance = undefined;
                });
            }

            // add chunk id for debugging
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', margin.top + margin.bottom)
                .text(`${id}`);

            sBrush = d3
                .brushX()
                .keyModifiers(false)
                .on('start brush', function ({ selection }) {
                    const start = Math.round(scaleX.invert(selection[0]));
                    const end = Math.round(scaleX.invert(selection[1]));

                    if (!showSparkLine) {
                        d3.select(ref.current)
                            .selectAll('.currentSelection')
                            .classed('currentSelection', false);

                        d3.select(ref.current)
                            .selectAll('rect')
                            .filter((d) => start <= d.timestep && d.timestep <= end)
                            .classed('currentSelection', true);
                    }
                })
                .on('end', function ({ selection }) {
                    const start = Math.round(scaleX.invert(selection[0]));
                    const end = Math.round(scaleX.invert(selection[1]));

                    if (!showSparkLine) {
                        d3.select(ref.current)
                            .selectAll('.currentSelection')
                            .classed('currentSelection', false);
                    }
                    // just one selection at a time... makes it a LOT easier
                    const nodes = [start, end];
                    setInternalExtents((prev) => [...prev, { states: nodes }]);
                    completeSelection();
                });
            // applyFilters(trajectories, runs, ref);
        },
        [yAttributeList, trajectory, run, showSparkLine, property, width, globalScale]
    );

    useEffect(() => {
        // need faster solution for this to be smoother
        if (stateHovered) {
            /* d3.select(ref.current)
                .selectAll('rect:not(.invisible)')
                .filter(function (dp) {
                    return dp.id !== stateHovered.stateID;
                })
                .classed('highlightedInvisible', true);

            d3.select(ref.current)
                .selectAll('rect:not(.highlightedInvisible)')
                .classed('highlightedStates', true);

            d3.select(ref.current)
                .selectAll('rect')
                .filter((d) => d.id === stateHovered.stateID)
                .classed('highlightedState', true);
        } else {
            d3.select(ref.current)
                .selectAll('.highlightedInvisible')
                .classed('highlightedInvisible', false);
            d3.select(ref.current)
                .selectAll('.highlightedStates')
                .classed('highlightedStates', false);
            d3.select(ref.current)
                .selectAll('.highlightedState')
                .classed('highlightedState', false); */
        }
    }, [stateHovered]);

    /* useEffect(() => {
        if (ref && ref.current && trajectoryName !== undefined) {
             }

        if (loadingCallback !== undefined) {
            loadingCallback();
        }
    }, [runs]); */

    /* useEffect(() => {
        d3.select(ref.current).selectAll('.currentSelection').classed('currentSelection', false);

        if (visibleExtent) {
            for (const e of visibleExtent) {
                d3.select(ref.current)
                    .selectAll('rect')
                    .filter((d) => {
                        const ids = e.states.map((s) => s.id);
                        return ids.includes(d.id);
                    })
                    .classed('currentSelection', true);
            }
        }
    }, [visibleExtent]); */

    return (
        <svg
            ref={ref}
            id={id}
            className="vis filterable"
            viewBox={[0, 0, width, height]}
            width={width}
            height={height}
            onClick={(e) => {
                // on double click
                if (e.detail === 2) {
                    doubleClickAction();
                }
            }}
        />
    );
}

Scatterplot.defaultProps = {
    lineColor: 'black',
};
