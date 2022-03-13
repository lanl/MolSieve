import { React, useEffect, useState, useRef } from "react";
import { useTrajectoryChartRender } from "../hooks/useTrajectoryChartRender";
import { intToRGB } from "../api/myutils";
import Box from "@mui/material/Box";
import * as d3 from "d3";
//import tippy from "tippy.js";
//import "tippy.js/dist/tippy.css";

const margin = { top: 20, bottom: 20, left: 40, right: 25 };

function SelectionVis({data, loadingCallback}) {
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
    }, [data]);

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

            // stolen from https://www.visualcinnamon.com/2016/06/glow-filter-d3-visualization/            
            // Container for the gradients
            var defs = svg.append("defs");

            // Filter for the outside glow
            var filter = defs.append("filter")
                .attr("id","glow");
            filter.append("feGaussianBlur")
                .attr("stdDeviation","10")
                .attr("result","coloredBlur");
            
            var feMerge = filter.append("feMerge");
            feMerge.append("feMergeNode")
                .attr("in","coloredBlur");
            feMerge.append("feMergeNode")
                .attr("in","SourceGraphic");            
                       
            let extents = Object.values(data.extents);            
            
            let sequence = data.sequence;           
            let run = data.run;            
            
            var scale_x = d3.scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([0, sequence.length]);

            svg.selectAll("rect")
                .data(sequence)
                .enter()
                .append("rect")
                .attr("x", function(_, i) {
                    return scale_x(i);
                })
                .attr("y", height * 0.2 + 5)                                   
                .attr("width", 5)
                .attr("height", 10)                
                .attr("fill", function(d) {
                    if (d["cluster"] == -1) {
                        return "black";
                    }
                    return intToRGB(d["cluster"]);                 
                })

            svg.selectAll("rect")
                .filter(function(d) {
                    for(var extent of extents) {                        
                        if(d['timestep'] >= extent['begin']['timestep'] && d['timestep'] <= extent['end']['timestep']) {
                            return true;
                        }
                    }
                    return false;
                })
                .attr("height", 20)
                .attr("y", height * 0.2)            
                .style("filter", "url(#glow)");
                                    
            let title = `${run}: `;

            for(let extent of extents) {
                title += `${extent['begin']['timestep']} - ${extent['end']['timestep']} `
            }

            svg.append("text")
                .attr("x", width / 2)
                .attr("y", margin.top)
                .attr("text-anchor", "middle")
                .style("font-size", "12px")
                .text(title);

            if(loadingCallback !== undefined) {
                loadingCallback();
            }
        });

    return (
        <Box ref={divRef} sx={{ height: 150 }}>
            {width && height && (
                <svg ref={ref} viewBox={[0, 0, width, height]} />
            )}
        </Box>
    );
}

export default SelectionVis;
