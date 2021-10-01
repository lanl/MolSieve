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
    var tooltip = d3.select("#info").append("div").attr("class", "tooltip-text").style("position", "absolute").style("opacity", 0).style("z-index", "10").attr("height", 40);
    var margin = {top: 20, bottom: 20, left: 25, right: 25};
    var svg = d3.select("#vis")
		.append("svg")
		.attr("width", bBox.width)
	        .attr("height", 800);
    
    $('#btn_load').on('click', function(e) {
	e.preventDefault();	
	$.getJSON('/load_dataset', "", function(data) {
	    	    	    	    
	    scale_x = d3.scaleLinear().range([margin.left, bBox.width - margin.right]).domain([0,data.length]);
	    svg.selectAll("rect").data(data, function(d) {return d}).enter().append("rect").attr("x", function(d,i) {return scale_x(i)}).attr("y", height - 30)
		.attr("width",5).attr("height",20).attr("fill", "black").attr("number", function(d) { return d.number }).attr("timestep", function(d) { return d.timestep })	    
		.on('mouseover', function(event,d) {
		    d3.select(this).attr("fill", "red");
		    d3.selectAll("rect").filter(function (dp) { return dp.number === d.number }).attr("fill", "red");
		    tooltip.transition().duration(50).style("opacity", 1);
		    tooltip.html(d.number + " " + "<i>t</i>=" + d.timestep);		    
		})
	        .on('mouseout', function(event,d) {
		    d3.select(this).attr("fill", "black");
		    d3.selectAll("rect").filter(function (dp) { return dp.number === d.number }).attr("fill", "black");
		});	
	    
	    $('#toggle_arc').show();
	    $('#lbl_toggle_arc').show();
	});
	$(this).hide();
    });

    $('#toggle_arc').change(function() {
	if(this.checked) {
	    $.getJSON('/generate_subsequences', "", function(data) {				
		const k = data.K;
		svg.selectAll('links')
		    .data(data.links)
		    .enter()
		    .append('path')
		    .attr('d', function (d) {
			start = scale_x(d.source);
			end = scale_x(d.target);
			return ['M', start, height-30,    
				'A',                     
				(start - end)/2, ',',    
				(start - end)/2, 4, 0, ',',
				start < end ? 1 : 0, end, ',', height-30].join(' ');
		    }).on('mouseover', function (event, d) {
			tooltip.transition().duration(50).style("opacity", 1);
			tooltip.html(d.sequence);
			d3.select(this).attr("stroke", "red");
		    }).on('mouseout', function (event, d) {
			tooltip.transition().duration(50).style("opacity", 0);
			d3.select(this).attr("stroke", "orange");
		    })
		    .attr("stroke", "orange")
		    .style("fill","none")
		    .attr("width", 4);
	    });	     
	}
    });
});
	
