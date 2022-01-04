// vis_model.js - Handles all of the data logic for the application

var trajectories = {};

// Section: AJAX calls

/* Ajax call that connects to the neo4j database and retrieves the various trajectories available, as well as their properties. */
var connect_to_database = function () {
    return new Promise(function(resolve, reject) {
	$.ajax({url: "/connect_to_db"}).done(function(data) {            
	    for(var i = 0; i < data.runs.length; i++) {
		if (data.runs[i] != null) {                        
		    trajectories[data.runs[i]] = new Trajectory();                        
		}
	    }
	    resolve(data);
	}).fail(function(msg, text, error) {            
	    reject("Failed to connect to the database. Error: " + msg.responseText);
	});
    });
}
	       		      		     
/* This calculates the PCCA for the trajectory specified by name. 
 * name - which trajectory to calculate PCCA for 
 * optimal - if the PCCA calculation should look for an optimal clustering, requires m_min and m_max
 * m_min - smallest clustering to try
 * m_max - largest clustering to try
 */

var load_PCCA = function(name, clusters, optimal, m_min, m_max) { 
    return new Promise(function(resolve, reject) {            
	$.getJSON('/pcca', {'run': name, 'clusters' : clusters, 'optimal' : optimal, 'm_min': m_min, 'm_max': m_max},
		  function(clustered_data) {
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
		      resolve(name);                      
		  }).fail(function(msg) {
		      reject(msg.responseText);
		  });
    });
};

/* Ajax call that loads the sequence of the given run into the trajectories object
 * name - run to load from database
 * properties - properties to load from the database
 */
var load_sequence = function(name,properties) { 
    return new Promise(function(resolve,reject) {	
	$.getJSON('/load_sequence', {'run': name, 'properties': properties.toString()}, function(data) {
	    trajectories[name].sequence = data;	    	    
	    trajectories[name].properties = properties;            
	    resolve(name);
	}).fail(function(msg) {
	    reject(msg.responseText);
	});            	
    });	
}    

/* Ajax call that calculates the overview for the sequence. The overview is calculated
 * via a simple divide and conquer algorithm that keeps recursively splitting the 
 * sequence until the subsequence is reduced to a length of ten, then counting the 
 * occurrence of each unique state within that subsequence, and merging up. This
 * demonstrates what states were dominant within a given region of the sequence.
 */
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

/* Ajax call to calculate a Nudged Elastic Band on a given path between two nodes.
 * start - beginning of the path
 * end - last state in path
 * name - name of the trajectory these states belong to
 * returns list of energy values across the path
 */
var calculate_neb_on_path = function(name,start,end) {
    return new Promise(function(resolve,reject) {
	$.getJSON('/calculate_neb_on_path', {'run': name, 'start': start, 'end': end}, function(data) {            
	    resolve(data);
	}).fail(function(msg) {
	    reject(msg.responseText);
	});
    });
}
/* Ajax call to generate an ovito image given a state's number
 * number - number of the state to generate an image for
 * returns - base 64 encoding of image
 */
var generate_ovito_image = function(number) {
    return new Promise(function(resolve,reject) {
	$.get('/generate_ovito_image', {'number':number}, function(data) {            
	    resolve(data.split('\'')[1])
	}).fail(function(msg) {
	    reject(msg.responseText)
	});
    });
}

// Section: Dataset calculations

/* Loops through the sequence and applies the clustering to each state. Makes visualization a lot easier,
 * allows us to keep track of colorings and perform other calculations. 
 * name - name of the trajectory to modify
 */
function set_cluster_info(name) { 
    for(var i = 0; i < trajectories[name].sequence.length; i++) {
	for(var j = 0; j < trajectories[name].clusterings[trajectories[name].current_clustering].length; j++) {
	    if(trajectories[name].clusterings[trajectories[name].current_clustering][j].
	       includes(trajectories[name].sequence[i]['number'])) {
		trajectories[name].sequence[i]['cluster'] = j;
	    }
	}
	if(trajectories[name].sequence[i]['cluster'] == null) {
	    trajectories[name].sequence[i]['cluster'] = -1;
	}
    }
}

/* Calculates a set of unique states in the sequence, as well as providing a mapping from
 * state id to state number.
 * name - name of the trajectory to calculate unique states for
 */
function calculate_unique_states(name) { 	
    if (trajectories[name].unique_states == null) {
	var unique_states = new Set();
	for (var i = 0; i < trajectories[name].sequence.length; i++) {
	    unique_states.add(trajectories[name].sequence[i].number);
	}
	trajectories[name].unique_states = unique_states;
    }        
}

// Section: Filters

/* Runs a sliding window across the entirety of the sequence and calculates the number of times the dominant
 * state of a cluster was visited within that window. Returns an array of length = to the length of the sequence
 * that is a percentage of how many times the dominant state was visited in the window divided by the window size.
 * name - name of the trajectory to calculate the window over
 * slider_value - this should be refactored to simply the size of the window
 * mode - TODO refactor
 * return: timesteps - array of percentages described above
 */
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

/* Calculates the differences in the various clusterings already calculated and returns an instability metric.
 * The more times a state in the sequence changed clusters, the more unstable it is.
 * name - name of the trajectory to calculate a difference for
 * return: array of instabilities for each state in the sequence
 */
function clustering_difference_filter(name) {
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
}

/* Returns the fuzzy membership values for each state in the sequence, scaled so that 
 * the opacity is apparent.
 * name - name of the trajectory to calculate the fuzzy membership for
 */

function fuzzy_membership_filter(name) {

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
}

// Section: Misc Calculations

/* Gets the minimum value of the given property within the sequence.
 * property - the property you're interested in
 * name - name of the trajectory to search through
 * return: min value of property
 * TODO: perhaps refactor to simply unique states would be faster
 */
function getMinProperty(property, name) {
    var min = Number.MAX_VALUE;        
    for(d of trajectories[name].sequence) {            
	if(d[property] < min) {
	    min = d[property];
	}
    }
    return min;
}

/* Gets the maximum value of the given property within the sequence.
 * property - the property you're interested in
 * name - name of the trajectory to search through
 * return: max value of property
 * TODO: perhaps refactor to simply unique states would be faster
 */
function getMaxProperty(property, name) {
    var max = Number.MIN_VALUE;
    for(d of trajectories[name].sequence) {
	if(d[property] > max) {
	    max = d[property];
	}
    }
    return max;
}
