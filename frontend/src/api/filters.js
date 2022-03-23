import { mostOccurringElement} from "./myutils";
import * as d3 from 'd3';
import axios from 'axios';

/** Generic filter function that gets all states with at least val of property.    
 * @param {Trajectory} trajectory - the trajectory to filter on
 * @param {Object} svg - d3 selection to modify
 * @param {Dictionary} options - the params specific to this filter
 */
export function filter_min_opacity(trajectory, svg, options) {    
    const property = options.property;
    const val = options.val;
    
    svg.select(`#g_${trajectory.name}`)
        .selectAll("rect")
        .filter(function (d) {
            return d[property] <= val;
        })
        .attr("opacity", 0);
}

/** Generic filter function that gets all states with at most val of property.
 * @param {string} property - property to filter on
 * @param {string} name - name of the trajectory
 * @param {Object} svg - d3 selection of svg to modify
 * @param {number} val - max value
 */
export function filter_max_opacity(trajectory, svg, options) {
    const property = options.property;
    const val = options.val;
    
    svg.select(`#g_${trajectory.name}`)
        .selectAll("rect")
        .filter(function (d) {
            return d[property] >= val;
        })
        .attr("opacity", 0);
}

/** Generic filter function that gets all states that are between val1 and val2 of the given property
 * @param {Trajectory} trajectory - the trajectory to filter on
 * @param {Object} svg - d3 selection to modify
 * @param {Dictionary} options - the params specific to this filter
 */
export function filter_range_opacity(trajectory, svg, options) {
    const property = options.property;
    const val = options.val;
    
    svg.select(`#g_${trajectory.name}`)
        .selectAll("rect")
        .filter(function (d) {
            return d[property] <= val[0] || d[property] >= val[1];
        })
        .attr("opacity", 0);
}

/** Filter that changes the opacity of the given trajectory based on each state's
 * fuzzy memberships. The further away the cluster's fuzzy membership is from its actual
 * cluster label, the less opaque it is.
 * @param {Trajectory} trajectory - the trajectory to filter on
 * @param {Object} svg - d3 selection to modify
 */
export function filter_fuzzy_membership(trajectory, svg) {
    var current_membership_values = trajectory.fuzzy_memberships;
    var extents = {};

    for (var i = 0; i < trajectory.current_clustering; i++) {
        var minMax = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
        extents[i] = minMax;
    }

    for (var j = 0; j < trajectory.data.length; j++) {
        var id = trajectory.data[j]["number"];
        var cluster_membership = trajectory.data[j]["cluster"];
        extents[cluster_membership][0] = Math.min(
            extents[cluster_membership][0],
            current_membership_values[id][cluster_membership]
        );
        extents[cluster_membership][1] = Math.max(
            extents[cluster_membership][1],
            current_membership_values[id][cluster_membership]
        );
    }

    var scales = [];
    for (var k = 0; k < trajectory.current_clustering; k++) {
        scales.push(
            d3
                .scaleLinear()
                .range([0, 0.5])
                .domain([extents[k][0], extents[k][1]])
        );
    }

    svg.select(`#g_${trajectory.name}`)
        .selectAll("rect")
        .attr("opacity", function () {
            var value = this.getAttributeNode("fuzzy_membership")
                .nodeValue.split(",")
                .map(Number);
            var scale_index = value.reduce(
                (iMax, x, i, arr) => (x > arr[iMax] ? i : iMax),
                0
            );
            return scales[scale_index](Math.max.apply(Math, value));
        });
}

/** Build a dict of state number: clustering assignments and then determine how many times the state changed clusters
 * @param {Trajectory} trajectory - the trajectory to filter on
 * @param {Object} svg - d3 selection to modify
 */
export function filter_clustering_difference(trajectory, svg) {
    var clustering_assignments = {};
    var maxSize = -Number.MAX_SAFE_INTEGER;
    // for some reason, an extra labels object is created at the end    
    for (var d of trajectory.unique_states) {
        var labels = new Set();
        for (var clustering of Object.values(trajectory.clusterings)) {
            for (var i = 0; i < clustering.length; i++) {
                if (clustering[i].includes(d)) {
                    labels.add(i);
                }
            }
        }
        maxSize = labels.size > maxSize ? labels.size : maxSize;
        clustering_assignments[d] = labels;
    }

    svg.select(`#g_${trajectory.name}`)
        .selectAll("rect")
        .attr("fill", function (d) {
            var instability =
                clustering_assignments[d["number"]].size / maxSize;
            if (instability > 0.75) {
                return "red";
            } else if (instability < 0.75 && instability > 0.5) {
                return "yellow";
            } else {
                return "green";
            }
        });
}

export function filter_relationship(trajectory,svg,options) {            
    const run = options.property;    
    const attribute = options.relation_attribute;

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
                   svg.select(`#g_${trajectory.name}`)
                       .selectAll("rect").filter(function(d) {
                           return !filter_array.includes(d[attribute]);
                       })
                       .attr("opacity", 0);                                     
               });
}

export function filter_chunks(trajectory, svg) {
    svg.select(`#c_${trajectory.name}`)
        .selectAll("rect").attr("opacity", 0);    
}

/** Run a sliding window across the entire trajectory and count how many times the dominant state of the cluster (the state the occurs the most)
 * occurs within that window. Set the opacity of a state based on that count divided by the size of the window.
 * @param {Trajectory} trajectory - the trajectory to filter on
 * @param {Object} svg - d3 selection to modify
 * @param {Dictionary} options - the params specific to this filter
 */
export function filter_transitions(trajectory, svg, options) {    
    const sequence = trajectory.data;
    const clusters = trajectory.clusterings[trajectory.current_clustering];
    const mode = options.selectVal;
    const slider_value = options.val;        
    
    var window;
    if (mode === "abs") {
        window = parseInt(slider_value);
    }

    var min = Number.MAX_SAFE_INTEGER;
    var dominants = [];

    for (var i = 0; i < clusters.length; i++) {
        var clustered_data = sequence
            .filter(function (d) {
                if (d["cluster"] === i) {
                    return d;
                }
            })
            .map(function (d) {
                return d.number;
            });

        if (clustered_data.length < min) {
            min = clustered_data.length;
        }

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
                sequence[i + j]["number"] ===
                dominants[sequence[i + j]["cluster"]]
            ) {
                count++;
            }
        }
        for (var k = 0; k < window; k++) {
            timesteps.push(count / window);
        }
    }
    svg.select(`#g_${trajectory.name}`)
        .selectAll("rect")
        .attr("opacity", function (_, i) {
            return timesteps[i];
        });
}
