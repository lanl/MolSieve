import { React, memo, useEffect } from "react";
import Box from "@mui/material/Box";
import * as d3 from "d3";
import { useTrajectoryChartRender } from "../hooks/useTrajectoryChartRender";
import { useResize } from '../hooks/useResize';
import { onStateMouseOver } from '../api/myutils';

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
                    const newEx = Object.assign({}, ex);
                    newEx.firstID = ex.states[0].id;
                    safeExtents = [...safeExtents, newEx];
                }                
            }            
            
            if(statesSeen.size > 0) {
                for(const id of statesSeen) {
                    const state = globalUniqueStates.get(id);
                    for(const seen of state.seenIn) {
                        const traj = trajectories[seen];
                        const timesteps = traj.idToTimestep.get(id);

                        // show first, and if it exists, last occurrence of timestep
                        const newEx = {'name': `${seen}`, 'begin': timesteps[0], 'end': timesteps[timesteps.length - 1], 'id': id};
                        safeExtents = [...safeExtents, newEx];                        
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
                .scaleOrdinal()
                .range([margin.top + 10, height - margin.bottom])
                .domain(Object.keys(trajectories));

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

                g.selectAll("rect")
                    .data(extentArray)
                    .enter()
                    .append("rect")
                    .attr("x", (d) => scaleX(d.begin))
                    .attr("y", (d) => scaleY(d.name) - 10)
                    .attr("width", (d) => scaleX(d.end) - scaleX(d.begin))
                    .attr("height", 30)
                    .attr("fill", "none")
                    .attr("stroke", function (d) {
                        const id = (d.firstID) ? d.firstID : d.id;
                        const traj = trajectories[d.name];                                        
                        return traj.colors[traj.idToCluster[id]];
                    }).on('mouseover', function(_,d) {
                        if(!d.firstID) {
                            onStateMouseOver(this, globalUniqueStates.get(d.id), trajectories[d.name], d.name);
                        }
                    });
                
                for(const [idx, extent] of extentArray.entries()) {                    
                    let ignore = null;

                    if(idx === 0) {
                        // if the extents don't cover the first element                    
                        if(extent.begin !== 0) {
                            ignore = {
                                begin: 0,
                                end: extent.begin - 1,
                                name: extent.name
                            };
                            ignored.push(ignore);
                        }
                    }
                    
                    if(idx !== extentArray.length - 1) {
                        ignore = {
                            begin: extent.end,
                            end: extentArray[idx + 1].begin - 1,
                            name: extent.name
                        };                                             
                    } else {
                        if(extent.end !== sequence.length) {
                            ignore = {
                                begin: extent.end,
                                end: sequence.length,
                                name: extent.name
                            };                       
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
                    .attr("y", (d) => scaleY(d.name))
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
                .attr('height', height)
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
