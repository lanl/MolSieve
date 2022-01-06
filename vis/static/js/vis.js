$('document').ready(function() {

    // global variable that keeps track of what trajectories are currently being used
    var names_in_use = [];

    //view
    let widget_height = 500;
    let svg_height = widget_height - 100;    
    var margin = {top: 20, bottom: 20, left: 5, right: 25};

    // view utility functions    
    /* If there's an error, just disable everything.
     * TODO make more sensitive towards non-fatal server errors */
    function error_state(msg) {	
	$('#modal_loading-indicator').iziModal('close');
	$('#modal_loading-indicator').hide();
 	$('*').hide();
	alert(msg);	
    }

    /* Shows a nice loading indicator with a subtitle that tells the user what you're doing */
    async function showLoadingIndicator(subtitle) {
	if(subtitle) {
	    $('#modal_loading-indicator').iziModal('setSubtitle', subtitle);
	}
	$('#modal_loading-indicator').attr("data-izimodal-preventclose", "").iziModal('open');
    }

    /* Closes the loading indicator when you're done doing asynchronous stuff */
    async function closeLoadingIndicator() {
	$('#modal_loading-indicator').iziModal('close');
	$('#modal_loading-indicator').iziModal('setSubtitle', '');
    }    
    
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

    // xy plot modal
    $('#modal_xy_plot').iziModal({
	title: 'XY Plot',
	borderBottom: false,                      
	onClosed: function() {
	    $("#select_y_attribute").empty();
	    $("#vis_xy").empty();
	}
    });

    /* Button inside xy plot modal that draws whatever user selected */
    $('#btn_generate_xy_plot').on('click', function() {
	var name = $(this).attr("data-name");
	var sequence = trajectories[name].sequence;
	var attribute = $('#select_y_attribute').val();
	draw_xy_plot(attribute, sequence, "xy");	
    });
 
    // Optimal clustering modal
    $("#modal_optimal_clustering").iziModal({
	title: 'Select optimal clustering bounds',
	closeButton: false,
	closeOnEscape: false,
	overlayClose: false,
	borderBottom: false	
    });

    /* Cancels optimal clustering if cancel is selected. */
    $("#btn_cancel_optimal_clustering").on('click', function() {                
	$("#modal_optimal_clustering").iziModal('close');
	$('#' + $(this).attr("data-name")).prop('checked', false);
    });

    /* Calculates the optimal clustering, creates the trajectory in memory etc. */
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
	showLoadingIndicator("Calculating PCCA for " + name);
	load_PCCA(name,-1,1, m_min, m_max).then((name) => {            
	    $('#modal_loading-indicator').iziModal('setSubtitle', "Loading sequence for " + name);                    		    
	    return load_sequence(name, properties);
	}).then((name) => {
	    $('#modal_loading-indicator').iziModal('setSubtitle', "Rendering");                    		    
	    set_cluster_info(name);
	    calculate_unique_states(name);    
	    setup_controls(name);                                 	
	    draw_PCCA(names_in_use);
	}).catch((err => {                        
	    error_state(err);
	})).finally(() => {
	    closeLoadingIndicator();				    				                                        
	});	
    });

    /* Opens the optimal clustering modal. Since there's a lot of setup here, placed in its own function. 
     * name - trajectory to prepare to calculate
     */
    function open_optimal_clustering_modal(name) { 
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
	$('#btn_cancel_optimal_clustering').attr("data-name", 'cb_' + name);
	$('#btn_calculate_optimal_clustering').attr("data-name", name);
	$("#modal_optimal_clustering").iziModal('open');				                                
    }

    // path selection modal
    $('#modal_path_selection').iziModal({
	title: 'Path Selection',
	closeButton: false,
        borderBottom: false,
	onClosed: function() {
	    $("#vis_neb").empty();
	    $("#btn_calculate_neb").show();
	}
    });

    $('#btn_calculate_neb').on('click', function() {	
	var name = $('#modal_path_selection_container').attr("data-name");
	var start = 300;//$('#modal_path_selection_container').attr("data-start");
	var end = 305;//$('#modal_path_selection_container').attr("data-end");
	showLoadingIndicator("Calculating nudged elastic band on timesteps " + start + " - " + end);
	calculate_neb_on_path(name, start, end+1).then((data) => {
	    let sequence = trajectories[name].sequence.slice(start, end+1);
	    var max_energy = Math.max.apply(Math,data);
	    var init_energy = data[0];
	    var dE = max_energy - init_energy;            
	    closeLoadingIndicator();
	    $('#modal_path_selection').iziModal('open');
	    $('#btn_calculate_neb').hide();
	    $("#vis_neb").append("<p><b>Maximum energy barrier on path:</b> " + max_energy + "</p>");
	    $("#vis_neb").append("<p><b>Total ΔE over path:</b> " + dE + "</p>");	                
	    draw_xy_plot("Energy", sequence, "neb", data);            	    
	}).catch((error) => {error_state(error);}).finally(() => {
	    closeLoadingIndicator();
	});

    });

    // add filter modal
    $('#modal_add_filter').iziModal({ 
	title: 'Add new filter',
	closeButton: false,
	closeOnEscape: false,
	overlayClose: false,
	borderBottom: false,        
	onClosed: function() {
	    $('#select_new_filter').empty();	   
	}
    });

    /* Self explanatory - closes add filter modal */
    $('#btn_cancel_create_filter').on('click', function(e) {
	$('#modal_add_filter').iziModal('close');
    });

    /* Creates filter based on user input in modal */
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
				       label.text(filter_text[filterType] + this.value); 
				       if($("#cb_filter_" + name + "_" + attribute).is(":checked")) {
					   $('#g_' + name).children().attr("opacity", 1);
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
		values: [getMinProperty(attribute,name), getMaxProperty(attribute,name)],
		slide: function(event, ui) {
		    label.text(filter_text[filterType] + ui.values[0] + " - " + ui.values[1]);                    
		    if($("#cb_filter_" + name + "_" + attribute).is(":checked")) {
                        $('#g_' + name).children().attr("opacity", 1);
			filter_functions[filterType](attribute,name, ui.values[0], ui.values[1]);
		    }
		}
	    });    						
	}

	var checkbox_label = $('<label>Filter ' + attribute + '? </label>', {for:'cb_filter_'+name+'_'+attribute});
	var checkbox = $('<input>', {type:'checkbox', id:'cb_filter_' + name + '_' + attribute}).on('click', function() {
	    if(this.checked) {
		if(filterType != "RANGE") {
		    $('#g_' + name).children().attr("opacity", 1);
		    filter_functions[filterType](attribute, name, $('#slider_filter_' + name + '_' + attribute).val());
		} else {
		    $('#g_' + name).children().attr("opacity", 1);
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

    /* Generic filter function that gets all states with at least val of property.
     * property - property to filter on
     * name - name of the trajectory 
     * val - min value
     */
    function filter_min_opacity(property, name, val) {        
        d3.selectAll("rect").filter(function(d) {     
	    return this.getAttributeNode("run").nodeValue == name && d[property] <= val;
	}).attr("opacity", 0);	
    }

    /* Generic filter function that gets all states with at most val of property.
     * property - property to filter on
     * name - name of the trajectory 
     * val - max value
     */
    function filter_max_opacity(property, name, val) {        
	d3.selectAll("rect").filter(function(d,i) {            
	    return this.getAttributeNode("run").nodeValue == name && d[property] >= val;
	}).attr("opacity", 0);	
    }
    
    /* Generic filter function that gets all states that are between val1 and val2 of the given property
     * property - property to filter on
     * name - name of the trajectory 
     * val1 - min value
     * val2 - max value
     */    
    function filter_range_opacity(property, name, val1, val2) {        
	d3.selectAll("rect").filter(function(d,i) {            
	    return this.getAttributeNode("run").nodeValue == name && (d[property] <= val1 || d[property] >= val2);
	}).attr("opacity", 0);	
    }

    // Application actually starts here
    showLoadingIndicator();    
    connect_to_database().then((data) => {        
	setup_properties_table(data.properties, "tbl_properties");
	setup_runs_table(data);	
	$('#grid').append(setup_main());        
    }).catch(function(error) {
	error_state(error);
    }).then(() => {
	closeLoadingIndicator();
    });               

    /* Sets up the properties table that is seen within the optimal_clustering modal
     * propertyList - properties to include
     * id - DOM id of the table to populate
     */
    function setup_properties_table(propertyList, id) { 
	const default_properties = ['occurences', 'number'];        
	var table = $('#' + id);
	var caption = $('<caption>Select which properties to load</caption>');
	var head = $('<thead class="thead-dark"><tr><th>Property</th><th>Load?</th></tr></thead>');
	table.append(caption);
	table.append(head);        
	for(property of propertyList) {	    
	    var row = $('<tr>');
	    var name_cell = $('<td>').text(property);
	    var checkbox = $('<input>', {type:'checkbox', id:'cb_' + property, value: property});
	    var input_cell = $('<td>').append(checkbox);
	    row.append(name_cell);
	    row.append(input_cell);
	    table.append(row);
	    
	    if(default_properties.includes(property)) {
		checkbox.prop("checked", true);
		checkbox.prop("disabled", true);
	    }
	}        
    }

    /* Set up table where you can choose which trajectories to visualize
     * data - data from the ajax call that includes the properties available in the database,
     * as well as the runs / trajectories available
     */
    function setup_runs_table(data) { 
	var table = $('<table>').addClass("table table-sm");
	var caption = $('<caption>Select which run(s) to visualize</caption>');
	var head = $('<thead class="thead-dark"><tr><th>Run name</th><th>Load?</th></tr></thead>');
	table.append(caption);
	table.append(head);                
	for(var i = 0; i < data.runs.length; i++) {
	    if (data.runs[i] != null) {                
		var row = $('<tr>');
		var name_cell = $('<td>').text(data.runs[i]);                
		var checkbox = $('<input>', {type:'checkbox', id:'cb_' + data.runs[i], value: data.runs[i], click: function() {
		    if(this.checked) {                                
			open_optimal_clustering_modal(this.value);
		    } else {				
			names_in_use.splice(names_in_use.indexOf(this.value), 1);                                
			$('#pcca_div_' + this.value).remove();
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
    }

    /* Set up main divider where everything is drawn */
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
	return div;	
    }                   

    /* Set up controls for the given trajectory on the right hand side of the divider
     * name - name of trajectory to set up controls for
     */
    function setup_controls(name) {
	var pcca_div = $('<div id="pcca_div_' + name + '">').addClass("row").css("border", "1px solid gray");	 	

	var name_label = $('<p><b>' + name + '</b></p>').on('mouseover', function() {
	    $(this).css("color", "blue");            
	}).on('mouseout', function() {
	    $(this).css("color", "black");
	}).on('click', function() {
	    //TODO show metadata about run
	});
                        
	var pcca_slider = $('<input type="range" min="1" max="20" value="' + trajectories[name].optimal_cluster_value + '">')
	    .attr("id", "slider_pcca_" + name)
	    .on('mousemove change', function(e) {                
		if(trajectories[name].feasible_clusters.includes(parseInt(this.value))) {
		    $("#lbl_pcca_slider_" + name).text(this.value + " clusters (valid)");
		} else {
		    $("#lbl_pcca_slider_" + name).text(this.value + " clusters (possibly invalid clustering)");
		}		
	    }).on('change', function(e) {                                		
		showLoadingIndicator();
		load_PCCA(name, parseInt(this.value), 0, -1, -1).then(() => {
                    draw_PCCA(names_in_use);
		}).catch((err) =>{error_state(err);}).finally(() => {closeLoadingIndicator();});		    
	    });

	var pcca_label = $('<label>' + pcca_slider.val() + " clusters (valid)" + '</label>')
	    .attr("id","lbl_pcca_slider_" + name).attr("for", "slider_pcca" + name);                       	

	var clustering_difference_label = $('<label>Show clustering difference</label>').attr("for", "cb_clustering_difference_" + name);
	var cb_clustering_difference = $('<input>', {type:'checkbox', id:'cb_clustering_difference_' + name}).on('click', function() {
		if(this.checked) {
		    $('#modal_loading-indicator').iziModal('setSubtitle', 'Calculating differences for clusters ' +
						       trajectories[name].feasible_clusters.toString());
		    showLoadingIndicator();
		    clustering_difference_filter(name);
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

    /* Sets up the transition filter within the control divider
     * name - name of trajectory to set up controls for
     */
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
	
	var transition_filter_slider_label = $('<label>Size of window: 10% of smallest cluster</label>')
	    .attr("id", "lbl_filter_slider_" + name).attr("for", "slider_filter_" + name);

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

    /* Set up the fuzzy membership filter 
     * name - name of trajectory to set up controls for
     */
    function setup_fuzzy_membership_filter(name) {	
	var div = $('<div>');        
	var chkbox = $('<input type="checkbox">').attr("id","chkbx_membership_filter_" + name).on('click', function() {
	    if(this.checked) {
		fuzzy_membership_filter(name);
	    } else {
		$("#g_" + name).children().attr("opacity", 1);                                
	    }
	});
	
	var chkbx_label = $('<label>Filter fuzzy memberships?</label>').attr("for", "chkbx_membership_filter_" + name);
	div.append(chkbox);	
	div.append(chkbx_label);
	return div;
    }

    /* Set up the dynamic filters 
     * name - name of trajectory to set up controls for
     */
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
    
    /* Sets up a SVG for drawing. Assumes that the divider you're drawing in is called vis_ something.
     * Trivial to make general, just no real point. 
     */    
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

    /* Draws the visualization according to the names array, which contains the names of every trajectory currently in use 
     * If called with an empty array, has the hidden function of deleting everything, acting as a clear function.
     * names - names of the trajectories to render
     */
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
	    
	    dataList.push({'name': name, 'data': data, 'y': count,
			   'fuzzy_memberships': trajectories[name].fuzzy_memberships[trajectories[name].current_clustering]});
	    count++;
	}        
       	
        let [svg,bBox] = set_svg("main");
	
	var scale_x = d3.scaleLinear().range([margin.left, bBox.width - margin.right]).domain([0,maxLength]);
	var scale_y = d3.scaleLinear().range([margin.top, svg_height - margin.bottom]).domain([0,dataList.length]);

	var tickNames = [];

	//TODO add modal on state click, to show additional information if interested

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
	        .attr("fuzzy_membership", function(d) {                    
		    return t.fuzzy_memberships[parseInt(d['id'])]; })
	        .on('click', function(event,d) {
		    //showLoadingIndicator("Generating Ovito image for state " + d['number']);
		    /*generate_ovito_image(d['number']).then((data) => {
			console.log(data);
			var img = $('<img>').attr("src", 'data:image/png;base64,' + data);
			$("#modal_container").append(img);
		    }).catch((error) => {error_state(error);}).finally(closeLoadingIndicator());*/
		    $("#modal_info").iziModal('setSubtitle', d['number']);
		    $("#modal_info").iziModal('open');
		})
		.on('mouseover', function(event,d) {                                        
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
			    "<br><b>Cluster</b>: " + d['cluster'] + " <b>Fuzzy memberships:</b>" +
			    $(this).attr("fuzzy_membership").toString() + 
			    "<br>There are <b>" + d['occurences'] + "</b> occurences of this state.<br>" + propertyString,
			arrow: true,
			maxWidth: 'none',
		    });
		});	    
	}
	
	svg.append("g").call(d3.axisBottom().scale(scale_x));				
	var brush = d3.brush().extent([[0,0], [bBox.width, svg_height]]).on('end', function(e) {
	    var extent = e.selection;                        
	    if(extent) {
		console.log(scale_y.invert(extent[0][1]));
                var curr_name = dataList[Math.round(scale_y.invert(extent[0][1]))].name;		
		if (curr_name != null && curr_name != undefined) {
		    var begin = trajectories[curr_name].sequence[Math.round(scale_x.invert(extent[0][0]))];
		    var end = trajectories[curr_name].sequence[Math.round(scale_x.invert(extent[1][0]))];                    
		    $('#modal_path_selection').iziModal('setSubtitle', "State " + begin.number + " - " + "State " + end.number);
		    $('#modal_path_selection_container').attr("data-start", begin.timestep);
		    $('#modal_path_selection_container').attr("data-end", end.timestep);
		    $('#modal_path_selection_container').attr("data-name", curr_name);
		    $('#modal_path_selection').attr("data-izimodal-preventclose", "");
		    $('#modal_path_selection').iziModal('open');                    
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

    /* Draws an xy plot within the specified modal. X is always time vs the user selected attribute y.
     * Default is to draw Y values towards the top of the graph; reverse switches that so that
     * the highest values are drawn towards the bottom of the graph.
     * attribute - what Y will be in the plot
     * sequence - sequence to draw, can be any length; the entire trajectory is not needed
     * svgName - svg where the x-y plot should be drawn
     * attributeList - if we're using an outside source for the y attribute, pass it here
     * reverse - draw y values top to bottom
     */
    function draw_xy_plot(attribute, sequence, svgName, attributeList, reverse) {        
	let [svg,bBox] = set_svg(svgName);
        
	if(reverse == null) reverse = false;
	
	if(attributeList == null) {
	    attributeList = [];
	    for(d of sequence) {
		attributeList.push(d[attribute]);
	    }
	}        
	
	var xtent = d3.extent(attributeList);        

	var first = 1;
	var last = 0;

	if(reverse) {
	    first = 0;
	    last = 1;
	}

	// 1.25 for breathing room between axis and values
        var scale_x = d3.scaleLinear().range([margin.left, bBox.width - margin.right]).domain([sequence[0]['timestep'],
											   sequence[sequence.length-1]['timestep']]);

	var scale_y = d3.scaleLinear().range([margin.top, svg_height - (margin.bottom * 1.5)]).domain([xtent[first],xtent[last]]);
	
        svg.selectAll("rect").data(sequence).enter().append("rect")
	    .attr("x", function(d) {return scale_x(d['timestep'])})
	    .attr("y", function(d, i) {return scale_y(attributeList[i])})
	    .attr("index", function(d,i) {return i})
	    .attr("width", 5).attr("height", 5)
	    .attr("fill", function(d) {                
		if(d['cluster'] == -1) {
		    return "black";
		}
		return intToRGB(d['cluster']);
	    }).on('mouseover', function(event, d) {                               
		const i = event.currentTarget.getAttribute("index");                
		tippy(this, {
		    allowHTML: true,
		    content: "<i>t<i> = " + d['timestep'] +
			     "<br><b>" + attribute + "</b>: " + attributeList[i],
		    arrow: true,
		    maxWidth: 'none',
		});		
	    });
	
	var xAxisPos = svg_height - margin.bottom;
	var xAxis = svg.append("g").attr("transform", "translate(0," + xAxisPos + ")").call(d3.axisBottom().scale(scale_x));                	
    }
});
