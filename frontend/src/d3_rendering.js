import React from "react";
import * as d3 from "d3";
import { intToRGB } from "./myutils";
import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";

const widget_width = 500;
const svg_height = widget_width - 100;
const margin = { top: 20, bottom: 20, left: 40, right: 25 };

let z_brush = null;

class D3RenderDiv extends React.Component {

    componentDidMount() {
	document.addEventListener('keydown', this.handleKeyPress);
    }
    
    componentDidUpdate() {
        this.draw_PCCA(Object.keys(this.props.trajectories));
    }

    handleKeyPress = (e) => {
	if(e.key === 'Z' || e.key === 'z') {
	    if (z_brush != null) {
		if (d3.select(".brush").length) { document.querySelector(".brush").remove(); }                
		d3.select("#svg_main").append("g").attr("class", "brush").call(z_brush);
	    }
	}
    }

    draw_PCCA = (names) => {
        if (names.length === 0 || names === undefined) {
            if (!d3.select("#svg_main").empty()) {
                d3.select("#svg_main").selectAll("*").remove();
            }
            return;
        }

        var dataList = [];
        var count = 0;
        var maxLength = -Number.MAX_SAFE_INTEGER;

        const trajectories = this.props.trajectories;

        for (const name of names) {
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
        let svg = d3
            .select("#svg_main")
            .attr("viewBox", [0, 0, widget_width, svg_height]);

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

        var xAxis = svg.append("g").call(d3.axisBottom().scale(scale_x));

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
                d3.select("#svg_main").select('.brush').call(z_brush.move, null);
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
    };

    render() {
	let trajectories = this.props.trajectories;
        let runs = Object.keys(trajectories);        

        if (runs.length > 0) {
            var controls = runs.map(function (run, idx) {
                return (
                    <div key={idx}>
                        <p>
                            <b>{run}</b>
                        </p>
                        <input
                            type="range"
                            min="1"
                            max="20"
                            name="pcca_slider"
                            value="2"
                        />
                        <label for="pcca_slider">X clusters</label>

                        <input type="checkbox" name="chkbx_clustering_diff" />
                        <label for="chkbx_clustering_diff">
                            Show clustering difference
                        </label>

                        <input type="checkbox" name="chkbx_transition_filter" />
                        <label for="chkbx_transition_filter">
                            Filter transitions from dominant state?
                        </label>

                        <input
                            type="range"
                            min="1"
                            max="100"
                            name="slider_transition_filter"
                            value="10"
                        />
                        <label for="slider_transition_filter">
                            Size of window: 10%
                        </label>

                        <input type="checkbox" name="chkbx_fuzzy_membership" />
                        <label for="chkbx_fuzzy_membership">
                            Filter fuzzy memberships?
                        </label>
			{trajectories[run].properties.length > 0 &&
                         <button>+ Add a new filter</button> &&
			 <button>Generate x-y plot with attribute</button>}
                    </div>
                );
            });
            return (
                <div style={{ display: "flex" }}>
                    <svg id="svg_main"></svg>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {controls}
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }
}

export default D3RenderDiv;
