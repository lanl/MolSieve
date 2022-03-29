import {
    React, useEffect, useState, useRef,
} from 'react';
import * as d3 from 'd3';

import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Checkbox from '@mui/material/Checkbox';
import SingleStateModal from '../modals/SingleStateModal';
import MultiplePathSelectionModal from '../modals/MultiplePathSelectionModal';
import SelectionModal from '../modals/SelectionModal';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { onStateMouseOver, onChunkMouseOver } from '../api/myutils';

const PATH_SELECTION = 'path_selection';
const MULTIPLE_PATH_SELECTION = 'multiple_path_selection';
const SINGLE_STATE = 'single_state';

const margin = {
    top: 20, bottom: 20, left: 40, right: 25,
};

let zBrush = null;
let sBrush = null;
let msBrush = null;

function useKeyUp(key, action) {
    useEffect(() => {
        function onKeyup(e) {
            if (e.key === key) action();
        }
        window.addEventListener('keyup', onKeyup);
        return () => window.removeEventListener('keyup', onKeyup);
    }, []);
}

function useKeyDown(key, action) {
    useEffect(() => {
        function onKeydown(e) {
            if (!e.repeat) {
                if (e.key === key) action();
            }
        }
        window.addEventListener('keydown', onKeydown);
        return () => window.removeEventListener('keydown', onKeydown);
    }, []);
}

