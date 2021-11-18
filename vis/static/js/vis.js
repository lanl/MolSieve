$('document').ready(function() {
    
    $("#modal_loading-indicator").iziModal({
	title: 'Loading',
	closeButton: false,
	closeOnEscape: false,
	borderBottom: false,
    });

    $("#modal_info").iziModal({
	title: 'Sequence Info',                            
	borderBottom: false,               
	fullscreen:true,        
    });		                

    
    $(document).ajaxSend(function(event, request, settings) {
	$('#modal_loading-indicator').iziModal('open');
    });
   
    $(document).ajaxComplete(function(event, request, settings) {
	$('#modal_loading-indicator').iziModal('close');
    });

    var scale_x = null;
    var height = 400;
    var margin = {top: 20, bottom: 20, left: 5, right: 25};
    
    function error_state(msg) {	
	$('#modal_loading-indicator').iziModal('close');
	$('#modal_loading-indicator').hide();
	alert("Error: " + msg);
	$("*").prop("disabled", true);
    }

    function PCCA(name, clusters) {       
        $.getJSON('/pcca', {'run': name, 'clusters' : clusters}, function(clustered_data) {           
	    $.getJSON('/load_dataset', {'run': name}, function(data) {
		draw_PCCA(data,name,clustered_data);
		switch_controls(name, "PCCA");
	    });
	});
    }

    function calculate_epochs(name) {
	$.getJSON('/calculate_epochs', {'run': name}, function(data) {
	    draw_overview(data, name);
	    switch_controls(name,"overview");
	});
    }

    function load_dataset(name) {
	$.getJSON('/load_dataset', {'run': name}, function(data) {
	    draw_state_id(data,name);
	    switch_controls(name,"state_id")
	});
    }    

    function switch_controls(name, mode) {

	switch(mode) {
	case "PCCA":            
	    $("#header_" + name).text("PCCA clustering");
	    $("#slider_pcca_" + name).show();
	    $("#lbl_pcca_slider_" + name).show();
            switch_buttons(name, "PCCA")
	    break;
	case "overview":
	    $("#header_" + name).text("Overview");
	    $("#slider_pcca_" + name).hide();
	    $("#lbl_pcca_slider_" + name).hide();
	    switch_buttons(name, "overview");            
	    break;
	case "state_id":
	    $("#header_" + name).text("State ID")
	    $("#slider_pcca_" + name).hide();
	    $("#lbl_pcca_slider_" + name).hide();
            switch_buttons(name, "state_id");
	    break;
	default:
	    error_state("Invalid mode selected: " + mode);
	    break;
	}
    }
	

    function switch_buttons(name,mode) {
	modes = ["PCCA","state_id","overview"];
        const idx = modes.indexOf(mode);
	modes.splice(idx,1);
	
	$("#btn_" + mode + "_" + name).hide();
	for(var i = 0; i < modes.length; i++) {
	    $("#btn_" + modes[i] + "_" + name).show();
	    $("#btn_" + modes[i] + "_" + name).prop('disabled', false);
	}
    }
    
    $.ajax({url: "/connect_to_db",
	    success: function(data) {
		$('#load_table_div').append('<p> Press CTRL to toggle zoom brush in overview mode. Double click to zoom out.</p>');
		var table = $('<table>').addClass("table table-sm");
		var caption = $('<caption>Select which run(s) to visualize</caption>');
		var head = $('<thead class="thead-dark"><tr><th>Run name</th><th>Load?</th></tr></thead>');
		table.append(caption);
		table.append(head);
		for(var i = 0; i < data.length; i++) {

		    if (data[i][0] != null) {
			var row = $('<tr>');
			var name_cell = $('<td>').text(data[i][0]);
			var checkbox = $('<input>', {type:'checkbox', id:'cb_' + data[i][0], value: data[i][0], click: function() {
			    if(this.checked) {
				calculate_epochs(this.value)
			    }
			}});			
			var input_cell = $('<td>').append(checkbox);
			row.append(name_cell);
			row.append(input_cell);
			table.append(row);
		    }
		}
		$('#load_table_div').append(table);
		$('#load_table_div').append('<br>');
	    },
	    error: function(data) {                
		error_state("Could not connect to database. Please check your connection to the database, refresh the page, and try again.");
	   }
    });
    
    //$('#toggle_arc').prop("checked", false);
    function setup_controls(name) {
	var div = $('<div>').addClass("row");
	var control_div = $('<div>').addClass("col-sm-3");
	var detail_header = $('<h2>Overview</h2>').attr("id","header_" + name);
        var slider = $('<input type="range" min="1" max="64" value="3">').attr("id", "slider_pcca_" + name)
	    .on('mousemove change', function(e) { $("#lbl_pcca_slider_" + name).text(this.value + " clusters")})
	    .on('change', function(e) {PCCA(name,this.value)}).hide();
	var label = $('<label>3 clusters</label>').attr("id","lbl_pcca_slider_" + name).attr("for","slider_pcca" + name).hide();
	var pcca_button = $('<button>Show PCCA Clustering</button>').attr("id", "btn_PCCA_" + name).on('click', function() {$(this).prop('disabled', true); PCCA(name,3);});
	var overview_button = $('<button>Show Overview</button>').attr("id", "btn_overview_" + name).on('click', function() {$(this).prop('disabled', true); calculate_epochs(name);}).hide();
	var state_id_button = $('<button>Show State ID vs Time</button>').attr("id", "btn_state_id_" + name).on('click', function() {$(this).prop('disabled', true); load_dataset(name);});
	control_div.append(detail_header)
	control_div.append(pcca_button);
	control_div.append(slider);
	control_div.append(label);
	control_div.append(overview_button);
	control_div.append(state_id_button);
	var vis_div = $('<div>').attr("id","vis_" + name).addClass("col-lg-9");
	vis_div.append('<h2>' + name + '</h2>');
	div.append(vis_div);
	div.append(control_div);
	$('#main').append(div);
    }

    function draw_state_id(data, name) {
	var svg = null;
	var bBox = null;

	if($('#svg_' + name).length) {
	    $("#svg_" + name).empty();
	    bBox = d3.select("#vis_" + name).node().getBoundingClientRect();    
	    svg = d3.select('#svg_' + name).attr("width", bBox.width);
	} else {            
	    bBox = d3.select("#vis_" + name).node().getBoundingClientRect();    
	    svg = d3.select("#vis_" + name).append("svg").attr("width", bBox.width).attr("height", 400).attr("id", "svg_" + name);
	}
        
        var unique_states = new Set();
        for (var i = 0; i < data.length; i++) {
	    unique_states.add(data[i].id);
	}
	
	scale_x = d3.scaleLinear().range([margin.left, bBox.width - margin.right]).domain([0,data.length]);
	scale_y = d3.scaleLinear().range([margin.top, height - margin.bottom]).domain([d3.extent(unique_states)[0], d3.extent(unique_states)[1]]);
	svg.selectAll("rect").data(data, function(d) { return d }).enter().append("rect").attr("x", function(d,i) { return scale_x(d['timestep']) })
	    .attr("y", function(d) {                
		return scale_y(d.id)})
	    .attr("width", 5).attr("height", 5)
	    .attr("fill", function(d) { return hashStringToColor(d['number'])})
	    .on('mouseover', function(event,d) {
		d3.selectAll("rect").filter(function (dp) { return dp['number'] != d['number'] }).attr("opacity", "0.05");
		tippy(this, {
		    allowHTML: true,                    
		    content: "<b>State number</b>: " + d['number'] + " <i>t</i>=" + d['timestep'] +
                             "<br>There are <b>" + d['occurences'] + "</b> occurences of this state.",
		    arrow: false,
		    maxWidth: 'none',
		});
	    }).on('mouseout', function(event,d) {
                d3.selectAll("rect").filter(function (dp) { return dp['number'] != d['number'] }).attr("opacity", "1.0");
	   });
	var xAxis = svg.append("g").call(d3.axisBottom().scale(scale_x));
	
    }
    
    function draw_overview(data,name) {
        var to_draw = []
	var q = new Queue();
	q.enqueue(data);
	var max_depth = 0;

	while (!q.isEmpty()) {
	    curr_data = q.dequeue();	   
	    to_draw.push(curr_data);

	    if (curr_data.l_child != null) {
		q.enqueue(curr_data.l_child);		
	    } 			    
	    
	    if (curr_data.r_child != null) {
		q.enqueue(curr_data.r_child);
	    }

	    if (curr_data.l_child === null && curr_data.r_child === null) {
		if (curr_data.depth > max_depth) {
		    max_depth = curr_data.depth;
		}
	    }	
	}

	var svg = null;
	var bBox = null;
	if($('#svg_' + name).length) {
	    $("#svg_" + name).empty();
	    bBox = d3.select("#vis_" + name).node().getBoundingClientRect();    
	    svg = d3.select('#svg_' + name).attr("width", bBox.width);
	} else {
	    setup_controls(name);
	    bBox = d3.select("#vis_" + name).node().getBoundingClientRect();    
	    svg = d3.select("#vis_" + name).append("svg").attr("width", bBox.width).attr("height", 400).attr("id", "svg_" + name);
	}
	scale_x = d3.scaleLinear().range([margin.left, bBox.width - margin.right]).domain([0,to_draw[0].end]);
	scale_y = d3.scaleLinear().range([margin.top, height - margin.bottom]).domain([0,max_depth]);
	svg.selectAll("rect").data(to_draw, function(d) { return d }).enter().append("rect").attr("x", function(d,i) { return scale_x(d.start) })
	    .attr("y", function(d) {return scale_y(d.depth)})
	    .attr("width", function(d,i) { return scale_x(d.end) - scale_x(d.start) }).attr("height", 5)
	    .attr("fill", function(d) { return hashStringToColor(d.winner)})
	    .on('mouseover', function(event,d) {
		d3.selectAll("rect").filter(function (dp) { return dp.winner != d.winner }).attr("opacity", "0.05");
		tippy(this, {
		    allowHTML: true,
		    content: "<b>Most common state</b>: " + d.winner +
			     "<br><b>Start</b>: " + d.start + " <b>End</b>: " + d.end + " <b>Sequence length</b>: " + (d.end-d.start) +
			     "<br><b>Number of occurences at this level</b>: " + d.counts[d.winner],
		    arrow: false,
		    maxWidth: 'none',
		});
	    })
	    .on('click', function(event,d) {
		event.preventDefault();
		$('#modal_container').html('');                	
		var items = Object.keys(d.counts).map(function(key) {
		    return [key, d.counts[key]];
		});

		items.sort(function(first, second) {
		    return second[1] - first[1];
		});
                		                
		var table = $('<table>').addClass("table table-sm");
		var head = $('<thead class="thead-dark"><tr><th>State number</th><th>Count</th></tr></thead>');                
		table.append(head);
		var count = 0;
		for(const item of items) {
		    var row = $('<tr>');                    
		    var name_cell = $('<td>').text(item[0]);
		    var count_cell = $('<td>').text(item[1]);
		    row.append(name_cell);
		    row.append(count_cell);
		    table.append(row);
		    if(count > 10) {
			break;
		    }
		    count++;
		}				
		
		$('#modal_container').append(table);                
		$('#modal_info').iziModal('open');
	    })
	    .on('mouseout', function(event,d) {				
		d3.selectAll("rect").filter(function (dp) { return dp.winner != d.winner }).attr("opacity", "1.0");
	    });
	
	var xAxis = svg.append("g").call(d3.axisBottom().scale(scale_x));
	//disable in detail mode
	svg.on('dblclick', function(event,d) {
	    // zoom out on double click
	    scale_x.domain([0,to_draw[0].end]);
	    xAxis.transition().duration(500).call(d3.axisBottom(scale_x));
	    svg.selectAll("rect").transition().duration(500)
		.attr("x", function(d,i) { return scale_x(d.start) })
		.attr("y", function(d) {return scale_y(d.depth)})
		.attr("width", function(d) { return scale_x(d.end) - scale_x(d.start) });
	});

	var brush = d3.brushX().extent([[0,0], [bBox.width, 400]]).on('end', function(e) {
	    var extent = e.selection;
	    
	    if(!extent) {
		scale_x.domain([0,to_draw[0].end]);
		xAxis.transition().duration(500).call(d3.axisBottom(scale_x));
	    } else {
		d3.select("#svg_" + name).select('.brush').call(brush.move, null);
		scale_x.domain([scale_x.invert(extent[0]), scale_x.invert(extent[1])]);
		xAxis.transition().duration(500).call(d3.axisBottom(scale_x));
		svg.selectAll("rect").transition().duration(500)
		    .attr("x", function(d,i) { return scale_x(d.start) })
		    .attr("y", function(d) {return scale_y(d.depth)})
		    .attr("width", function(d) { return scale_x(d.end) - scale_x(d.start) });
		d3.select(this).remove();
		// remove all other brushes too
		$(".brush").remove();
	    }
	});
	//TODO: zoom only shows up on last drawn graph
	document.onkeyup = function(e) {
	    if(e.keyCode === 17) {                
		if ($(".brush").length) { $(".brush").remove(); }               
		d3.select("#svg_" + name).append("g").attr("class", "brush").call(brush);
	    }
	}		
    }

    
    
    function draw_PCCA(data, name, clustered_data) {
	var svg = null;
	
	//const threshold = $('#slider_threshold').val();	
	//data = data.filter(function (d) { return d['n.occurences'] > threshold });        
        
	cluster_colors = [];        
	for(var i = 0; i < clustered_data.length; i++) {	    
	    cluster_colors.push(intToRGB(i));	    
	}
                
	for(var i = 0; i < data.length; i++) {
	    for(var j = 0; j < clustered_data.length; j++) {
		if(clustered_data[j].includes(data[i]['number'])) {
		    data[i]['cluster'] = j;
		}
	    }
            if(data[i]['cluster'] == null) {
		data[i]['cluster'] = -1;
	    }
	}	        
	       
	if($('#svg_' + name).length) {
	    $("#svg_" + name).empty();
	    bBox = d3.select("#vis_" + name).node().getBoundingClientRect();    
	    svg = d3.select('#svg_' + name).attr("width", bBox.width);
	} else {
	    svg = d3.select("#vis").append("svg").attr("width", overwidth).attr("height", 400).attr("id", "svg");
	}
	
	scale_x = d3.scaleLinear().range([margin.left, bBox.width - margin.right]).domain([0,data.length]);
	scale_y = d3.scaleLinear().range([margin.top, height - margin.bottom]).domain([clustered_data.length,-1]);
	svg.selectAll("rect").data(data, function(d) {return d}).enter().append("rect")
	    .attr("x", function(d,i) {return scale_x(i)}).attr("y", function (d) {		
		return scale_y(d['cluster']);
	    })
	    .attr("width",1).attr("height",5).attr("fill", function(d) {
		if(d['cluster'] == -1) {
		    return "black";
		}
		return cluster_colors[d['cluster']];
	    })
	    .attr("number", function(d) { return d['number'] })
	    .attr("timestep", function(d) { return d['timestep'] })
	    .attr("occurences", function(d) { return d['occurences'] })
		.on('mouseover', function(event,d) {
                    d3.selectAll("rect").filter(function (dp) { return dp['number'] != d['number'] }).attr("opacity", "0.05");
		    tippy(this, {
			allowHTML: true,
			content: "<b>State number</b>: " + d['number'] + " <i>t</i>=" + d['timestep'] +
			         "<br><b>Cluster</b>: " + d['cluster'] +
			         "<br>There are <b>" + d['occurences'] + "</b> occurences of this state.",
			arrow: true,
			maxWidth: 'none',
		    });
		})
	        .on('mouseout', function(event,d) {
                    d3.selectAll("rect").filter(function (dp) { return dp['number'] != d['number'] }).attr("opacity", "1.0");
		});
	var xAxis = svg.append("g").call(d3.axisBottom().scale(scale_x));
    }
    
    /*$('#btn_load').on('click', function(e) {
	e.preventDefault();	
	$.getJSON('/calculate_epochs', "", function(data) {
	    draw_overview(data);
	    $('#overview_options').show();
	});
	$('#detail_view_options').hide();
	$(this).hide();
	$(this).html("Switch to Overview");
    });

    /*$('#btn_detail').on('click', function(e) {
	e.preventDefault();	
	$.getJSON('/load_dataset', "", function(data) {
	    draw(data);
	    $('#detail_view_options').show();
	    $('#btn_load').show();
	});
	$('#overview_options').hide();
    });*/

    
    /*$('#slider_threshold').on('mousemove change', function(e) {
	$('#lbl_slider').text("Only show states with more than " + $(this).val() + " occurences.");
    });
    
    $('#slider_threshold').on('change', function(e) {
	e.preventDefault();
	$.getJSON('/load_dataset', "", function(data) {
	    draw(data);
	    $('#btn_load').hide();
	    $('#detail_view').show();
	});
    });*/
    
    $('#toggle_arc').change(function() {
	if(this.checked) {
	    $.getJSON('/generate_subsequences', "", function(data) {				
		const k = data.K;
		d3.select("#svg").selectAll('links')
		    .data(data.links)
		    .enter()
		    .append('path')
		    .attr('d', function (d) {
			start = scale_x(d.source);
			end = scale_x(d.target);
			return ['M', start + ((k/2) * 5), height-30,    
				'A',                     
				(start - end)/2, ',',    
				(start - end)/2, 4, 0, ',',
				start < end ? 1 : 0, end + ((k/2) * 5), ',', height-30].join(' ');
		    }).on('mouseover', function (event, d) {
			tippy(this, {
			    allowHTML: true,
			    content: d.sequence,
			    arrow: false,
			    maxWidth: 'none'
			});
			d3.select(this).attr("stroke", "red").style("opacity",1.0);
		    }).on('mouseout', function (event, d) {			
			d3.select(this).attr("stroke", "orange").style("opacity",0.3);
		    })
		    .attr("stroke", "orange").style("opacity", 0.3)
		    .style("fill","none")
		    .attr("stroke-width", k * 5);
	    });	     
	} else {
	    d3.select("#svg").selectAll('path').remove();
	}
    });
});
	
