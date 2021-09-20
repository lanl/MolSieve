$(document).ajaxSend(function(event, request, settings) {
    $('#loading-indicator').show();
});

$(document).ajaxComplete(function(event, request, settings) {
    $('#loading-indicator').hide();
});


$('document').ready(function() {

    var container;
    
    $('#btn_load').on('click', function(e) {
	e.preventDefault();	
	$.getJSON('/load_dataset', "", function(data) {	    
	    var base = d3.select("#vis");
	    var bBox = base.node().getBoundingClientRect();
	    var chart = d3.select("#vis_canvas")
		.attr("width", bBox.width)
	        .attr("height", 800);
	    var context = chart.node().getContext("2d");

	    var invis = document.createElement("invis");
	    container = d3.select(invis);
	    
	    var scale = d3.scaleLinear().range([0,100]).domain([0,data.length]);

	    var dataBinding = container.selectAll("invis.rect").data(data, function(d) {return d.s});
	    dataBinding.enter().append("invis").classed("rect",true).attr("x", scale).attr("y", 100).attr("size",5).attr("fillStyle", "black").attr("number", function(d) {return d.s.number});
	  
	    context.fillStyle = "#fff";
	    context.rect(0,0,chart.attr("width"),chart.attr("height"));
	    context.fill();

	    var elements = container.selectAll("invis.rect");
	    elements.each(function(d, i) {
		var node = d3.select(this);
		context.beginPath();
		context.fillStyle = node.attr("fillStyle");
		node.attr("x", i * 10);
		context.rect(i * 10, node.attr("y"), node.attr("size"), node.attr("size"));
		context.fill();
		context.closePath();
	    });	   
	});
	$(this).hide();
    });

    $('#vis_canvas').mousemove(function(e) {
	var o = $('#vis_canvas').offset();
	var x = e.clientX - o.left;
	var y = e.clientY - o.top;

	var elements = container.selectAll("invis.rect");
	var context = d3.select("#vis_canvas").node().getContext("2d");
	
	elements.each(function(d,i) {
	    var node = d3.select(this);
	    
	    if(node.attr("x") == x) {
		context.beginPath();
		context.fillStyle = "red";
		node.attr("x", i * 10);
		context.rect(i * 10, node.attr("y"), node.attr("size"), node.attr("size"));
		context.fill();
		context.closePath();
		console.log(node);
		$('#tooltip').show();
		$('#tooltip').text(node.attr("number"));
	    }
	    
	});
    });

    
});
