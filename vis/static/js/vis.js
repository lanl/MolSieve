$('document').ready(function() {

    var trajectories = {};
    var vis_modes = {};
    var names_in_use = [];
    $("#modal_loading-indicator").iziModal({
	title: 'Loading',
	closeButton: false,
	closeOnEscape: false,
	overlayClose: false,
	borderBottom: false,
    });

    $("#modal_info").iziModal({
	title: 'Sequence Info',
	borderBottom: false,               
	fullscreen:true,        
    });


    $("#modal_optimal_clustering").iziModal({
	title: 'Select optimal clustering bounds',
	closeButton: false,
	closeOnEscape: false,
	overlayClose: false,
	borderBottom: false	
    });

    $("#btn_cancel_optimal_clustering").on('click', function(e) {                
	$("#modal_optimal_clustering").iziModal('close');
	$('#' + $(this).attr("data-name")).prop('checked', false);
    });
    
    $("#btn_calculate_optimal_clustering").on('click', function(e) {        
	var name = $(this).attr("data-name");
	var m_min = $(this).attr("data-m_min");
	var m_max = $(this).attr("data-m_max");        
	names_in_use.push(name);                                
	showLoadingIndicator();
	load_PCCA(names_in_use,-1,1, m_min, m_max).then((names) => {				    
	    setup_controls(name);                                 
	    draw_PCCA(names);
            update_pcca(name);                                    
	}).catch((err => {error_state(err);})).finally(() => {
	    closeLoadingIndicator();				    				                                        
	});
	
    });
    
    /*$(document).ajaxSend(function(event, request, settings) {
        showLoadingIndicator();
    });
   
    $(document).ajaxComplete(function(event, request, settings) {
        closeLoadingIndicator();
    });*/

    async function showLoadingIndicator() {
	$('#modal_loading-indicator').iziModal('open');
    }

    async function closeLoadingIndicator() {
	$('#modal_loading-indicator').iziModal('close');
    }

    var scale_x = null;
    let widget_height = 500;
    let svg_height = widget_height - 100;
    var width = d3.select("#main").node().getBoundingClientRect().width;    
    var margin = {top: 20, bottom: 20, left: 5, right: 25};
    /*var gridster = $('#grid').gridster({helper: 'clone',					
					widget_base_dimensions: [width * 0.985,widget_height],
					resize: { enabled: false, stop: function(e,ui,widget) {
					    var name = $(widget).attr("data-name");                                            
					    vis_modes[name](name);                                                                                        
					}},
//					widget_margins: [50,0],
					widget_selector: ".gs-w",
					max_size_x: 2}).data('gridster');*/
    function error_state(msg) {	
	$('#modal_loading-indicator').iziModal('close');
	$('#modal_loading-indicator').hide();
	$('*').hide();
	alert(msg);	
    }

    var load_PCCA_json = function(names,index,clusters,optimal, m_min, m_max) {
	return new Promise(function(resolve, reject) {
	    var name = names[index];
	    $('#modal_loading-indicator').iziModal('setSubtitle', "Calculating PCCA for " + name);
	                
	    $.getJSON('/pcca', {'run': name, 'clusters' : clusters, 'optimal' : optimal, 'm_min': m_min, 'm_max': m_max}, function(clustered_data) {                
		if (optimal === 1) {                    
		    trajectories[name].optimal_cluster_value = clustered_data.optimal_value;
		    trajectories[name].current_clustering = clustered_data.optimal_value;
		    trajectories[name].feasible_clusters = clustered_data.feasible_clusters;
		    trajectories[name].clusterings[clustered_data.optimal_value] = clustered_data.sets;		    
		} else {
		    trajectories[name].clusterings[clusters] = clustered_data.sets;
		    trajectories[name].current_clustering = clusters;
		}
		                
		trajectories[name].fuzzy_memberships[trajectories[name].current_clustering] = clustered_data.fuzzy_memberships;
		
		if(trajectories[name].sequence == null) {
		    $('#modal_loading-indicator').iziModal('setSubtitle', "Loading sequence for " + name);                    		    
		    $.getJSON('/load_dataset', {'run': name}, function(data) {			
			trajectories[name].sequence = data;                        
		    }).then(() => {                        
			if(index < names.length - 1) {                            
			    load_PCCA_json(names,++index,clusters,optimal, m_min, m_max).then((names) => {resolve(names)});
			} else {
			    resolve(names);
			}			
		    });
		} else {
		    if(index < names.length - 1) {
			load_PCCA_json(names,++index,clusters,optimal,m_min,m_max).then((names) => {resolve(names)});
		    } else {
			resolve(names);
		    }			
		}
	    });
	});
    }

    function set_cluster_info(name) {
	for(var i = 0; i < trajectories[name].sequence.length; i++) {
	    for(var j = 0; j < trajectories[name].clusterings[trajectories[name].current_clustering].length; j++) {
		if(trajectories[name].clusterings[trajectories[name].current_clustering][j].includes(trajectories[name].sequence[i]['number'])) {
		    trajectories[name].sequence[i]['cluster'] = j;
		}
	    }
	    if(trajectories[name].sequence[i]['cluster'] == null) {
		trajectories[name].sequence[i]['cluster'] = -1;
	    }
	}
    }

    function calculate_unique_states(name) {	
	if (trajectories[name].unique_states == null) {
	    var unique_states = new Set();
	    for (var i = 0; i < trajectories[name].sequence.length; i++) {
		unique_states.add(trajectories[name].sequence[i].id);
	    }
	    trajectories[name].unique_states = unique_states;
	}        
    }
    
    var load_PCCA = function(names, clusters, optimal, m_min, m_max) {
	return new Promise(function(resolve, reject) {
            load_PCCA_json(names,0,clusters,optimal, m_min, m_max).then((names) => {
		for(const name of names) {
		    $('#modal_loading-indicator').iziModal('setSubtitle', "Rendering");                    		    
		    set_cluster_info(name);
		    calculate_unique_states(name);                    
		}                
		resolve(names)});
	});	  
    };
    
    var calculate_epochs = function(name) { 
	return new Promise(function(resolve,reject) {
	    if(trajectories[name].overview == null) {
		$.getJSON('/calculate_epochs', {'run': name}, function(data) {	   
		    trajectories[name].overview = data;
    		    resolve(name);
		}).fail(function(msg) {
		    reject(msg.responseText);
		});
	    } else {
		resolve(name);                                                
	    };
	})
    }					      
    var load_dataset = function(name) {
	return new Promise(function(resolve,reject) {
	    if(trajectories[name].sequence == null) {
		$.getJSON('/load_dataset', {'run': name}, function(data) {
		    trajectories[name].sequence = data;	    	    
		    resolve(name);
		}).fail(function(msg) {
		    reject(msg.responseText);
		});
	    } else {
		resolve(name);                                   
	    }
	})	
    }    

    function switch_controls(name, mode, callback) {
	switch(mode) {
	case "PCCA":            
	    $("#header_" + name).text("PCCA clustering");
	    $("#pcca_div_" + name).show();
            $("#state_id_div_" + name).hide();            
	    //switch_buttons(name, "PCCA")
	    break;
	case "overview":
	    $("#header_" + name).text("Overview");
            $("#pcca_div_" + name).hide();
            $("#state_id_div_" + name).hide();            
	    switch_buttons(name, "overview");            
	    break;
	case "state_id":
	    $("#header_" + name).text("State ID");
	    $("#pcca_div_" + name).hide();
            $("#state_id_div_" + name).show();            
            switch_buttons(name, "state_id");
	    break;
	default:
	    error_state("Error: Invalid mode selected: " + mode);
	    break;
	}
	
	if (callback) {
	    callback();
	}	
    }
    
    function switch_buttons(name,mode) {
	var modes = ["PCCA","state_id","overview"];
        const idx = modes.indexOf(mode);
	modes.splice(idx,1);
	
	$("#btn_" + mode + "_" + name).hide();
	for(var i = 0; i < modes.length; i++) {
	    $("#btn_" + modes[i] + "_" + name).show();
	    $("#btn_" + modes[i] + "_" + name).prop('disabled', false);
	}
    }

    function update_pcca(name) {
	$("#slider_pcca_" + name).val(trajectories[name].optimal_cluster_value);
	$("#lbl_pcca_slider_" + name).text(trajectories[name].optimal_cluster_value + " clusters (valid)");
    }
    
    function transition_filter(name, slider_value, mode) {
	$('#modal_loading-indicator').iziModal('setSubtitle', "Calculating transition filter for " + name);
	var window;        
	if(mode == "abs") {
	    window = parseInt(slider_value);
	}
        	
	const sequence = trajectories[name].sequence;
	const clusters = trajectories[name].clusterings[trajectories[name].current_clustering];
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

	if(mode == "per") {
	    const ws = slider_value / 100;
	    window = Math.ceil(ws * min);	    
	}
        	        
	var timesteps = [];        
	var count;
	       
	for(var i = 0; i < sequence.length - window; i += window) {
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
        
        d3.selectAll("rect").filter(function() {            
	    return this.getAttributeNode("run").nodeValue == name;
	}).attr("opacity",function(d,i) {            
	    return timesteps[i];
	});
        
    }	
    
    showLoadingIndicator();
    $.ajax({url: "/connect_to_db",
	    success: function(data) {
		$('#load_table_div').append('<p> Press CTRL to toggle zoom brush in overview mode. Double click to zoom out.</p>');
		var table = $('<table>').addClass("table table-sm");
		var caption = $('<caption>Select which run(s) to visualize</caption>');
		var head = $('<thead class="thead-dark"><tr><th>Run name</th><th>Load?</th></tr></thead>');
		table.append(caption);
		table.append(head);
                
		setup_main();
		for(var i = 0; i < data.length; i++) {
		    if (data[i][0] != null) {
			var newTrajectory = new Trajectory();
			trajectories[data[i][0]] = newTrajectory;
			vis_modes[data[i][0]] = draw_PCCA;
			var row = $('<tr>');
			var name_cell = $('<td>').text(data[i][0]);
			var checkbox = $('<input>', {type:'checkbox', id:'cb_' + data[i][0], value: data[i][0], click: function() {
			    if(this.checked) {
				$("#slider_optimal_clustering").slider({
				    range: true,
				    min: 2,
				    max: 20,
				    values: [2,4],
				    slide: function(event, ui) {
					$('#optimal_cluster_range').val(ui.values[0] + " - " + ui.values[1]);
					$('#btn_calculate_optimal_clustering').attr("data-m_min", ui.values[0]);
					$('#btn_calculate_optimal_clustering').attr("data-m_max", ui.values[1]);
				    }
				});    				

				$("#optimal_cluster_range").val($("#slider_optimal_clustering").slider("values", 0) +
								" - " + $("#slider_optimal_clustering").slider("values", 1));
				$('#btn_calculate_optimal_clustering').attr("data-m_min", $("#slider_optimal_clustering").slider("values", 0));
				$('#btn_calculate_optimal_clustering').attr("data-m_max", $("#slider_optimal_clustering").slider("values", 1));

				$('#btn_cancel_optimal_clustering').attr("data-name", 'cb_' + this.value);
				$('#btn_calculate_optimal_clustering').attr("data-name", this.value);
				$("#modal_optimal_clustering").iziModal('open');				                                
			    } else {
				//TODO: delete drawing and controls for a trajectory that gets deselected
				delete names_in_use[this.value];
				draw_PCCA(names_in_use);
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
		closeLoadingIndicator();
	    },
	    error: function() {                
		error_state("Error: Could not connect to database. Please check your connection to the database, refresh the page, and try again.");
		$("*").prop("disabled", true);
	   }
    });

    function setup_main() {
	var name = "main"
	var div = $('<div id="div_' + name + '">').attr("data-name", name);
	var control_div = $('<div id="div_control">').addClass("col-sm-3");
	var detail_header = $('<h2>PCCA Clustering</h2>').attr("id","header_" + name);
	var vis_div = $('<div>').attr("id","vis_" + name).addClass("col-lg-9");
	vis_div.append('<h2>' + name + '</h2>');
	div.append(vis_div);
	control_div.append(detail_header);
	div.append(control_div);
	$('#grid').append(div);
	//gridster.add_widget(div,1,1,1, Object.keys(vis_modes).length);
    }

    function setup_transition_filter(name) {
	var div = $('<div>');
	var chkbx_transition_filter = $('<input type="checkbox">').attr("id","chkbx_filter_" + name).on('click', function() {
	    if(this.checked) {
                showLoadingIndicator();
		transition_filter(name, $("#slider_filter_" + name).val(), $('#select_transition_filter_window_type_' + name).val());                
		closeLoadingIndicator();
	    } else {
		// BUG: unchecking one should redraw the other as it was,
		// not reset everything
		draw_PCCA(names_in_use);
	    }
	});
	
	var chkbx_transition_label = $('<label>Filter transitions from dominant state?</label>').attr("for", "chkbx_filter_" + name);

	var transition_filter_slider = $('<input type="range" min=1 max=100 value="10">').attr("id", "slider_filter_" + name).on('mousemove change', function(e) {	    
	    if($('#select_transition_filter_window_type_' + name).val() == "abs") {
		$("#lbl_filter_slider_" + name).text("Size of window: " + $("#slider_filter_" + name).val() + " timesteps");
	    } else {
		$("#lbl_filter_slider_" + name).text("Size of window: " + this.value + "% of smallest cluster");
	    }	    
	}).on('change', function(e) {
	    if($('#chkbx_filter_' + name).is(':checked')) {
		showLoadingIndicator();
		transition_filter(name, this.value, $('#select_transition_filter_window_type_' + name).val());
		closeLoadingIndicator();
	    }
	});
	
	var transition_filter_slider_label = $('<label>Size of window: 10% of smallest cluster</label>').attr("id", "lbl_filter_slider_" + name).attr("for", "slider_filter_" + name);

	var filter_window_types = [{val: "per", text: 'Percentage of cluster size'},
				   {val: "abs", text: 'Absolute number of states'}];
	
	var transition_filter_window_type = $('<select id="select_transition_filter_window_type_' + name +'">').on('change', function(e) {
	    if(this.value == "abs") {
		$("#slider_filter_" + name).prop({'min': 1, 'max': trajectories[name].sequence.length});
		$("#lbl_filter_slider_" + name).text("Size of window: " + $("#slider_filter_" + name).val() + " timesteps");
	    } else {
		$("#slider_filter_" + name).prop({'min': 1, 'max': 100});
		$("#lbl_filter_slider_" + name).text("Size of window: " + $("#slider_filter_" + name).val() + "% of smallest cluster");
	    }
	});

	$(filter_window_types).each(function() {
	    transition_filter_window_type.append($("<option>").attr('value', this.val).text(this.text));
	});

	transition_filter_window_type.val("per");

	var transition_filter_window_label = $('<label>Compute window size with: </label>')
	    .attr("id", "lbl_select_transition_filter_window_type_" + name)
	    .attr("for", "select_transition_filter_window_type_" + name);

	div.append(chkbx_transition_filter);
        div.append(chkbx_transition_label);
	div.append(transition_filter_slider);
	div.append(transition_filter_slider_label);
	div.append("<br>")
	div.append(transition_filter_window_label);
	div.append(transition_filter_window_type);	
	return div;
    }
    
    function setup_fuzzy_membership_filter(name) {
	var div = $('<div>');
	var chkbox = $('<input type="checkbox">').attr("id","chkbx_membership_filter_" + name).on('click', function() {
	    if(this.checked) {
	    	d3.selectAll("rect").filter(function() {            
		    return this.getAttributeNode("run").nodeValue == name;
		}).attr("opacity",function(d) {                    
		    return Math.max.apply(Math,this.getAttributeNode("fuzzy_membership").nodeValue.split(",").map(Number));
		});
	    } else {
		draw_PCCA(names_in_use);
	    }
	});
	
	var chkbx_label = $('<label>Filter fuzzy memberships?</label>').attr("for", "chkbx_membership_filter_" + name);
	div.append(chkbox);	
	div.append(chkbx_label);
	return div;
    }
    
    function setup_controls(name) {
	var name_label = $('<p><b>' + name + '</b></p>').on('mouseover', function() {
	    $(this).css("color", "blue");            
	}).on('mouseout', function() {
	    $(this).css("color", "black");
	}).on('click', function() {
	    //TODO show metadata about run
	});
	var pcca_slider = $('<input type="range" min="1" max="20" value="3">').attr("id", "slider_pcca_" + name)
	    .on('mousemove change', function(e) {                
		if(trajectories[name].feasible_clusters.includes(parseInt(this.value))) {
		    $("#lbl_pcca_slider_" + name).text(this.value + " clusters (valid)");
		}
	        else if (Math.max(trajectories[name].feasible_clusters) < parseInt(this.value) || Math.min(trajectories[name].feasible_clusters) > parseInt(this.value)) {
		    $("#lbl_pcca_slider_" + name).text(this.value + " clusters (possibly valid, not tested)");
		} else {
		    $("#lbl_pcca_slider_" + name).text(this.value + " clusters (invalid clustering)");
		}		
	    })
	    .on('change', function(e) {                
		if(trajectories[name].feasible_clusters.includes(parseInt(this.value) || Math.max(trajectories[name].feasible_clusters) < parseInt(this.value))) {
		    showLoadingIndicator();
		    load_PCCA([name],this.value,0, -1, -1).then(() => {
                        draw_PCCA(names_in_use);
		    }).catch((err) =>{error_state(err);}).finally(() => {closeLoadingIndicator();});		    
		} else {
		    alert("Warning: clustering trajectory into " + this.value + " clusters will split complex conjugate eigenvalues. Try a different clustering value.");
		}});
	var pcca_label = $('<label> 3 clusters</label>').attr("id","lbl_pcca_slider_" + name).attr("for","slider_pcca" + name);                       	
	var pcca_div = $('<div id="pcca_div_' + name + '">').addClass("row").css("border", "1px solid gray");	 	

	pcca_div.append(name_label);
	pcca_div.append(pcca_slider);
	pcca_div.append(pcca_label);
	pcca_div.append("<br>");
	pcca_div.append(setup_transition_filter(name));        
	pcca_div.append(setup_fuzzy_membership_filter(name));
	$('#div_control').append(pcca_div);        	
    }

    function set_svg(name) { 
        var svg = null;
	var bBox = null;

	if($('#svg_' + name).length) {
	    $("#svg_" + name).empty();
	    bBox = d3.select("#vis_" + name).node().getBoundingClientRect();    
	    svg = d3.select('#svg_' + name).attr("width", bBox.width);
	} else {            
	    bBox = d3.select("#vis_" + name).node().getBoundingClientRect();    
	    svg = d3.select("#vis_" + name).append("svg").attr("width", bBox.width).attr("height", svg_height).attr("id", "svg_" + name);
	}
	return [svg, bBox];
    }
    
    function draw_state_id(name) {        
	var data = trajectories[name].sequence;
	var clustered_data = null;
	if (trajectories[name].color_by_cluster) {
	    clustered_data = trajectories[name].current_clustering;
	}
	let [svg, bBox] = set_svg(name);        
	cluster_colors = [];
        
	if(clustered_data != null) {	    
	    for(var k = 0; k < clustered_data.length; k++) {	    
		cluster_colors.push(intToRGB(k));	    
	    }	                
	}
	
	scale_x = d3.scaleLinear().range([margin.left, bBox.width - margin.right]).domain([0,data.length]);
	scale_y = d3.scaleLinear().range([margin.top, svg_height - margin.bottom]).domain([d3.extent(trajectories[name].unique_states)[0], d3.extent(trajectories[name].unique_states)[1]]);
	svg.selectAll("rect").data(data, function(d) { return d }).enter().append("rect").attr("x", function(d) { return scale_x(d['timestep']) })
	    .attr("y", function(d) {                
		return scale_y(d.id)})
	    .attr("width", 5).attr("height", 5)
	    .attr("fill", function(d) {
		if(clustered_data != null) {
		    return cluster_colors[d['cluster']];
		} else {
		    return hashStringToColor(d['number']);
		}
	    })
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
    
    function draw_overview(name) { 
	var data = trajectories[name].overview;
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

        let [svg, bBox] = set_svg(name);
	
	scale_x = d3.scaleLinear().range([margin.left, bBox.width - margin.right]).domain([0,to_draw[0].end]);
	scale_y = d3.scaleLinear().range([margin.top, svg_height - margin.bottom]).domain([0,max_depth]);
	svg.selectAll("rect").data(to_draw, function(d) { return d }).enter().append("rect").attr("x", function(d) { return scale_x(d.start) })
	    .attr("y", function(d) {return scale_y(d.depth)})
	    .attr("width", function(d) { return scale_x(d.end) - scale_x(d.start) }).attr("height", 5)
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

	var brush = d3.brushX().extent([[0,0], [bBox.width, svg_height]]).on('end', function(e) {
	    var extent = e.selection;
	    
	    if(!extent) {
		scale_x.domain([0,to_draw[0].end]);
		xAxis.transition().duration(500).call(d3.axisBottom(scale_x));
	    } else {
		d3.select("#svg_" + name).select('.brush').call(brush.move, null);
		scale_x.domain([scale_x.invert(extent[0]), scale_x.invert(extent[1])]);
		xAxis.transition().duration(500).call(d3.axisBottom(scale_x));
		svg.selectAll("rect").transition().duration(500)
		    .attr("x", function(d) { return scale_x(d.start) })
		    .attr("y", function(d) {return scale_y(d.depth)})
		    .attr("width", function(d) { return scale_x(d.end) - scale_x(d.start) });
		d3.select(this).remove();
		// remove all other brushes too
		$(".brush").remove();
	    }
	});
	//TODO: zoom only shows up on last drawn graph
	document.onkeyup = function(e) {
	    if(e.key === "Control") {                
		if ($(".brush").length) { $(".brush").remove(); }               
		d3.select("#svg_" + name).append("g").attr("class", "brush").call(brush);
	    }
	}		
    }
    
    function draw_PCCA(names) { 
        
	var dataList = [];
	var count = 0;
	var maxLength = -Number.MAX_SAFE_INTEGER;

	for (const name of names) {            
	    var data = trajectories[name].sequence;
	    var clustered_data = trajectories[name].clusterings[trajectories[name].current_clustering];            
	    cluster_colors = [];        
	    for(var i = 0; i < clustered_data.length; i++) {	    
		cluster_colors.push(intToRGB(i));	    
	    }        
	    
	    if(data.length > maxLength) {
                maxLength = data.length;
	    }
	    
	    dataList.push({'name': name, 'data': data, 'y': count, 'fuzzy_memberships': trajectories[name].fuzzy_memberships[trajectories[name].current_clustering]});
	    count++;
	}
        
        let [svg,bBox] = set_svg("main");
	scale_x = d3.scaleLinear().range([margin.left, bBox.width - margin.right]).domain([0,maxLength]);
	scale_y = d3.scaleLinear().range([margin.top, svg_height - margin.bottom]).domain([0,dataList.length]);
	var tickNames = [];
	for(const t of dataList) {
	    tickNames.push(t.name);
	    svg.selectAll("rect").data(t.data, function(d) {return d}).enter().append("rect")
		.attr("x", function(d,i) {return scale_x(i)}).attr("y", function () {		
		    return scale_y(t.y);
		})
		.attr("width",1).attr("height",5).attr("fill", function(d) {
		    if(d['cluster'] == -1) {
			return "black";
		    }
		    return cluster_colors[d['cluster']];
		})
	        .attr("run", function() { return t.name })
		.attr("number", function(d) { return d['number'] })
		.attr("timestep", function(d) { return d['timestep'] })
		.attr("occurences", function(d) { return d['occurences'] })
	        .attr("fuzzy_membership", function(d,i) {                    
		    return t.fuzzy_memberships[parseInt(d['id'])] })
		.on('mouseover', function(event,d,i) {
                    //d3.selectAll("rect").filter(function (dp) { return dp['number'] != d['number'] }).attr("opacity", "0.05");
		    tippy(this, {
			allowHTML: true,
			content: "<b>Run</b>: " + t.name + " <b>State number</b>: " + d['number'] + " <i>t</i>=" + d['timestep'] +
			    "<br><b>Cluster</b>: " + d['cluster'] + " <b>Fuzzy memberships:</b>" + $(this).attr("fuzzy_membership").toString() + 
			    "<br>There are <b>" + d['occurences'] + "</b> occurences of this state.",
			arrow: true,
			maxWidth: 'none',
		    });
		})
		.on('mouseout', function(event,d) {
                    //d3.selectAll("rect").filter(function (dp) { return dp['number'] != d['number'] }).attr("opacity", "1.0");
		});
	}
	var xAxis = svg.append("g").call(d3.axisBottom().scale(scale_x));
	//add y axis
	/*var yAxis = d3.axisRight().scale(scale_y).tickValues(tickNames);
	svg.append("g").call(yAxis);*/
			
    }	
	    
});


