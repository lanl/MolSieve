import { React, useEffect, useState } from 'react';
import * as d3 from 'd3';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Checkbox from '@mui/material/Checkbox';
import Box from '@mui/material/Box';
import Timestep from '../api/timestep';

import useKeyUp from '../hooks/useKeyUp';
import useKeyDown from '../hooks/useKeyDown';
import { useExtents } from '../hooks/useExtents';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useContextMenu } from '../hooks/useContextMenu';
import { useResize } from '../hooks/useResize';
import { useHover } from '../hooks/useHover';

import '../css/vis.css';
import { onStateMouseOver, onChunkMouseOver } from '../api/myutils';

import { apply_filters } from '../api/filters';

const margin = {
    top: 35,
    bottom: 20,
    left: 25,
    right: 25,
};

let sBrush = null;
let zoom = null;
let individualSelectionMode = false;

const visible = {};
const kList = new Map();
const childToParent = new Map();

function ensureMinWidth(d, x_scale) {
    if (x_scale(d.last + 1) - x_scale(d.timestep) < 10) {
        return x_scale(d.last + 1) - x_scale(d.timestep) + 10;
    }
    return x_scale(d.last + 1) - x_scale(d.timestep);
}

function TrajectoryChart({
    trajectories,
    globalUniqueStates,
    runs,
    loadingCallback,
    setStateHovered,
    setStateClicked,
    stateHovered,
    setExtents,
    setVisible,
    setSequenceExtent,
    visibleExtent,
}) {
    const { contextMenu, toggleMenu } = useContextMenu();
    const { width, height, divRef } = useResize();

    const [stateHighlight, setStateHighlight] = useState(false);

    const toggleStateHighlight = () => {
        setStateHighlight((prev) => !prev);
    };

    const selectionBrush = () => {
        if (sBrush != null) {
            d3.select(ref.current).append('g').attr('class', 'brush').call(sBrush);
        }
    };

    const { setInternalExtents, completeSelection } = useExtents(setExtents, () => {
        d3.select(ref.current).call(zoom);
    });

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

    const renderChunks = (data, trajectoryName, count, xScale, yScale) => {
        const trajectory = trajectories[trajectoryName];

        const nodes = d3
            .select(`#c_${trajectoryName}`)
            .selectAll('rect')
            .data(data, (d) => d.id);

        nodes
            .enter()
            .append('rect')
            .attr('x', (d) => xScale(d.timestep))
            .attr('y', (d) => {
                const impOffset = d.important ? -5 : 0;
                return yScale(count) + impOffset;
            })
            .attr('width', function (d) {
                return ensureMinWidth(d, xScale);
            })
            .attr('height', (d) => {
                if (d.important) {
                    return 37.5;
                }
                return 25;
            })
            .attr('fill', (d) => {
                return trajectory.colorByCluster(d);
            })
            .on('mouseover', function (_, d) {
                onChunkMouseOver(this, d, trajectoryName);
                setStateHovered({
                    caller: this,
                    stateID: d.id,
                    name: trajectoryName,
                    timestep: d.timestep,
                });
            })
            .on('mouseout', function () {
                setStateHovered(null);
            })
            .classed('importantChunk', (d) => d.important)
            .classed('unimportantChunk', (d) => !d.important)
            .classed('breakdown', (d) => d.parentID);
        nodes.exit().remove();
    };

    const renderStates = (data, trajectoryName, count, scaleX, scaleY) => {
        const trajectory = trajectories[trajectoryName];

        const newNodes = d3
            .select(`#g_${trajectoryName}`)
            .selectAll('rect')
            .data(data, (d) => d.timestep);

        newNodes
            .enter()
            .append('rect')
            .attr('x', (d) => scaleX(d.timestep))
            .attr('y', () => scaleY(count))
            .attr('width', (d) => scaleX(d.timestep + 1) - scaleX(d.timestep))
            .attr('height', 25)
            .attr('fill', (d) => {
                return trajectory.colorByCluster(d);
            })
            .on('click', function (_, d) {
                if (individualSelectionMode) {
                    d3.select(this).classed('currentSelection', true);
                    setInternalExtents((prev) => [...prev, { name: trajectoryName, states: [d] }]);
                } else {
                    setStateClicked(globalUniqueStates.get(d.id));
                }
            })
            .on('mouseover', function (_, d) {
                onStateMouseOver(this, globalUniqueStates.get(d.id), trajectory, trajectoryName);
                setStateHovered({
                    caller: this,
                    stateID: d.id,
                    name: trajectoryName,
                    timestep: d.timestep,
                });
            })
            .on('mouseout', function () {
                setStateHovered(null);
            })
            .classed('clickable', true);

        newNodes.exit().remove();
    };

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (height === undefined || width === undefined) {
                return;
            }

            // clear so we don't draw over-top and cause insane lag
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            let y = 0;
            let maxLength = -Number.MAX_SAFE_INTEGER;

            for (const trajectory of Object.values(trajectories)) {
                if (trajectory.sequence.length > maxLength) {
                    maxLength = trajectory.sequence.length;
                }
            }

            const scaleX = d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([0, maxLength]);

            const scaleY = d3
                .scaleLinear()
                .range([margin.top, height - margin.bottom])
                .domain([0, Object.keys(trajectories).length]);

            const tickNames = [];
            const chunkGroup = svg.append('g').attr('id', 'chunk');
            const importantGroup = svg.append('g').attr('id', 'sequence_important');

            for (const [name, trajectory] of Object.entries(trajectories)) {
                const { simplifiedSequence } = trajectory;
                const { chunks } = simplifiedSequence;
                trajectory.name = name;
                visible[name] = {
                    chunkList: Array.from(chunks.values()).filter((d) => d.parentID === undefined),
                    sequence: [],
                    toAdd: new Set(),
                    toRemove: new Set(),
                    count: y,
                };

                const { chunkList } = visible[name];
                importantGroup.append('g').attr('id', `g_${name}`).attr('name', `${name}`);
                chunkGroup.append('g').attr('id', `c_${name}`).attr('name', `${name}`);

                tickNames.push(name);

                renderChunks(chunkList, name, y, scaleX, scaleY);

                for (const c of chunkList) {
                    kList.set(c.id, 1);
                }

                y++;
            }

            let rescaledX = scaleX;

            const xAxis = svg.append('g').attr('transform', `translate(0,0)`);

            xAxis.call(
                d3
                    .axisBottom(scaleX)
                    .tickValues(scaleX.ticks().filter((tick) => Number.isInteger(tick)))
                    .tickFormat(d3.format('d'))
            );

            zoom = d3
                .zoom()
                .scaleExtent([1, Infinity])
                .translateExtent([
                    [0, margin.top],
                    [width, height - margin.bottom],
                ])
                .on('zoom', (e) => {
                    const xz = e.transform.rescaleX(scaleX);
                    const start = xz.domain()[0];
                    const end = xz.domain()[1];

                    // select all chunks within the viewport
                    const onScreenChunks = chunkGroup
                        .selectAll('.importantChunk')
                        .filter(function (d) {
                            return (
                                (d.timestep >= start && d.last <= end) ||
                                (d.last >= start && d.last <= end) ||
                                (d.timestep >= start && d.timestep <= end)
                            );
                        });

                    const onScreenChunkData = onScreenChunks.nodes().map((chunk) => {
                        const data = d3.select(chunk).data()[0];
                        return {
                            k: kList.get(data.id),
                            breakdown: d3.select(chunk).classed('breakdown'),
                            trajectoryName: chunk.parentNode.getAttribute('name'),
                            data,
                        };
                    });

                    /* this loop goes through each chunk and checks if its needs to be
                     * a. consolidated
                     * b. broken down
                     * c. left alone
                     * it generates a list of chunks to add / remove, and processes this list later
                     */

                    for (const d of onScreenChunkData) {
                        const { data, trajectoryName, breakdown, k } = d;
                        const { toAdd, toRemove } = visible[trajectoryName];
                        if (e.transform.k > k * 1.5) {
                            // zoom in - break down chunk
                            toRemove.add(data.id);
                            // NOTE: individual states in this view are identified by timestep
                            // NOT true for graph view
                            for (const child of data.getChildren()) {
                                toAdd.add(child);
                                childToParent.set(child, data.id);
                            }
                        }
                        if (breakdown && e.transform.k < k * 0.75) {
                            // zoom out - consolidate chunks into bigger chunk
                            toRemove.add(data.id);
                            toAdd.add(data.parentID);
                        }
                    }

                    // individual nodes -> chunk

                    const onScreenNodes = importantGroup.selectAll('rect');
                    const onScreenNodeData = onScreenNodes
                        .nodes()
                        .map((node) => {
                            const data = d3.select(node).data()[0];
                            return {
                                data,
                                trajectoryName: node.parentNode.getAttribute('name'),
                                k: kList.get(data.timestep),
                                parentID: childToParent.get(data.timestep),
                            };
                        })
                        .filter((d) => e.transform.k < d.k * 0.75);

                    // group by parentID
                    const nodeDataByParentID = d3.group(onScreenNodeData, (d) => d.parentID);

                    if (onScreenNodeData.length > 0) {
                        for (const [parentID, dataArray] of nodeDataByParentID.entries()) {
                            const { trajectoryName } = dataArray[0];
                            const { toAdd, toRemove } = visible[trajectoryName];
                            toAdd.add(parentID);
                            for (const d of dataArray) {
                                toRemove.add(d.data.timestep);
                            }
                        }
                    }

                    for (const [name, trajectory] of Object.entries(trajectories)) {
                        const { toAdd, toRemove, chunkList, sequence, count } = visible[name];

                        const { chunks } = trajectory.simplifiedSequence;

                        // filter the two sets down
                        const added = [...toAdd];
                        const removed = [...toRemove];

                        const newChunks = added.filter((d) => d < 0);
                        const removedChunks = removed.filter((d) => d < 0);

                        const newTimesteps = added.filter((d) => d > 0);
                        const removedTimesteps = removed.filter((d) => d > 0);

                        for (const c of newChunks) {
                            chunkList.push(chunks.get(c));
                        }

                        for (const t of newTimesteps) {
                            sequence.push(
                                Timestep.withParent(t, trajectory.sequence[t], childToParent.get(t))
                            );
                        }

                        const newChunkList = chunkList.filter((d) => !removedChunks.includes(d.id));
                        const newSequence = sequence.filter(
                            (d) => !removedTimesteps.includes(d.timestep)
                        );

                        renderChunks(newChunkList, name, count, xz, scaleY);
                        renderStates(newSequence, name, count, xz, scaleY);

                        for (const id of toAdd) {
                            if (!kList.has(id)) {
                                kList.set(id, e.transform.k);
                            }
                        }

                        toAdd.clear();
                        toRemove.clear();
                        visible[name].chunkList = newChunkList;
                        visible[name].sequence = newSequence;
                    }

                    // geometric zoom for the rest
                    xAxis.call(
                        d3
                            .axisBottom(xz)
                            .tickValues(xz.ticks().filter((tick) => Number.isInteger(tick)))
                            .tickFormat(d3.format('d'))
                    );

                    xAxis
                        .selectAll('text')
                        .style('text-anchor', 'center')
                        .attr('transform', 'rotate(-15)');

                    chunkGroup
                        .selectAll('rect')
                        .attr('x', (d) => xz(d.timestep))
                        .attr('width', (d) => ensureMinWidth(d, xz));

                    importantGroup
                        .selectAll('rect')
                        .attr('x', (d) => xz(d.timestep))
                        .attr('width', (d) => xz(d.timestep + 1) - xz(d.timestep));

                    rescaledX = xz;
                    setSequenceExtent([start, end]);
                    setVisible(visible);
                });

            svg.call(zoom);

            xAxis.selectAll('text').style('text-anchor', 'center').attr('transform', 'rotate(-15)');

            sBrush = d3
                .brush()
                .keyModifiers(false)
                .extent([
                    [margin.left, margin.top],
                    [width - margin.right, height - margin.bottom],
                ])
                .on('start', function () {
                    d3.select(ref.current).on('.zoom', null);
                })
                .on('brush', function (e) {
                    const extent = e.selection;
                    if (extent) {
                        const currName =
                            Object.keys(trajectories)[Math.round(scaleY.invert(extent[0][1]))];
                        if (currName !== null && currName !== undefined) {
                            const begin = Math.round(rescaledX.invert(extent[0][0]));
                            const end = Math.round(rescaledX.invert(extent[1][0]));

                            d3.select(ref.current)
                                .selectAll('.currentSelection')
                                .classed('currentSelection', false);

                            d3.select(ref.current)
                                .select('#sequence_important')
                                .selectAll('rect')
                                .filter((d) => {
                                    return d.timestep >= begin && d.timestep <= end;
                                })
                                .classed('currentSelection', true);
                        }
                    }
                })
                .on('end', function (e) {
                    const extent = e.selection;
                    if (extent) {
                        const currName =
                            Object.keys(trajectories)[Math.round(scaleY.invert(extent[0][1]))];
                        if (currName !== null && currName !== undefined) {
                            const begin = Math.round(rescaledX.invert(extent[0][0]));
                            const end = Math.round(rescaledX.invert(extent[1][0]));

                            if (begin !== undefined && end !== undefined) {
                                const xtent = {
                                    name: currName,
                                    begin,
                                    end,
                                };
                                setInternalExtents((prev) => [...prev, xtent]);
                            } else {
                                alert('Invalid selection. Please try again.');
                            }
                        }
                    }
                });
            loadingCallback();
        },
        [width, height, trajectories]
    );

    useEffect(() => {
        if (ref !== undefined && ref.current !== undefined) {
            apply_filters(trajectories, runs, globalUniqueStates, ref);
        }
        loadingCallback();
    }, [runs]);

    useEffect(() => {
        if (stateHovered) {
            if (stateHighlight) {
                d3.select(ref.current)
                    .selectAll('rect:not(.invisible)')
                    .filter(function (dp) {
                        return dp.id !== stateHovered.id;
                    })
                    .classed('highlightedInvisible', true);

                d3.select('#sequence_important')
                    .selectAll('rect:not(.highlightedInvisible)')
                    .classed('highlightedStates', true);
            }

            // needs to be !== null and undefined in case timestep === 0
            if (stateHovered.timestep !== null && stateHovered.timestep !== undefined) {
                d3.select(ref.current)
                    .selectAll('rect:not(.invisible)')
                    .filter((d) => d.timestep === stateHovered.timestep)
                    .classed('highlightedState', true);
            }

            if (stateHovered.timesteps) {
                d3.select(ref.current)
                    .selectAll('rect:not(.invisible)')
                    .filter((d) => stateHovered.timesteps.includes(d.timestep))
                    .classed('highlightedState', true);
            }
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
    }, [stateHovered, stateHighlight]);

    useEffect(() => {
        d3.select(ref.current).selectAll('.currentSelection').classed('currentSelection', false);

        if (visibleExtent) {
            for (const e of visibleExtent) {
                let filterFunc = null;

                if (e.begin && e.end) {
                    filterFunc = function (d) {
                        return d.timestep >= e.begin && d.timestep <= e.end;
                    };
                } else {
                    filterFunc = function (d) {
                        const ids = e.states.map((s) => s.id);
                        return ids.includes(d.id);
                    };
                }
                d3.select(ref.current)
                    .select('#sequence_important')
                    .selectAll('rect')
                    .filter((d) => {
                        return filterFunc(d);
                    })
                    .classed('currentSelection', true);
            }
        }
    }, [visibleExtent]);

    return (
        <>
            <Box ref={divRef}>
                <svg
                    className="vis"
                    onContextMenu={toggleMenu}
                    id="sequence"
                    ref={ref}
                    preserveAspectRatio="none"
                    viewBox={[0, 0, width, height]}
                />
            </Box>
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
                    <ListItemIcon>
                        <Checkbox
                            onChange={() => {
                                toggleStateHighlight();
                            }}
                            checked={stateHighlight}
                        />
                    </ListItemIcon>
                    <ListItemText>Toggle state highlighting</ListItemText>
                </MenuItem>
            </Menu>
        </>
    );
}

export default TrajectoryChart;
