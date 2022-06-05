import {
    React, useEffect, useState } from 'react';
import * as d3 from 'd3';
import '../css/vis.css';
import { onStateMouseOver, onChunkMouseOver } from '../api/myutils';
import { apply_filters } from '../api/filters';


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
import { useHover } from '../hooks/useHover';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useContextMenu } from '../hooks/useContextMenu';
import { useResize } from '../hooks/useResize';
import usePrevious from '../hooks/usePrevious';


let container = null;
let zoom = null;
const trajRendered = {};
let visible = {};
let sBrush = null;
let globalTimeScale = null;

let individualSelectionMode = false;

function GraphVis({trajectories, runs, globalUniqueStates, stateHovered, setStateClicked, setStateHovered, loadingCallback, style, setExtents, visibleProp }) {

    const {contextMenu, toggleMenu} = useContextMenu();
    const {width, height, divRef} = useResize();

    const previousVisible = usePrevious(visibleProp);
    
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
    const isHovered = useHover(divRef);
    useKeyDown('Shift', selectionBrush, isHovered);
    useKeyUp('Shift', completeSelection, isHovered);      

    const toggleIndividualSelectionMode = () => {
        individualSelectionMode = !individualSelectionMode;
    }
    
    useKeyDown('Control', toggleIndividualSelectionMode, isHovered);
    useKeyUp('Control', function() {        
        completeSelection();
        toggleIndividualSelectionMode();
    }, isHovered);

    
    const [seperateTrajectories, setSeperateTrajectories] = useState(true);
    const [inCommon, setInCommon] = useState([]);
    const [showInCommon, setShowInCommon] = useState(false);
    const [sims, setSims] = useState({});
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

    const buildSimulation = (chunks, sSequence, links, x_count, width, x_measureCount, gts) => {
        // fix chunks to positions
        const traj_gap = width;
        const center_x = x_count * width + x_count * traj_gap;    
        const cluster_gap = width / x_measureCount;
        const halfX = Math.floor(x_measureCount / 2);    
    
        const sim = d3.forceSimulation([...chunks, ...sSequence])
              .force("link", d3.forceLink(links).id(function(d) { return d.id; }))
              .force("x", d3.forceX((d) => {
                  if(d.x_measure === halfX) {
                      return center_x;
                  } else {
                      if (d.x_measure < halfX) {
                          return center_x - ((halfX - d.x_measure) * cluster_gap);
                      } else {
                          return center_x + ((d.x_measure - halfX) * cluster_gap);
                      }
                  }
              }))       
              .force("charge", d3.forceManyBody().theta(0.6))
              .force("collide", d3.forceCollide().iterations(2).radius((d) => {
                  if(d.size !== undefined && d.size !== null) {
                      return gts(d.size) * 1.25;
                  } else {
                      return 6.125;
                  }                    
              })).stop();
        
        return sim;
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
    
    const renderGraph = (links, chunks, sSequence, l, g, c, name, trajectory, gts, idToTimestep) => {
        const colors = trajectory.colors;

        const sequenceData = g.selectAll('circle')
              .data(sSequence, (d) => d.id);

        sequenceData.enter()
              .append('circle')        
              .attr('r', 5)
              .attr('id', d => `node_${d.id}`).attr('fill', function(d) {              
                  return colors[trajectory.idToCluster[d.id]];                  
              }).on('click', function(_,d) {
                  if(individualSelectionMode) {
                      setInternalExtents((prev) => [...prev, {'name': name, 'states': [d]}]);             
                  } else {
                      setStateClicked(globalUniqueStates.get(d.id));
                  }
              }).on('mouseover', function(_, d) {                 
                  onStateMouseOver(this, globalUniqueStates.get(d.id), trajectory, name);
                  const timesteps = idToTimestep.get(d.id);
                  if(timesteps.length === 1) {                        
                      setStateHovered({'caller': this, 'stateID': d.id, 'name': name, 'timestep': timesteps[0]});
                  } else {
                      setStateHovered({'caller': this, 'stateID': d.id, 'name': name, 'timesteps': timesteps});
                  }                  
              }).on('mouseout', function() {                  
                  setStateHovered(null);
              })
            .classed('clickable', true)
            .classed('node', true);

        sequenceData.exit().remove();
        
        const chunkData = c.selectAll('circle')
              .data(chunks, (d) => d.id);
        
        chunkData.enter()
            .append('circle')                
            .attr('r', (d) => {
                return gts(d.size);
            })
            .attr('fill', function(d) { return trajectory.colors[trajectory.idToCluster[d.firstID]]; })
            .on('mouseover', function(_, d) {                      
                d3.select(this).classed('importantChunkDashedStroke', false);           
                onChunkMouseOver(this, d, name);                 
            }).on('mouseout', function() {
                d3.select(this).classed('importantChunkDashedStroke', true);                      
            })
            .classed("importantChunk", (d) => d.important)
            .classed("unimportantChunk", (d) => !d.important)
            .classed('node', true);

        chunkData.exit().remove();

        const linkData = l.selectAll("path")
            .data(links, (d) => d.id);

        linkData.enter().append("path")
            .classed('link', true)
            .attr("fill", "none")
            .classed("arrowed", showArrows)
            .classed("dashedStroke", (d) => d.dashStroke)
        ;

        linkData.exit().remove();
        
        if(showTransitionProb) {
            l.selectAll('.link').attr("opacity", (d) => {
                return d.transitionProb;
            });
        }

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
             
        // https://bl.ocks.org/mbostock/1062288 - collapsible tree
        // https://coppelia.io/2014/07/an-a-to-z-of-extra-features-for-the-d3-force-layout/
        // http://bl.ocks.org/samuelleach/5497403
        const globalChunkSizes = [];
        for(const [name, trajectory] of Object.entries(trajectories)) {
            const chunkData = trajectory.simplifiedSequence.chunks;
            const chunkList = Array.from(chunkData.values()).filter((d) => d.parentID === undefined);
            const chunkSizes = chunkList.map((d) => d.size);
            globalChunkSizes.push(...chunkSizes);
            visible[name] = {chunkList: chunkList, sequence: [], links: []};
        }
                
        const gts = d3.scaleLinear().range([10,125]).domain([0, Math.max(...globalChunkSizes)]);        
        
        const seen = [];                       
        let x_count = 0;
        let y_count = 0;

        let globalChunks = [];
        let globalSequence = [];
        let globalLinks = [];
        let trajCount = 0;

        for (const [name, trajectory] of Object.entries(trajectories)) {                                              
            const chunkData = trajectory.simplifiedSequence.chunks;
            const chunks = visible[name].chunkList;
            const links = visible[name].links;
            const sSequence = visible[name].sequence;            
            const sorted = [...sSequence, ...chunks].sort((a,b) => a.timestep - b.timestep);
            
            for(let i = 0; i < sorted.length - 1; i++) {
                const tp = (sorted[i].id > 0 && sorted[i+1].id > 0) ? trajectory.occurrenceMap.get(sorted[i].id).get(sorted[i+1].id) : 1.0;
                links.push({
                    source: sorted[i].id,
                    target: sorted[i+1].id,
                    id: `${sorted[i].id}-${sorted[i+1].id}`,
                    transitionProb: tp,
                    dashStroke: (sorted[i].timestep + 1 !== sorted[i+1].timestep) ? true : false
                });
            }

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
                for(const link of links) {
                    const tc_idx = (link.target > 0) ? link.target : chunkData.get(link.target).firstID;
                    const sc_idx = (link.source > 0) ? link.source : chunkData.get(link.source).firstID;
                    const targetCluster = trajectory.idToCluster[tc_idx];
                    const sourceCluster = trajectory.idToCluster[sc_idx];

                    const targetNode = chunkData.get(link.target);
                    const sourceNode = chunkData.get(link.source);
                                        
                    targetNode.x_measure = targetCluster;
                    sourceNode.x_measure = sourceCluster;                    
                }
                
                const l = linkGroup.append("g").attr('id', `l_${name}`);                                   
                const g = importantGroup.append('g').attr('id', `g_${name}`);      
                const c = chunkGroup.append('g').attr('id', `c_${name}`);                    
                const sim = buildSimulation(chunks, sSequence, links, x_count, width, trajectory.current_clustering, gts);

                renderGraph(links, chunks, sSequence, l, g, c, name, trajectory, gts);

                const ticked = () => {
                    g.selectAll('.node')
                        .attr("cx", (d) => d.x)
                        .attr("cy", (d) => d.y);

                    c.selectAll('.node')
                        .attr("cx", (d) => d.x)
                        .attr("cy", (d) => d.y);
                                         
                    l.selectAll('.link').attr("d", (d) => {                        
                        const rt = (d.target.size) ? gts(d.target.size) : 5;
                        const rs = (d.source.size) ? gts(d.source.size) : 5;
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
                }
                sim.on('tick', ticked);
                sim.alpha(0.1).restart();
                setSims({...sims, [name]: sim});
                trajRendered[name] = true;                                                    
            }
                                
            x_count++;
                
            if(x_count === 3) {
                x_count = 0;
                y_count++;                    
            }                
        }
        trajCount++;    

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
                maxChunkSize: globalTimeScale(Math.max(...globalChunkSizes))
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
                                        
                    renderGraph(links, chunks, renderNow, l, g, c, name, trajectory, globalTimeScale);
                    
                    g.selectAll('.node')
                        .attr("cx", function(d) { return globalSequenceMap.get(d.id).x; })
                        .attr("cy", function(d) { return globalSequenceMap.get(d.id).y; });

                    c.selectAll('.node')
                        .attr("cx", function(d) { return globalChunkMap.get(d.id).x; })
                        .attr("cy", function(d) { return globalChunkMap.get(d.id).y; });

                    l.selectAll('.link')
                        .attr("d", (d) => {                        
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
                    g.selectAll('.node').filter((d) => {
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
        
        // set default view for SVG

        const bbox = container.node().getBBox();
        const vx = bbox.x;
        const vy = bbox.y;	
        const vw = bbox.width;
        const vh = bbox.height;

        const defaultView = `${vx} ${vy} ${vw} ${vh}`;        

        // the trick to zooming like this is to move the container without moving the SVG's viewport
        zoom = d3.zoom().on('zoom', function(e) {
            container.attr("transform", e.transform);
        });
        
        globalTimeScale = gts;

        svg.attr("viewBox", defaultView).attr("preserveAspectRatio", "none")
            .call(zoom);

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
        if(visibleProp) {           
            for(const [name, visible] of Object.entries(visibleProp)) {                
                const sequence = visible.sequence;
                const chunkList = visible.chunkList;
                if(previousVisible && previousVisible[name].sequence.length === sequence.length && previousVisible[name].chunkList.length === chunkList.length) {
                    continue;
                }
                const sim = sims[name];
                const trajectory = trajectories[name];
                const chunkData = trajectory.simplifiedSequence.chunks;
                const links = [];
                const sorted = [...sequence, ...chunkList].sort((a,b) => a.timestep - b.timestep);

                for(let i = 0; i < sorted.length - 1; i++) {
                    // when drawing and there's a large gap, render dashed stroke
                    const tp = (sorted[i].id > 0 && sorted[i+1].id > 0) ? trajectory.occurrenceMap.get(sorted[i].id).get(sorted[i+1].id) : 1.0;
                    links.push({
                        source: sorted[i].id,
                        target: sorted[i+1].id,
                        id: `${sorted[i].id}-${sorted[i+1].id}`,
                        transitionProb: tp,
                        dashStroke: (sorted[i].timestep + 1 !== sorted[i+1].timestep) ? true : false
                    });
                }

                const idToTimestep = new Map();

                const seqLen = sequence.length;
                for(let i = 0; i < seqLen; i++) {
                    const s = sequence[i];
                    if(idToTimestep.has(s.id)) {
                        const timestepList = idToTimestep.get(s.id);
                        idToTimestep.set(s.id, [...timestepList, s.timestep]);
                    } else {
                        idToTimestep.set(s.id, [s.timestep]);
                    }
                }
                       
                const sequenceMap = new Map();
                sequence.map((state) => {
                    sequenceMap.set(state.id, state);
                });


                for(let i = 0; i < links.length; i++) {
                    const link = links[i];
                    const tc_idx = (link.target > 0) ? link.target : chunkData.get(link.target).firstID;
                    const sc_idx = (link.source > 0) ? link.source : chunkData.get(link.source).firstID;
                    const targetCluster = trajectory.idToCluster[tc_idx];
                    const sourceCluster = trajectory.idToCluster[sc_idx];
                                        
                    const targetNode = (link.target > 0) ? sequenceMap.get(link.target) : chunkData.get(link.target);
                    targetNode.x_measure = targetCluster;
                    
                    const sourceNode = (link.source > 0) ? sequenceMap.get(link.source) : chunkData.get(link.source);
                    sourceNode.x_measure = sourceCluster;

                    link.color = trajectory.colors[targetCluster];
                    links[i] = link;
                }
                
                const l = d3.select('#graph').select(`#l_${name}`);
                const g = d3.select('#graph').select(`#g_${name}`);
                const c = d3.select('#graph').select(`#c_${name}`);
                
                sim.nodes(sorted);
                sim.force('link').links(links);
                // manipulate data in such a way that nothing gets lost
                renderGraph(links, chunkList, Array.from(sequenceMap.values()), l, g, c, name, trajectory, globalTimeScale, idToTimestep);

                const ticked = () => {
                    g.selectAll('.node')
                        .attr("cx", (d) => d.x)
                        .attr("cy", (d) => d.y);

                    c.selectAll('.node')
                        .attr("cx", (d) => d.x)
                        .attr("cy", (d) => d.y);
                                         
                    l.selectAll('.link')
                        .attr("d", (d) => {                        
                            const rt = (d.target.size) ? globalTimeScale(d.target.size) : 5;
                            const rs = (d.source.size) ? globalTimeScale(d.source.size) : 5;
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
                            return d.color;
                    });
                }
                sim.on('tick', ticked);
                sim.restart().alpha(0.5);
            }                    
        }
    }, [visibleProp]);
    
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
                <svg className="vis" id="graph" onContextMenu={toggleMenu} ref={ref} viewBox={[0,0,width,height]}/>
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
