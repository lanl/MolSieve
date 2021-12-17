$('document').ready(function() {

    // modal init here
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
	onClosed: function() {
	    $("#modal_container").empty();
	}
    });

    $('#modal_xy_plot').iziModal({
	title: 'XY Plot',
	borderBottom: false,                      
	onClosed: function() {
	    $("#select_y_attribute").empty();
	    $("#vis_xy").empty();
	}
    });

    $("#modal_optimal_clustering").iziModal({
	title: 'Select optimal clustering bounds',
	closeButton: false,
	closeOnEscape: false,
	overlayClose: false,
	borderBottom: false	
    });

    $('#modal_path_selection').iziModal({
	title: 'Path Selection',
	closeButton: false,
        borderBottom: false
    });

    $('#modal_add_filter').iziModal({
	title: 'Add new filter',
	closeButton: false,
	closeOnEscape: false,
	overlayClose: false,
	borderBottom: false,
	//most intelligent way to reset state
	onClosed: function() {
	    $('#select_new_filter').empty();	   
	}
    });
    
    // global variables
    var trajectories = {};
    var vis_modes = {};
    var names_in_use = [];

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
    
    //START HERE
    showLoadingIndicator();
    $.ajax({url: "/connect_to_db",
	    success: function(data) {                
		$('#load_table_div').append('<p> Press CTRL to toggle path selection brush.</p>');
		generate_properties_table(data.properties, "tbl_properties");
		var table = $('<table>').addClass("table table-sm");
		var caption = $('<caption>Select which run(s) to visualize</caption>');
		var head = $('<thead class="thead-dark"><tr><th>Run name</th><th>Load?</th></tr></thead>');
		table.append(caption);
		table.append(head);                
		setup_main();
		for(var i = 0; i < data.runs.length; i++) {
		    if (data.runs[i] != null) {
			var newTrajectory = new Trajectory();
			trajectories[data.runs[i]] = newTrajectory;
			vis_modes[data.runs[i]] = draw_PCCA;
			var row = $('<tr>');
			var name_cell = $('<td>').text(data.runs[i]);
			var checkbox = $('<input>', {type:'checkbox', id:'cb_' + data.runs[i], value: data.runs[i], click: function() {
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
				names_in_use.splice(names_in_use.indexOf(this.value), 1);                                
				draw_PCCA(names_in_use);
				$('#pcca_div_' + this.value).remove();
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

    $('#btn_cancel_create_filter').on('click', function(e) {
	$('#modal_add_filter').iziModal('close');
    });

    function filter_min_opacity(property, name, val) {        
        d3.selectAll("rect").filter(function(d) {     
	    return this.getAttributeNode("run").nodeValue == name && d[property] <= val;
	}).attr("opacity", 0);	
    }

    function filter_max_opacity(property, name, val) {        
	d3.selectAll("rect").filter(function(d,i) {            
	    return this.getAttributeNode("run").nodeValue == name && trajectories[name].sequence[i][property] >= val;
	}).attr("opacity", 0);	
    }

    function filter_range_opacity(property, name, val1, val2) {        
	d3.selectAll("rect").filter(function(d,i) {            
	    return this.getAttributeNode("run").nodeValue == name && (trajectories[name].sequence[i][property] <= val1 || trajectories[name].sequence[i][property] >= val2);
	}).attr("opacity", 0);	
    }

    function getMinProperty(property, name) {
	var min = Number.MAX_VALUE;        
	for(d of trajectories[name].sequence) {            
	    if(d[property] < min) {
		min = d[property];
	    }
	}
	return min;
    }

    function getMaxProperty(property, name) {
	var max = Number.MIN_VALUE;
	for(d of trajectories[name].sequence) {
	    if(d[property] > max) {
		max = d[property];
	    }
	}
	return max;
    }
				      
    $('#btn_create_filter').on('click', function(e) {
	var attribute = $('#select_new_filter').val();
	var filterType = $('#select_new_filter_type').val();

	var filter_functions = {"MIN": filter_min_opacity,
			        "MAX": filter_max_opacity,
			        "RANGE": filter_range_opacity};

	var filter_text = {"MIN": "At least ",
			   "MAX": "At most ",
			   "RANGE": "Between "}
	
	var name = $(this).attr("data-name");                
        
	var div = $('<div>')

	var label = $('<label for="slider_filter_'+name+'_'+attribute+'"><label>');
	var slider = null;
	
	if(filterType != "RANGE") {
	    slider = $('<input>', {type: 'range', min: getMinProperty(attribute, name),
				   max: getMaxProperty(attribute, name),
				   value: getMinProperty(attribute, name),
				   id:'slider_filter_' + name + '_' + attribute}).on('change', function() {
				       label.text(filter_text[filter_type] + this.value); 
				       if($("#cb_filter_" + name + "_" + attribute).is(":checked")) {
					   filter_functions[filterType](attribute, name, this.value);
				       }
				   });
	    label.text(slider.val());
	} else {
	    slider = $('<div>', {id:'slider_filter_' + name + '_' + attribute});
	    slider.slider({
		range: true,
		min: getMinProperty(attribute, name),
		max: getMaxProperty(attribute,name),
		values: [getMinProperty(attribute,name),getMaxProperty(attribute,name)],
		slide: function(event, ui) {
		    label.text(filter_text[filter_type] + ui.values[0] + " - " + ui.values[1]);                    
		    if($("#cb_filter_" + name + "_" + attribute).is(":checked")) {                        
			filter_functions[filterType](attribute,name, ui.values[0], ui.values[1]);
		    }
		}
	    });    						
	}

	var checkbox_label = $('<label>Filter ' + attribute + '? </label>', {for:'cb_filter_'+name+'_'+attribute});
	var checkbox = $('<input>', {type:'checkbox', id:'cb_filter_' + name + '_' + attribute}).on('click', function() {
	    if(this.checked) {
		if(filterType != "RANGE") {                    
		    filter_functions[filterType](attribute, name, $('#slider_filter_' + name + '_' + attribute).val());
		} else {
		    filter_functions[filterType](attribute, name,
						 $('#slider_filter_' + name + '_' + attribute).slider("values", 0),
						 $('#slider_filter_' + name + '_' + attribute).slider("values", 1))
		}		
	    } else {
		$('#g_' + name).children().attr("opacity", 1);
	    }
	});
	
	div.append(checkbox);
	div.append(checkbox_label)
	div.append(slider);
	div.append(label);
	$('#pcca_div_' + name).append(div);
        
	$('#modal_add_filter').iziModal('close');
    });

    $('#btn_generate_xy_plot').on('click', function() {
	var name = $(this).attr("data-name");
	var attribute = $('#select_y_attribute').val();

	draw_xy_plot(name,attribute);
	
    });
    
    $("#btn_cancel_optimal_clustering").on('click', function() {                
	$("#modal_optimal_clustering").iziModal('close');
	$('#' + $(this).attr("data-name")).prop('checked', false);
    });
    
    $("#btn_calculate_optimal_clustering").on('click', function(e) {        
	var name = $(this).attr("data-name");
	var m_min = $(this).attr("data-m_min");
	var m_max = $(this).attr("data-m_max");
	var checkboxes = $("#tbl_properties").find('td input:checkbox');
	var properties = [];
	for(chkbx of checkboxes) {
	    if(chkbx.checked) {                
		properties.push(chkbx.value);
	    }
	}

	names_in_use.push(name);
	trajectories[name].properties = properties;
	
	showLoadingIndicator();
	load_PCCA(names_in_use,-1,1, m_min, m_max).then((names) => {				    
	    setup_controls(name);                                 
	    draw_PCCA(names);
            update_pcca(name);                                    
	}).catch((err => {
	    //need a better way to come back from this
	    closeLoadingIndicator();
	    error_state(err);
	})).finally(() => {
	    closeLoadingIndicator();				    				                                        
	});
	
    });

    // perhaps add a subtitle option
    async function showLoadingIndicator() {
	$('#modal_loading-indicator').iziModal('open');
    }

    async function closeLoadingIndicator() {
	$('#modal_loading-indicator').iziModal('close');
	$('#modal_loading-indicator').iziModal('setSubtitle', '');
    }
    
    function generate_properties_table(propertyList, id) {
	const default_properties = ['occurences', 'number'];        
	var table = $('#' + id);
	var caption = $('<caption>Select which properties to load</caption>');
	var head = $('<thead class="thead-dark"><tr><th>Property</th><th>Load?</th></tr></thead>');
	table.append(caption);
	table.append(head);                	
	for(property of propertyList) {
	    if(!default_properties.includes(property)) {
		var row = $('<tr>');
		var name_cell = $('<td>').text(property);
		var checkbox = $('<input>', {type:'checkbox', id:'cb_' + property, value: property});
		var input_cell = $('<td>').append(checkbox);
		row.append(name_cell);
		row.append(input_cell);
		table.append(row);
	    }
	}        
    }

    function error_state(msg) {	
	$('#modal_loading-indicator').iziModal('close');
	$('#modal_loading-indicator').hide();
	$('*').hide();
	alert(msg);	
    }

    //TODO make the error checking more robust, this is overall pretty clumsy and ugly
    var load_PCCA_json = function(names,index,clusters,optimal, m_min, m_max) {
	return new Promise(function(resolve, reject) {
	    var name = names[index];
	    $('#modal_loading-indicator').iziModal('setSubtitle', "Calculating PCCA for " + name);
	                
	    $.getJSON('/pcca', {'run': name, 'clusters' : clusters, 'optimal' : optimal, 'm_min': m_min, 'm_max': m_max}, function(clustered_data) {                
		if (optimal === 1) {                    
		    trajectories[name].optimal_cluster_value = clustered_data.optimal_value;
		    trajectories[name].current_clustering = clustered_data.optimal_value;                    
		    trajectories[name].feasible_clusters = clustered_data.feasible_clusters;
		    for(idx of trajectories[name].feasible_clusters) {
			trajectories[name].clusterings[idx] = clustered_data.sets[idx];			
			trajectories[name].fuzzy_memberships[idx] = clustered_data.fuzzy_memberships[idx];
		    }
		} else {
		    if(!trajectories[name].feasible_clusters.includes(clusters)) {
			trajectories[name].feasible_clusters.push(clusters);
		    }
		    trajectories[name].clusterings[clusters] = clustered_data.sets[clusters];
		    trajectories[name].fuzzy_memberships[clusters] = clustered_data.fuzzy_memberships[clusters];
		    trajectories[name].current_clustering = clusters;
		}
                		
		if(trajectories[name].sequence == null) {
		    $('#modal_loading-indicator').iziModal('setSubtitle', "Loading sequence for " + name);                    		    
		    $.getJSON('/load_dataset', {'run': name, 'properties': trajectories[name].properties.toString()}, function(data) {			                        
			trajectories[name].sequence = data;                                                
		    }).then(() => {                        
			if(index < names.length - 1) {                            
			    load_PCCA_json(names,++index,clusters,optimal, m_min, m_max).then((names) => {resolve(names)});
			} else {
			    resolve(names);
			}			
		    }).fail(function () {
			reject(names);
		    });
		} else {
		    if(index < names.length - 1) {
			load_PCCA_json(names,++index,clusters,optimal,m_min,m_max).then((names) => {resolve(names)});
		    } else {
			resolve(names);
		    }			
		}
	    }).fail(function() {
		reject(names);
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
		unique_states.add(trajectories[name].sequence[i].number);
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
		$("#g_" + name).children().attr("opacity", 1);                
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
	console.log(trajectories[name]);
        
        // scale opacity by max of that value
	var chkbox = $('<input type="checkbox">').attr("id","chkbx_membership_filter_" + name).on('click', function() {
	    if(this.checked) {
		
		var current_membership_values = trajectories[name].fuzzy_memberships[trajectories[name].current_clustering];
		var extents = {};
		
		for(var i = 0; i < trajectories[name].current_clustering; i++) {		    
		    var minMax = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
		    extents[i] =  minMax;
		}
		
		for(var j = 0; j < trajectories[name].sequence.length; j++) {
		    var id = trajectories[name].sequence[j]['id'];
                    var cluster_membership = trajectories[name].sequence[j]['cluster'];                    
		    extents[cluster_membership][0] = Math.min(extents[cluster_membership][0], current_membership_values[id][cluster_membership]);
		    extents[cluster_membership][1] = Math.max(extents[cluster_membership][1], current_membership_values[id][cluster_membership]);
		}
                                		
		var scales = [];
		for(var i = 0; i < trajectories[name].current_clustering; i++) {
		    scales.push(d3.scaleLinear().range([0,0.5]).domain([extents[i][0], extents[i][1]]));
		}                

		//still not that great of a metric
	    	d3.selectAll("rect").filter(function() {            
		    return this.getAttributeNode("run").nodeValue == name;
		}).attr("opacity", function(d) {
		    var value = this.getAttributeNode("fuzzy_membership").nodeValue.split(",").map(Number);
		    var scale_index = value.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0);                    
		    return scales[scale_index](Math.max.apply(Math, value));
		});
	    } else {
		$("#g_" + name).children().attr("opacity", 1);                                
	    }
	});
	
	var chkbx_label = $('<label>Filter fuzzy memberships?</label>').attr("for", "chkbx_membership_filter_" + name);
	div.append(chkbox);	
	div.append(chkbx_label);
	return div;
    }

    function setup_filter_buttons(name) {
	var div = $('<div>');
	var btn_add_filter = $('<button>+ Add a new filter...</button>').attr("id", "btn_add_filter_" + name).addClass("btn btn-light")
	    .on('click', function() {
		$('#modal_add_filter').iziModal('setSubtitle', name);
		for(property of trajectories[name].properties) {
		    $('#select_new_filter').append($('<option>').val(property).text(property));
		}
		$('#btn_create_filter').attr("data-name", name);
		$('#modal_add_filter').iziModal('open');
	    });

	var btn_plot_attribute = $('<button>Generate x-y plot with attribute</button>').attr("id", "btn_plot_attribute_" + name)
	    .addClass("btn btn-light").on('click', function() {                
		var select = $("#select_y_attribute");
		for(property of trajectories[name].properties) {
		    select.append($('<option>').val(property).text(property));		    
		}
		$('#btn_generate_xy_plot').attr("data-name", name);
	        $('#modal_xy_plot').iziModal('open');
	    });

	div.append(btn_add_filter);
	div.append(btn_plot_attribute);

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
	// this can be better, considering that we change the values constantly
	var pcca_slider = $('<input type="range" min="1" max="20" value="3">').attr("id", "slider_pcca_" + name)
	    .on('mousemove change', function(e) {                
		if(trajectories[name].feasible_clusters.includes(parseInt(this.value))) {
		    $("#lbl_pcca_slider_" + name).text(this.value + " clusters (valid)");
		} else if (parseInt(this.value) == 1) {
		        $("#lbl_pcca_slider_" + name).text(this.value + " cluster (trivial)");
		} else if (Math.max.apply(Math, trajectories[name].feasible_clusters) < parseInt(this.value) || Math.min.apply(Math, trajectories[name].feasible_clusters) > parseInt(this.value)) {
		    $("#lbl_pcca_slider_" + name).text(this.value + " clusters (possibly valid, not tested)");
		} else {
		    $("#lbl_pcca_slider_" + name).text(this.value + " clusters (invalid clustering)");
		}		
	    })
	    .on('change', function(e) {                                
		if(trajectories[name].feasible_clusters.includes(parseInt(this.value)) || Math.max.apply(Math, trajectories[name].feasible_clusters) < parseInt(this.value) || Math.min.apply(Math, trajectories[name].feasible_clusters) > parseInt(this.value)) {		
		    showLoadingIndicator();
		    load_PCCA([name], parseInt(this.value), 0, -1, -1).then(() => {
                        draw_PCCA(names_in_use);
		    }).catch((err) =>{error_state(err);}).finally(() => {closeLoadingIndicator();});		    
		} else {
		    alert("Warning: clustering trajectory into " + this.value + " clusters will split complex conjugate eigenvalues. Try a different clustering value.");
		}});

	var pcca_label = $('<label> 3 clusters</label>').attr("id","lbl_pcca_slider_" + name).attr("for", "slider_pcca" + name);                       	
	var pcca_div = $('<div id="pcca_div_' + name + '">').addClass("row").css("border", "1px solid gray");	 	

	var clustering_difference_label = $('<label>Show clustering difference</label>').attr("for", "cb_clustering_difference_" + name);
	var cb_clustering_difference = $('<input>', {type:'checkbox', id:'cb_clustering_difference_' + name})
            .on('click', function() {
		if(this.checked) {
		    $('#modal_loading-indicator').iziModal('setSubtitle', 'Calculating differences for clusters ' +
						       trajectories[name].feasible_clusters.toString());
		    showLoadingIndicator();

		    var clustering_assignments = [];
		    var maxSize = -Number.MAX_SAFE_INTEGER;
		    // for some reason, an extra labels object is created at the end
		    for(d of trajectories[name].unique_states) {
			var labels = new Set();
			for(clustering of Object.values(trajectories[name].clusterings)) {
			    for(var i = 0; i < clustering.length; i++) {
				if(clustering[i].includes(d)) {
				    labels.add(i);
				}
			    }
			}
			maxSize = (labels.size > maxSize) ? labels.size : maxSize;		    
			clustering_assignments.push(labels);		    
		    }                

		    d3.selectAll("rect").filter(function() {            
			return this.getAttributeNode("run").nodeValue == name;
		    }).attr("fill", function(d,i) {
			var instability = clustering_assignments[d['id']].size / maxSize; 
			if(instability > 0.75) {
			    return "red";
			} else if(instability < 0.75 && instability > 0.5) {
			    return "yellow";
			} else {
			    return "green";
			}		    
		    });
		    
		    closeLoadingIndicator();
		} else {
                    d3.selectAll("rect").filter(function() {            
			return this.getAttributeNode("run").nodeValue == name;
		    }).attr("fill", function(d,i) {
			return intToRGB(d['cluster']);
		    });		    
		}
	});	
	pcca_div.append(name_label);
	pcca_div.append(pcca_slider);
	pcca_div.append(pcca_label);
	pcca_div.append("<br>");

	pcca_div.append(cb_clustering_difference);
	pcca_div.append(clustering_difference_label);
	pcca_div.append("<br>");
	pcca_div.append(setup_transition_filter(name));        
	pcca_div.append(setup_fuzzy_membership_filter(name));

	if(trajectories[name].properties.length > 0) {
	    pcca_div.append(setup_filter_buttons(name));
	}
	
	$('#div_control').append(pcca_div);        	
    }

    // saves a lot of time for setup, just name the div containing the drawing vis_NAME and pass NAME into this function
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
        
        
	scale_x = d3.scaleLinear().range([margin.left, bBox.width - margin.right]).domain([0,data.length]);
	scale_y = d3.scaleLinear().range([margin.top, svg_height - margin.bottom]).domain([d3.extent(trajectories[name].unique_states)[0], d3.extent(trajectories[name].unique_states)[1]]);
	svg.selectAll("rect").data(data, function(d) { return d }).enter().append("rect").attr("x", function(d) { return scale_x(d['timestep']) })
	    .attr("y", function(d) {                
		return scale_y(d.id)})
	    .attr("width", 5).attr("height", 5)
	    .attr("fill", function(d) {
		if(clustered_data != null) {
		    return intToRGB(d['cluster']);
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
        
	if(names.length == 0 || names === undefined) {
	    if($('#svg_main').length) {
		$("#svg_main").empty();
	    }
	    return;
	}
	
	var dataList = [];
	var count = 0;
	var maxLength = -Number.MAX_SAFE_INTEGER;

	for (const name of names) {            
	    var data = trajectories[name].sequence;            
            
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
	    let g = svg.append("g").attr("id", "g_" + t.name);	
	    tickNames.push(t.name);
	    g.selectAll("rect").data(t.data, function(d) {return d}).enter().append("rect")
		.attr("x", function(d,i) {                    
		    return scale_x(i)}).attr("y", function () {		
		    return scale_y(t.y);
		})
		.attr("width",5).attr("height",5).attr("fill", function(d) {
		    if(d['cluster'] == -1) {
			return "black";
		    }
		    return intToRGB(d['cluster']);
		})
	        .attr("run", function() { return t.name })
		.attr("number", function(d) { return d['number'] })
		.attr("timestep", function(d) { return d['timestep'] })
		.attr("occurences", function(d) { return d['occurences'] })
	        .attr("fuzzy_membership", function(d,i) {                    
		    return t.fuzzy_memberships[parseInt(d['id'])] })
		.on('mouseover', function(event,d,i) {                                        
		    var props = trajectories[t.name].properties;
		    var propertyString = "";
		    var perLine = 3;
		    var count = 0;
		    for(property of props) {
			propertyString += "<b>" + property + "</b>: " + trajectories[t.name].sequence[d['timestep']][property] + " ";
			count++;
			if(count % perLine == 0) {
			    propertyString + "<br>";
			}
		    }
		    tippy(this, {
			allowHTML: true,
			content: "<b>Run</b>: " + t.name + " <b>State number</b>: " + d['number'] + " <i>t</i>=" + d['timestep'] +
			    "<br><b>Cluster</b>: " + d['cluster'] + " <b>Fuzzy memberships:</b>" + $(this).attr("fuzzy_membership").toString() + 
			    "<br>There are <b>" + d['occurences'] + "</b> occurences of this state.<br>" + propertyString,
			arrow: true,
			maxWidth: 'none',
		    });
		});	    
	}
	var xAxis = svg.append("g").call(d3.axisBottom().scale(scale_x));				

	var brush = d3.brush().extent([[0,0], [bBox.width, svg_height]]).on('end', function(e) {
	    var extent = e.selection;                        
	    if(extent) {
		var curr_name = dataList[Math.round(scale_y.invert(extent[0][1]))].name;		
		if (curr_name != null && curr_name != undefined) {
		    var begin = trajectories[curr_name].sequence[Math.round(scale_x.invert(extent[0][0]))];
		    var end = trajectories[curr_name].sequence[Math.round(scale_x.invert(extent[1][0]))];                    
		    $('#modal_path_selection').iziModal('setSubtitle', "State " + begin.number + " - " + "State " + end.number);                    		    
		    $('#modal_path_selection').iziModal('open');
                    //TODO bind start and end to data attributes of buttons in modal
		    
		}                                
	    }	    
	    d3.select(this).remove();            
	    $(".brush").remove();
	});
	
	document.onkeyup = function(e) {
	    if(e.key === "Control") {                
		if ($(".brush").length) { $(".brush").remove(); }               
		d3.select("#svg_main").append("g").attr("class", "brush").call(brush);
	    }                			
	}	
    }

    function draw_xy_plot(name, attribute) {
	let [svg,bBox] = set_svg("xy");

	const data = trajectories[name].sequence;
        
	var attributeList = [];
	for(d of trajectories[name].sequence) {
	    attributeList.push(d[attribute]);
	}

	var xtent = d3.extent(attributeList);        
	
        scale_x = d3.scaleLinear().range([margin.left, bBox.width - margin.right]).domain([0,data.length]);
	scale_y = d3.scaleLinear().range([margin.top, svg_height - margin.bottom]).domain([xtent[0],xtent[1]]);
	
        svg.selectAll("rect").data(data).enter().append("rect")
	    .attr("x", function(d) {return scale_x(d['timestep'])})
	    .attr("y", function(d) {return scale_y(d[attribute])})
	    .attr("width", 5).attr("height", 5)
	    .attr("fill", function(d) {                
		if(d['cluster'] == -1) {
		    return "black";
		}
		return intToRGB(d['cluster']);
	    }).on('mouseover', function(event, d) {
		tippy(this, {
		    allowHTML: true,
		    content: "<i>t<i> = " + d['timestep'] +
			     "<br><b>" + attribute + "</b>: " + d[attribute],
		    arrow: true,
		    maxWidth: 'none',
		});		
	    });

	var xAxis = svg.append("g").call(d3.axisBottom().scale(scale_x));				
    }
});
