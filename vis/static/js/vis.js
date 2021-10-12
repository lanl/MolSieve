$(document).ajaxSend(function(event, request, settings) {
    $('#loading-indicator').show();
});

$(document).ajaxComplete(function(event, request, settings) {
    $('#loading-indicator').hide();
});

$('document').ready(function() {
    
    $('#toggle_arc').prop("checked", false);
    var scale_x = null;
    var height = 400;
    var base = d3.select("#vis");

    var bBox = base.node().getBoundingClientRect();    
    var margin = {top: 20, bottom: 20, left: 25, right: 25};

    function draw(data) {
	var svg = null;
	
	const threshold = $('#slider_threshold').val();	
	data = data.filter(function (d) { return d['n.occurences'] > threshold });	

	const overwidth = data.length * 5 + margin.left + margin.right;	

	if($('#svg').length) {
	    d3.select("#svg").selectAll().remove();
	    svg = d3.select('#svg');
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
		    d3.selectAll("rect").filter(function (dp) { return dp['n.number'] === d['n.number'] }).attr("fill", "red");
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
	$.getJSON('/load_dataset', "", function(data) {

	    draw(data);	    		    
	    $('#toggle_arc').show();
	    $('#lbl_toggle_arc').show();
	    $('#btn_load_more').show();
	});
	$(this).hide();
    });

    $('#slider_threshold').on('mousemove change', function(e) {
	$('#lbl_slider').text("Only show states with more than " + $(this).val() + " occurences.");
    });
    
    $('#slider_threshold').on('change', function(e) {
	e.preventDefault();
	$.getJSON('/load_dataset', "", function(data) {
	    draw(data);
	    $('#btn_load').hide();
	    $('#toggle_arc').show();
	    $('#lbl_toggle_arc').show();
	    $('#btn_load_more').show();
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
	
