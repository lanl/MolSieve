import {
    React, useEffect, useState } from 'react';
import * as d3 from 'd3';
import '../css/vis.css';
import { onStateMouseOver, onChunkMouseOver } from '../api/myutils';
import { apply_filters } from '../api/filters';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useContextMenu } from '../hooks/useContextMenu';
import { useResize } from '../hooks/useResize';

import { useSnackbar } from 'notistack';

import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Checkbox from '@mui/material/Checkbox';
import ProgressBox from '../components/ProgressBox';
import Box from '@mui/material/Box';

import useKeyUp from '../hooks/useKeyUp';
import useKeyDown from '../hooks/useKeyDown';
import {useExtents} from '../hooks/useExtents';

let container = null;
let zoom = null;
const trajRendered = {};
let sBrush = null;

function GraphVis({trajectories, runs, globalUniqueStates, stateHovered, setStateClicked, setStateHovered, loadingCallback, style, setExtents }) {

    const {contextMenu, toggleMenu} = useContextMenu();
    const {width, height, divRef} = useResize();

    const {setInternalExtents, completeSelection} = useExtents(setExtents, () => {
        d3.select(ref.current).call(zoom);
    });

    const selectionBrush = () => {
        if (sBrush != null) {            
            if (!d3.selectAll('.brush').empty()) {
                d3.selectAll('.brush').remove();
            }
            
            d3.select(ref.current)
                .append('g')
                .attr('class', 'brush')
                .call(sBrush);
        }
    }
    
    useKeyDown('s', selectionBrush);
    useKeyUp('s', completeSelection);      
    
    const [seperateTrajectories, setSeperateTrajectories] = useState(true);
    const [inCommon, setInCommon] = useState([]);
    const [showInCommon, setShowInCommon] = useState(false);
    
    const [progressVal, setProgress] = useState(0);
    
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

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();    
    
    const renderGraph = (links, chunks, sSequence, l, g, c, name, trajectory) => {

        const colors = trajectory.colors;

        const stateNodes = g.selectAll('circle')
              .data(sSequence)
              .enter()
              .append('circle')        
              .attr('r', 5)
              .attr('id', d => `node_${d.id}`).attr('fill', function(d) {              
                  return colors[trajectory.idToCluster[d.id]];                  
              }).on('click', function(_,d) {                     
                  setStateClicked(globalUniqueStates.get(d.id));                
              }).on('mouseover', function(_, d) {
                  onStateMouseOver(this, globalUniqueStates.get(d.id), trajectory, name);
                  const timesteps = trajectory.simplifiedSequence.idToTimestep.get(d.id);
                  if(timesteps.length === 1) {                        
                      setStateHovered({'caller': this, 'stateID': d.id, 'name': name, 'timestep': timesteps[0]});
                  } else {
                      setStateHovered({'caller': this, 'stateID': d.id, 'name': name, 'timesteps': timesteps});
                  }                  
              }).on('mouseout', function() {
                  setStateHovered(null);
              });
        
        const chunkNodes = c.selectAll('circle')
              .data(chunks)
              .enter()
              .append('circle')                
              .attr('r', (d) => {
                  return d.size;
              }).attr('fill', function(d) {
                  return trajectory.colors[trajectory.idToCluster[d.firstID]];
              }).on('mouseover', function(_, d) {                      
                      onChunkMouseOver(this, d, name);                 
              }).classed("importantChunk", (d) => d.important).classed("unimportantChunk", (d) => !d.important);

        const linkNodes = l.selectAll("path")
              .data(links)
              .join("path")
              .attr("fill", "none").classed("arrowed", showArrows);

        if(showTransitionProb) {
            linkNodes.attr("opacity", (d) => {
                return d.transitionProb;
            });
        }
                     
        return {stateNodes, chunkNodes, linkNodes};
    }

    const ref = useTrajectoryChartRender((svg) => {

        if (height === undefined || width === undefined) {
            return;
        }
        // clear so we don't draw over-top and cause insane lag        
        
        if (!svg.empty()) {                   
            svg.selectAll('*').remove();            
        }
        
        // used for zooming https://gist.github.com/catherinekerr/b3227f16cebc8dd8beee461a945fb323
        
        svg.append('defs')
            .append('marker')
            .attr('id', 'arrow')
            .attr('viewBox','0 -5 10 10')
            .attr('refX', 0)
            .attr('refY', 0)
            .attr('markerWidth', 5)
            .attr('markerHeight', 5)
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
        
        const globalTimeScale = d3.scaleRadial().range([10,125]).domain([0, Math.max(...chunkSizes)]);
        for (const trajectory of Object.values(trajectories)) {                        
            for(const c of trajectory.simplifiedSequence.chunks) {
                c.size = globalTimeScale(c.size);
            }
        }
        
        const seen = [];                       
        let x_count = 0;
        let y_count = 0;

        let globalChunks = [];
        let globalSequence = [];
        let globalLinks = [];
        let trajCount = 0;

        for (const [name, trajectory] of Object.entries(trajectories)) {                        
            let chunks = JSON.parse(JSON.stringify(trajectory.simplifiedSequence.chunks));
            let sSequence = JSON.parse(JSON.stringify(trajectory.simplifiedSequence.uniqueStates));
            let links = JSON.parse(JSON.stringify(trajectory.simplifiedSequence.interleaved));                        

            trajectory.name = name;

            if(!seperateTrajectories) {
                for(let c of chunks) {
                    const chunk = c;
                    chunk.x_measure = trajCount;
                    c = chunk;
                }
                
                globalChunks = [...globalChunks, ...chunks];
                
                for(const s of sSequence) {
                    if(!seen.includes(s.id)) {
                        seen.push(s.id);
                        s.x_measure = trajCount;
                        globalSequence.push(s);
                    }
                }
                globalLinks = [...globalLinks, ...links];                
            } else {                
                const simulationWorker = new Worker(new URL ('workers/force_directed_simulation.js', import.meta.url));
            
                trajRendered[name] = false;            
                enqueueSnackbar((<ProgressBox messageProp={`Loading graph for ${name}...`} progressVal={progressVal}/>), {key: name, persist: true, preventDuplicate: true});

                const sequenceMap = new Map();
                sSequence.map((state) => {
                    sequenceMap.set(state.id, state);
                });
                
                chunks.map((chunk) => {
                    sequenceMap.set(chunk.id, chunk);
                });
                
                for(const link of links) {
                    const tc_idx = (link.target > 0) ? link.target : chunks[Math.abs(link.target)].firstID;
                    const sc_idx = (link.source > 0) ? link.source : chunks[Math.abs(link.source)].firstID;
                    const targetCluster = trajectory.idToCluster[tc_idx];
                    const sourceCluster = trajectory.idToCluster[sc_idx];

                    const targetNode = sequenceMap.get(link.target);
                    const sourceNode = sequenceMap.get(link.source);
                                        
                    targetNode.x_measure = targetCluster;
                    sourceNode.x_measure = sourceCluster;
                    
                    sequenceMap.set(link.target, targetNode);
                    sequenceMap.set(link.source, sourceNode);
                }
                
                simulationWorker.postMessage({
                    chunks: chunks,
                    sSequence: sSequence,
                    links: links,
                    x_count: x_count,
                    x_measureCount: trajectory.current_clustering,                    
                    width: width,
                });            
  
                simulationWorker.onmessage = (event) => {
                    if (event.data.type == "tick") {
                        setProgress(event.data.progress * 100);
                    }  else {
                        return ended(event.data, name);                       
                    }
                }
                
                const ended = (data) => {
                    const simulatedStates = data.sSequence;
                    const simulatedChunks = data.chunks;
                    const simulatedLinks = data.links;

                    const l = linkGroup.append("g").attr('id', `l_${name}`);                                   
                    const g = importantGroup.append('g').attr('id', `g_${name}`);      
                    const c = chunkGroup.append('g').attr('id', `c_${name}`);                    
                    
                    let { stateNodes, chunkNodes, linkNodes } = renderGraph(simulatedLinks, simulatedChunks, simulatedStates, l, g, c, name, trajectory);

                    stateNodes                    
                        .attr("cx", (d) => d.x)
                        .attr("cy", (d) => d.y);

                    chunkNodes
                        .attr("cx", (d) => d.x)
                        .attr("cy", (d) => d.y);
                                         
                    linkNodes.attr("d", (d) => {                        
                        const rt = (d.target.size) ? d.target.size : 5;
                        const rs = (d.source.size) ? d.source.size : 5;
                        const dx = d.target.x - d.source.x;
                        const dy = d.target.y - d.source.y;                        
                        const dr = Math.sqrt(dx * dx + dy * dy);

                        const g = Math.atan2(dy,dx);

                        const sx = d.source.x + (Math.cos(g) * (rs));
                        const sy = d.source.y + (Math.sin(g) * (rs));
                        const tx = d.target.x - (Math.cos(g) * (rt + 5));
                        const ty = d.target.y - (Math.sin(g) * (rt + 5));

                        return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`;                      
                    }).attr("stroke", function(d) {
                        const idx = (d.target.id > 0) ? d.target.id : d.target.firstID;
                        return trajectory.colors[trajectory.idToCluster[idx]];
                    });
                                        
                    trajRendered[name] = true;                   
                    closeSnackbar(name);       
                }
                                
                x_count++;
                
                if(x_count === 3) {
                    x_count = 0;
                    y_count++;                    
                }                
            }
            trajCount++;
        }

        if(!seperateTrajectories) {
            const simulationWorker = new Worker(new URL ('workers/force_directed_simulation.js', import.meta.url));
            const name = 'Global Trajectory';
            
            trajRendered[name] = false;           
            enqueueSnackbar((<ProgressBox name={name} progressVal={progressVal}/>), {key: name, persist: true, preventDuplicate: true});
            
            simulationWorker.postMessage({
                chunks: globalChunks,
                sSequence: globalSequence,
                links: globalLinks,
                x_measureCount: Object.keys(trajectories).length,
                x_count: x_count,
                y_count: y_count,
                width: width,
                height: height,
                maxChunkSize: globalTimeScale(Math.max(...chunkSizes))
            });

            simulationWorker.onmessage = (event) => {
                if (event.data.type == "tick") {
                    setProgress(event.data.progress * 100);
                }  else {
                    return ended(event.data);                       
                }
            }

            const ended = (data) => {
                const globalSequenceMap = new Map();
                const globalChunkMap = new Map();
                
                data.sSequence.map((node) => {
                    globalSequenceMap.set(node.id, {'x': node.x, 'y': node.y});
                });
                
                data.chunks.map((node) => {
                    globalChunkMap.set(node.id, {'x': node.x, 'y': node.y});
                });               

                const rendered = [];
                
                for(const [name, trajectory] of Object.entries(trajectories)) {
                    
                    const chunks = trajectory.simplifiedSequence.chunks;
                    const sSequence = trajectory.simplifiedSequence.uniqueStates;
                    const links = trajectory.simplifiedSequence.interleaved;
                    
                    const l = linkGroup.append("g").attr('id', `l_${name}`);                                   
                    const g = importantGroup.append('g').attr('id', `g_${name}`);      
                    const c = chunkGroup.append('g').attr('id', `c_${name}`);            

                    // render only unseen states && get x / y values from simulation data
                    let renderNow = [];

                    for(const s of sSequence) {                        
                        if(!rendered.includes(s.id)) {                            
                            renderNow.push(s);
                        }
                    }
                                        
                    let { stateNodes, chunkNodes, linkNodes } = renderGraph(links, chunks, renderNow, l, g, c, name, trajectory);
                    
                    stateNodes
                        .attr("cx", function(d) { return globalSequenceMap.get(d.id).x; })
                        .attr("cy", function(d) { return globalSequenceMap.get(d.id).y; });

                    chunkNodes
                        .attr("cx", function(d) { return globalChunkMap.get(d.id).x; })
                        .attr("cy", function(d) { return globalChunkMap.get(d.id).x; });

                    linkNodes.attr("d", (d) => {                        
                        const source = (d.source >= 0) ? globalSequenceMap.get(d.source) : globalChunkMap.get(d.source);
                        const target = (d.target >= 0) ? globalSequenceMap.get(d.target) : globalChunkMap.get(d.target);
                        
                        const dx = target.x - source.x;
                        const dy = target.y - source.y;
                        const dr = Math.sqrt(dx * dx + dy * dy);

                        return `M${source.x},${source.y}A${dr},${dr} 0 0,1 ${target.x},${target.y}`;
                    }).attr("stroke", function(d) {
                        return trajectory.colors[trajectory.idToCluster[Math.abs(d.target.id)]];
                    });
                    
                    // set nodes with multiple trajectories to black
                    stateNodes.filter((d) => {
                        return globalUniqueStates.get(d.id).seenIn.length > 1;
                    }).attr('fill', 'black').on('mouseover', function(_, d) {
                        onStateMouseOver(this, globalUniqueStates.get(d.id));
                        setStateHovered({'caller': this, 'stateID': d.id});
                    });                    

                    trajRendered[name] = true;                                   
                    closeSnackbar(name);       
                }
                trajRendered['Global Trajectory'] = true;                                   
                closeSnackbar('Global Trajectory');   
            }
        }
        // the trick to zooming like this is to move the container without moving the SVG's viewport
        
        zoom = d3.zoom().on('zoom', function(e) {
            container.attr("transform", e.transform);  
        });

        // set default view for SVG
        const bbox = container.node().getBBox();
        const vx = bbox.x;
        const vy = bbox.y;	
        const vw = bbox.width;
        const vh = bbox.height;
        const defaultView = `${vx} ${vy} ${vw} ${vh}`;        

        svg.attr("viewBox", defaultView).attr("preserveAspectRatio", "none").call(zoom);

        setInCommon(inCommon);
        loadingCallback();

        sBrush = d3
            .brush()
            .keyModifiers(false)
            .on('brush start', function(e) {
                // remove zoom on brush start to get rid of cursor getting stuck issue
                // zoom gets added back after brushing completes
                d3.select(ref.current).on('.zoom', null);
                const zt = d3.zoomTransform(container.node());
                const extent = e.selection;
                d3.select(ref.current).select('#important').selectAll('.highlightedState').classed("highlightedState", false);  
                d3.select(ref.current).select('#important').selectAll('circle').filter(function(d) {
                    const x = zt.k*d.x + zt.x;
                    const y = zt.k*d.y + zt.y;
                    
                    return (extent[0][0] <= x && x < extent[1][0] &&
                            extent[0][1] <= y && y < extent[1][1]);                    
                }).classed("highlightedState", true); 
            }).on('end', function(e) {                
                const zt = d3.zoomTransform(container.node());
                const extent = e.selection;                
                const nodes = d3.select(ref.current).select('#important').selectAll('circle').filter(function(d) {
                    const x = zt.k*d.x + zt.x;
                    const y = zt.k*d.y + zt.y;
                    
                    return (extent[0][0] <= x && x < extent[1][0] &&
                            extent[0][1] <= y && y < extent[1][1]);                    
                }).data();
                d3.select(ref.current).select('#important').selectAll('.highlightedState').classed("highlightedState", false);
                if(nodes.length > 0) {
                    setInternalExtents((prev) => [...prev, {'states': nodes}]);
                }
            });                       
         
    }, [width, height, trajectories, seperateTrajectories]);

    useEffect(() => {        
        if (ref !== undefined && ref.current !== undefined) {            
            apply_filters(trajectories, runs, globalUniqueStates, ref);
        }
        loadingCallback();
    }, [runs]);

    useEffect(() => {
        if(stateHovered !== undefined && stateHovered !== null) {                        
            const {caller, name, stateID} = stateHovered;

            if(trajRendered[name]) {
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
                    const occurrenceMap = trajectories[name].occurrenceMap;

                    d3.select(ref.current).select(`#g_${name}`).selectAll('circle').filter((d) => {
                        return (!occurrenceMap.get(stateID).has(d.id)) && d.id != stateID;
                    }).classed("neighborInvisible", true);

                    d3.select(ref.current).select(`#l_${name}`).selectAll('path').filter((d) => {                
                        return d.source.id != stateID && d.target.id != stateID;
                    }).classed("neighborInvisible", true);
                }
            }
        }
    }, [stateHovered, runs, showNeighbors]);

    useEffect(() => {
        if(ref) {
            d3.select(ref.current).selectAll("path").classed("arrowed", showArrows);
        }
    }, [showArrows]);
    
    useEffect(() => {
        if(ref) {
            if(showTransitionProb) {
                d3.select(ref.current).select('#links').selectAll('path').attr("opacity", (d) => {                
                    return d.transitionProb;                
                });                                
            } else {
                d3.select(ref.current).select('#links').selectAll('path').attr("opacity", 1.0);
            }
        }
    }, [showTransitionProb, seperateTrajectories]);

    useEffect(() => {
        if(ref) {
            if(showInCommon) {
                d3.select(ref.current).select('#important').selectAll("circle").filter((d) => {
                    return globalUniqueStates.get(d.id).seenIn.length == 1;
                }).classed("inCommonInvisible", true);
            } else {
                d3.select(ref.current).selectAll(".inCommonInvisible").classed("inCommonInvisible", false);
            }
        }
        }, [showInCommon, seperateTrajectories, globalUniqueStates]);

    
    return (
        <>
            <Box ref={divRef} sx={style.sx} className={style.className}>                
                <svg id="graph" onContextMenu={toggleMenu} className="vis" ref={ref} viewBox={[0,0,width,height]}/>
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
                    {Object.keys(trajectories).length > 1 &&
                     <>
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
                                     onChange={() => { toggleShowInCommon(); }}
                                     checked={showInCommon}                                
                                 />
                             </ListItemIcon>
                             <ListItemText>Show only states in common</ListItemText>                
                         </MenuItem>
                     </>
                    }
                     <MenuItem>
                         <ListItemIcon>
                             <Checkbox
                                 onChange={() => { toggleArrows(); }}
                                 checked={showArrows}                                
                             />
                         </ListItemIcon>
                         <ListItemText>Show all transition arrows</ListItemText>                
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
                    <MenuItem>
                        <ListItemIcon>
                            <Checkbox
                                onChange={() => { toggleShowTransitionProb(); }}
                                checked={showTransitionProb}                                
                            />
                        </ListItemIcon>
                        <ListItemText>Set relation opacity to transition probability</ListItemText>                
                    </MenuItem>      
                </Menu>                            
            </>);    
}



export default GraphVis;
