import { useTrajectoryChartRender } from './hooks/useTrajectoryChartRender';
import {React, useEffect} from 'react';
import * as d3 from 'd3';
import { intToRGB } from "./myutils";
import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";


const widget_width = 500;
const svg_height = widget_width - 100;
const margin = { top: 20, bottom: 20, left: 40, right: 25 };

//    handleKeyPress = (e) => {
	/*if(e.key === 'Z' || e.key === 'z') {
	    if (z_brush != null) {
		if (d3.select(".brush").length) { document.querySelector(".brush").remove(); }                
		d3.select("#svg_main").append("g").attr("class", "brush").call(z_brush);
	    }
	}*/
//    }


function TrajectoryChart({trajectories}) {
    let z_brush = null;
    useKeyPress('z', () => {        
	if(z_brush != null) {
	    if (d3.select('.brush').length) { d3.select(".select").remove(); }
	    d3.select("#svg_main").append("g").attr("class", "brush").call(z_brush);
	}        
    });
    const ref = useTrajectoryChartRender((svg) => {
	        
	var dataList = [];
        var count = 0;
        var maxLength = -Number.MAX_SAFE_INTEGER;        

        for (const [name,traj] of Object.entries(trajectories)) {
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
            });
            count++;
        }

        //let svg = d3.select(set_svg("main", widget_width, svg_height));
        //console.log(svg);
        /*let svg = d3
            .select("#svg_main")
            .attr("viewBox", [0, 0, widget_width, svg_height]);*/

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
                    if (d["cluster"] == -1) {
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
                            " <i>t</i>=" +
                            d["timestep"] +
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
        }

        var xAxis = svg.select(".x-axis").call(d3.axisBottom().scale(scale_x));

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
        /*var extents = [];
	
	var m_s_brush = d3.brush().extent([[0,0], [bBox.width, svg_height]]).on('end', function(e) {
	    var extent = e.selection;                        
	    if(extent) {
		var curr_name = dataList[Math.round(scale_y.invert(extent[0][1]))].name;		
		if (curr_name != null && curr_name != undefined) {
		    var begin = trajectories[curr_name].sequence[Math.round(scale_x.invert(extent[0][0]))];
		    var end = trajectories[curr_name].sequence[Math.round(scale_x.invert(extent[1][0]))];
		    var xtent = {name:curr_name,begin:begin,end:end};
		    extents.push(xtent);
		}
	    }            
	});

	// single path selection
	var s_brush = d3.brush().extent([[0,0], [bBox.width, svg_height]]).on('end', function(e) {
	    var extent = e.selection;                        
	    if(extent) {                
                var curr_name = dataList[Math.round(scale_y.invert(extent[0][1]))].name;		
		if (curr_name != null && curr_name != undefined) {
		    var begin = trajectories[curr_name].sequence[Math.round(scale_x.invert(extent[0][0]))];
		    var end = trajectories[curr_name].sequence[Math.round(scale_x.invert(extent[1][0]))];                    
		    document.querySelector('#modal_path_selection').iziModal('setSubtitle', "State " + begin.number + " - " + "State " + end.number);
		    document.querySelector('#modal_path_selection_container').attr("data-start", begin.timestep);
		    document.querySelector('#modal_path_selection_container').attr("data-end", end.timestep);
		    document.querySelector('#modal_path_selection_container').attr("data-name", curr_name);
		    document.querySelector('#modal_path_selection').attr("data-izimodal-preventclose", "");
		    document.querySelector('#modal_path_selection').iziModal('open');                    
		}                                
	    }            
	    d3.select(this).remove();            
	    document.querySelector(".brush").remove();
	});*/

        // controls
        /*	document.onkeyup = function(e) {
	    /*if(e.key == "Control") {                
		if (document.querySelector(".brush").length) { document.querySelector(".brush").remove(); }               
		d3.select("#svg_main").append("g").attr("class", "brush").call(s_brush);
	    }*/

        /*if(e.key == 'Z' || e.key == 'z') {
		if (document.querySelector(".brush").length) { document.querySelector(".brush").remove(); }                
		d3.select("#svg_main").append("g").attr("class", "brush").call(z_brush);
	    }*/

        /*if(e.key == "Shift") {
		d3.select("#svg_main").append("g").attr("class", "brush").call(m_s_brush);                
	    }
	    
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
    
    }, [trajectories.length])
    return(<svg id="svg_main" ref={ref} viewBox={[0, 0, widget_width, svg_height]}>
	       <g className="x-axis"></g>
	   </svg>);
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
