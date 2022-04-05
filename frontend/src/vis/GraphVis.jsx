import {
    React, useEffect, useState, useRef
} from 'react';
import * as d3 from 'd3';
import '../css/vis.css';
import { onStateMouseOver, onChunkMouseOver } from '../api/myutils';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import {apply_filters} from '../api/filters';

import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Checkbox from '@mui/material/Checkbox';

let globalLinkNodes = null;
let globalChunkNodes = null;
let globalStateNodes = null;

let container = null;
let zoom = null;
const simulations = [];

function GraphVis({trajectories, runs, globalUniqueStates, stateHovered, setStateClicked, setStateHovered, loadingCallback, lastEventCaller }) {

    const divRef = useRef();
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();        

    const [contextMenu, setContextMenu] = useState(null);

    
    
    const [seperateTrajectories, setSeperateTrajectories] = useState(true);
    
    const toggleSeperateTrajectories = () => {
        setSeperateTrajectories((prev) => !prev);
    };

    const [showArrows, setArrows] = useState(true);

    const toggleArrows = () => {
        setArrows((prev) => !prev);
    }
    
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
    
    const resize = () => {
        const newWidth = divRef.current.parentElement.clientWidth;
        setWidth(newWidth);

        const newHeight = divRef.current.parentElement.clientHeight;
        setHeight(newHeight);
    };

    const ticked = () => {
        globalLinkNodes
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        globalChunkNodes
            .attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; });
                                
        globalStateNodes
            .attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; });        
    }
    
    useEffect(() => {
        resize();
    }, [trajectories]);

    useEffect(() => {
        window.addEventListener('resize', resize());
    }, []);

    const ref = useTrajectoryChartRender((svg) => {

        if (height === undefined || width === undefined) {
            return;
        }
        // clear so we don't draw over-top and cause insane lag        
        
        if (!svg.empty()) {
            
            for(const sim of simulations) {
                sim.stop();
            }
            
            simulations.splice(0, simulations.length);

            for (const [name, trajectory] of Object.entries(trajectories)) {
                svg.select(`#c_${name}`).selectAll('circle')
                    .data(trajectory.simplifiedSequence.chunks).exit().remove();
                svg.select(`#l_${name}`).selectAll('line')
                    .data(trajectory.simplifiedSequence.interleaved).exit().remove();
                svg.select(`#g_${name}`).selectAll('circle')
                    .data(trajectory.simplifiedSequence.uniqueStates).exit().remove();
            }            
            
            svg.selectAll('*').remove();            
        }
        
        // used for zooming https://gist.github.com/catherinekerr/b3227f16cebc8dd8beee461a945fb323

        const markerBoxWidth = 10;
        const markerBoxHeight = 10;
        const refX = markerBoxWidth / 2;
        const refY = markerBoxHeight / 2;
        const arrowPoints = [[0,0], [0,10], [10,5]];
        
        svg.append('defs')
            .append('marker')
            .attr('id', 'arrow')
            .attr('viewBox', [0, 0, markerBoxWidth, markerBoxHeight])
            .attr('refX', refX)
            .attr('refY', refY)
            .attr('markerWidth', markerBoxWidth)
            .attr('markerHeight', markerBoxHeight)
            .attr('orient', 'auto-start-reverse')
            .append('path')
            .attr('d', d3.line()(arrowPoints));
        
        container = svg.append('g')
              .attr('id', 'container')
              .attr('transform', "translate(0,0)scale(1,1)");
        
        const importantGroup = container.append('g').attr('id', 'important');
        const chunkGroup = container.append('g').attr('id', 'chunk');
        const linkGroup = container.append('g').attr('id', 'links');

        let simulated = [];
        let simulatedLinks = [];
        let chunkSizes = [];

        // always global; option
        for (const trajectory of Object.values(trajectories)) {                        
            chunkSizes.push(...trajectory.simplifiedSequence.chunks.map((chunk) => {
                chunk.size = (chunk.last - chunk.timestep);
                return chunk.size;
            }));
        }

        // https://bl.ocks.org/mbostock/1062288 - collapsible tree
        // https://coppelia.io/2014/07/an-a-to-z-of-extra-features-for-the-d3-force-layout/
        // http://bl.ocks.org/samuelleach/5497403
        
        const globalTimeScale = d3.scaleLinear().range([5,125]).domain([0, Math.max(...chunkSizes)]);            
        const seen = [];
        let count = 0;
        
        for (const [name, trajectory] of Object.entries(trajectories)) {            
            const chunks = trajectory.simplifiedSequence.chunks;
            const sSequence = trajectory.simplifiedSequence.uniqueStates;
            const links = trajectory.simplifiedSequence.interleaved;
            const colors = trajectory.colors;            
            
            trajectory.name = name;

            const l = linkGroup.append("g").attr('id', `l_${name}`);
            const g = importantGroup.append('g').attr('id', `g_${name}`);      
            const c = chunkGroup.append('g').attr('id', `c_${name}`);
            
            if(seperateTrajectories) {
                let {linkNodes, stateNodes, chunkNodes} = renderGraph(links, chunks, sSequence, l, g, c,
                                                                      name, colors, globalTimeScale, trajectory,
                                                                      globalUniqueStates, setStateClicked, setStateHovered, showArrows);                                                
                
                const sim = d3.forceSimulation([...chunks, ...sSequence])
                      .force("link", d3.forceLink(links).id(function(d) { return d.id; }))
                      .force("center", d3.forceCenter(count * 2 * width, count * 2 * height))
                      .force("charge", d3.forceManyBody())
                      .force("collide", d3.forceCollide().strength(10).radius((d) => {
                        if(d.size !== undefined && d.size !== null) {
                            return globalTimeScale(d.size);
                        } else {
                            return 5;
                        }                    
                    })).on('tick', ticked_single);

                simulations.push(sim);
                count++;
                
                function ticked_single() {
                    linkNodes
                        .attr("x1", function(d) { return d.source.x; })
                        .attr("y1", function(d) { return d.source.y; })
                        .attr("x2", function(d) { return d.target.x; })
                        .attr("y2", function(d) { return d.target.y; });

                    chunkNodes
                        .attr("cx", function(d) { return d.x; })
                        .attr("cy", function(d) { return d.y; });
                                
                    stateNodes
                        .attr("cx", function(d) { return d.x; })
                        .attr("cy", function(d) { return d.y; });       
                }
                
            } else {
                let renderNow = [];
                for(const s of sSequence) {
                    if(!seen.includes(s.number)) {                        
                        renderNow.push(s);
                        seen.push(s.number);
                    }
                }
                
                simulatedLinks = [...simulatedLinks, ...links];          
                renderGraph(simulatedLinks, chunks, renderNow, l, g, c, name, colors, globalTimeScale, trajectory, setStateHovered);                
                simulated = [...simulated, ...chunks, ...renderNow];
            }
        }                

        // the trick to zooming like this is to move the container without moving the SVG's viewport
        
        zoom = d3.zoom().on('zoom', function(e) {
            container.attr("transform", e.transform);  
        });

        if(!seperateTrajectories) {                       
            globalLinkNodes = linkGroup.selectAll('line');
            globalStateNodes = importantGroup.selectAll('circle');
            globalChunkNodes = chunkGroup.selectAll('circle');            

            d3.forceSimulation(simulated)
                .force("link", d3.forceLink(simulatedLinks).id(function(d) { return d.id; }))
                .force("charge", d3.forceManyBody().distanceMax(600).theta(0.75))
                .force("collide", d3.forceCollide().strength(10).radius((d) => {
                    if(d.size !== undefined && d.size !== null) {
                        return globalTimeScale(d.size);
                    } else {
                        return 5;
                    }                    
                }))
                .on('tick', ticked);
        }

        // set default view for SVG
        const bbox = container.node().getBBox();
        const vx = bbox.x;
        const vy = bbox.y;	
        const vw = bbox.width;
        const vh = bbox.height;
        const defaultView = `${vx} ${vy} ${vw} ${vh}`;
        
        svg.attr("viewBox", defaultView).attr("preserveAspectRatio", "xMidYMid meet").call(zoom);

        loadingCallback();
        //used to be run, width, height
    }, [width, height, trajectories, seperateTrajectories]);

    useEffect(() => {        
        if (ref) {
            console.log(runs);
            apply_filters(trajectories, runs, globalUniqueStates, ref);
        }
        loadingCallback();
    }, [runs]);

    useEffect(() => {

        if(stateHovered !== undefined && stateHovered !== null) {
            
            const prevSelect = d3.select(ref.current)
                  .selectAll('*').select('.highlightedState');

            if(!prevSelect.empty()) {
                prevSelect.classed("highlightedState", false);
            }
            
            const select = d3.select(ref.current).select(`#node_${stateHovered}`);
            select.classed("highlightedState", true);

            if(lastEventCaller.nodeName !== "circle") {
                const node = select.node();
                const bbox = node.getBBox();
                const bx = bbox.x;
                const by = bbox.y;
                const bw = bbox.width;
                const bh = bbox.height;

                // get middle of object
                const midX = bx + bw / 2;
                const midY = by + bh / 2;

                //translate the middle of our view-port to that position    
                d3.select(ref.current).transition().duration(500).call(zoom.transform,
                                                                       d3.zoomIdentity.translate(width / 2 - midX, height / 2 - midY));
            }
        }        
    }, [stateHovered]);

    useEffect(() => {
        if(ref) {
            d3.select(ref.current).selectAll("line").classed("arrowed", showArrows);
        }
    }, [showArrows])

    return (<div ref={divRef} onContextMenu={openContext}>
                
                {width && height && Object.keys(trajectories).length === Object.keys(runs).length
                 && <svg id="svg_nodes" ref={ref} viewBox={[0,0,width,height]}/>}

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
                                onChange={() => { toggleSeperateTrajectories(); }}
                                checked={seperateTrajectories}                                
                            />
                        </ListItemIcon>
                        <ListItemText>Seperate trajectories</ListItemText>
                    </MenuItem>
                    <MenuItem>
                        <ListItemIcon>
                            <Checkbox
                                onChange={() => { toggleArrows(); }}
                                checked={showArrows}                                
                            />
                        </ListItemIcon>
                        <ListItemText>Show transition arrows</ListItemText>                
                    </MenuItem>
                </Menu>                            
            </div>);    
}

