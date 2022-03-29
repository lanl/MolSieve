import {
    React, useEffect, useState, useRef,
} from 'react';
import * as d3 from 'd3';
import { onStateMouseOver, onChunkMouseOver } from '../api/myutils';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

function GraphVis({trajectories, runs }) {

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

    const ref = useTrajectoryChartRender((svg) => {

        if (height === undefined || width === undefined) {
            return;
        }
        // clear so we don't draw over-top and cause insane lag
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


        // switch to only running one simulation
        
        for (const [name, trajectory] of Object.entries(trajectories)) {
            
            const chunks = trajectory.simplifiedSequence.chunks;
            const sSequence = trajectory.simplifiedSequence.uniqueStates;
            const links = trajectory.simplifiedSequence.interleaved;
            const colors = trajectory.colors;

            trajectory.name = name;
            
            // chunk strength - a measure of its size
            // state strength - measure of its occurences                        
            
            const chunkSizes = chunks.map((chunk) => {
                chunk.size = chunk.last - chunk.timestep;
                return chunk.size;
            });            

            // scale could be 5 times * threshold cluster
            const timeScale = d3.scaleLinear().range([5,125]).domain([0,Math.max(...chunkSizes)]);            
            
            const l = linkGroup.append("g").attr('id', 'l_${name}');
            let link = l.selectAll("line").data(links).enter().append("line").attr("stroke-width", 1).attr("stroke", "black");
            
            const g = importantGroup.append('g').attr('id', `g_${name}`);            
            let stateNodes = g.selectAll('circle')
                    .data(sSequence)
                    .enter()
                    .append('circle')
                    .attr('r', 5)
                    .attr('fill', function(d) {
                        if (d.cluster === -1) {
                            return 'black';
                        }
                        return colors[d.cluster];
                    }).on('mouseover', function(_, d) {                        
                        onStateMouseOver(this, d, trajectory, name);
                    }).on('mouseout', function() {
                        this.setAttribute('stroke', 'none');
                    });
                        
            const c = chunkGroup.append('g').attr('id', `c_${name}`);            
            let chunkNodes = c.selectAll('circle')
                .data(chunks)
                .enter()
                .append('circle')                
                .attr('r', (d) => {
                    return timeScale(d.size);
                })
                .attr('fill', function(d) {
                    if (d.color === -1) {
                        return 'black';
                    }
                    return colors[d.color];
                }).on('mouseover', function(_, d) {
                    this.setAttribute('stroke', 'black');
                    onChunkMouseOver(this, d, name);
                }).on('mouseout', function () {                        
                    this.setAttribute('stroke', 'none');
                });
            
            if (Object.keys(runs[name].filters).length > 0) {
                for (const k of Object.keys(runs[name].filters)) {
                    const filter = runs[name].filters[k];
                    if (filter.enabled) {
                        filter.func(trajectory, svg, filter.options);
                    }
                }
            }                    
        
            d3.forceSimulation([...chunks, ...sSequence])
                .force("link", d3.forceLink(links).id(function(d) { return d.number; }))
                .force("charge", d3.forceManyBody().distanceMax(300).theta(0.75))
                .force("collide", d3.forceCollide().strength(10).radius((d) => {
                    if(d.size !== undefined && d.size !== null) {
                        return timeScale(d.size);
                    } else {
                        return 5;
                    }                    
                }))
                .on('tick', ticked);                       

            function ticked() {
                link
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
           
            /*function drag(simulation) {    
                function dragstarted(event) {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    event.subject.fx = event.subject.x;
                    event.subject.fy = event.subject.y;
                }
    
                function dragged(event) {
                    event.subject.fx = event.x;
                    event.subject.fy = event.y;
                }
    
                function dragended(event) {
                    if (!event.active) simulation.alphaTarget(0);
                    event.subject.fx = null;
                    event.subject.fy = null;
                }
    
                return d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged)
                    .on("end", dragended);
                    }*/            
        }

        // the trick to zooming like this is to move the container without moving the SVG's viewport
        
        const zoom = d3.zoom().on('zoom', function(e) {
            container.attr("transform", e.transform);  
        });

        // set default view for SVG
        const bbox = container.node().getBBox();
        const vx = bbox.x;
        const vy = bbox.y;	
        const vw = bbox.width;
        const vh = bbox.height;
        const defaultView = `${vx} ${vy} ${vw} ${vh}`;
        
        svg.attr("viewBox", defaultView).attr("preserveAspectRatio", "xMidYMid meet").call(zoom);
            
    }        
    , [runs, width, height, trajectories]);

    return (<div ref={divRef}>
                {width && height && Object.keys(trajectories).length === Object.keys(runs).length
                 && <svg id="svg_nodes" ref={ref} viewBox={[0,0,width,height]}/>}                
            </div>);    
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
