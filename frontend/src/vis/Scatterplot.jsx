import { React, useEffect, useState, useRef } from "react";
import { useTrajectoryChartRender } from "../hooks/useTrajectoryChartRender";
import Box from "@mui/material/Box";
import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";
import * as d3 from "d3";

const margin = { top: 20, bottom: 20, left: 40, right: 25 };

function Scatterplot({ data, loadingCallback }) {
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

            let x_attribute = data.x_attribute;
            let y_attribute = data.y_attribute;
            let x_attributeList = data.x_attributeList;
            let y_attributeList = data.y_attributeList;
            const idToCluster = data.trajectory.idToCluster;
            let reverse = data.reverse;
            let path = data.path;
            let sequence = data.sequence;
            let title = data.title;
            let colors = data.colors;            
            
            if (reverse == null) reverse = false;
            if (path == null) path = false;

            if (x_attributeList == null) {
                x_attributeList = [];
                if(x_attribute !== 'timestep') {
                    for (const d of sequence) {
                        x_attributeList.push(d[x_attribute]);
                    }
                } else {
                    const start = (data.start) ? data.start : 0;
                    for(let i = 0; i < sequence.length; i++) {
                        x_attributeList.push(start + i);
                    }
                }
            }

            if (y_attributeList == null) {
                y_attributeList = [];
                if(y_attribute !== 'timestep') {
                    for (const d of sequence) {
                        y_attributeList.push(d[y_attribute]);
                    }
                } else {
                    const start = (data.start) ? data.start : 0;
                    for(let i = 0; i < sequence.length; i++) {
                        y_attributeList.push(start + i);
                    }
                }
            }

            var xtent = d3.extent(x_attributeList);
            var ytent = d3.extent(y_attributeList);

            var first = 0;
            var last = 1;

            if (reverse) {
                first = 1;
                last = 0;
            }

            // 1.25 for breathing room between axis and values
            var scale_x = d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([xtent[0], xtent[1]]);

            var scale_y = d3
                .scaleLinear()
                .range([height - margin.bottom, margin.top])
                .domain([ytent[first], ytent[last]]);

            svg.selectAll("rect")
                .data(sequence)
                .enter()
                .append("rect")
                .attr("x", function (_, i) {
                    return scale_x(x_attributeList[i]);
                })
                .attr("y", function (_, i) {
                    return scale_y(y_attributeList[i]);
                })
                .attr("index", function (_, i) {
                    return i;
                })
                .attr("width", 5)
                .attr("height", 5)
                .attr("fill", function (d) {
                    return colors[idToCluster[d.id]];
                })
                .on("mouseover", function (event) {
                    const i = event.currentTarget.getAttribute("index");
                    tippy(this, {
                        allowHTML: true,
                        content:
                            "<b>X: " +
                            x_attribute +
                            "</b>: " +
                            x_attributeList[i] +
                            "<br><b> Y: " +
                            y_attribute +
                            "</b>: " +
                            y_attributeList[i],
                        arrow: true,
                        maxWidth: "none",
                    });
                });

            if (path) {
                var datum = [];
                for (var i = 0; i < sequence.length; i++) {
                    const d = { x: x_attributeList[i], y: y_attributeList[i] };
                    datum.push(d);
                }

                const line = d3
                    .line()
                    .x((d) => scale_x(d.x))
                    .y((d) => scale_y(d.y))
                    .curve(d3.curveCatmullRom.alpha(0.5));
                svg.append("path")
                    .datum(datum)
                    .attr("d", line)
                    .attr("stroke", "black")
                    .attr("fill", "none");
            }

            // decorations

            var yAxisPos = margin.left;
            var xAxisPos = height - margin.bottom;

            svg.append("g")
                .attr("transform", `translate(0,${xAxisPos})`)
                .call(d3.axisBottom().scale(scale_x));
            svg.append("g")
                .attr("transform", `translate(${yAxisPos},0)`)
                .call(d3.axisLeft().scale(scale_y));

            if (title === null || title === "") {
                title = x_attribute + " vs " + y_attribute;
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
        },
        [data.x_attribute, data.y_attribute, data.x_attributeList, data.y_attributeList, width, height]
    );

    return (
        <Box ref={divRef} sx={{ height: 300 }}>
            {width && height && (
                <svg ref={ref} viewBox={[0, 0, width, height]} />
            )}
        </Box>
    );
}

export default Scatterplot;