function renderGraph(links, chunks, sSequence, l, g, c, name, colors, timeScale, trajectory, globalUniqueStates, setStateClicked, setStateHovered, showArrows) {    

    const linkNodes = l.selectAll("line").data(links).enter().append("line").attr("stroke-width", 1).attr("stroke", "black").classed("arrowed", showArrows); 
    const stateNodes = g.selectAll('circle')
          .data(sSequence)
          .enter()
          .append('circle')
          .attr('r', 5)
          .attr('id', d => `node_${d.id}`)
          .attr('fill', function(d) {              
              return colors[trajectory.idToCluster[d.id]];
          }).on('click', function(_,d) {              
              if (!this.classList.contains("invisible")) {                  
                  setStateClicked(globalUniqueStates.get(d.id));
              }                        
          })    
          .on('mouseover', function(_, d) {
              if(!this.classList.contains("invisible")) {
                  if(trajectory !== null && trajectory !== undefined) {
                      onStateMouseOver(this, globalUniqueStates.get(d.id), trajectory, name);
                  }
                  setStateHovered(this, d.id);
              }
          });             

    const chunkNodes = c.selectAll('circle')
        .data(chunks)
        .enter()
        .append('circle')                
        .attr('r', (d) => {
            return timeScale(d.size);
        })
        .attr('fill', function(d) {
            return colors[trajectory.idToCluster[-d.id]];
        }).on('mouseover', function(_, d) {
            if (!this.classList.contains("invisible")) {   
                this.setAttribute('stroke', 'black');
                onChunkMouseOver(this, d, name);
            }
        }).on('mouseout', function () {
            if (!this.classList.contains("invisible")) { 
                this.setAttribute('stroke', 'none');
            }
        });
    
    return {linkNodes, stateNodes, chunkNodes};
}

export default GraphVis;
