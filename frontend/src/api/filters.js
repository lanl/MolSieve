import { mostOccurringElement} from "./myutils";
import * as d3 from 'd3';
import axios from 'axios';


function apply_classes(selection, classes) {
    if(typeof classes === 'string') {
        selection.classed(classes, true);
    }
    for(const class_name of classes) {
        selection.classed(class_name, true);
    }
}

/** Generic filter function that gets all states with at least val of property.    
 * @param {Trajectory} trajectory - the trajectory to filter on
 * @param {Object} svg - d3 selection to modify
 * @param {Dictionary} options - the params specific to this filter
 */
export function filter_min_opacity(trajectory, svg, globalUniqueStates) {    
    const property = this.options.property;
    const val = this.options.val;
    const className = this.className;
    
    const selection = svg.select(`#g_${trajectory.name}`)
        .selectAll("*")
        .filter(function (d) {
            return globalUniqueStates[d.id][property] <= val;
        });

    apply_classes(selection, className);
}

/** Generic filter function that gets all states with at most val of property.
 * @param {string} property - property to filter on
 * @param {string} name - name of the trajectory
 * @param {Object} svg - d3 selection of svg to modify
 * @param {number} val - max value
 */
export function filter_max_opacity(trajectory, svg, globalUniqueStates) {
    const property = this.options.property;
    const val = this.options.val;
    const className = this.className;
    
    const selection = svg.select(`#g_${trajectory.name}`)
        .selectAll("*")
        .filter(function (d) {
            return globalUniqueStates[d.id][property] >= val;
        });
    
    apply_classes(selection, className);
}

/** Generic filter function that gets all states that are between val1 and val2 of the given property
 * @param {Trajectory} trajectory - the trajectory to filter on
 * @param {Object} svg - d3 selection to modify
 * @param {Dictionary} options - the params specific to this filter
 */
export function filter_range_opacity(trajectory, svg, globalUniqueStates) {
    const property = this.options.property;
    const val = this.options.val;
    const className = this.className;
    
   const selection = svg.select(`#g_${trajectory.name}`)
        .selectAll("*")
        .filter(function (d) {
            return globalUniqueStates[d.id][property] <= val[0] || globalUniqueStates[d.id][property] >= val[1];
        });
    
    apply_classes(selection, className)
}

/** Filter that changes the opacity of the given trajectory based on each state's
 * fuzzy memberships. The further away the cluster's fuzzy membership is from its actual
 * cluster label, the less opaque it is.
 * @param {Trajectory} trajectory - the trajectory to filter on
 * @param {Object} svg - d3 selection to modify
 */
export function filter_fuzzy_membership(trajectory, svg) {
    const current_clustering = trajectory.current_clustering;
    const current_membership_values = trajectory.fuzzy_memberships[current_clustering];
    const idToCluster = trajectory.idToCluster;
    const uniqueStates = trajectory.simplifiedSequence.uniqueStates;
    
    //const className = this.className;

    // for each cluster that is in the current clustering,
    // create an extents array that contains its minimum / maximum membership percentage
    const extents = {};
    for (let i = 0; i < current_clustering; i++) {
        const minMax = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
        extents[i] = minMax;
    }

    // go through sequence and find min / max membership percentage
    for (let j = 0; j < uniqueStates.length; j++) {        
        const state = uniqueStates[j].id;
        const cluster = idToCluster[state];

        // look at the state's determined clustering and compare it to the minimum percentage we've seen
        extents[cluster][0] = Math.min(
            extents[cluster][0],
            current_membership_values[state][cluster]
        );

        // same as above
        extents[cluster][1] = Math.max(
            extents[cluster][1],
            current_membership_values[state][cluster]
        );
    }

    // for each cluster in the current clustering, build a set of scales to scale the opacity by
    var scales = [];
    for (var k = 0; k < trajectory.current_clustering; k++) {
        scales.push(
            d3
                .scaleLinear()
                .range([0, 0.5])
                .domain([extents[k][0], extents[k][1]])
        );
    }

    const selection = svg.select(`#g_${trajectory.name}`)
        .selectAll("*")
        .attr("opacity", function (d) {
            let value = current_membership_values[d.id];            
            var scale_index = value.reduce(
                (iMax, x, i, arr) => (x > arr[iMax] ? i : iMax),
                0
            );
            return scales[scale_index](Math.max.apply(Math, value));
        });

    apply_classes(selection, "fuzzy_membership");

    const invis_selection = svg.select(`#g_${trajectory.name}`).selectAll(".fuzzy_membership").filter(function() {
        return this.getAttribute("opacity") === 0.0;
    });

    apply_classes(invis_selection, "invisible");

}

/** Build a dict of state number: clustering assignments and then determine how many times the state changed clusters
 * @param {Trajectory} trajectory - the trajectory to filter on
 * @param {Object} svg - d3 selection to modify
 */
