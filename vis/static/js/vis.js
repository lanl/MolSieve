$(document).ajaxSend(function(event, request, settings) {
    $('#loading-indicator').show();
});

$(document).ajaxComplete(function(event, request, settings) {
    $('#loading-indicator').hide();
});


$('document').ready(function() {

    
    $('#btn_load').on('click', function(e) {
	e.preventDefault();	
	$.getJSON('/load_dataset', "", function(data) {
	    
	    var base = d3.select("#vis");
	    var bBox = base.node().getBoundingClientRect();
	    var tooltip = d3.select("#info").append("div").attr("class", "tooltip-text").style("position", "absolute").style("opacity", 0).style("z-index", "10").attr("height", 40);
	    var margin = {left: 25, right: 25};
	    var svg = d3.select("#vis")
		.append("svg")
		.attr("width", bBox.width)
	        .attr("height", 800);	   
	    	    	    	    
	    var scale_x = d3.scaleLinear().range([margin.left, bBox.width - margin.right]).domain([0,data.length]);
	    svg.selectAll("rect").data(data, function(d) {return d}).enter().append("rect").attr("x", function(d,i) {return scale_x(i)}).attr("y", 100)
		.attr("width",5).attr("height",20).attr("fill", "black").attr("number", function(d) { return d.number }).attr("timestep", function(d) { return d.timestep })	    
		.on('mouseover', function(d,i) {
		    d3.select(this).attr("fill", "red");
		    d3.selectAll("rect").filter(function (dp) { return dp.number == d.target.__data__.number }).attr("fill", "red");
		    tooltip.transition().duration(50).style("opacity", 1);
		    tooltip.text(d.target.__data__.number + " " + "t=" + d.target.__data__.timestep);
		    
		})
	        .on('mouseout', function(d,i) {
		    d3.select(this).attr("fill", "black");
		    d3.selectAll("rect").filter(function (dp) { return dp.number == d.target.__data__.number }).attr("fill", "black");
		    tooltip.transition().duration(50).style("opacity", 0);
		});

	    
	});
	
	$(this).hide();
    });
});
