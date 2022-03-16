import { useTrajectoryChartRender } from "../hooks/useTrajectoryChartRender";
import { React, useEffect, useState, useRef } from "react";
import * as d3 from "d3";
import { intToRGB } from "../api/myutils";
import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";
import SelectionModal from "../modals/SelectionModal";
import MultiplePathSelectionModal from "../modals/MultiplePathSelectionModal";
import SingleStateModal from "../modals/SingleStateModal";

import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Checkbox from '@mui/material/Checkbox';


const PATH_SELECTION = "path_selection";
const MULTIPLE_PATH_SELECTION = "multiple_path_selection";
const SINGLE_STATE = "single_state";

const margin = { top: 20, bottom: 20, left: 40, right: 25 };

let z_brush = null;
let s_brush = null;
let m_s_brush = null;

function TrajectoryChart({ trajectories, runs, loadingCallback }) {
    let [currentModal, setCurrentModal] = useState();

    const toggleModal = (key) => {
        if (currentModal) {
            setCurrentModal();
            return;
        }
        setCurrentModal(key);
    };

    const [contextMenu, setContextMenu] = useState(null);

    const openContext = (event) => {
        event.preventDefault();
        setContextMenu(
            contextMenu === null
                ? {
                    mouseX: event.clientX - 2,
                    mouseY: event.clientY - 4,
                }
            : null,
        );
    };

    const closeContext = () => {
        setContextMenu(null);
    }

    let [extents, setExtents] = useState([]);
    let [actionCompleted, setActionCompleted] = useState('');
    let [modalTitle, setModalTitle] = useState("");
    let [currentState, setCurrentState] = useState(null);
    
    let [stateHighlight, setStateHighlight] = useState(false);

    const toggleStateHighlight = () => {        
        setStateHighlight(prev => !prev);        
    }    
    
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
        window.addEventListener("resize", resize());
    }, []);    
    
    const zoom = () => {
        if (z_brush != null) {
            if (!d3.selectAll(".brush").empty()) {
                d3.selectAll(".brush").remove();
            }
            
            d3.select("#svg_main")
                .append("g")
                .attr("class", "brush")
                .call(z_brush);
        }
    };

    const selection_brush = () => {
        if (s_brush != null) {
            if (!d3.selectAll(".brush").empty()) {
                d3.selectAll(".brush").remove();
            }
            
            d3.select("#svg_main")
                .append("g")                
                .attr("class", "brush")
                .call(s_brush);
        }
    };

    useKeyDown("z", zoom);
    useKeyDown("Control", selection_brush);

    const multiple_selection_brush = () => {
        if (m_s_brush != null) {                      
            d3.select("#svg_main")
                .append("g")                
                .attr("class", "brush")
                .call(m_s_brush);
        }
    };

    const complete_multiple_selection = () => {
        if (!d3.selectAll(".brush").empty()) {
            d3.selectAll(".brush").remove();
        }
        
        setModalTitle("Multiple Path Selection");
        setActionCompleted(MULTIPLE_PATH_SELECTION);                        
    };

    useKeyDown("Shift", multiple_selection_brush);
    useKeyUp("Shift", complete_multiple_selection);

    useEffect(() => {
        switch(actionCompleted) {
        case MULTIPLE_PATH_SELECTION:
            if(extents.length < 2) break;
            toggleModal(actionCompleted);
            break;
        case PATH_SELECTION:
            toggleModal(actionCompleted);            
            break;
        case SINGLE_STATE:
            console.log(actionCompleted);
            toggleModal(actionCompleted);
            break;
        default:
            break;
        }        
    }, [actionCompleted]);    
    
    const ref = useTrajectoryChartRender(
        (svg) => {            
            if (height === undefined || width === undefined) {
                return;
            }
            //clear so we don't draw over-top and cause insane lag
            if (!svg.empty()) {
                svg.selectAll("*").remove();
            }

            var dataList = [];
            var count = 0;
            var maxLength = -Number.MAX_SAFE_INTEGER;

            for (const name of Object.keys(trajectories)) {
                var data = trajectories[name].sequence;

                if (data.length > maxLength) {
                    maxLength = data.length;
                }

                dataList.push({
                    name: name,
                    data: data,
                    y: count,
                    fuzzy_memberships:
                        trajectories[name].fuzzy_memberships[
                            trajectories[name].current_clustering
                        ],
                    unique_states: trajectories[name].unique_states,
                    clusterings: trajectories[name].clusterings,
                    current_clustering: trajectories[name].current_clustering,
                });
                count++;
            }

            var scale_x = d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([0, maxLength]);
            var scale_y = d3
                .scaleLinear()
                .range([margin.top, height - margin.bottom])
                .domain([0, dataList.length]);

            var tickNames = [];

            //TODO add modal on state click, to show additional information if interested

            for (const t of dataList) {
                let g = svg.append("g").attr("id", "g_" + t.name);
                tickNames.push(t.name);
                g.selectAll("rect")
                    .data(t.data, function (d) {
                        return d;
                    })
                    .enter()
                    .append("rect")
                    .attr("x", function (d) {
                        return scale_x(d["timestep"]);
                    })
                    .attr("y", function () {
                        return scale_y(t.y);
                    })
                    .attr("width", 1)
                    .attr("height", 25)
                    .attr("fill", function (d) {
                        if (d["cluster"] === -1) {
                            return "black";
                        }
                        return intToRGB(d["cluster"]);
                    })
                    .attr("run", function () {
                        return t.name;
                    })
                    .attr("number", function (d) {
                        return d["number"];
                    })
                    .attr("timestep", function (d) {
                        return d["timestep"];
                    })
                    .attr("occurrences", function (d) {
                        return d["occurrences"];
                    })
                    .attr("fuzzy_membership", function (d) {
                        return t.fuzzy_memberships[d["number"]];
                    })
                    .on("click", function (_, d) {
                        setCurrentState(d);
                        setActionCompleted(SINGLE_STATE);                            
                        //toggleModal(SINGLE_STATE);                                             
                    })
                    .on("mouseover", function (_, d) {
                        var props = trajectories[t.name].properties;
                        var propertyString = "";
                        var perLine = 3;
                        var count = 0;
                        for (const property of props) {
                            propertyString +=
                                "<b>" +
                                property +
                                "</b>: " +
                                trajectories[t.name].sequence[d["timestep"]][
                                    property
                                ] +
                                " ";
                            count++;
                            if (count % perLine === 0) {
                                propertyString += "<br>";
                            }
                        }
                        tippy(this, {
                            allowHTML: true,
                            content:
                                "<b>Run</b>: " +
                                t.name +
                                "<br><b>Cluster</b>: " +
                                d["cluster"] +
                                " <b>Fuzzy memberships</b>: " +
                                this.getAttribute(
                                    "fuzzy_membership"
                                ).toString() +
                                "<br>" +
                                propertyString,
                            arrow: true,
                            maxWidth: "none",
                        });

                        //TODO make this bind as an effect instead of inside the function
                        if(stateHighlight) {                            
                            d3.selectAll("rect").filter(function (dp) {                                
                                return dp['id'] != d['id'] }).attr("opacity", "0.05");
                        }                        
                    }).on('mouseout', function(_,d) {
                        if(stateHighlight) {
                            d3.selectAll("rect").filter(function (dp) { return dp['id'] != d['id'] }).attr("opacity", "1.0");
                        }
                    });

                if (Object.keys(runs[t.name].filters).length > 0) {
                    for (var k of Object.keys(runs[t.name].filters)) {
                        let filter = runs[t.name].filters[k];
                        if (filter.enabled) {
                            filter.func(t, svg, filter.options);
                        }
                    }
                }
            }
            var xAxis = svg.append("g").call(d3.axisBottom().scale(scale_x));

            // reset zoom
            svg.on("dblclick", function () {
                // zoom out on double click
                scale_x.domain([0, maxLength]);
                xAxis.call(d3.axisBottom(scale_x));
                svg.selectAll("rect").attr("x", function (d) {
                    return scale_x(d["timestep"]);
                });
            });            

            z_brush = d3
                .brushX()
                .keyModifiers(false)
                .extent([
                    [0, 0],
                    [width, height],
                ])
                .on("end", function (e) {
                    var extent = e.selection;
                    if (extent) {
                        svg.select(".brush").call(z_brush.move, null);
                        scale_x.domain([
                            scale_x.invert(extent[0]),
                            scale_x.invert(extent[1]),
                        ]);
                        xAxis.call(d3.axisBottom(scale_x));
                        svg.selectAll("rect").attr("x", function (d) {
                            return scale_x(d["timestep"]);
                        });
                        svg.selectAll("rect").attr("stroke", "none");
                    }
                    d3.select(this).remove();
                    d3.select(".brush").remove();
                });



            // multiple path selection
            m_s_brush = d3
                .brush()
                .keyModifiers(false)
                .extent([
                    [0, 0],
                    [width, height],
                ])
                .on("end", function (e) {
                    var extent = e.selection;

                    if (extent) {
                        var curr_name =
                            dataList[Math.round(scale_y.invert(extent[0][1]))]
                                .name;
                        if (curr_name !== null && curr_name !== undefined) {
                            var begin =
                                trajectories[curr_name].sequence[
                                    Math.round(scale_x.invert(extent[0][0]))
                                ];
                            var end =
                                trajectories[curr_name].sequence[
                                    Math.round(scale_x.invert(extent[1][0]))
                                ];
                            var xtent = {
                                name: curr_name,
                                begin: begin,
                                end: end,
                            };
                            
                            setExtents(prev => [...prev, xtent]);

                        }
                    }
                });

            // single path selection
            s_brush = d3
                .brush()
                .keyModifiers(false)
                .extent([
                    [0, 0],
                    [width, height],
                ])
                .on("end", function (e) {
                    let extent = e.selection;
                    if (extent) {
                        let curr_name =
                            dataList[Math.round(scale_y.invert(extent[0][1]))]
                                .name;
                        if (curr_name !== null && curr_name !== undefined) {
                            let begin =
                                trajectories[curr_name].sequence[
                                    Math.round(scale_x.invert(extent[0][0]))
                                ];
                            let end =
                                trajectories[curr_name].sequence[
                                    Math.round(scale_x.invert(extent[1][0]))
                                ];
                            let xtent = {
                                name: curr_name,
                                begin: begin,
                                end: end,
                            };
                            setModalTitle(
                                `Timesteps ${begin.timestep} - ${end.timestep}`
                            );                            
                            setExtents([...extents,xtent]);                            
                            setActionCompleted(PATH_SELECTION);                            
                        }
                    }                    
                    d3.select(this).remove();
                    d3.select(".brush").remove();
                });
            loadingCallback();
        },
        [runs, width, height, stateHighlight, trajectories]
    );

    return (
        <div onContextMenu={openContext} ref={divRef} width="100%" height="100%">            
            {width &&
             height &&
             Object.keys(trajectories).length ===
             Object.keys(runs).length && (
                 <svg
                        id="svg_main"
                        ref={ref}
                        viewBox={[0, 0, width, height]}
                    />
             )}
            <Menu
                open={contextMenu !== null}
                onClose={closeContext}
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
                            onChange={() => {toggleStateHighlight()}}
                            checked={stateHighlight}/>
                    </ListItemIcon>
                    <ListItemText>Toggle state highlighting</ListItemText>
                </MenuItem>
            </Menu>
            {currentModal === SINGLE_STATE && (
                <SingleStateModal
                    open={currentModal === SINGLE_STATE}
                    state={currentState}
                    closeFunc={() => {
                        setCurrentState(null);
                        setActionCompleted('');
                        toggleModal(SINGLE_STATE)
                    }}
                />
            )}
            {currentModal === PATH_SELECTION && (
                <SelectionModal
                    title={modalTitle}
                    open={currentModal === PATH_SELECTION}
                    trajectories={trajectories}
                    extents={extents}
                    closeFunc={() => {                        
                        setExtents([]);
                        setActionCompleted('');
                        toggleModal(PATH_SELECTION)
                    }}
                />
            )}
            {currentModal === MULTIPLE_PATH_SELECTION && (
                <MultiplePathSelectionModal
                    title={modalTitle}
                    open={currentModal === MULTIPLE_PATH_SELECTION}
                    trajectories={trajectories}
                    extents={extents}
                    closeFunc={() => {                       
			setExtents([]);
                        setActionCompleted('');
			toggleModal(MULTIPLE_PATH_SELECTION)
                    }}
                />
            )}
        </div>
    );
}

function useKeyUp(key, action) {
    useEffect(() => {
        function onKeyup(e) {
            if (e.key === key) action();
        }
        window.addEventListener("keyup", onKeyup);
        return () => window.removeEventListener("keyup", onKeyup);
    }, []);
}

function useKeyDown(key, action) {
    useEffect(() => {
        function onKeydown(e) {
            if (!e.repeat) {
                if (e.key === key) action();
            }
        }
        window.addEventListener("keydown", onKeydown);
        return () => window.removeEventListener("keydown", onKeydown);
    }, []);
}

export default TrajectoryChart;
