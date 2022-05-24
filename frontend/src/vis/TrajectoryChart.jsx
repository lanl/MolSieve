import { React, useEffect, useState } from 'react';
import * as d3 from 'd3';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Checkbox from '@mui/material/Checkbox';
import Box from '@mui/material/Box';

import useKeyUp from '../hooks/useKeyUp';
import useKeyDown from '../hooks/useKeyDown';
import {useExtents} from '../hooks/useExtents';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useContextMenu } from '../hooks/useContextMenu';
import { useResize } from '../hooks/useResize';


import '../css/vis.css';
import { onStateMouseOver, onChunkMouseOver } from '../api/myutils';
import {apply_filters} from '../api/filters';

const margin = {
    top: 20, bottom: 20, left: 25, right: 25,
};

let sBrush = null;
let zoom = null;

function TrajectoryChart({ trajectories, globalUniqueStates, runs, loadingCallback, setStateHovered, setStateClicked, stateHovered, setExtents}) {       
    const {contextMenu, toggleMenu} = useContextMenu();
    const {width, height, divRef} = useResize();
    
    const [stateHighlight, setStateHighlight] = useState(false);
    
    const toggleStateHighlight = () => {
        setStateHighlight((prev) => !prev);
    };

    /*const zoom = () => {
        if (zBrush != null) {
            if (!d3.selectAll('.brush').empty()) {
                d3.selectAll('.brush').remove();
            }

            d3.select(ref.current)
                .append('g')
                .attr('class', 'brush')
                .call(zBrush);
        }
    };*/

    const selectionBrush = () => {
        if (sBrush != null) {                        
            d3.select(ref.current)
                .append('g')
                .attr('class', 'brush')
                .call(sBrush);
        }
    }

    const {setInternalExtents, completeSelection} = useExtents(setExtents);    

    useKeyDown('Shift', selectionBrush);
    useKeyUp('Shift', completeSelection);      
    //zuseKeyDown('z', zoom);
       
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
                
                const {colors, idToCluster, simplifiedSequence} = trajectory;
                const {sequence, chunks} = simplifiedSequence;                                
                trajectory.name = name;
                
                const g = importantGroup.append('g').attr('id', `g_${name}`);
                tickNames.push(name);

                g.selectAll('rect')
                    .data(sequence, (d) => d)
                    .enter()
                    .append('rect')
                    .attr('x', (d) => scaleX(d.timestep))
                    .attr('y', () => scaleY(count))
                    .attr('width', (d) => scaleX(d.timestep + 1) - scaleX(d.timestep))
                    .attr('height', 25)
                    .attr('opacity', 1.0)
                    .attr('fill', (d) => {                        
                        return colors[idToCluster[d.id]];
                    })                    
                    .on('click', function (_, d) {                        
                        setStateClicked(globalUniqueStates.get(d.id));                                      
                    })
                    .on('mouseover', function(_, d) {                                                
                        onStateMouseOver(this, globalUniqueStates.get(d.id), trajectory, name);                                                        
                        setStateHovered({'caller': this, 'stateID': d.id, 'name': name, 'timestep': sequence.indexOf(d)});                            
                    })
                    .on('mouseout', function() {                        
                        setStateHovered(null);
                    });                
                
                const c = chunkGroup.append('g').attr('id', `c_${name}`);
                
                c.selectAll('rect').data(chunks)
                    .enter()
                    .append('rect')
                    .attr('x', (d) => scaleX(d.timestep))
                    .attr('y', () => scaleY(count))
                    .attr('width', (d) => scaleX(d.last + 1) - scaleX(d.timestep))
                    .attr('height', 25)
                    .attr('fill', (d) => {
                        return colors[idToCluster[d.firstID]];
                    })                    
                    .on('mouseover', function(_, d) {
                        onChunkMouseOver(this, d, name);                            
                    }).classed("importantChunk", (d) => d.important).classed("unimportantChunk", (d) => !d.important);            
                count++;
            }


            const xAxis = svg.append('g');
            xAxis.attr("transform", `translate(0,0)`);
            
            xAxis.call(d3.axisBottom(scaleX).tickValues(scaleX.ticks().filter(tick => Number.isInteger(tick)))
                       .tickFormat(d3.format('d')));

            zoom = d3.zoom().scaleExtent([1,Infinity]).translateExtent([
                [margin.left, margin.top],
                [width - margin.right, height - margin.bottom]
            ]).on("zoom", (e) => {
                const xz = e.transform.rescaleX(scaleX);
                console.log(xz);
                xAxis.call(d3.axisBottom(xz).tickValues(xz.ticks().filter(tick => Number.isInteger(tick)))
                           .tickFormat(d3.format('d')));
                importantGroup.selectAll('rect').attr('x', (d) => xz(d.timestep)).attr('width', (d) => xz(d.timestep + 1) - xz(d.timestep));          
                chunkGroup.selectAll('rect').attr('x', (d) => xz(d.timestep)).attr('width', (d) => xz(d.last + 1) - xz(d.timestep));
            });

            svg.call(zoom);

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
                                setInternalExtents((prev) => [...prev, xtent]);                                
                            } else {
                                alert("Invalid selection. Please try again.");
                            }
                        }
                    }
                });                                   
            loadingCallback();
        },
        [width, height, trajectories],
    );

    

    useEffect(() => {
        if (ref !== undefined && ref.current !== undefined) {
            apply_filters(trajectories, runs, globalUniqueStates, ref);
        }
        loadingCallback();
     }, [runs]);

    useEffect(() => {        
        if(stateHovered !== undefined && stateHovered !== null) {            
            if(stateHighlight) {             
                d3.select('#sequence_important').selectAll('rect:not(.invisible)').filter(function(dp) {                                    
                    return (dp.id !== stateHovered.stateID);
                }).classed("highlightedInvisible", true);
                
                d3.select('#sequence_important').selectAll('rect:not(.highlightedInvisible)').classed("highlightedStates", true);
            }
            
            if(stateHovered.timestep) {                
                d3.select(ref.current).select(`#g_${stateHovered.name}`).selectAll('rect:not(.invisible)')
                    .filter(function(_, i) {
                        return i === stateHovered.timestep;
                    }).classed("highlightedState", true);
            }            
        } else {
            d3.select('#sequence_important').selectAll(".highlightedInvisible").classed("highlightedInvisible", false);
            d3.select('#sequence_important').selectAll('.highlightedStates').classed("highlightedStates", false);            
            d3.select('#sequence_important').selectAll('.highlightedState').classed("highlightedState", false);
        }
    }, [stateHovered, stateHighlight]);

    
    return (<>
                <Box ref={divRef}>
                    <svg className="vis"
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
                            onChange={() => { toggleStateHighlight(); }}
                            checked={stateHighlight}
                        />
                    </ListItemIcon>
                    <ListItemText>Toggle state highlighting</ListItemText>
                </MenuItem>
            </Menu>            
        </>);
}

export default TrajectoryChart;
