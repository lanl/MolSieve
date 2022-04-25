import { React, useEffect, useState, useRef } from "react";
import { useTrajectoryChartRender } from "../hooks/useTrajectoryChartRender";
import { onStateMouseOver } from "../api/myutils";
import { apply_filters } from '../api/filters';
import * as d3 from "d3";
import '../css/vis.css';

const margin = { top: 20, bottom: 20, left: 40, right: 25 };

export default function Scatterplot({ data, globalUniqueStates, loadingCallback, setStateHovered, setStateClicked, stateHovered, trajectoryName, scatterplotID, runs, trajectory }) {

    const divRef = useRef(null);    
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();

    const [x_attributeList, setXAttributeList] = useState([]);
    const [y_attributeList, setYAttributeList] = useState([]);

    const resize = () => {
        if(!divRef || !divRef.current) {
            return;
        }
        const newWidth = divRef.current.offsetWidth;
        setWidth(newWidth);

        const newHeight = divRef.current.offsetHeight;
        setHeight(newHeight);
    };

    useEffect(() => {
        resize();
    }, [divRef]);

    useEffect(() => {
        window.addEventListener("resize", resize);
    }, []);

    useEffect(() => {
        ref.current.setAttribute('id', scatterplotID);
    }, [scatterplotID]);

    useEffect(() => {
        if (data.x_attributeList == null) {            
            
            const ids = trajectory.simplifiedSequence.sequence.map((s) => {
                return s.id;
            });

            const uniqueStates = ids.map((id) => {
                return globalUniqueStates.get(id);
            });

            setXAttributeList(uniqueStates.map((s) => {
                return s[data.x_attribute];
            }));
            
        } else {
            setXAttributeList(data.x_attributeList);
        }
    }, [data, trajectory]);

    useEffect(() => {
        if (data.y_attributeList == null) {            
            
            const ids = trajectory.simplifiedSequence.sequence.map((s) => {
                return s.id;
            });

            const uniqueStates = ids.map((id) => {
                return globalUniqueStates.get(id);
            });

            setYAttributeList(uniqueStates.map((s) => {
                return s[data.y_attribute];
            }));
            
        } else {
            setYAttributeList(data.y_attributeList);
        }
    }, [data, trajectory]);


    
    const ref = useTrajectoryChartRender(
        (svg) => {

            console.log('re-draw');
            
            if (height === undefined || width === undefined) {
                return;
            }

            if (!svg.empty()) {
                svg.selectAll("*").remove();
            }
            
            const idToCluster = trajectory.idToCluster;
            const sequence = trajectory.simplifiedSequence.sequence;
            //let reverse = data.reverse;
            //let path = data.path;
            //let title = data.title;
            const colors = trajectory.colors;            
            
            //if (reverse == null) reverse = false;
            //if (path == null) path = false;
         
            const xtent = d3.extent(x_attributeList);
            const ytent = d3.extent(y_attributeList);

            const first = 0;
            const last = 1;

           /*if (reverse) {
                first = 1;
                last = 0;
            }*/

            // 1.25 for breathing room between axis and values
            const scale_x = d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([xtent[0], xtent[1]]);

            const scale_y = d3
                .scaleLinear()
                .range([height - margin.bottom, margin.top])
                .domain([ytent[first], ytent[last]]);

            const g = svg.append("g").attr('id',`g_${trajectoryName}`);
            
            g.selectAll("rect")
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
                }).on("click", function(_,d) {                    
                    setStateClicked(globalUniqueStates.get(d.id));    
                })                
                .on("mouseover", function (_, d) {                    
                    onStateMouseOver(this, globalUniqueStates.get(d.id), trajectory, trajectoryName);
                    const timesteps = trajectory.simplifiedSequence.idToTimestep.get(d.id);
                    if(timesteps.length === 1) {
                        setStateHovered({'caller': this, 'stateID': d.id, 'name': trajectoryName, 'timestep': timesteps[0]});
                    } else {
                        setStateHovered({'caller': this, 'stateID': d.id, 'name': trajectoryName, 'timesteps': timesteps});
                    }    
                }).on('mouseout', function() {
                  setStateHovered(null);
              });

            /*if (path) {
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
            }*/

            // decorations

            const yAxisPos = margin.left;
            const xAxisPos = height - margin.bottom;

            svg.append("g")
                .attr("transform", `translate(0,${xAxisPos})`)
                .call(d3.axisBottom().scale(scale_x));
            svg.append("g")
                .attr("transform", `translate(${yAxisPos},0)`)
                .call(d3.axisLeft().scale(scale_y));

            /*if (title === null || title === "") {
                title = x_attribute + " vs " + y_attribute;
            }

            svg.append("text")
                .attr("x", width / 2)
                .attr("y", margin.top)
                .attr("text-anchor", "middle")
                .style("font-size", "12px")
                .text(title);*/

            if(loadingCallback !== undefined) {
                loadingCallback();
            }
        }, [trajectory, data, width, height]);

    useEffect(() => {                
        if(stateHovered !== undefined && stateHovered !== null) {
            d3.select(ref.current).select(`#g_${trajectoryName}`).selectAll('rect:not(.invisible)').filter(function(dp) {                                    
                return (dp.id !== stateHovered.stateID);
            }).classed("highlightedInvisible", true);
                
            d3.select(ref.current).selectAll('rect:not(.highlightedInvisible)').classed("highlightedStates", true);
        } else {
            d3.select(ref.current).selectAll(".highlightedInvisible").classed("highlightedInvisible", false);
            d3.select(ref.current).selectAll('.highlightedStates').classed("highlightedStates", false);            
            d3.select(ref.current).selectAll('.highlightedState').classed("highlightedState", false);
        }
    }, [stateHovered]);

     useEffect(() => {
         if (ref !== undefined && ref.current !== undefined) {
             const trajectories = {};
             trajectories[trajectoryName] = trajectory;
             trajectory.name = trajectoryName;
             apply_filters(trajectories, runs, globalUniqueStates, ref);
         }

         if(loadingCallback !== undefined) {                        
             loadingCallback();
         }
     }, [runs, data]);

    
    return (
        <div ref={divRef}>
            <svg ref={ref} className="vis" viewBox={[0,0,width,height]} />
        </div>
    );
}