export function filter_clustering_difference(trajectory, svg) {
    const clustering_assignments = {};
    let maxSize = -Number.MAX_SAFE_INTEGER;

    // for some reason, an extra labels object is created at the end    
    for (const d of trajectory.simplifiedSequence.uniqueStates) {
        const labels = new Set();
        for (const clustering of Object.values(trajectory.clusterings)) {
            for (let i = 0; i < clustering.length; i++) {
                if (clustering[i].includes(d.id)) {
                    labels.add(i);                    
                }
            }
        }
        maxSize = (maxSize < labels.size) ? labels.size : maxSize;
        clustering_assignments[d.id] = labels;
    }    
    
    svg.select(`#g_${trajectory.name}`)
        .selectAll("*")
        .attr("class", function (d) {
            var instability = clustering_assignments[d.id].size / maxSize;
            if (instability > 0.75) {
                return "strongly_unstable";
            }
             else if (instability < 0.75 && instability > 0.5) {
                return "moderately_unstable";
            } else {
                return "stable";
            }
        });
}

// won't work
export function filter_relationship(trajectory,svg) {            
    const run = this.options.property;    
    const attribute = this.options.relation_attribute;
    const className = this.options.className;

    // bold assumption to make, but will work for now
    const node = (attribute !== 'timestep') ? '(n:State)' : '()';
    const entityType = (attribute !== 'timestep') ? 'n' : 'r';
    
    let query = `MATCH ${node}-[r:${run}]-() RETURN DISTINCT ${entityType}.${attribute};`;    
    
    axios.get('/run_cypher_query',
              {params:
               {query:
                query
               }}).then((response) => {
                   let filter_array = response.data;
                   const selection = svg.select(`#g_${trajectory.name}`)
                       .selectAll("*").filter(function(d) {
                           return !filter_array.includes(d[attribute]);
                       });
                   apply_classes(selection, className);
               });
}

export function filter_chunks(trajectory, svg) {
    const className = this.className;
    const selection = svg.select(`#c_${trajectory.name}`)
          .selectAll("*");
    apply_classes(selection, className);
}

/** Run a sliding window across the entire trajectory and count how many times the dominant state of the cluster (the state the occurs the most)
 * occurs within that window. Set the opacity of a state based on that count divided by the size of the window.
 * @param {Trajectory} trajectory - the trajectory to filter on
 * @param {Object} svg - d3 selection to modify
 * @param {Dictionary} options - the params specific to this filter
 */
// should only apply to sequence chart
export function filter_transitions(trajectory, svg) {    
    const sequence = trajectory.simplifiedSequence.sequence;    
    const clusters = trajectory.clusterings[trajectory.current_clustering];
    const idToCluster = trajectory.idToCluster;

    const mode = this.options.selectVal;
    const slider_value = this.options.val;

    var window;
    if (mode === "abs") {
        window = parseInt(slider_value);
    }

    var min = Number.MAX_SAFE_INTEGER;
    var dominants = [];

    // for each cluster, check who occurs the most in the array
    for (var i = 0; i < clusters.length; i++) {
        // build an array for this cluster with duplicates
        const clustered_data = sequence.map((stateID) => {
            if(idToCluster[stateID] === i) {
                return stateID;
            }
        });

        // this gets you the length of the cluster
        if (clustered_data.length < min) {
            min = clustered_data.length;
        }

        // plus allows you to calculate the most occuring element
        dominants[i] = mostOccurringElement(clustered_data);
    }

    if (mode === "per") {
        const ws = slider_value / 100;
        window = Math.ceil(ws * min);
    }

    var timesteps = [];
    var count;

    for (i = 0; i < sequence.length - window; i += window) {
        count = 0;

        for (var j = 0; j < window; j++) {
            if (
                sequence[i + j].id ===
                dominants[sequence[i + j].id]
            ) {
                count++;
            }
        }
        for (var k = 0; k < window; k++) {
            timesteps.push(count / window);
        }
    }
    
    const selection = svg.select(`#g_${trajectory.name}`)
        .selectAll("*")
        .attr("opacity", function(_,i) {            
            return timesteps[i];
        });

    apply_classes(selection, "transitions");

    const invis_selection = svg.select(`#g_${trajectory.name}`).selectAll(".transitions").filter(function() {
        return this.getAttribute("opacity") === 0.0;
    });

    apply_classes(invis_selection, "invisible");
    
}

export function apply_filters(trajectories, runs, globalUniqueStates, ref) {    

    // reset all values
    d3.select(ref.current).selectAll('*').attr("class", null).attr("opacity", 1.0);
    for (const [name, trajectory] of Object.entries(trajectories)) {             
        if (Object.keys(runs[name].filters).length > 0) {
            for (const k of Object.keys(runs[name].filters)) {
                const filter = runs[name].filters[k];                
                if (filter.enabled) {
                    filter.func(trajectory, d3.select(ref.current), globalUniqueStates);
                }                 
            }
        }
    }
}
