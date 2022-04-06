import {
    React, useEffect, useState, useRef
} from 'react';
import * as d3 from 'd3';
import '../css/vis.css';
import { onStateMouseOver, onChunkMouseOver, onStateMouseOverMultTraj } from '../api/myutils';
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

function GraphVis({trajectories, runs, globalUniqueStates, stateHovered, setStateClicked, setStateHovered, loadingCallback }) {

    const divRef = useRef();
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();        

    const [contextMenu, setContextMenu] = useState(null);
       
    const [seperateTrajectories, setSeperateTrajectories] = useState(true);
    const [inCommon, setInCommon] = useState([]);
    const [showInCommon, setShowInCommon] = useState(false);

    const toggleShowInCommon = () => {
        setShowInCommon((prev) => !prev);
    }
    
    const toggleSeperateTrajectories = () => {
        setSeperateTrajectories((prev) => !prev);
        if(seperateTrajectories) {
            setShowInCommon(false);
        }
    };

    const [showArrows, setArrows] = useState(true);

    const toggleArrows = () => {
        setArrows((prev) => !prev);
    }

    const [showNeighbors, setShowNeighbors] = useState(true);

    const toggleShowNeighbors = () => {
        setShowNeighbors((prev) => !prev);
    }

    const [showTransitionProb, setShowTransitionProb] = useState(true);

    const toggleShowTransitionProb = () => {
        setShowTransitionProb((prev) => !prev);
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

    const renderGraph = (links, chunks, sSequence, l, g, c, name, colors, timeScale, trajectory) => {
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

        
        const linkNodes = l.selectAll("path")
              .data(links)
              .join("path")
              .attr("fill", "none")
              .attr("stroke", function(d) {
                  return colors[trajectory.idToCluster[d.target]];
              }).classed("arrowed", showArrows); 
        
        if(seperateTrajectories) {                      
            stateNodes.on('mouseover', function(_, d) {
                if(!this.classList.contains("invisible")) {                    
                    onStateMouseOver(this, globalUniqueStates.get(d.id), trajectory, name);
                    const timesteps = trajectory.simplifiedSequence.idToTimestep.get(d.id);
                    if(timesteps.length === 1) {                        
                        setStateHovered({'caller': this, 'stateID': d.id, 'name': name, 'timestep': timesteps[0]});
                    } else {
                        setStateHovered({'caller': this, 'stateID': d.id, 'name': name, 'timesteps': timesteps});
                    }
                }
            });

            if(showTransitionProb) {
                linkNodes.attr("opacity", (d) => {
                    return trajectory.occurrenceMap.get(Math.abs(d.source)).get(Math.abs(d.target));
                });
            }
        } else {            
            stateNodes.on('mouseover', function(_, d) {
                onStateMouseOverMultTraj(this, globalUniqueStates.get(d.id));
                // add follow path feature later
                setStateHovered({'caller': this, 'stateID': d.id, 'name': name});
            });
        }       
        
        return {linkNodes, stateNodes, chunkNodes};
        
    }

    const ref = useTrajectoryChartRender((svg) => {

        if (height === undefined || width === undefined) {
            return;
        }
        // clear so we don't draw over-top and cause insane lag        
        
        if (!svg.empty()) {            
            for(const sim of simulations) {
                sim.force("link").links([]);
                delete sim.nodes();                
                sim.nodes([]);                
                sim.stop();
            }           
            simulations.splice(0, simulations.length);            
            svg.selectAll('*').remove();            
        }
        
        // used for zooming https://gist.github.com/catherinekerr/b3227f16cebc8dd8beee461a945fb323
        
        svg.append('defs')
            .append('marker')
            .attr('id', 'arrow')
            .attr('viewBox','0 -5 10 10')
            .attr('refX', 15)
            .attr('refY', -1.5)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .attr('fill', 'black')
            .append('path')
            .attr('d', "M 0,-5L10,0L0,5");
        
        container = svg.append('g')
              .attr('id', 'container')
              .attr('transform', "translate(0,0)scale(1,1)");
        
        const linkGroup = container.append('g').attr('id', 'links');
        const importantGroup = container.append('g').attr('id', 'important');
        const chunkGroup = container.append('g').attr('id', 'chunk');
       
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
        
        const globalTimeScale = d3.scaleLinear().range([10,125]).domain([0, Math.max(...chunkSizes)]);            
        const seen = [];        
        let count = 1;

        for (const [name, trajectory] of Object.entries(trajectories)) {            
            const chunks = JSON.parse(JSON.stringify(trajectory.simplifiedSequence.chunks));
            const sSequence = JSON.parse(JSON.stringify(trajectory.simplifiedSequence.uniqueStates));
            const links = JSON.parse(JSON.stringify(trajectory.simplifiedSequence.interleaved));            
            const colors = trajectory.colors;            
            
            trajectory.name = name;
            
            const l = linkGroup.append("g").attr('id', `l_${name}`);                                   
            const g = importantGroup.append('g').attr('id', `g_${name}`);      
            const c = chunkGroup.append('g').attr('id', `c_${name}`);            

            let renderNow = [];                
            for(const s of sSequence) {
                if(!seen.includes(s.id)) {                        
                    renderNow.push(s);
                    seen.push(s.id);                        
                } else {
                    inCommon.push(s.id);
                }
            }
       
            if(seperateTrajectories) {
                let {linkNodes, stateNodes, chunkNodes} = renderGraph(links, chunks, sSequence, l, g, c,
                                                                      name, colors, globalTimeScale, trajectory);                                                

                // fix chunks to positions
                
                const sim = d3.forceSimulation([...chunks, ...sSequence])
                      .force("link", d3.forceLink(links).id(function(d) { return d.id; }))
                      .force("center", d3.forceCenter(count * 2 * width, count * 2 * height))
                      .force("charge", d3.forceManyBody().theta(0.6))
                      .force("collide", d3.forceCollide().strength(5).radius((d) => {
                        if(d.size !== undefined && d.size !== null) {
                            return globalTimeScale(d.size);
                        } else {
                            return 5;
                        }                    
                    })).on('tick', ticked_single);

                simulations.push(sim);
                count++;
                
                function ticked_single() {
                    chunkNodes
                        .attr("cx", function(d) { return d.x; })
                        .attr("cy", function(d) { return d.y; });
                                
                    stateNodes
                        .attr("cx", function(d) { return d.x; })
                        .attr("cy", function(d) { return d.y; });

                    linkNodes.attr("d", (d) => {
                        const dx = d.target.x - d.source.x;
                        const dy = d.target.y - d.source.y;                        
                        const dr = Math.sqrt(dx * dx + dy * dy);
                        
                        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
                    })
                }                
            } else {                
                simulatedLinks = [...simulatedLinks, ...links];          
                renderGraph(simulatedLinks, chunks, renderNow, l, g, c, name, colors, globalTimeScale, trajectory);                
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
                .force("charge", d3.forceManyBody())
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
        setInCommon(inCommon);
        loadingCallback();
        
    }, [width, height, trajectories, seperateTrajectories]);

    useEffect(() => {        
        if (ref) {            
            apply_filters(trajectories, runs, globalUniqueStates, ref);
        }
        loadingCallback();
    }, [runs]);

    useEffect(() => {

        if(stateHovered !== undefined && stateHovered !== null) {
                        
            const {caller, name, stateID} = stateHovered;

            const prevSelect = d3.select(ref.current)
                  .selectAll('.highlightedState');

            if(!prevSelect.empty()) {
                prevSelect.classed("highlightedState", false);                
            }

            const prevHidden = d3.select(ref.current).selectAll('.neighborInvisible');
            
            if(!prevHidden.empty()) {
                prevHidden.classed("neighborInvisible", false);
            }

            const select = d3.select(ref.current).select(`#g_${name}`).select(`#node_${stateID}`);
            select.classed("highlightedState", true);
            
            if(caller.nodeName !== "circle") {
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

            if(!showNeighbors) {
                const adjacencyList = trajectories[name].adjacencyList;

                d3.select(ref.current).select(`#g_${name}`).selectAll('circle').filter((d) => {
                    return (!adjacencyList.get(stateID).includes(d.id)) && d.id != stateID;
                }).classed("neighborInvisible", true);

                d3.select(ref.current).select(`#l_${name}`).selectAll('path').filter((d) => {                
                    return d.source.id != stateID && d.target.id != stateID;
                }).classed("neighborInvisible", true);
            }
        }
    }, [stateHovered, runs, showNeighbors]);

    useEffect(() => {
        if(ref) {
            d3.select(ref.current).selectAll("path").classed("arrowed", showArrows);
        }
    }, [showArrows]);
    
    useEffect(() => {
        if(showTransitionProb && seperateTrajectories && ref) {
            for(const [name, trajectory] of Object.entries(trajectories)) {
                d3.select(ref.current).select(`#l_${name}`).selectAll('path').attr("opacity", (d) => {
                    // here it has to be id because the object has changed...
                    return trajectory.occurrenceMap.get(Math.abs(d.source.id)).get(Math.abs(d.target.id));
                });
            }                                
        } else {
            d3.select(ref.current).selectAll('path').attr("opacity", 1.0);
        }    
    }, [showTransitionProb, seperateTrajectories]);

    useEffect(() => {
        if(ref) {
            if(!seperateTrajectories && showInCommon) {
                d3.select(ref.current).selectAll("circle").filter((d) => {
                    return !inCommon.includes(d.id);
                }).classed("inCommonInvisible", true);
            } else {
                d3.select(ref.current).selectAll(".inCommonInvisible").classed("inCommonInvisible", false);
            }
        }
    }, [showInCommon, seperateTrajectories]);
    
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
                    <MenuItem>
                        <ListItemIcon>
                            <Checkbox
                                onChange={() => { toggleShowNeighbors(); }}
                                checked={showNeighbors}                                
                            />
                        </ListItemIcon>
                        <ListItemText>Show neighbors</ListItemText>                
                    </MenuItem>

                    {!seperateTrajectories &&
                         <MenuItem>
                             <ListItemIcon>
                                 <Checkbox
                                     onChange={() => { toggleShowInCommon(); }}
                                     checked={showInCommon}                                
                                 />
                             </ListItemIcon>
                             <ListItemText>Show only states in common</ListItemText>                
                         </MenuItem>
                    }
                    {seperateTrajectories &&
                     <MenuItem>
                          <ListItemIcon>
                              <Checkbox
                                  onChange={() => { toggleShowTransitionProb(); }}
                                  checked={showTransitionProb}                                
                              />
                          </ListItemIcon>
                          <ListItemText>Set relation opacity to transition probability</ListItemText>                
                      </MenuItem>
                    }
                </Menu>                            
            </div>);    
}

export default GraphVis;
