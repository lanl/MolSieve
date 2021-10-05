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
    
    $('#btn_load').on('click', function(e) {
	e.preventDefault();	
	$.getJSON('/load_dataset', "", function(data) {
	    const overwidth = data.length * 5 + margin.left + margin.right;
	    var svg = d3.select("#vis")
		.append("svg")
		.attr("width", overwidth)
	        .attr("height", 400)
	        .attr("id", "svg");	    	    	    	    
	    scale_x = d3.scaleLinear().range([margin.left, overwidth - margin.right]).domain([0,data.length]);
	    svg.selectAll("rect").data(data, function(d) {return d}).enter().append("rect").attr("x", function(d,i) {return scale_x(i)}).attr("y", height - 30)
		.attr("width",5).attr("height",20).attr("fill", "black").attr("number", function(d) { return d.number }).attr("timestep", function(d) { return d.timestep })	    
		.on('mouseover', function(event,d) {
		    d3.select(this).attr("fill", "red");
		    var sameCount = 0;
		    d3.selectAll("rect").filter(function (dp) {
			if(dp.number === d.number) {
			    sameCount++;
			}
			return dp.number === d.number }).attr("fill", "red");
		    tippy(this, {
			allowHTML: true,
			content: d.number + " " + "<i>t</i>=" + d.timestep + "<br> There are <b>" + sameCount + "</b> occurences of this state.",
			arrow: false,
			maxWidth: 'none'
		    });
		})
	        .on('mouseout', function(event,d) {
		    d3.select(this).attr("fill", "black");
		    d3.selectAll("rect").filter(function (dp) { return dp.number === d.number }).attr("fill", "black");
		});		    
	    $('#toggle_arc').show();
	    $('#lbl_toggle_arc').show();
	    $('#btn_load_more').show();
	});
	$(this).hide();
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
	
