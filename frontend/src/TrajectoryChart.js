import { useTrajectoryChartRender } from './hooks/useTrajectoryChartRender';
import {React, useEffect, useState} from 'react';
import * as d3 from 'd3';
import { intToRGB, mostOccurringElement} from "./myutils";
import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";
import SelectionModal from "./SelectionModal"

const widget_width = 500;
const svg_height = widget_width - 100;
const margin = { top: 20, bottom: 20, left: 40, right: 25 };
const PATH_SELECTION_MODAL = 'path_selection';

function TrajectoryChart({trajectories, runs, goRender}) {    
    let [currentModal, setCurrentModal] = useState('');
    let [extents, setExtents] = useState([]);
    let [modalTitle, setModalTitle] = useState('');    
    
    let z_brush = null;
    let s_brush = null;
    let m_s_brush = null;    
    
    const zoom = () => {
	if(z_brush != null) {
	    if (d3.select('.brush').length) { d3.select(".select").remove(); }
	    d3.select("#svg_main").append("g").attr("class", "brush").call(z_brush);
	}        
    }

    const selection_brush = () => {
	if(s_brush != null) {
	    if (d3.select(".brush").length) { d3.select(".brush").remove(); }               
	    d3.select("#svg_main").append("g").attr("class", "brush").call(s_brush);
	}
    }
    
    const multiple_selection_brush = () => {
	if(m_s_brush != null) {
	    d3.select("#svg_main").append("g").attr("class", "brush").call(m_s_brush);
	}
    }

    const transition_filter = (trajectory, slider_value, mode, svg) => {
	const sequence = trajectory.data;
	const clusters = trajectory.clusterings[trajectory.current_clustering];
	      
	var window;        
	if(mode === "abs") {
	    window = parseInt(slider_value);
	}

	
	var min = Number.MAX_SAFE_INTEGER;        
	var dominants = [];
	
	for(var i = 0; i < clusters.length; i++) {
	    var clustered_data = sequence.filter(function(d) {                
		if(d['cluster'] === i) {
		    return d;
		}
	    }).map(function(d) {return d.number});
	    
	    
	    if(clustered_data.length < min) {
		min = clustered_data.length;
	    }
	    
	    dominants[i] = mostOccurringElement(clustered_data);	               
	}
	
	if(mode === "per") {
	    const ws = slider_value / 100;
	    window = Math.ceil(ws * min);	    
	}
	
	var timesteps = [];        
	var count;
	
	for(i = 0; i < sequence.length - window; i += window) {
	    count = 0;
	    
	    for(var j = 0; j < window; j++) {                
		if(sequence[i+j]['number']  === dominants[sequence[i+j]['cluster']]) {
		    count++;		                        
		}
	    }
	    for(var k = 0; k < window; k++) {
		timesteps.push(count / window);
	    }	                
	}
	svg.select(`#g_${trajectory.name}`).selectAll("rect").attr("opacity",function(d,i) {            
	    return timesteps[i];
	});
    }

    /** Build a dict of state number: clustering assignments
     *  and then determine how many times the state changed clusters
     */
    const show_clustering_difference = (trajectory, svg) => {
	var clustering_assignments = {};
	var maxSize = -Number.MAX_SAFE_INTEGER;
	// for some reason, an extra labels object is created at the end
	for(var d of trajectory.unique_states) {
	    var labels = new Set();
	    for(var clustering of Object.values(trajectory.clusterings)) {
		for(var i = 0; i < clustering.length; i++) {
		    if(clustering[i].includes(d)) {
			labels.add(i);
		    }
		}
	    }
	    maxSize = (labels.size > maxSize) ? labels.size : maxSize;		    
	    clustering_assignments[d] = (labels);		    
	}                             
	
	svg.select(`#g_${trajectory.name}`).selectAll("rect").attr("fill", function(d) {            
	    var instability = clustering_assignments[d['number']].size / maxSize; 
	    if(instability > 0.75) {
		return "red";
	    } else if(instability < 0.75 && instability > 0.5) {
		return "yellow";
	    } else {
		return "green";
	    }		    
	});		    	
    }

    const toggleModal = (key) => {
	if(currentModal) {
	    setCurrentModal();
	    return;
	}
	setCurrentModal(key);
    };

    useKeyPress('z', zoom);
    useKeyPress('Control', selection_brush);
    useKeyPress('Shift', multiple_selection_brush);
    
    const ref = useTrajectoryChartRender((svg) => {
	console.log(goRender);
	//clear so we don't draw over-top and cause insane lag        
	if(!svg.empty()) {
	    svg.selectAll('*').remove();
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
		current_clustering: trajectories[name].current_clustering
            });
            count++;
        }
        
        var scale_x = d3
            .scaleLinear()
            .range([margin.left, widget_width - margin.right])
            .domain([0, maxLength]);
        var scale_y = d3
            .scaleLinear()
            .range([margin.top, svg_height - margin.bottom])
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
                .attr("width", 5)
                .attr("height", 5)
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
                .attr("fuzzy_membership", function (d, i) {
                    return t.fuzzy_memberships[d["number"]];
                })
                .on("click", function (event, d) {
                    //showLoadingIndicator("Generating Ovito image for state " + d['number']);
                    /*generate_ovito_image(d['number']).then((data) => {
			console.log(data);
			var img = document.querySelector('<img>').attr("src", 'data:image/png;base64,' + data);
			document.querySelector("#modal_container").append(img);
		    }).catch((error) => {error_state(error);}).finally(closeLoadingIndicator());*/
                    //		    document.querySelector("#modal_info").iziModal('setSubtitle', d['number']);
                    //		    document.querySelector("#modal_info").iziModal('open');
                })
                .on("mouseover", function (event, d) {
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
                            this.getAttribute("fuzzy_membership").toString() +
                            "<br>" +
                            propertyString,
                        arrow: true,
                        maxWidth: "none",
                    });
                });

	    if(runs[t.name].show_clustering_difference) {
		show_clustering_difference(t, svg);
            }

	    if(runs[t.name].show_transition_filter) {                                
		transition_filter(t, runs[t.name]['transition_filter_slider_value'], runs[t.name]['transition_filter_mode'], svg);
	    }
	}
        var xAxis = svg.append('g').call(d3.axisBottom().scale(scale_x));

        // reset zoom
        svg.on('dblclick', function(event,d) {
	    // zoom out on double click
	    scale_x.domain([0,maxLength]);
	    xAxis.call(d3.axisBottom(scale_x));
	    svg.selectAll("rect")
		.attr("x", function(d) { return scale_x(d['timestep']); });             
	});

	z_brush = d3.brushX().extent([[0,0], [widget_width, svg_height]]).on('end', function(e) {
	    var extent = e.selection;                        
	    if(extent) {                
                svg.select('.brush').call(z_brush.move, null);
		scale_x.domain([scale_x.invert(extent[0]), scale_x.invert(extent[1])]);
		xAxis.call(d3.axisBottom(scale_x));
		svg.selectAll("rect")
		    .attr("x", function(d) { return scale_x(d['timestep']); });                  
		d3.select(this).remove();                
		d3.select(".brush").remove();
	    }            
	    d3.select(this).remove();            
	    d3.select(".brush").remove();
	});

        // multiple path selection	
	m_s_brush = d3.brush().extent([[0,0], [widget_width, svg_height]]).on('end', function(e) {
	    var extent = e.selection;                        
	    if(extent) {
		var curr_name = dataList[Math.round(scale_y.invert(extent[0][1]))].name;		
		if (curr_name !== null && curr_name !== undefined) {
		    var begin = trajectories[curr_name].sequence[Math.round(scale_x.invert(extent[0][0]))];
		    var end = trajectories[curr_name].sequence[Math.round(scale_x.invert(extent[1][0]))];
		    var xtent = {name:curr_name,begin:begin,end:end};
		    extents.push(xtent);
		}
	    }            
	});

	// single path selection
	s_brush = d3.brush().extent([[0,0], [widget_width, svg_height]]).on('end', function(e) {
	    let extent = e.selection;                        
	    if(extent) {                
                let curr_name = dataList[Math.round(scale_y.invert(extent[0][1]))].name;		
		if (curr_name !== null && curr_name !== undefined) {
		    let begin = trajectories[curr_name].sequence[Math.round(scale_x.invert(extent[0][0]))];
		    let end = trajectories[curr_name].sequence[Math.round(scale_x.invert(extent[1][0]))];
		    let xtent = {name:curr_name,begin:begin,end:end};
		    
		    setModalTitle(`Timesteps ${begin.timestep} - ${end.timestep}`);
		    extents.push(xtent);
		    toggleModal(PATH_SELECTION_MODAL);
		}                                
	    }
	    
            setExtents([]);
	    d3.select(this).remove();            
	    d3.select(".brush").remove();
	});
	
					 /*
	    if(e.key == "S" || e.key == "s") {
		if (document.querySelector(".brush").length) { document.querySelector(".brush").remove(); }
		if(extents.length >= 2) {                    
		    var x_select = document.querySelector('#select_x_attributes');
		    var y_select = document.querySelector("#select_y_attributes");

		    var propList = []
		    for(var i = 0; i < extents.length; i++) {
			propList.push(trajectories[extents[i]['name']].properties);
		    }
		    
		    var cmn = intersection(propList); 

		    x_select.append(document.querySelector('<option>').val('timestep').text('timestep'));
                    y_select.append(document.querySelector('<option>').val('timestep').text('timestep'));
		    
		    for(const property of cmn) {
			x_select.append(document.querySelector('<option>').val(property).text(property));
			y_select.append(document.querySelector('<option>').val(property).text(property));
		    }
                    		    
		    document.querySelector('.similarity_select').each(function() {                        
                        for(const extent of extents) {                            
			    document.querySelector(this).append(document.querySelector('<option>').val(JSON.stringify(extent)).text(`document.querySelector{extent['name']}: timesteps document.querySelector{extent['begin']['timestep']} - document.querySelector{extent['end']['timestep']}`));
			}
		    });	    
		    
		    document.querySelector('#modal_comparison_container').attr("data-extents", JSON.stringify(extents));
                    document.querySelector('#modal_comparison').iziModal('open');
		    
		}
		// clear extents array
		extents = [];
		}*/
    
    }, [trajectories, goRender]);
    
    return(<div><svg id="svg_main" ref={ref} viewBox={[0, 0, widget_width, svg_height]}/>
	   <SelectionModal title={modalTitle} isOpen={currentModal === PATH_SELECTION_MODAL} extents={extents} closeFunc={() => toggleModal(PATH_SELECTION_MODAL)} /></div>);
}

function useKeyPress(key, action) {
    useEffect(() => {
	function onKeyup(e) {
	    if(e.key === key) action()
	}
	window.addEventListener('keyup', onKeyup);
	return () => window.removeEventListener('keyup', onKeyup);
    }, []);
}

export default TrajectoryChart;
