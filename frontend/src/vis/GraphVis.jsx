import {
    React, useEffect, useState, useRef,
} from 'react';
import * as d3 from 'd3';
import { onStateMouseOver, onChunkMouseOver } from '../api/myutils';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

let globalLinkNodes = null;
let globalChunkNodes = null;
let globalStateNodes = null;

function GraphVis({trajectories, runs, globalUniqueStates }) {

    const divRef = useRef();
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();

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
        console.log("rendering...");
        
        if (!svg.empty()) {
            svg.selectAll('*').remove();
        }

        // used for zooming https://gist.github.com/catherinekerr/b3227f16cebc8dd8beee461a945fb323
        const container = svg.append('g')
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
                let {linkNodes, stateNodes, chunkNodes} = renderGraph(links, chunks, sSequence, l, g, c, name, colors, globalTimeScale, trajectory, globalUniqueStates);

                /*if (Object.keys(runs[name].filters).length > 0) {
                    for (const k of Object.keys(runs[name].filters)) {
                        const filter = runs[name].filters[k];
                        if (filter.enabled) {
                            filter.func(trajectory, svg, globalUniqueStates, filter.options);
                        }
                    }
                }*/
                
                d3.forceSimulation([...chunks, ...sSequence])
                    .force("link", d3.forceLink(links).id(function(d) { return d.id; }))
                    .force("charge", d3.forceManyBody().distanceMax(300).theta(0.75))
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
        
        const zoom = d3.zoom().on('zoom', function(e) {
            container.attr("transform", e.transform);  
        });

        if(!seperateTrajectories) {                       
            globalLinkNodes = linkGroup.selectAll('line');
            globalStateNodes = importantGroup.selectAll('circle');
            globalChunkNodes = chunkGroup.selectAll('circle');            

            d3.forceSimulation(simulated)
                .force("link", d3.forceLink(simulatedLinks).id(function(d) { return d.number; }))
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
        const vx = bbox.x;
        const vy = bbox.y;	
        const vw = bbox.width;
        const vh = bbox.height;
        const defaultView = `${vx} ${vy} ${vw} ${vh}`;
        
        svg.attr("viewBox", defaultView).attr("preserveAspectRatio", "xMidYMid meet").call(zoom);

        //used to be run, width, height
    }, [width, height, trajectories]);

    useEffect(() => {
        if (ref) {
            for (const [name, trajectory] of Object.entries(trajectories)) {
                const undoGroups = ['g', 'l', 'c'];
                if (Object.keys(runs[name].filters).length > 0) {
                    for (const k of Object.keys(runs[name].filters)) {
                        const filter = runs[name].filters[k];
                        if (filter.enabled) {
                            filter.func(trajectory, d3.select(ref.current), globalUniqueStates, filter.options);
                            if (undoGroups.includes(filter.group)) {
                                undoGroups.splice(undoGroups.indexOf(filter.group));
                            }
                        }
                    }
                    for (const group of undoGroups) {
                        d3.select(ref.current).select(`#${group}_${name}`)
                            .selectAll('*')
                            .attr("opacity", 1.0)
                            .attr("fill", function(d) {
                                if(group === 'c') {
                                    return trajectory.colors[trajectory.idToCluster[-d.id]];
                                } else {
                                    return trajectory.colors[trajectory.idToCluster[d.id]];
                                }
                            });
                    }
                }
            }
        }
    }, [runs]);

    return (<div ref={divRef}>
                {width && height && Object.keys(trajectories).length === Object.keys(runs).length
                 && <svg id="svg_nodes" ref={ref} viewBox={[0,0,width,height]}/>}                
            </div>);    
}

function renderGraph(links, chunks, sSequence, l, g, c, name, colors, timeScale, trajectory, globalUniqueStates) {    

    const linkNodes = l.selectAll("line").data(links).enter().append("line").attr("stroke-width", 1).attr("stroke", "black");    
    const stateNodes = g.selectAll('circle')
          .data(sSequence)
          .enter()
          .append('circle')
          .attr('r', 5)
          .attr('fill', function(d) {              
              return colors[trajectory.idToCluster[d.id]];
        }).on('mouseover', function(_, d) {
            if(trajectory !== null && trajectory !== undefined) {
                onStateMouseOver(this, globalUniqueStates[d.id], trajectory, name);
            }
        }).on('mouseout', function() {
            this.setAttribute('stroke', 'none');
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

// might still be useful for centering on trajectory
/*function getTransform(node, xScale) {
    bbox = node.node().getBBox();
    var bx = bbox.x;
    var by = bbox.y;
    var bw = bbox.width;
    var bh = bbox.height;
    var tx = -bx*xScale + vx + vw/2 - bw*xScale/2;
    var ty = -by*xScale + vy + vh/2 - bh*xScale/2;
    return {translate: [tx, ty], scale: xScale}
}*/

export default GraphVis;