function TrajectoryChart({ trajectories, runs, loadingCallback }) {
    const [currentModal, setCurrentModal] = useState();

    const toggleModal = (key) => {
        if (currentModal) {
            setCurrentModal();
            setActionCompleted();
            return;
        }
        setCurrentModal(key);
    };

    const [contextMenu, setContextMenu] = useState(null);

    const openContext = (event) => {
        event.preventDefault();
        setContextMenu(
            contextMenu === null
                ? {
                    mouseX: event.clientX - 2,
                    mouseY: event.clientY - 4,
                }
                : null,
        );
    };

    const closeContext = () => {
        setContextMenu(null);
    };

    const [extents, setExtents] = useState([]);
    const [actionCompleted, setActionCompleted] = useState('');
    const [modalTitle, setModalTitle] = useState('');
    const [currentState, setCurrentState] = useState(null);

    const [stateHighlight, setStateHighlight] = useState(false);

    const toggleStateHighlight = () => {
        setStateHighlight((prev) => !prev);
    };

    const divRef = useRef();
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();

    const resize = () => {
        const newWidth = divRef.current.parentElement.clientWidth;
        setWidth(newWidth);

        const newHeight = divRef.current.parentElement.clientHeight;
        setHeight(newHeight);
    };

    useEffect(() => {
        resize();
    }, [trajectories]);

    useEffect(() => {
        window.addEventListener('resize', resize());
    }, []);

    const zoom = () => {
        if (zBrush != null) {
            if (!d3.selectAll('.brush').empty()) {
                d3.selectAll('.brush').remove();
            }

            d3.select('#svg_main')
                .append('g')
                .attr('class', 'brush')
                .call(zBrush);
        }
    };

    const selectionBrush = () => {
        if (sBrush != null) {
            if (!d3.selectAll('.brush').empty()) {
                d3.selectAll('.brush').remove();
            }

            d3.select('#svg_main')
                .append('g')
                .attr('class', 'brush')
                .call(sBrush);
        }
    };

    useKeyDown('z', zoom);
    useKeyDown('Control', selectionBrush);

    const multipleSelectionBrush = () => {
        if (msBrush != null) {
            d3.select('#svg_main')
                .append('g')
                .attr('class', 'brush')
                .call(msBrush);
        }
    };

    const completeMultipleSelection = () => {
        if (!d3.selectAll('.brush').empty()) {
            d3.selectAll('.brush').remove();
        }

        setModalTitle('Multiple Path Selection');
        setActionCompleted(MULTIPLE_PATH_SELECTION);
    };

    useKeyDown('Shift', multipleSelectionBrush);
    useKeyUp('Shift', completeMultipleSelection);

    useEffect(() => {
        switch (actionCompleted) {            
        case MULTIPLE_PATH_SELECTION:            
            if (extents.length < 2) break;
            toggleModal(actionCompleted);
            break;
        case PATH_SELECTION:            
            toggleModal(actionCompleted);
            break;
        case SINGLE_STATE:            
            toggleModal(actionCompleted);
            break;
        default:
                break;
            }
        }, [actionCompleted]);

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (height === undefined || width === undefined) {
                return;
            }
            // clear so we don't draw over-top and cause insane lag
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }
            
            let count = 0;
            let maxLength = -Number.MAX_SAFE_INTEGER;
            let chunkSizes = [1];
            
            for (const trajectory of Object.values(trajectories)) {
                if(trajectory.sequence.length > maxLength) {
                    maxLength = trajectory.sequence.length;
                }

                chunkSizes.push(...trajectory.simplifiedSequence.chunks.map((chunk) => {
                    chunk.size = (chunk.last - chunk.timestep);
                    return chunk.size;
                }));
            }            
            
            // domain 102.5% of actual length for some breathing room
            const scaleX = d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([0, maxLength * 1.025]);                                                                                                                                      
            
            const scaleY = d3
                .scaleLinear()
                .range([margin.top, height - margin.bottom])
                .domain([0, Object.keys(trajectories).length]);                                           
            
            const tickNames = [];

            // TODO add modal on state click, to show additional information if interested
            
            const chunkGroup = svg.append('g').attr('id', 'chunk');            
            const importantGroup = svg.append('g').attr('id', 'important');
            
            for (const [name, trajectory] of Object.entries(trajectories)) {

                const sSequence = trajectory.simplifiedSequence.sequence;
                const chunks = trajectory.simplifiedSequence.chunks;                
                const colors = trajectory.colors;            

                trajectory.name = name;
                
                const g = importantGroup.append('g').attr('id', `g_${name}`);
                tickNames.push(name);

                g.selectAll('rect')
                    .data(sSequence, (d) => d)
                    .enter()
                    .append('rect')
                    .attr('x', (d) => scaleX(d.timestep))
                    .attr('y', () => scaleY(count))
                    .attr('width', (d) => scaleX(d.timestep + 1) - scaleX(d.timestep))
                    .attr('height', 25)
                    .attr('opacity', 1.0)
                    .attr('fill', (d) => {
                        if (d.cluster === -1) {
                            return 'black';
                        }
                        return colors[d.cluster];
                    })                    
                    .on('click', function (_, d) {
                        if (this.getAttribute('opacity') > 0) {
                            setCurrentState(d);
                            setActionCompleted(SINGLE_STATE);
                        }                        
                    })
                    .on('mouseover', function(_, d) {                        
                        if (this.getAttribute('opacity') > 0) {                            
                            this.setAttribute('stroke', 'black');
                            onStateMouseOver(this, d, trajectory, name);
                            // TODO make this bind as an effect instead of inside the function - this could still be optimized
                            if (stateHighlight) {                            
                                svg.select(`#g_${name}`).selectAll('*').filter(function(dp) {                                    
                                    return (dp.id !== d.id) && this.getAttribute('opacity') > 0;
                                }).attr('opacity', 0.01);
                            }
                        }
                    })
                    .on('mouseout', function (_, d) {                        
                        if (this.getAttribute('opacity') > 0) {
                            this.setAttribute('stroke', 'none');
                            if (stateHighlight) {
                                svg.select(`#g_${name}`).selectAll('*').filter(function(dp) {
                                    return (dp.id != d.id) && this.getAttribute('opacity') > 0;
                                }).attr('opacity', 1.0);
                            }
                        }
                    });

                const c = chunkGroup.append('g').attr('id', `c_${name}`);
                
                c.selectAll('rect').data(chunks)
                    .enter()
                    .append('rect')
                    .attr('x', (d) => scaleX(d.timestep))
                    .attr('y', () => scaleY(count))
                    .attr('width', (d) => scaleX(d.last + 1) - scaleX(d.timestep))
                    .attr('height', 25)
                    .attr('stroke', 'black')
                    .attr('opacity', 1.0)
                    .attr('fill', (d) => {
                        if (d.color === -1) {
                            return 'black';
                        }
                        return colors[d.color];
                    })                    
                    .on('mouseover', function(_, d) {                        
                        if (this.getAttribute('opacity') > 0) {
                            this.setAttribute('opacity', 0.2);
                            onChunkMouseOver(this, d, name);
                        }
                    }).on('mouseout', function() {
                        if(this.getAttribute('opacity') > 0) {
                            this.setAttribute('opacity', 1.0);                            
                        }
                    });
               
                if (Object.keys(runs[name].filters).length > 0) {
                    for (const k of Object.keys(runs[name].filters)) {
                        const filter = runs[name].filters[k];
                        if (filter.enabled) {
                            filter.func(trajectory, svg, filter.options);
                        }
                    }
                }
            }
            
            const xAxis = svg.append('g').call(d3.axisBottom().scale(scaleX));

            // reset zoom
            svg.on('dblclick', () => {
                // zoom out on double click
                scaleX.domain([0, maxLength * 1.025]);
                xAxis.call(d3.axisBottom(scaleX));
                importantGroup.selectAll('rect').attr('x', (d) => scaleX(d.timestep)).attr('width', (d) => scaleX(d.timestep + 1) - scaleX(d.timestep));
                chunkGroup.selectAll('rect').attr('x', (d) => scaleX(d.timestep)).attr('width', (d) => scaleX(d.last + 1) - scaleX(d.timestep));
            });

            zBrush = d3
                .brushX()
                .keyModifiers(false)
                .extent([
                    [margin.left, margin.top],
                    [width - margin.right, height - margin.bottom],
                ])
                .on('end', function(e) {
                    const extent = e.selection;
                    if (extent) {
                        d3.select('.brush').call(zBrush.move, null);
                        scaleX.domain([
                            scaleX.invert(extent[0]),
                            scaleX.invert(extent[1]),
                        ]);
                        xAxis.call(d3.axisBottom(scaleX));
                        
                        importantGroup.selectAll('rect').attr('x', (d) => scaleX(d.timestep)).attr('width', (d) => scaleX(d.timestep + 1) - scaleX(d.timestep));          
                        chunkGroup.selectAll('rect').attr('x', (d) => scaleX(d.timestep)).attr('width', (d) => scaleX(d.last + 1) - scaleX(d.timestep));
                    }
                    d3.select(this).remove();
                    d3.select('.brush').remove();
                });

            // multiple path selection
            msBrush = d3
                .brush()
                .keyModifiers(false)
                .extent([
                    [margin.left, margin.top],
                    [width - margin.right, height - margin.bottom],
                ])
                .on('end', (e) => {
                    const extent = e.selection;
                    if (extent) {
                        const currName = Object.keys(trajectories)[Math.round(scaleY.invert(extent[0][1]))];
                        if (currName !== null && currName !== undefined) {
                            const begin = trajectories[currName].sequence[
                                Math.round(scaleX.invert(extent[0][0]))
                            ];
                            const end = trajectories[currName].sequence[
                                Math.round(scaleX.invert(extent[1][0]))
                            ];
                            if(begin !== undefined && end !== undefined) {
                                const xtent = {
                                    name: currName,
                                    begin,
                                    end,
                                };
                                setExtents((prev) => [...prev, xtent]);
                            } else {                                
                                alert("Invalid selection. Please try again.")
                            }
                        }
                    }
                });

            // single path selection
            sBrush = d3
                .brush()
                .keyModifiers(false)
                .extent([
                    [margin.left, margin.top],
                    [width - margin.right, height - margin.bottom],
                ])
                .on('end', function(e) {
                    const extent = e.selection;                    
                    if (extent) {
                        const currName = Object.keys(trajectories)[Math.round(scaleY.invert(extent[0][1]))];
                        if (currName !== null && currName !== undefined) {
                            const begin = trajectories[currName].sequence[
                                Math.round(scaleX.invert(extent[0][0]))
                            ];
                            const end = trajectories[currName].sequence[
                                Math.round(scaleX.invert(extent[1][0]))
                            ];

                            if(begin !== undefined && end !== undefined) {                                
                                const xtent = {
                                    name: currName,
                                    begin,
                                    end,
                                };
                                setModalTitle(
                                    `Timesteps ${begin.timestep} - ${end.timestep}`,
                                );
                                setExtents([...extents, xtent]);
                                setActionCompleted(PATH_SELECTION);
                            } else {
                                alert("Invalid selection. Please try again.");
                            }
                        }
                    }
                    d3.select(this).remove();
                    d3.select('.brush').remove();
                });                       
            loadingCallback();
        },
        [runs, width, height, stateHighlight, trajectories],
    );

    return (        
        <div onContextMenu={openContext} ref={divRef}>
            {width
                && height
                && Object.keys(trajectories).length
                === Object.keys(runs).length && (
                    <svg
                        id="svg_main"
                        ref={ref}
                        viewBox={[0, 0, width, height]}
                    />
                )}
            <Menu
                open={contextMenu !== null}
                onClose={closeContext}
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
                            onChange={() => { toggleStateHighlight(); }}
                            checked={stateHighlight}
                        />
                    </ListItemIcon>
                    <ListItemText>Toggle state highlighting</ListItemText>
                </MenuItem>
            </Menu>
            {currentModal === SINGLE_STATE && (
                <SingleStateModal
                    open={currentModal === SINGLE_STATE}
                    state={currentState}
                    closeFunc={() => {
                        setCurrentState(null);
                        setActionCompleted('');
                        toggleModal(SINGLE_STATE);
                    }}
                />
            )}
            {currentModal === PATH_SELECTION && (
                <SelectionModal
                    title={modalTitle}
                    open={currentModal === PATH_SELECTION}
                    trajectories={trajectories}
                    extents={extents}
                    closeFunc={() => {
                        setExtents([]);
                        setActionCompleted('');
                        toggleModal(PATH_SELECTION);
                    }}
                />
            )}
            {currentModal === MULTIPLE_PATH_SELECTION && (
                <MultiplePathSelectionModal
                    title={modalTitle}
                    open={currentModal === MULTIPLE_PATH_SELECTION}
                    trajectories={trajectories}
                    extents={extents}
                    closeFunc={() => {
                        setExtents([]);
                        setActionCompleted('');
                        toggleModal(MULTIPLE_PATH_SELECTION);
                    }}
                />
            )}
        </div>
    );
}

export default TrajectoryChart;
