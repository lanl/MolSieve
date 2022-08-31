import { React, useEffect, useState } from 'react';
import * as d3 from 'd3';

import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import FormHelperText from '@mui/material/FormHelperText';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

import GlobalStates from '../api/globalStates';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useContextMenu } from '../hooks/useContextMenu';

import { onEntityMouseOver, getScale } from '../api/myutils';

import '../css/vis.css';
import '../css/App.css';

import { useExtents } from '../hooks/useExtents';
import { applyFilters } from '../api/filters';

const margin = { top: 25, bottom: 20, left: 25, right: 25 };
let sBrush = null;
let individualSelectionMode = false;
let selectionBrushMode = false;

export default function Scatterplot({
    sequence,
    uniqueStatesProp,
    trajectories,
    loadingCallback,
    stateHovered,
    id,
    title,
    trajectoryName,
    setStateClicked,
    setStateHovered,
    setExtents,
    properties,
    xAttributeProp = properties[0],
    yAttributeProp = properties[1],
    xAttributeListProp = null,
    yAttributeListProp = null,
    enableMenu = true,
    path = false,
    visibleExtent,
    width,
    height,
    runs,
    isParentHovered,
    sortBySimilarity = true,
}) {
    const { contextMenu, toggleMenu } = useContextMenu();
    const [xAttribute, setXAttribute] = useState(xAttributeProp);
    const [yAttribute, setYAttribute] = useState(yAttributeProp);

    const [xAttributeList, setXAttributeList] = useState(xAttributeListProp);
    const [yAttributeList, setYAttributeList] = useState(yAttributeListProp);

    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        setIsHovered(isParentHovered);
    }, [isParentHovered]);

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

    const useAttributeList = (setAttributeList, attribute, attributeListProp) => {
        useEffect(() => {
            const uniqueStates = sequence.map((i) => {
                return GlobalStates.get(i);
            });

            if (attributeListProp === null || attributeListProp === undefined) {
                if (attribute === 'timestep') {
                    const timesteps = sequence.map((_, i) => {
                        return i;
                    });

                    setAttributeList(timesteps);
                } else {
                    setAttributeList(
                        uniqueStates.map((s) => {
                            return s[attribute];
                        })
                    );
                }
            } else {
                setAttributeList(attributeListProp);
            }
        }, [GlobalStates, attribute, sequence]);
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

    useEffect(() => {
        ref.current.setAttribute('id', id);
    }, [id]);

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            if (xAttributeList === null || yAttributeList === null) {
                return;
            }

            const scaleX = getScale(xAttributeList, xAttribute === 'timestep').range([
                margin.left + 5,
                width - margin.right,
            ]);

            const scaleY = getScale(yAttributeList, yAttribute === 'id').range([
                height - margin.bottom - 5,
                margin.top,
            ]);

            const container = svg.append('g').attr('transform', 'translate(0,0)');

            if (trajectoryName !== undefined) {
                container.attr('id', `g_${trajectoryName}`);
            }

            const points = container
                .selectAll('rect')
                .data(sequence)
                .enter()
                .append('rect')
                .attr('x', function (_, i) {
                    return scaleX(xAttributeList[i]);
                })
                .attr('y', function (_, i) {
                    return scaleY(yAttributeList[i]);
                })
                .attr('width', 5)
                .attr('height', 5)
                .attr('fill', function (d) {
                    const state = GlobalStates.get(d);
                    return state.individualColor;
                })
                .attr('display', function (_, i) {
                    if (xAttributeList[i] === undefined || yAttributeList[i] === undefined) {
                        return 'none';
                    }
                    return 'inline';
                })
                .classed('state', true)
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
                        setStateClicked(d);
                    }
                });
            }

            if (setStateHovered) {
                points
                    .on('mouseover', function (_, d) {
                        const state = GlobalStates.get(d);

                        /* if (trajectory !== undefined) {
                            const fuzzyMemberships =
                                trajectory.fuzzy_memberships[trajectory.current_clustering][d.id];
                            content += `<b>Fuzzy memberships</b>: ${fuzzyMemberships}<br/>`;
                        } */

                        onEntityMouseOver(this, state);
                        const traj = trajectories[state.seenIn[0]];
                        const timesteps = traj.idToTimestep.get(d);
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
                    onStateMouseOver(this, d.id);
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
                    .x((d) => scaleX(d.x))
                    .y((d) => scaleY(d.y))
                    .curve(d3.curveCatmullRom.alpha(0.5));

                svg.append('path')
                    .datum(datum)
                    .attr('d', line)
                    .attr('stroke', 'black')
                    .attr('fill', 'none');
            }

            const yAxisPos = margin.left;
            const xAxisPos = height - margin.bottom;

            const xUnique = new Set(xAttributeList);
            const yUnique = new Set(yAttributeList);

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

            if (title === undefined || title === null) {
                title = '';
            }
            title += `scatterplot ${id} ${xAttribute} vs ${yAttribute}`;

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
                            const x = scaleX(xAttributeList[i]);
                            const y = scaleY(yAttributeList[i]);

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
                            const x = scaleX(xAttributeList[i]);
                            const y = scaleY(yAttributeList[i]);

                            return x0 <= x && x < x1 && y0 <= y && y < y1;
                        })
                        .data();
                    setInternalExtents((prev) => [...prev, { states: nodes }]);
                });

            if (loadingCallback !== undefined) {
                loadingCallback();
            }

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

            applyFilters(trajectories, runs, ref);
        },
        [xAttributeList, yAttributeList, trajectories, runs]
    );

    useEffect(() => {
        if (stateHovered) {
            console.log('stateHovered');
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
            {isHovered && (
                <Box className="floatingToolBar">
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
                    <Button color="secondary" size="small" onClick={(e) => toggleMenu(e)}>
                        Attributes
                    </Button>
                </Box>
            )}

            <svg
                ref={ref}
                id={id}
                className="vis filterable"
                viewBox={[0, 0, width, height]}
                width={width}
                height={height}
            />
            {enableMenu && (
                <Menu
                    open={contextMenu !== null}
                    onClose={toggleMenu}
                    anchorReference="anchorPosition"
                    anchorPosition={
                        contextMenu !== null
                            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                            : undefined
                    }
                >
                    <MenuItem>
                        <FormControl size="small">
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
                        <FormControl size="small">
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
