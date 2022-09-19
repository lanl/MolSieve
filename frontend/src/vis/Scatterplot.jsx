import { React, useEffect, useState } from 'react';
import * as d3 from 'd3';

import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

import GlobalStates from '../api/globalStates';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

import { onEntityMouseOver, getScale } from '../api/myutils';

import '../css/vis.css';
import '../css/App.css';

import BoxPlot from './BoxPlot';
import { useExtents } from '../hooks/useExtents';

const margin = { top: 25, bottom: 20, left: 30, right: 20 };
const sBrush = null;
let individualSelectionMode = false;
let selectionBrushMode = false;

export default function Scatterplot({
    sequence,
    trajectories,
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
    runs,
    isParentHovered,
    property,
    globalScale,
    movingAverage,
    leftBoundary,
    rightBoundary,
    toggleExpanded,
    includeBoundaries,
    sliceBy,
}) {
    const [yAttributeList, setYAttributeList] = useState(yAttributeListProp);

    const [showSparkLine, setSparkLine] = useState(true);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        setIsHovered(isParentHovered);
    }, [isParentHovered]);

    const toggleSparkLine = () => {
        setSparkLine(!showSparkLine);
    };

    const { setInternalExtents, completeSelection } = useExtents(setExtents);

    const selectionBrush = () => {
        if (sBrush != null) {
            if (!d3.selectAll('.brush').empty()) {
                d3.selectAll('.brush').remove();
            }

            d3.select(ref.current).append('g').attr('class', 'brush').call(sBrush);
        }
    };

    const toggleSelectionBrush = () => {
        if (!selectionBrushMode) {
            selectionBrushMode = !selectionBrushMode;
            selectionBrush();
        } else {
            selectionBrushMode = !selectionBrushMode;
            completeSelection();
        }
    };

    const toggleIndividualSelectionMode = () => {
        individualSelectionMode = !individualSelectionMode;
        if (individualSelectionMode) {
            completeSelection();
            d3.select(ref.current)
                .selectAll('.currentSelection')
                .classed('currentSelection', false);
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
        }, [GlobalStates, attribute, sequence]);
    };

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
            .attr('fill', color);
    };

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            if (yAttributeList === null) {
                return;
            }

            const xAttribute = 'timestep';
            const xAttributeList = sequence.map((d) => {
                return d.timestep;
            });

            const scaleX = getScale(xAttributeList, xAttribute === 'timestep').range([
                margin.left + 5,
                width - margin.right,
            ]);

            const yAttributeListRender = showSparkLine ? yAttributeList : sequence.map((d) => d.id);
            const yAttributeRender = showSparkLine ? property : 'id';

            const scaleY = showSparkLine
                ? globalScale
                : getScale(yAttributeListRender, yAttributeRender === 'id').range([
                      height - margin.bottom - 5,
                      margin.top,
                  ]);

            const container = svg.append('g').attr('transform', 'translate(0,0)');

            if (trajectoryName !== undefined) {
                container.attr('id', `g_${trajectoryName}`);
            }

            if (!showSparkLine) {
                container
                    .selectAll('rect')
                    .data(sequence)
                    .enter()
                    .append('rect')
                    .attr('x', function (_, i) {
                        return scaleX(xAttributeList[i]);
                    })
                    .attr('y', function (_, i) {
                        return scaleY(yAttributeListRender[i]);
                    })
                    .attr('width', 5)
                    .attr('height', 5)
                    .attr('fill', function (d) {
                        const state = GlobalStates.get(d.id);
                        return state.individualColor;
                    })
                    .classed('state', true)
                    .classed('clickable', true)
                    .on('click', function (_, d) {
                        if (individualSelectionMode) {
                            d3.select(this).classed('currentSelection', true);
                            setInternalExtents((prev) => [
                                ...prev,
                                { name: trajectoryName, states: [d.id] },
                            ]);
                        } else {
                            setStateClicked(d);
                        }
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
                if (includeBoundaries) {
                    const leftTimestep = leftBoundary.timesteps.slice(
                        leftBoundary.timesteps.length - sliceBy,
                        leftBoundary.timesteps.length
                    );
                    const rightTimestep = rightBoundary.timesteps.slice(0, sliceBy);
                    renderBackgroundColor(svg, scaleX, leftTimestep, leftBoundary.color);
                    renderBackgroundColor(svg, scaleX, rightTimestep, rightBoundary.color);
                }
                const datum = [];
                const mv = [];

                const line = d3
                    .line()
                    .x((d) => scaleX(d.x))
                    .y((d) => scaleY(d.y))
                    .curve(d3.curveCatmullRom.alpha(0.5));

                for (let i = 0; i < sequence.length; i++) {
                    const d = { x: xAttributeList[i], y: yAttributeListRender[i] };
                    datum.push(d);
                }

                for (let i = 0; i < movingAverage.length; i++) {
                    const d = { x: xAttributeList[i], y: movingAverage[i] };
                    mv.push(d);
                }
                // sparkline
                svg.append('path')
                    .datum(datum)
                    .attr('d', line)
                    .attr('stroke', 'black')
                    .attr('fill', 'none');

                // moving average line
                svg.append('path')
                    .datum(mv)
                    .attr('d', line)
                    .attr('stroke', 'red')
                    .attr('fill', 'none');
            }

            const yAxisPos = margin.left;
            const xAxisPos = height - margin.bottom;

            const xUnique = new Set(xAttributeList);
            const yUnique = new Set(yAttributeListRender);

            if (xUnique.size < 20) {
                const xAxis = svg
                    .append('g')
                    .attr('transform', `translate(0,${xAxisPos})`)
                    .call(d3.axisBottom().scale(scaleX).ticks(5));

                xAxis
                    .selectAll('text')
                    .style('text-anchor', 'center')
                    .attr('transform', 'rotate(15)');
            }

            if (yUnique.size < 20) {
                svg.append('g')
                    .attr('transform', `translate(${yAxisPos},0)`)
                    .call(d3.axisLeft().scale(scaleY).ticks(5));
            }

            svg.append('text')
                .attr('x', width / 2)
                .attr('y', margin.top)
                .attr('text-anchor', 'middle')
                .style('font-size', '12px')
                .text(`scatterplot ${id} ${xAttribute} vs ${yAttributeRender}`);

            /* const zoom = d3.zoom().on('zoom', ({ transform }) => {
                // choose whether to use transform or switch back to only continuous scales
                // const zx = transform.rescaleX(scaleX);
                // const zy = transform.rescaleY(scaleY);
                // const { x, y, k } = transform;
                // points.attr('transform', `translate(${x},${y})scale(${k},1)`);
                // .attr('x', (_, i) => zx(xAttributeList[i]));
                // .attr('y', (_, i) => zy(yAttributeList[i]));
            });


            svg.call(zoom); */

            // applyFilters(trajectories, runs, ref);
        },
        [yAttributeList, trajectories, runs, showSparkLine, property, width]
    );

    useEffect(() => {
        if (stateHovered) {
            // .select(`#g_${trajectoryName}`)
            /* d3.select(ref.current).selectAll('rect:not(.invisible)').filter(function(dp) {                                    
                return (dp.id !== stateHovered.stateID);
            }).classed("highlightedInvisible", true);
            
            d3.select(ref.current).selectAll('rect:not(.highlightedInvisible)').classed("highlightedStates", true); */

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
                .classed('highlightedState', false);
        }
    }, [stateHovered]);

    /* useEffect(() => {
        if (ref && ref.current && trajectoryName !== undefined) {
             }

        if (loadingCallback !== undefined) {
            loadingCallback();
        }
    }, [runs]); */

    useEffect(() => {
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
    }, [visibleExtent]);
    return (
        <>
            <Box className="floatingToolBar" sx={{ visibility: isHovered ? 'visible' : 'hidden' }}>
                <Button color="secondary" size="small" onClick={() => toggleSelectionBrush()}>
                    SelectionBrush
                </Button>
                <Button
                    color="secondary"
                    size="small"
                    onClick={() => toggleIndividualSelectionMode()}
                >
                    iSelectionBrush
                </Button>
                <Button color="secondary" size="small" onClick={() => toggleSparkLine()}>
                    {showSparkLine ? 'ShowScatter' : 'ShowSparkLine'}
                </Button>
            </Box>
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
                        toggleExpanded();
                    }
                }}
            />
        </>
    );
}

/* <Button color="secondary" size="small" onClick={(e) => toggleMenu(e)}>
                        Attributes
                    </Button> */
