import { React, useEffect, useState } from 'react';
import * as d3 from 'd3';

import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import FormHelperText from '@mui/material/FormHelperText';
import Box from '@mui/material/Box';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useContextMenu } from '../hooks/useContextMenu';
import { useResize } from '../hooks/useResize';
import { useHover } from '../hooks/useHover';

import { onStateMouseOver } from '../api/myutils';
import { apply_filters } from '../api/filters';

import '../css/vis.css';

import useKeyUp from '../hooks/useKeyUp';
import useKeyDown from '../hooks/useKeyDown';
import { useExtents } from '../hooks/useExtents';

const margin = { top: 20, bottom: 20, left: 40, right: 25 };
let sBrush = null;
let individualSelectionMode = false;

export default function Scatterplot({
    globalUniqueStates,
    sequence,
    trajectories,
    loadingCallback,
    stateHovered,
    runs,
    id,
    title,
    trajectoryName,
    setStateClicked,
    setStateHovered,
    setExtents,
    sx,
    properties,
    xAttributeProp = properties[0],
    yAttributeProp = properties[1],
    xAttributeListProp = null,
    yAttributeListProp = null,
    enableMenu = true,
    path = false,
    visibleExtent,
}) {
    const { contextMenu, toggleMenu } = useContextMenu();
    const { width, height, divRef } = useResize();

    const [xAttribute, setXAttribute] = useState(xAttributeProp);
    const [yAttribute, setYAttribute] = useState(yAttributeProp);

    const [xAttributeList, setXAttributeList] = useState(xAttributeListProp);
    const [yAttributeList, setYAttributeList] = useState(yAttributeListProp);

    const { setInternalExtents, completeSelection } = useExtents(setExtents);

    const selectionBrush = () => {
        if (sBrush != null) {
            if (!d3.selectAll('.brush').empty()) {
                d3.selectAll('.brush').remove();
            }

            d3.select(ref.current).append('g').attr('class', 'brush').call(sBrush);
        }
    };

    const isHovered = useHover(divRef);

    useKeyDown('Shift', selectionBrush, isHovered);
    useKeyUp('Shift', completeSelection, isHovered);

    const toggleIndividualSelectionMode = () => {
        individualSelectionMode = !individualSelectionMode;
        if (individualSelectionMode) {
            d3.select(ref.current)
                .selectAll('.currentSelection')
                .classed('currentSelection', false);
        }
    };

    useKeyDown('Control', toggleIndividualSelectionMode, isHovered);
    useKeyUp(
        'Control',
        function () {
            completeSelection();
            toggleIndividualSelectionMode();
        },
        isHovered
    );

    const useAttributeList = (setAttributeList, attribute, attributeListProp) => {
        useEffect(() => {
            const ids = sequence.map((s) => {
                return s.id;
            });

            const uniqueStates = ids.map((id) => {
                return globalUniqueStates.get(id);
            });

            if (attributeListProp === null || attributeListProp === undefined) {
                setAttributeList(
                    uniqueStates.map((s) => {
                        return s[attribute];
                    })
                );
            } else {
                setAttributeList(attributeListProp);
            }
        }, [globalUniqueStates, attribute, sequence]);
    };

    useAttributeList(setXAttributeList, xAttribute, xAttributeListProp);
    useAttributeList(setYAttributeList, yAttribute, yAttributeListProp);

    const options = properties.map((property) => {
        return (
            <MenuItem key={property} value={property}>
                {property}
            </MenuItem>
        );
    });

    options.push(
        <MenuItem key="id" value="id">
            id
        </MenuItem>
    );

    useEffect(() => {
        ref.current.setAttribute('id', id);
    }, [id]);

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (height === undefined || width === undefined) {
                return;
            }

            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            // let reverse = data.reverse;
            // let title = data.title;
            // const colors = trajectory.colors;
            // const idToCluster = trajectory.idToCluster;

            // if (reverse == null) reverse = false;

            const xtent = d3.extent(xAttributeList);
            const ytent = d3.extent(yAttributeList);

            const first = 0;
            const last = 1;

            /* if (reverse) {
                first = 1;
                last = 0;
                } */
            let xScaleFunction = null;
            if (xtent[1] - xtent[0] > 10000) {
                xScaleFunction = d3.scaleLog;
            } else {
                xScaleFunction = d3.scaleLinear;
            }

            let yScaleFunction = null;
            if (ytent[1] - ytent[0] > 10000) {
                yScaleFunction = d3.scaleLog;
            } else {
                yScaleFunction = d3.scaleLinear;
            }

            const scale_x = xScaleFunction()
                .range([margin.left + 5, width - margin.right])
                .domain([xtent[0], xtent[1]]);

            const scale_y = yScaleFunction()
                .range([height - margin.bottom - 5, margin.top])
                .domain([ytent[first], ytent[last]]);

            const g = svg.append('g');

            if (trajectoryName !== undefined) {
                g.attr('id', `g_${trajectoryName}`);
            }

            const points = g
                .selectAll('rect')
                .data(sequence)
                .enter()
                .append('rect')
                .attr('x', function (_, i) {
                    return scale_x(xAttributeList[i]);
                })
                .attr('y', function (_, i) {
                    return scale_y(yAttributeList[i]);
                })
                .attr('width', 5)
                .attr('height', 5)
                .attr('fill', function (d) {
                    const state = globalUniqueStates.get(d.id);
                    let traj = null;
                    if (trajectoryName) {
                        traj = trajectories[trajectoryName];
                    } else {
                        traj = trajectories[state.seenIn[0]];
                    }

                    return traj.colors[traj.idToCluster[d.id]];
                })
                .attr('display', function (_, i) {
                    if (xAttributeList[i] === undefined || yAttributeList[i] === undefined) {
                        return 'none';
                    }
                    return 'inline';
                })
                .classed('clickable', true);

            if (setStateClicked) {
                points.on('click', function (_, d) {
                    if (individualSelectionMode) {
                        d3.select(this).classed('currentSelection', true);
                        setInternalExtents((prev) => [
                            ...prev,
                            { name: trajectoryName, states: [d] },
                        ]);
                    } else {
                        setStateClicked(globalUniqueStates.get(d.id));
                    }
                });
            }

            if (setStateHovered) {
                points
                    .on('mouseover', function (_, d) {
                        onStateMouseOver(this, globalUniqueStates.get(d.id));
                        const state = globalUniqueStates.get(d.id);
                        const traj = trajectories[state.seenIn[0]];
                        const timesteps = traj.idToTimestep.get(d.id);
                        if (timesteps.length === 1) {
                            setStateHovered({
                                caller: this,
                                stateID: d.id,
                                name: trajectoryName,
                                timestep: timesteps[0],
                            });
                        } else {
                            setStateHovered({
                                caller: this,
                                stateID: d.id,
                                name: trajectoryName,
                                timesteps,
                            });
                        }
                    })
                    .on('mouseout', function () {
                        setStateHovered(null);
                    });
            } else {
                points.on('mouseover', function (_, d) {
                    onStateMouseOver(this, globalUniqueStates.get(d.id));
                });
            }

            if (path) {
                const datum = [];
                for (let i = 0; i < sequence.length; i++) {
                    const d = { x: xAttributeList[i], y: yAttributeList[i] };
                    datum.push(d);
                }

                const line = d3
                    .line()
                    .x((d) => scale_x(d.x))
                    .y((d) => scale_y(d.y))
                    .curve(d3.curveCatmullRom.alpha(0.5));

                svg.append('path')
                    .datum(datum)
                    .attr('d', line)
                    .attr('stroke', 'black')
                    .attr('fill', 'none');
            }

            const yAxisPos = margin.left;
            const xAxisPos = height - margin.bottom;

            const xAxis = svg
                .append('g')
                .attr('transform', `translate(0,${xAxisPos})`)
                .call(
                    d3
                        .axisBottom()
                        .scale(scale_x)
                        .tickValues(scale_x.ticks().filter((tick) => Number.isInteger(tick)))
                        .tickFormat(d3.format('d'))
                );

            xAxis.selectAll('text').style('text-anchor', 'center').attr('transform', 'rotate(15)');

            svg.append('g')
                .attr('transform', `translate(${yAxisPos},0)`)
                .call(d3.axisLeft().scale(scale_y));

            if (title === undefined || title === null) {
                title = '';
            }
            title += ` ${xAttribute} vs ${yAttribute}`;

            svg.append('text')
                .attr('x', width / 2)
                .attr('y', margin.top)
                .attr('text-anchor', 'middle')
                .style('font-size', '12px')
                .text(title);

            sBrush = d3
                .brush()
                .keyModifiers(false)
                .on('start brush', function (e) {
                    const [[x0, y0], [x1, y1]] = e.selection;
                    d3.select(ref.current)
                        .selectAll('.currentSelection')
                        .classed('currentSelection', false);
                    d3.select(ref.current)
                        .selectAll('rect')
                        .filter(function (_, i) {
                            const x = scale_x(xAttributeList[i]);
                            const y = scale_y(yAttributeList[i]);

                            return x0 <= x && x < x1 && y0 <= y && y < y1;
                        })
                        .classed('currentSelection', true);
                })
                .on('end', function (e) {
                    const [[x0, y0], [x1, y1]] = e.selection;
                    const nodes = d3
                        .select(ref.current)
                        .selectAll('rect')
                        .filter(function (_, i) {
                            const x = scale_x(xAttributeList[i]);
                            const y = scale_y(yAttributeList[i]);

                            return x0 <= x && x < x1 && y0 <= y && y < y1;
                        })
                        .data();
                    setInternalExtents((prev) => [...prev, { states: nodes }]);
                });

            if (loadingCallback !== undefined) {
                loadingCallback();
            }
        },
        [width, height, xAttributeList, yAttributeList, trajectories]
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

    useEffect(() => {
        if (ref && ref.current && trajectoryName !== undefined) {
            apply_filters(trajectories, runs, globalUniqueStates, ref);
        }

        if (loadingCallback !== undefined) {
            loadingCallback();
        }
    }, [runs]);

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
            <Box ref={divRef} sx={sx}>
                <svg
                    ref={ref}
                    onContextMenu={toggleMenu}
                    className="vis"
                    viewBox={[0, 0, width, height]}
                />
            </Box>
            {enableMenu && (
                <Menu
                    open={contextMenu !== null}
                    onClose={toggleMenu}
                    anchorReference="anchorPosition"
                    preserveAspectRatio="none"
                    anchorPosition={
                        contextMenu !== null
                            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                            : undefined
                    }
                >
                    <MenuItem>
                        <FormControl>
                            <Select
                                value={xAttribute}
                                onChange={(e) => {
                                    setXAttribute(e.target.value);
                                }}
                            >
                                {options}
                            </Select>
                            <FormHelperText>X attribute</FormHelperText>
                        </FormControl>
                    </MenuItem>

                    <MenuItem>
                        <FormControl>
                            <Select
                                value={yAttribute}
                                onChange={(e) => {
                                    setYAttribute(e.target.value);
                                }}
                            >
                                {options}
                            </Select>
                            <FormHelperText>Y attribute</FormHelperText>
                        </FormControl>
                    </MenuItem>
                </Menu>
            )}
        </>
    );
}
