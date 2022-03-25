import {
    React, useEffect, useState, useRef,
} from 'react';
import * as d3 from 'd3';
//import tippy from 'tippy.js';
//import 'tippy.js/dist/tippy.css';
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
        
        const importantGroup = svg.append('g').attr('id', 'important');
        const chunkGroup = svg.append('g').attr('id', 'chunk');
        const linkGroup = svg.append('g').attr("id", 'links');
   
        for (const [name, trajectory] of Object.entries(trajectories)) {
            
            const chunks = trajectory.simplifiedSequence.chunks;
            const sSequence = trajectory.simplifiedSequence.sequence;
            const links = trajectory.simplifiedSequence.interleaved;
            const colors = trajectory.colors;
            const uniqueStates = [];

            const seen = [];
            for(const s of sSequence) {
                if(!seen.includes(s.number)) {
                    uniqueStates.push(s);
                    seen.push(s.number);
                }
            }
            
            // chunk strength - a measure of its size
            // state strength - measure of its occurences
            
            const chunkSizes = chunks.map((chunk) => {
                return chunk.last - chunk.timestep;
            })                        
            
            const timeScale = d3.scaleLinear().range([1,125]).domain([0,Math.max([...chunkSizes])]);
            
            const l = linkGroup.append("g").attr('id', 'l_${name}');
            let link = l.selectAll("line").data(links).enter().append("line").attr("stroke-width", 1).attr("stroke", "black");

            const g = importantGroup.append('g').attr('id', 'node_g_${name}');            

            let stateNodes = g.selectAll('circle')
                .data(uniqueStates)
                .enter()
                .append('circle')
                .attr('r', 5)
                .attr('fill', function(d) {
                    if (d.cluster === -1) {
                        return 'black';
                    }
                    return colors[d.cluster];
                }).on('mouseover', function(d) {
                    console.log(d);
                });

            
            const c = chunkGroup.append('g').attr('id', `node_c_${name}`);
            
            let chunkNodes = c.selectAll('circle')
                .data(chunks)
                .enter()
                .append('circle')
                .attr('r', (d) => { return timeScale(d.last - d.timestep); })
                .attr('fill', function(d) {
                    if (d.color === -1) {
                        return 'black';
                    }
                    return colors[d.color];
                });            


            d3.forceSimulation([...chunks, ...uniqueStates])
                .force("link", d3.forceLink(links).id(function(d) { return d.number; }).iterations(1))
                .force("charge", d3.forceManyBody().distanceMax(200).theta(0.6))
                       //.strength(function(d) {
                    // highly connected states attract others
                    //return links[]
            //    })
                .on('tick', ticked);
            
            // pass in entire dataset
            
//            simulation.force("link").links(links);

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

            const zoom = d3.zoom().on('zoom', function(e) {

//                const originX = e.clientX;
//                const originY = e.clientY;
                
                console.log(e.transform);
                const tX = e.transform.x;
                const tY = e.transform.y;
                //const s = e.transform.k;

                svg.attr("viewBox", `${tX},${tY}, ${width}, ${height}`);
                svg.attr("transform-origin", "0 0");

            });

            svg.call(zoom);
            
        }

        
    }, [runs, width, height, trajectories]);

    return (<div ref={divRef}>
                {width && height && Object.keys(trajectories).length === Object.keys(runs).length
                 && <svg id="svg_nodes" ref={ref} viewBox={[0,0,width,height]}/>}                
            </div>);    
}

export default GraphVis;
