import { React, useEffect, useState, useRef, memo } from "react";
import Box from "@mui/material/Box";
import * as d3 from "d3";
import { useTrajectoryChartRender } from "../hooks/useTrajectoryChartRender";
import "../css/vis.css";

const margin = {
    top: 20,
    bottom: 20,
    left: 40,
    right: 25,
};

function SelectionVis({ trajectories, extents, loadingCallback }) {
    const divRef = useRef();
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();

    const resize = () => {
        if (!divRef || !divRef.current) {
            return;
        }

        const newWidth = divRef.current.parentElement.offsetWidth;
        setWidth(newWidth);

        const newHeight = divRef.current.parentElement.offsetHeight;
        setHeight(newHeight);
    };

    useEffect(() => {
        resize();
    }, [divRef]);

    useEffect(() => {
        window.addEventListener("resize", resize());
    }, []);

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (height === undefined || width === undefined) {
                return;
            }

            if (!svg.empty()) {
                svg.selectAll("*").remove();
            }

            const groupedExtents = d3.group(extents, (d) => d.name);
            const maxLength = d3.max(
                Object.values(trajectories),
                (t) => t.sequence.length
            );

            const scaleX = d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([0, maxLength]);

            const scaleY = d3
                .scaleLinear()
                .range([margin.top + 10, height - margin.bottom])
                .domain([0, Object.keys(trajectories).length]);

            let count = 0;

            for (const [name, extentArray] of groupedExtents.entries()) {
                const { sequence, colors, idToCluster } = trajectories[name];

                const g = svg.append('g');
                const ig = svg.append('g');

                extentArray.sort(function (a,b) {
                    return d3.ascending(a.begin, b.begin);
                });


                const ignored = [];
                
                for(const [idx, extent] of extentArray.entries()) {
                    const grouping = [];
                    
                    for(let i = extent.begin; i <= extent.end; i++) {
                        grouping.push({'timestep': i, 'id': sequence[i]});
                    }                    

                    g.selectAll("rect")
                        .data(grouping)
                        .enter()
                        .append("rect")
                        .attr("x", (d) => scaleX(d.timestep))
                        .attr("y", () => scaleY(count))
                        .attr("width", 1)
                        .attr("height", 10)
                        .attr("fill", (d) => {
                            return colors[idToCluster[d.id]];
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
                    .attr("stroke", "black");

                let title = `${name} `;

                for (const extent of extents) {
                    title += `${extent.begin} - ${extent.end} `;
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

    return (
        <Box ref={divRef}>
            {width && height && (
                <svg
                    ref={ref}
                    className="vis"
                    preserveAspectRatio="none"
                    viewBox={[0, 0, width, height]}
                />
            )}
        </Box>
    );
}
// no need to re-render
export default memo(SelectionVis);
