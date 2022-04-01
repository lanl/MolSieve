import {
    React, useEffect, useState, useRef
} from 'react';
import * as d3 from 'd3';
import '../css/vis.css';
import { onStateMouseOver, onChunkMouseOver } from '../api/myutils';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import usePrevious from '../hooks/usePrevious';
import {apply_filters} from '../api/filters';

let globalLinkNodes = null;
let globalChunkNodes = null;
let globalStateNodes = null;
let container = null;

let vx = null;
let vy = null;
let vw = null;
let vh = null;
let zoom = null;

function GraphVis({trajectories, runs, globalUniqueStates, stateHovered, setStateClicked }) {

    const divRef = useRef();
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();

    const previousStateHovered = usePrevious(stateHovered);
    
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
            svg.selectAll('*').remove();
        }                                                  

        var defs = svg.append("defs");
        //Filter for the outside glow
        var filter = defs.append("filter")
            .attr("id","changeColor");

        filter.append("feColorMatrix")
            .attr("type","hueRotate")
            .attr("values","180");

        
        // used for zooming https://gist.github.com/catherinekerr/b3227f16cebc8dd8beee461a945fb323
        container = svg.append('g')
              .attr('id', 'container')
              .attr('transform', "translate(0,0)scale(1,1)");
        
        const importantGroup = container.append('g').attr('id', 'important');
        const chunkGroup = container.append('g').attr('id', 'chunk');
        const linkGroup = container.append('g').attr('id', 'links');

        // if not seperate trajectories
        // merge chunks, sSequence, links
        const seperateTrajectories = true;
        
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
        const globalTimeScale = d3.scaleLinear().range([5,125]).domain([0, Math.max(...chunkSizes)]);            
        const seen = [];
        
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
                let {linkNodes, stateNodes, chunkNodes} = renderGraph(links, chunks, sSequence, l, g, c, name, colors, globalTimeScale, trajectory, globalUniqueStates, setStateClicked);                                                
                d3.forceSimulation([...chunks, ...sSequence])
                    .force("link", d3.forceLink(links).id(function(d) { return d.id; }))
//                    .force("charge", d3.forceManyBody().distanceMax(300).theta(0.75))
                    .force("collide", d3.forceCollide().strength(10).radius((d) => {
                        if(d.size !== undefined && d.size !== null) {
                            return globalTimeScale(d.size);
                        } else {
                            return 5;
                        }                    
                    })).on('tick', ticked_single);

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
                renderGraph(simulatedLinks, chunks, renderNow, l, g, c, name, colors, globalTimeScale, trajectory)                
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
                .force("charge", d3.forceManyBody().distanceMax(300).theta(0.75))
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
        vx = bbox.x;
        vy = bbox.y;	
        vw = bbox.width;
        vh = bbox.height;
        const defaultView = `${vx} ${vy} ${vw} ${vh}`;
        
        svg.attr("viewBox", defaultView).attr("preserveAspectRatio", "xMidYMid meet").call(zoom);

        //used to be run, width, height
    }, [width, height, trajectories]);

    useEffect(() => {
        if (ref) {
            apply_filters(trajectories, runs, globalUniqueStates, ref);
        }
    }, [runs]);

    useEffect(() => {
        if(stateHovered !== undefined && stateHovered !== null) {
            if(previousStateHovered !== undefined && previousStateHovered !== null) {
                const node = d3.select(ref.current).select(`#node_${previousStateHovered}`).node();
                node.classList.toggle("highlightedState");
            }
            const select = d3.select(ref.current).select(`#node_${stateHovered}`);
            select.classed("highlightedState", true);

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
    }, [stateHovered]);

    return (<div ref={divRef}>
                {width && height && Object.keys(trajectories).length === Object.keys(runs).length
                 && <svg id="svg_nodes" ref={ref} viewBox={[0,0,width,height]}/>}                
            </div>);    
}

function renderGraph(links, chunks, sSequence, l, g, c, name, colors, timeScale, trajectory, globalUniqueStates, setStateClicked) {    

    const linkNodes = l.selectAll("line").data(links).enter().append("line").attr("stroke-width", 1).attr("stroke", "black");    
    const stateNodes = g.selectAll('circle')
          .data(sSequence)
          .enter()
          .append('circle')
          .attr('r', 5)
          .attr('id', d => `node_${d.id}`)
          .attr('fill', function(d) {              
              return colors[trajectory.idToCluster[d.id]];
          }).on('click', function(_,d) {
              if (this.getAttribute('opacity') > 0) {                                                        
                  setStateClicked(d);
              }                        
          })    
          .on('mouseover', function(_, d) {
            if(trajectory !== null && trajectory !== undefined) {
                onStateMouseOver(this, globalUniqueStates[d.id], trajectory, name);
            }
            // move this out 
            d3.select('#sequence_important').selectAll('g').selectAll('*').filter(function(dp) {                                    
                return (dp.id == d.id) && this.getAttribute('opacity') > 0;
            }).attr('stroke', 'black');
       
        }).on('mouseout', function(_,d) {
            this.setAttribute('stroke', 'none');
            d3.select(`#sequence_important`).selectAll('g').selectAll('*').filter(function(dp) {
                return (dp.id == d.id) && this.getAttribute('opacity') > 0;
            }).attr('stroke', 'none');
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
            this.setAttribute('stroke', 'black');
            onChunkMouseOver(this, d, name);
        }).on('mouseout', function () {                        
            this.setAttribute('stroke', 'none');
        });
    
    return {linkNodes, stateNodes, chunkNodes};
}

export default GraphVis;
