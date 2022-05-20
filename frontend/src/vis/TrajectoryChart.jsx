import { React, useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Checkbox from '@mui/material/Checkbox';
import Box from '@mui/material/Box';

//import useKeyUp from '../hooks/useKeyUp';
//import useKeyDown from '../hooks/useKeyDown';
//import {useExtents} from '../hooks/useExtents';

//import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useContextMenu } from '../hooks/useContextMenu';
//import { useResize } from '../hooks/useResize';


import '../css/vis.css';
//import { onStateMouseOver, onChunkMouseOver } from '../api/myutils';
//import {apply_filters} from '../api/filters';

const margin = {
    top: 20, bottom: 20, left: 25, right: 25,
};

//let zBrush = null;
//let sBrush = null;

import {Application, Container, Graphics} from "pixi.js";

function TrajectoryChart({ trajectories, globalUniqueStates, runs, loadingCallback, setStateHovered, setStateClicked, stateHovered, setExtents}) {       
    //const {contextMenu, toggleMenu} = useContextMenu();
    const [pixiApp, setPixiApp] = useState(null);
    const ref = useRef();
    //const {width, height, divRef} = useResize();


    
    /*const [stateHighlight, setStateHighlight] = useState(false);
    
    const toggleStateHighlight = () => {
        setStateHighlight((prev) => !prev);
    };

    const zoom = () => {
        if (zBrush != null) {
            if (!d3.selectAll('.brush').empty()) {
                d3.selectAll('.brush').remove();
            }

            d3.select(ref.current)
                .append('g')
                .attr('class', 'brush')
                .call(zBrush);
        }
    };

    const selectionBrush = () => {
        if (sBrush != null) {                        
            d3.select(ref.current)
                .append('g')
                .attr('class', 'brush')
                .call(sBrush);
        }
    }*/

    //const {setInternalExtents, completeSelection} = useExtents(setExtents);    

    /*useKeyDown('Shift', selectionBrush);
    useKeyUp('Shift', completeSelection);      
    useKeyDown('z', zoom);*/

    useEffect(() => {
        if(ref.current) {
            setPixiApp(new Application({
                backgroundColor: 0xFFFFFF,
                resolution: devicePixelRatio,
                view: ref.current,
                resizeTo: ref.current.parentElement,
                //autoStart: false
            }));
        }
    }, [ref]);
    
    
    useEffect(() => {
        if (!pixiApp) {
            return;
        }        
        
        //ref.current.appendChild(canvas);
        const canvas = pixiApp.view;
        const width = canvas.width;
        const height = canvas.height;
        // clear so we don't draw over-top and cause insane lag
            
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
            
            //const chunkGroup = new Container(); //svg.append('g').attr('id', 'chunk');            
            //const importantGroup = new Container(); //svg.append('g').attr('id', 'sequence_important');

//            pixiApp.view.addChild(chunkGroup);
  //          pixiApp.view.addChild(importantGroup);

            for (const [name, trajectory] of Object.entries(trajectories)) {

                const {colors, idToCluster, simplifiedSequence} = trajectory;
                const {sequence, chunks} = simplifiedSequence;                                

                // create geometries for each color
                const renderColors = [];
                for(const c of colors) {
                    const gfx = new Graphics();
                    gfx.beginFill(c);
                    renderColors.push(gfx);
                }
                                
                trajectory.name = name;
                
                //const g = importantGroup.append('g').attr('id', `g_${name}`);
                tickNames.push(name);
                const seqLen = sequence.length;
                for(let i = 0; i < seqLen; i++) {
                    const d = sequence[i];
                    const gfx = renderColors[idToCluster[d.id]];                    
                    gfx.drawRect(scaleX(d.timestep), scaleY(count),
                                 scaleX(d.timestep + 1) - scaleX(d.timestep), 25);                        
                }

                const chunkLen = chunks.length;
                for(let i = 0; i < chunkLen; i++) {
                    const d = chunks[i];
                    const gfx = renderColors[idToCluster[-d.id]];                    
                    gfx.drawRect(scaleX(d.timestep), scaleY(count),
                                 scaleX(d.last + 1) - scaleX(d.timestep), 25);  
                }

                for(const gfx of renderColors) {                    
                    pixiApp.stage.addChild(gfx);
                }

                console.log(pixiApp);
                
                /*
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
                
                    .attr('stroke', 'black')
                    .attr('fill', (d) => {
                        return colors[idToCluster[-d.id]];
                    })                    
                    .on('mouseover', function(_, d) {
                        onChunkMouseOver(this, d, name);                            
                        this.setAttribute('opacity', 0.2);                                                    
                    }).on('mouseout', function() {
                        this.setAttribute('opacity', 1.0);                                                    
7                    });       */        
                count++;
            }


            /*const xAxis = svg.append('g');
            xAxis.attr("transform", `translate(0,0)`);
            
            xAxis.call(d3.axisBottom(scaleX).tickValues(scaleX.ticks().filter(tick => Number.isInteger(tick)))
                       .tickFormat(d3.format('d')));*/
            
            // reset zoom
            /*svg.on('dblclick', () => {
                // zoom out on double click
                scaleX.domain([0, maxLength]);
                xAxis.call(d3.axisBottom(scaleX).tickValues(scaleX.ticks().filter(tick => Number.isInteger(tick)))
                  .tickFormat(d3.format('d')));
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
                        scaleX.domain([
                            scaleX.invert(extent[0]),
                            scaleX.invert(extent[1]),
                        ]);
                        
                        xAxis.call(d3.axisBottom(scaleX).tickValues(scaleX.ticks().filter(tick => Number.isInteger(tick)))
                                   .tickFormat(d3.format('d')));
                        
                        importantGroup.selectAll('rect').attr('x', (d) => scaleX(d.timestep)).attr('width', (d) => scaleX(d.timestep + 1) - scaleX(d.timestep));          
                        chunkGroup.selectAll('rect').attr('x', (d) => scaleX(d.timestep)).attr('width', (d) => scaleX(d.last + 1) - scaleX(d.timestep));                        
                    }
                    d3.select(this).remove();
                    d3.select('.brush').remove();
                });

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
                });*/
            loadingCallback();
        }, [trajectories, pixiApp],
    );

    

    /*useEffect(() => {
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
    }, [stateHovered, stateHighlight]);*/

    
    return (
        <div>
            <canvas ref={ref}/>
        </div>
    );
}
/*
  <svg className="vis"
                         onContextMenu={toggleMenu}
                         id="sequence"
                         ref={ref}
                         preserveAspectRatio="none"
                         viewBox={[0, 0, width, height]}
                    />
  
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
*/
export default TrajectoryChart;
