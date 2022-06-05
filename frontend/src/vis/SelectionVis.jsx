import { React, memo, useEffect } from "react";
import Box from "@mui/material/Box";
import * as d3 from "d3";
import { useTrajectoryChartRender } from "../hooks/useTrajectoryChartRender";
import { useResize } from '../hooks/useResize';

import "../css/vis.css";

const margin = {
    top: 20,
    bottom: 20,
    left: 40,
    right: 25,
};

let scaleX = null;
let scaleY = null;

function SelectionVis({ trajectories, extents, loadingCallback, style, globalUniqueStates, titleProp, sequenceExtent }) {
    const {width, height, divRef} = useResize();
    
    const ref = useTrajectoryChartRender(
        (svg) => {
            if (height === undefined || width === undefined) {
                return;
            }

            if (!svg.empty()) {
                svg.selectAll("*").remove();
            }

            let safeExtents = [];            
            const statesSeen = new Set();
            for(let ex of extents) {
                if(!ex.begin && !ex.end) {
                    for(const e of ex.states) {
                        statesSeen.add(e.id);
                    }                                             
                } else {
                    safeExtents = [...safeExtents, ex];
                }
                
            }            
            
            if(statesSeen.size > 0) {
                for(const id of statesSeen) {
                    const state = globalUniqueStates.get(id);
                    for(const seen of state.seenIn) {
                        const traj = trajectories[seen];
                        const timesteps = traj.idToTimestep.get(id);

                        // very slow! start here
                        for(const t of timesteps) {
                            const newEx = {'name': `${seen}`, 'begin': t, 'end': t};
                            safeExtents = [...safeExtents, newEx];
                        }
                    }
                }
            }

            const groupedExtents = d3.group(safeExtents, (d) => d.name);
            const maxLength = d3.max(
                Object.values(trajectories),
                (t) => t.sequence.length
            );

            scaleX = d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([0, maxLength]);

            scaleY = d3
                .scaleLinear()
                .range([margin.top + 10, height - margin.bottom])
                .domain([0, Object.keys(trajectories).length]);

            let count = 0;

            //stores the rectangle that gets drawn when the view moves
            svg.append('g').attr('id', 'extentGroup');

            for (const [name, extentArray] of groupedExtents.entries()) {
                const { sequence } = trajectories[name];

                const g = svg.append('g');
                const ig = svg.append('g');                

                extentArray.sort(function (a,b) {
                    return d3.ascending(a.begin, b.begin);
                });

                const ignored = [];
                
                for(const [idx, extent] of extentArray.entries()) {
                    const grouping = [];
                    
                    for(let i = extent.begin; i <= extent.end || i < 1000; i++) {
                        grouping.push({
                            'timestep': i,
                            'id': sequence[i]
                        });
                    }                    

                    g.selectAll("rect")
                        .data(grouping)
                        .enter()
                        .append("rect")
                        .attr("x", (d) => scaleX(d.timestep))
                        .attr("y", () => scaleY(count))
                        .attr("width", 1)
                        .attr("height", 10)
                        .attr("fill", function (d) {
                            const state = globalUniqueStates.get(d.id);                    
                            const traj = trajectories[state.seenIn[0]];                                        
                            return traj.colors[traj.idToCluster[state.id]];
                        });
                    
                    let ignore = null;
                                        
                    // if the extents don't cover the first element
                    if(idx === 0) {
                        if(extent.begin !== 0) {
                            ignore = {begin: 0, end: extent.begin - 1};
                            ignored.push(ignore);
                        }
                    }

                    
                    if(idx !== extentArray.length - 1) {
                        ignore = {begin: extent.end, end: extentArray[idx + 1].begin - 1};
                    } else {
                        if(extent.end !== sequence.length) {
                            ignore = {begin: extent.end, end: sequence.length};                       
                        }
                    }
                    if(ignore) {
                        ignored.push(ignore);
                    }
                    
                }                    
            
                ig.selectAll("rect")
                    .data(ignored)
                    .enter()
                    .append("rect")
                    .attr("x", (d) => scaleX(d.begin))
                    .attr("y", () => scaleY(count))
                    .attr("width", (d) => scaleX(d.end) - scaleX(d.begin))
                    .attr("height", 10)
                    .attr("fill", "none")
                    .attr("stroke", "lightgray");
                
                let title = null;
                
                if (titleProp == null || titleProp == undefined) {
                    title = `${name} `;
                    for (const extent of extents) {
                        title += `${extent.begin} - ${extent.end} `;
                    }
                } else {
                    title = titleProp;
                }
                
                svg.append('text')
                    .attr('x', width / 2)
                    .attr('y', margin.top)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '12px')
                    .text(title);
                count++;
            }

            if (loadingCallback !== undefined) {
                loadingCallback();
            }
        },
        [width, height, trajectories]
    );

    useEffect(() => {
        if(sequenceExtent && scaleX && scaleY) {            
            const g = d3.select(ref.current).select('#extentGroup');
            g.selectAll('rect').remove();
            g.append('rect')
                .attr('x', scaleX(sequenceExtent[0]))
                .attr('y', 0)
                .attr('width', scaleX(sequenceExtent[1]) - scaleX(sequenceExtent[0]))
                .attr('height', height - margin.bottom)
                .attr('fill', 'none')
                .attr('stroke', 'gray');
        }
    }, [sequenceExtent]);

    return (
        <Box ref={divRef} sx={style.sx}>
            {width && height && (
                <svg
                    ref={ref}
                    preserveAspectRatio="none"
                    viewBox={[0, 0, width, height]}
                />
            )}
        </Box>
    );
}
// no need to re-render
export default memo(SelectionVis);
