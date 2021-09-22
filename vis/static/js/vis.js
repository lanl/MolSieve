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
	    var tooltip = d3.select("#vis").append("div").attr("class", "tooltip-text").style("position", "absolute").style("opacity", 0).style("z-index", "10").attr("height", 40);
	    var svg = d3.select("#vis")
		.append("svg")
		.attr("width", bBox.width)
	        .attr("height", 800);

	    data[152].s.number = 14497815140213431073;

	    // experimenting with selecting stuff 14497815140213431073	    
	    	    	    	    
	    var scale = d3.scaleLinear().range([0,100]).domain([0,data.length]);
	    svg.selectAll("rect").data(data, function(d) {return d.s}).enter().append("rect").attr("x", function(d,i) {return i * 5}).attr("y", 100)
		.attr("width",5).attr("height",20).attr("fill", "black").attr("number", function(d) { return d.s.number })	    
		.on('mouseover', function(d,i) {
		    d3.select(this).attr("fill", "red");
		    d3.selectAll("rect").filter(function (dp) { return dp.s.number == d.target.__data__.s.number }).attr("fill", "red");
		    tooltip.transition().duration(50).style("opacity", 1);
		    tooltip.text(d.target.__data__.s.number);
		    
		})
	        .on('mouseout', function(d,i) {
		    d3.select(this).attr("fill", "black");
		    d3.selectAll("rect").filter(function (dp) { return dp.s.number == d.target.__data__.s.number }).attr("fill", "black");
		    tooltip.transition().duration(50).style("opacity", 0);
		});
	});
	
	$(this).hide();
    });
});
