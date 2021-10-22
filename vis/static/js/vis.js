$(document).ajaxSend(function(event, request, settings) {
    $('#loading-indicator').show();
});

$(document).ajaxComplete(function(event, request, settings) {
    $('#loading-indicator').hide();
});

$('document').ready(function() {

    function error_state() {
	alert("Error: Could not connect to database. Please check your connection to the database, refresh the page, and try again.");
	$("*").prop("disabled", true);
    }

    function load_dataset(cb) {
	
	if($(cb).prop('checked')) {
	    $.getJSON('/calculate_epochs', {'run': cb.value}, function(data) {
		draw_overview(data, cb.value);
	    });
	} else {
	    
	}
    }
    
    $.ajax({url: "/connect_to_db",
	    success: function(data) {
		$('#load_table_div').append('<p> Press CTRL to toggle zoom brush. Double click to zoom out.</p>');
		var table = $('<table>').addClass("table table-sm");
		var caption = $('<caption>Select which run(s) to visualize</caption>');
		var head = $('<thead class="thead-dark"><tr><th>Run name</th><th>Load?</th></tr></thead>');
		table.append(caption);
		table.append(head);
		for(var i = 0; i < data.length; i++) {

		    if (data[i][0] != null) {
			var row = $('<tr>');
			var name_cell = $('<td>').text(data[i][0]);
			var checkbox = $('<input>', {type:'checkbox', id:'cb_' + data[i][0], value: data[i][0], click: function() { load_dataset(this) }})			
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
		error_state();
	   }
    });
    
    $('#toggle_arc').prop("checked", false);
    var scale_x = null;
    var height = 400;

    var margin = {top: 20, bottom: 20, left: 5, right: 25};
    
    function draw_overview(data,name) {
	console.log("Data for " + name);
	console.log(data);
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
	    var div = $('<div>').addClass("container-fluid");
	    var control_div = $('<div>').addClass("col-auto");
	    control_div.append('<h2>' + name + '</h2>');
	    control_div.append('<button>test</button>');
	    var vis_div = $('<div>').attr("id","vis_" + name).addClass("col-auto");
	    div.append(vis_div);
	    div.append(control_div);
	    $('#main').append(div);	    
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
	    }).on('mouseout', function(event,d) {				
		d3.selectAll("rect").filter(function (dp) { return dp.winner != d.winner }).attr("opacity", "1.0");
	    });
	
	var xAxis = svg.append("g").call(d3.axisBottom().scale(scale_x));
	
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

	// will have to remove these key callbacks after switching to detail view
	document.onkeyup = function(e) {
	    if(e.keyCode === 17) {
		if ($(".brush").length) { $(".brush").remove(); }
		d3.select("#svg_" + name).append("g").attr("class", "brush").call(brush);
	    }
	}		
    }
    
    function draw(data) {
	var svg = null;
	
	const threshold = $('#slider_threshold').val();	
	data = data.filter(function (d) { return d['n.occurences'] > threshold });	

	const overwidth = data.length * 5 + margin.left + margin.right;	

	if($('#svg').length) {
	    $("#svg").empty();
	    svg = d3.select('#svg').attr("width", overwidth);
	} else {
	    svg = d3.select("#vis").append("svg").attr("width", overwidth).attr("height", 400).attr("id", "svg");
	}
	
	scale_x = d3.scaleLinear().range([margin.left, overwidth - margin.right]).domain([0,data.length]);
	svg.selectAll("rect").data(data, function(d) {return d}).enter().append("rect")
	    .attr("x", function(d,i) {return scale_x(i)}).attr("y", height - 30)
	    .attr("width",5).attr("height",20).attr("fill", "black")
	    .attr("number", function(d) { return d['n.number'] })
	    .attr("timestep", function(d) { return d['r.timestep'] })
	    .attr("occurences", function(d) { return d['n.occurences'] })
		.on('mouseover', function(event,d) {
		    d3.select(this).attr("fill", "red");
		    d3.selectAll("rect").filter(function (dp) { return dp['n.number'] === d['n.number']}).attr("fill", "red");
		    tippy(this, {
			allowHTML: true,
			content: d['n.number'] + " " + "<i>t</i>=" + d['r.timestep'] + "<br> There are <b>" + d['n.occurences'] + "</b> occurences of this state.",
			arrow: false,
			maxWidth: 'none',
		    });
		})
	        .on('mouseout', function(event,d) {
		    d3.select(this).attr("fill", "black");
		    d3.selectAll("rect").filter(function (dp) { return dp['n.number'] === d['n.number'] }).attr("fill", "black");
		});	
    }
    
    $('#btn_load').on('click', function(e) {
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

    
    $('#slider_threshold').on('mousemove change', function(e) {
	$('#lbl_slider').text("Only show states with more than " + $(this).val() + " occurences.");
    });
    
    $('#slider_threshold').on('change', function(e) {
	e.preventDefault();
	$.getJSON('/load_dataset', "", function(data) {
	    draw(data);
	    $('#btn_load').hide();
	    $('#detail_view').show();
	});
    });
    
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
	
