import { React, useEffect, useState } from "react";
import * as d3 from "d3";

import { useTrajectoryChartRender } from "../hooks/useTrajectoryChartRender";
import { useContextMenu } from '../hooks/useContextMenu';
import { useResize } from '../hooks/useResize';

import { onStateMouseOver } from "../api/myutils";
import { apply_filters } from '../api/filters';

import '../css/vis.css';

import MenuItem from "@mui/material/MenuItem";
import Menu from "@mui/material/Menu";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import FormHelperText from "@mui/material/FormHelperText";
import Box from '@mui/material/Box';

const margin = { top: 20, bottom: 20, left: 40, right: 25 };

export default function Scatterplot({globalUniqueStates, loadingCallback, stateHovered, trajectoryName, id, runs, trajectory, setStateClicked, setStateHovered, title, sx, uniqueStates }) {    

    const {contextMenu, toggleMenu} = useContextMenu();
    const {width, height, divRef} = useResize();
       
    const [xAttribute, setXAttribute] = useState(trajectory.properties[0]);
    const [yAttribute, setYAttribute] = useState(trajectory.properties[0]);
    
    const [xAttributeList, setXAttributeList] = useState(null);
    const [yAttributeList, setYAttributeList] = useState(null);

    const getSequence = () => {
        if(uniqueStates) {
            return uniqueStates;
        } else {
            return trajectory.simplifiedSequence.uniqueStates;
        }
    }
    
    const useAttributeList = (setAttributeList, attribute) => {    
        useEffect(() => {
            const ids = getSequence().map((s) => {
                return s.id;
            });

            const uniqueStates = ids.map((id) => {
                return globalUniqueStates.get(id);
            });
            
            setAttributeList(uniqueStates.map((s) => {
                return s[attribute];
            }));

        }, [globalUniqueStates, attribute, trajectory.chunkingThreshold, trajectory.current_clustering]);
    }

    useAttributeList(setXAttributeList, xAttribute);
    useAttributeList(setYAttributeList, yAttribute);   

    const options = trajectory.properties.map((property) => {
        return (
            <MenuItem key={property} value={property}>
                {property}
            </MenuItem>
        );
    });

    options.push(<MenuItem key="id" value="id"> 
                     id
                 </MenuItem>);

    useEffect(() => {
        ref.current.setAttribute('id', id);
    }, [id]);
    
    const ref = useTrajectoryChartRender(
        (svg) => {
            
            if (height === undefined || width === undefined) {
                return;
            }

            if (!svg.empty()) {
                svg.selectAll("*").remove();
            }
            
            const idToCluster = trajectory.idToCluster;
            const sequence = getSequence();
            
            //let reverse = data.reverse;
            //let path = data.path;
            //let title = data.title;
            const colors = trajectory.colors;            
            
            //if (reverse == null) reverse = false;
            //if (path == null) path = false;
         
            const xtent = d3.extent(xAttributeList);
            const ytent = d3.extent(yAttributeList);

            const first = 0;
            const last = 1;

           /*if (reverse) {
                first = 1;
                last = 0;
                }*/

            const scale_x = d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([xtent[0], xtent[1]]);

            const scale_y = d3
                .scaleLinear()
                .range([height - margin.bottom, margin.top])
                .domain([ytent[first], ytent[last]]);

            const g = svg.append("g").attr('id',`g_${trajectoryName}`);
            
            const points = g.selectAll("rect")
                .data(sequence)
                .enter()
                .append("rect")
                .attr("x", function (_, i) {
                    return scale_x(xAttributeList[i]);
                })
                .attr("y", function (_, i) {
                    return scale_y(yAttributeList[i]);
                })
                  .attr("width", 5)
                  .attr("height", 5)
                .attr("fill", function (d) {
                    return colors[idToCluster[d.id]];
                });

            if(setStateClicked) {
                points.on("click", function(_,d) {                    
                    setStateClicked(globalUniqueStates.get(d.id));    
                });
            }
            
            if(setStateHovered) {
                points.on("mouseover", function (_, d) {                    
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
            }

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

            const yAxisPos = margin.left;
            const xAxisPos = height - margin.bottom;

            svg.append("g")
                .attr("transform", `translate(0,${xAxisPos})`)
                .call(d3.axisBottom().scale(scale_x));
            svg.append("g")
                .attr("transform", `translate(${yAxisPos},0)`)
                .call(d3.axisLeft().scale(scale_y));

            if (title === null || title === "") {
                title = xAttribute + " vs " + yAttribute;
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
        }, [trajectory.chunkingThreshold, trajectory.current_clustering, width, height, xAttributeList, yAttributeList]);

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
     }, [runs]);

    
    return (
        <>
        <Box ref={divRef} sx={sx}>
            <svg ref={ref} onContextMenu={toggleMenu} className="vis" viewBox={[0,0,width,height]} />
        </Box>
            <Menu
                open={contextMenu !== null}
                onClose={toggleMenu}
                anchorReference="anchorPosition"
                preserveAspectRatio="none"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
            >
                <MenuItem>
                    <FormControl>
                    <Select
                            value={xAttribute}
                            onChange={(e) => {
                                setXAttribute(e.target.value);
                            }}>
                            {options}
                    </Select>
                        <FormHelperText>X attribute</FormHelperText>
                    </FormControl>
                </MenuItem>

                <MenuItem>
                    <FormControl>
                        <Select
                            value={yAttribute}
                            onChange={(e) => {
                                setYAttribute(e.target.value);
                            }}>
                            {options}
                        </Select>
                        <FormHelperText>Y attribute</FormHelperText>
                    </FormControl>
            </MenuItem>
            </Menu>            
        </>
    );
}
