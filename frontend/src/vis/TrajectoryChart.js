import {
    React, useEffect, useState, useRef,
} from 'react';
import * as d3 from 'd3';

import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Checkbox from '@mui/material/Checkbox';
import MultiplePathSelectionModal from '../modals/MultiplePathSelectionModal';
import SelectionModal from '../modals/SelectionModal';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { onStateMouseOver, onChunkMouseOver } from '../api/myutils';
import '../css/vis.css';
import {apply_filters} from '../api/filters';
import usePrevious from '../hooks/usePrevious';

const PATH_SELECTION = 'path_selection';
const MULTIPLE_PATH_SELECTION = 'multiple_path_selection';

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

function TrajectoryChart({ trajectories, globalUniqueStates, runs, loadingCallback, setStateHovered, setStateClicked, stateHovered }) {
    
    const [currentModal, setCurrentModal] = useState();

    const previousStateHovered = usePrevious(stateHovered);
    
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
    //const [currentState, setCurrentState] = useState(null);

    const [stateHighlight, setStateHighlight] = useState(true);

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
        //setActionCompleted(MULTIPLE_PATH_SELECTION);
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
                .domain([0, maxLength]);                                                                                                                                      
            
            const scaleY = d3
                .scaleLinear()
                .range([margin.top, height - margin.bottom])
                .domain([0, Object.keys(trajectories).length]);                                           
            
            const tickNames = [];

            // TODO add modal on state click, to show additional information if interested
            
            const chunkGroup = svg.append('g').attr('id', 'chunk');            
            const importantGroup = svg.append('g').attr('id', 'sequence_important');                        
            
            for (const [name, trajectory] of Object.entries(trajectories)) {                
                const sSequence = trajectory.simplifiedSequence.sequence;
                const chunks = trajectory.simplifiedSequence.chunks;                
                const colors = trajectory.colors;
                const currentClustering = trajectory.idToCluster;

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
                        return colors[currentClustering[d.id]];
                    })                    
                    .on('click', function (_, d) {
                        if (!this.classList.contains("invisible")) {                                                        
                            setStateClicked(globalUniqueStates[d.id]);
                        }                        
                    })
                    .on('mouseover', function(_, d) {                        
                        if (!this.classList.contains("invisible")) {
                            onStateMouseOver(this, globalUniqueStates[d.id], trajectory, name);
                            setStateHovered(this, d.id);
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
                        return colors[currentClustering[-d.id]];
                    })                    
                    .on('mouseover', function(_, d) {
                        if (!this.classList.contains("invisible")) {
                            onChunkMouseOver(this, d, name);                            
                            this.setAttribute('opacity', 0.2);                            
                        }
                    }).on('mouseout', function() {
                        if(!this.classList.contains("invisible")) {
                            this.setAttribute('opacity', 1.0);                            
                        }
                    });               
                count++;
            }
            
            const xAxis = svg.append('g').call(d3.axisBottom().scale(scaleX));

            // reset zoom
            svg.on('dblclick', () => {
                // zoom out on double click
                scaleX.domain([0, maxLength]);
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
                            const begin = Math.round(scaleX.invert(extent[0][0]));                            
                            const end = Math.round(scaleX.invert(extent[1][0]));
                            
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
                            const begin = Math.round(scaleX.invert(extent[0][0]));
                            const end = Math.round(scaleX.invert(extent[1][0]));
                            
                            if(begin !== undefined && end !== undefined) {                                
                                const xtent = {
                                    name: currName,
                                    begin,
                                    end,
                                };
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
        [width, height, stateHighlight, trajectories],
    );

     useEffect(() => {
            if (ref) {
                apply_filters(trajectories, runs, globalUniqueStates, ref);
            }
        loadingCallback();
     }, [runs]);

    useEffect(() => {
        if(stateHighlight && stateHovered !== undefined && stateHovered !== null) {

            if(previousStateHovered !== undefined && previousStateHovered !== null) {
                d3.select('#sequence_important').selectAll(".highlightedState").classed("highlightedState", false);
            }
            
            d3.select('#sequence_important').selectAll('g').selectAll('rect').filter(function(dp) {                                    
                return (dp.id == stateHovered) && !this.classList.contains("invisible");
            }).classed("highlightedState", true);                                                
        }                    
    }, [stateHovered]);
    
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
            {currentModal === PATH_SELECTION && (
                    <SelectionModal
                title={modalTitle}
                open={currentModal === PATH_SELECTION}
                trajectories={trajectories}
                globalUniqueStates={globalUniqueStates}
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
