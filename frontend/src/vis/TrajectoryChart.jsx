import { React, useEffect, useState } from 'react';
import * as d3 from 'd3';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Checkbox from '@mui/material/Checkbox';
import Box from '@mui/material/Box';

import useKeyUp from '../hooks/useKeyUp';
import useKeyDown from '../hooks/useKeyDown';
import {useExtents} from '../hooks/useExtents';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useContextMenu } from '../hooks/useContextMenu';
import { useResize } from '../hooks/useResize';


import '../css/vis.css';
import { onStateMouseOver, onChunkMouseOver } from '../api/myutils';


import {apply_filters} from '../api/filters';

const margin = {
    top: 35, bottom: 20, left: 25, right: 25,
};

let sBrush = null;
let zoom = null;

let visible = {};

function TrajectoryChart({ trajectories, globalUniqueStates, runs, loadingCallback,  setStateHovered, setStateClicked, stateHovered, setExtents, setVisible, setSequenceExtent}) {       
    const {contextMenu, toggleMenu} = useContextMenu();
    const {width, height, divRef} = useResize();
    
    const [stateHighlight, setStateHighlight] = useState(false);
    
    const toggleStateHighlight = () => {
        setStateHighlight((prev) => !prev);
    };

    const selectionBrush = () => {
        if (sBrush != null) {                        
            d3.select(ref.current)
                .append('g')
                .attr('class', 'brush')
                .call(sBrush);
        }
    }

    const {setInternalExtents, completeSelection} = useExtents(setExtents);    

    useKeyDown('Shift', selectionBrush);
    useKeyUp('Shift', completeSelection);      

    const renderChunks = (data, trajectory, trajectoryName, count, x_scale, y_scale) => {
        const colors = trajectory.colors;
        const idToCluster = trajectory.idToCluster;
        
        const nodes = d3.select(`#c_${trajectoryName}`)
              .selectAll('rect')
              .data(data, (d) => d.id);
        
            nodes.enter()
            .append('rect')
            .attr('x', (d) => x_scale(d.timestep))
            .attr('y', () => y_scale(count))
            .attr('width', (d) => x_scale(d.last + 1) - x_scale(d.timestep))
            .attr('height', 25)
            .attr('fill', (d) => {
                return colors[idToCluster[d.firstID]];
            })                    
            .on('mouseover', function(_, d) {
                onChunkMouseOver(this, d, trajectoryName);                            
            })
            .classed("importantChunk", (d) => d.important)
            .classed("unimportantChunk", (d) => !d.important)
            .classed("breakdown", (d) => d.parentID);
        
        nodes.exit().remove();                                       
    }
    
    const ref = useTrajectoryChartRender(
        (svg) => {
            if (height === undefined || width === undefined) {
                return;
            }

            // clear so we don't draw over-top and cause insane lag
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }
            
            let count = 0;
            let maxLength = -Number.MAX_SAFE_INTEGER;
            
            for (const trajectory of Object.values(trajectories)) {
                if(trajectory.sequence.length > maxLength) {
                    maxLength = trajectory.sequence.length;
                }
            }            
            
            const scaleX = d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([0, maxLength]);                                                                                                                                      
            
            const scaleY = d3
                .scaleLinear()
                .range([margin.top, height - margin.bottom])
                .domain([0, Object.keys(trajectories).length]);                                           
            
            const tickNames = [];
            const chunkGroup = svg.append('g').attr('id', 'chunk');            
            const importantGroup = svg.append('g').attr('id', 'sequence_important');                        
            
            for (const [name, trajectory] of Object.entries(trajectories)) {                
                const {simplifiedSequence} = trajectory;
                let {chunks} = simplifiedSequence;
                trajectory.name = name;
                visible[name] = {chunkList: Array.from(chunks.values()).filter((d) => d.parentID === undefined),
                                 sequence: [], count: count};

                const chunkList = visible[name].chunkList;
                
                importantGroup.append('g').attr('id', `g_${name}`).attr('name', `${name}`);                 
                chunkGroup.append('g').attr('id', `c_${name}`).attr('name', `${name}`);
                
                tickNames.push(name);
               
                renderChunks(chunkList, trajectory, name, count, scaleX, scaleY);
                count++;
            }

            let rescaledX = scaleX;
            
            const xAxis = svg.append('g')
                  .attr("transform", `translate(0,0)`);            
            
            xAxis.call(d3.axisBottom(scaleX).tickValues(scaleX.ticks().filter(tick => Number.isInteger(tick)))
                       .tickFormat(d3.format('d')));

            zoom = d3.zoom().scaleExtent([1,Infinity]).translateExtent([
                [0, margin.top],
                [width, height - margin.bottom]
            ]).on("zoom", (e) => {
                const xz = e.transform.rescaleX(scaleX);
                const start = xz.domain()[0];
                const end = xz.domain()[1];
                const breakThreshold = parseInt((end - start) * 0.15);
                const consolidateThreshold = parseInt((end-start) * 0.075);

                const graphVisible = {};
                for(const name of Object.keys(trajectories)) {
                    graphVisible[name] = {chunkList: [], sequence: []};
                }
               
                const onScreenChunks = chunkGroup.selectAll('.importantChunk')
                      .filter(function(d) {
                          return (d.timestep >= start && d.last <= end) || (d.last >= start && d.last <= end) || (d.timestep >= start && d.timestep <= end);
                      });
                
                const onScreenChunkData = onScreenChunks.nodes().map((chunk) => {
                    const data = d3.select(chunk).data()[0];
                    return {...data, trajectoryName: chunk.parentNode.getAttribute("name"), breakdown: d3.select(chunk).classed("breakdown")};
                });
                
                const added = new Set();
                for(const data of onScreenChunkData) {
                    const trajectoryName = data.trajectoryName;
                    const chunkList = visible[trajectoryName].chunkList;
                    const trajectory = trajectories[trajectoryName];
                    let newChunks = null;
                    const chunks = trajectory.simplifiedSequence.chunks;
                         
                    if((data.childSize) && (data.childSize > breakThreshold)) {
                            // zoom in - break down chunk
                        newChunks = chunkList.filter((d) => d.id !== data.id);
                        for(const child of data.children) {
                            if(!added.has(child)) {
                                newChunks.push(chunks.get(child));
                                graphVisible[trajectoryName].chunkList.push(chunks.get(child));
                                added.add(child);
                            }
                        }
                            
                    } else if((!data.childSize) && data.size > breakThreshold * 5)  {
                        // zoom in - break down chunk into nodes
                        newChunks = chunkList.filter((d) => d.id !== data.id);
                        
                        const nodeData = visible[trajectoryName].sequence;
                        for(let i = data.timestep; i <= data.last; i++) {
                            nodeData.push({timestep: i, id: trajectory.sequence[i]});
                            graphVisible[trajectoryName].sequence.push({timestep: i, id: trajectory.sequence[i]});
                        }
                        
                        const newNodes = d3.select(`#g_${trajectoryName}`)
                              .selectAll('rect')
                              .data(nodeData, (d) => d.id);
                        
                        newNodes.enter()
                            .append('rect')
                            .attr('parentID', data.id)
                            .attr('x', (d) => scaleX(d.timestep))
                            .attr('y', () => scaleY(visible[trajectoryName].count))
                            .attr('width', (d) => scaleX(d.timestep + 1) - scaleX(d.timestep))
                            .attr('height', 25)
                            .attr('fill', (d) => {                        
                                return trajectory.colors[trajectory.idToCluster[d.id]];
                            })                    
                            .on('click', function (_, d) {                        
                                setStateClicked(globalUniqueStates.get(d.id));                                      
                            })
                            .on('mouseover', function(_, d) {                                                
                                onStateMouseOver(this, globalUniqueStates.get(d.id), trajectory, trajectoryName);                                                        
                                setStateHovered({'caller': this, 'stateID': d.id, 'name': trajectoryName, 'timestep': d.timestep});                            
                            })
                            .on('mouseout', function() {                        
                                setStateHovered(null);
                            });
                        
                        newNodes.exit().remove();
                        visible[trajectoryName].sequence = nodeData;
                    } else if(data.breakdown && data.size < consolidateThreshold) {
                        // zoom out - consolidate chunks into bigger chunk
                        newChunks = chunkList.filter((d) => d.id !== data.id);
                        const chunks = trajectory.simplifiedSequence.chunks;                        
                        const parentID = data.parentID;
                        
                        if(!added.has(parentID)) {
                            newChunks.push(chunks.get(parentID));
                            graphVisible[trajectoryName].chunkList.push(chunks.get(parentID));
                            added.add(parentID);
                        }
                    } else {                        
                        newChunks = chunkList;
                        graphVisible[trajectoryName].chunkList.push(data);
                    }
                    visible[trajectoryName].chunkList = newChunks;
                }
                console.log(added);
                                    
                const hideIndividualThreshold = parseInt((end - start)) * 0.01;                            
                const onScreenNodes = importantGroup
                      .selectAll('rect');
     
                const onScreenNodeData = onScreenNodes.nodes().map((node) => {
                    const data = d3.select(node).data()[0];
                    return {...data, trajectoryName: node.parentNode.getAttribute('name'), parentID: parseInt(node.getAttribute("parentID"))};
                });                

                // group by parentID

                const nodeDataByParentID = d3.group(onScreenNodeData, d => d.parentID);

                if(1.5 < hideIndividualThreshold) {
                    for(const [parentID, dataArray] of nodeDataByParentID.entries()) {
                        const data = dataArray[0];
                        const trajectoryName = data.trajectoryName;
                    
                        const trajectory = trajectories[trajectoryName];                    
                        
                        const chunks = trajectory.simplifiedSequence.chunks;
                            
                        visible[trajectoryName].chunkList.push(chunks.get(parentID));
                        graphVisible[trajectoryName].chunkList.push(chunks.get(parentID));                        
                        
                        const sequence = visible[trajectoryName].sequence;                    
                        
                        const newSequence = sequence.filter((d) => !dataArray.map((d) => d.id).includes(d.id));
                        visible[trajectoryName].sequence = newSequence;                        
                        
                        graphVisible[trajectoryName].sequence = visible[trajectoryName].sequence;                
                        onScreenNodes.remove();
                    }                  
                } else {
                    for(const name of Object.keys(trajectories)) {
                        graphVisible[name].sequence = visible[name].sequence;
                    }                        
                }
                               
                // geometric zoom for the rest                
                xAxis.call(d3.axisBottom(xz).tickValues(xz.ticks().filter(tick => Number.isInteger(tick)))
                           .tickFormat(d3.format('d')));

                xAxis.selectAll("text")
                    .style("text-anchor", "center")
                    .attr("transform", "rotate(-15)");

                for(const [name,trajectory] of Object.entries(trajectories)) {
                    graphVisible[name].chunkList = [...new Map(graphVisible[name].chunkList.map((item) => [item.id, item])).values()];
                    graphVisible[name].sequence = [...new Map(graphVisible[name].sequence.map((item) => [item.id, item])).values()];
                    renderChunks(visible[name].chunkList, trajectory, name, visible[name].count, xz, scaleY);
                }

                importantGroup.selectAll('rect').attr('x', (d) => xz(d.timestep)).attr('width', (d) => xz(d.timestep + 1) - xz(d.timestep));          
                chunkGroup.selectAll('rect').attr('x', (d) => xz(d.timestep)).attr('width', (d) => xz(d.last + 1) - xz(d.timestep));
                rescaledX = xz;
                
                setSequenceExtent([start,end]);
                console.log(graphVisible);                
                setVisible(graphVisible);
            });
        
            svg.call(zoom);

            xAxis.selectAll("text")
                .style("text-anchor", "center")
                .attr("transform", "rotate(-15)");

            sBrush = d3
                .brush()
                .keyModifiers(false)
                .extent([
                    [margin.left, margin.top],
                    [width - margin.right, height - margin.bottom],
                ])
                .on('end', function(e) {
                    const extent = e.selection;                    
                    if (extent) {
                        const currName = Object.keys(trajectories)[Math.round(scaleY.invert(extent[0][1]))];
                        if (currName !== null && currName !== undefined) {
                            const begin = Math.round(rescaledX.invert(extent[0][0]));
                            const end = Math.round(rescaledX.invert(extent[1][0]));
                            
                            if(begin !== undefined && end !== undefined) {                                
                                const xtent = {
                                    name: currName,
                                    begin,
                                    end,
                                };
                                setInternalExtents((prev) => [...prev, xtent]);                                
                            } else {
                                alert("Invalid selection. Please try again.");
                            }
                        }
                    }
                });                                   
            loadingCallback();
        },
        [width, height, trajectories],
    );

    

    useEffect(() => {
        if (ref !== undefined && ref.current !== undefined) {
            apply_filters(trajectories, runs, globalUniqueStates, ref);
        }
        loadingCallback();
     }, [runs]);

    useEffect(() => {        
        if(stateHovered !== undefined && stateHovered !== null) {            
            if(stateHighlight) {             
                d3.select('#sequence_important').selectAll('rect:not(.invisible)').filter(function(dp) {                                    
                    return (dp.id !== stateHovered.stateID);
                }).classed("highlightedInvisible", true);
                
                d3.select('#sequence_important').selectAll('rect:not(.highlightedInvisible)').classed("highlightedStates", true);
            }
            
            if(stateHovered.timestep) {                
                d3.select(ref.current).select(`#g_${stateHovered.name}`).selectAll('rect:not(.invisible)')
                    .filter(function(_, i) {
                        return i === stateHovered.timestep;
                    }).classed("highlightedState", true);
            }            
        } else {
            d3.select('#sequence_important').selectAll(".highlightedInvisible").classed("highlightedInvisible", false);
            d3.select('#sequence_important').selectAll('.highlightedStates').classed("highlightedStates", false);            
            d3.select('#sequence_important').selectAll('.highlightedState').classed("highlightedState", false);
        }
    }, [stateHovered, stateHighlight]);

    
    return (<>
                <Box ref={divRef}>
                    <svg className="vis"
                         onContextMenu={toggleMenu}
                         id="sequence"
                         ref={ref}
                         preserveAspectRatio="none"
                         viewBox={[0, 0, width, height]}
                    />
                </Box>  
            <Menu
                open={contextMenu !== null}
                onClose={toggleMenu}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
            >
                <MenuItem>
                    <ListItemIcon>
                        <Checkbox
                            onChange={() => { toggleStateHighlight(); }}
                            checked={stateHighlight}
                        />
                    </ListItemIcon>
                    <ListItemText>Toggle state highlighting</ListItemText>
                </MenuItem>
            </Menu>            
        </>);
}

export default TrajectoryChart;
