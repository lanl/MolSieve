import * as d3 from 'd3';
import axios from 'axios';
import { mostOccurringElement } from './myutils';
import GlobalStates from './globalStates';

function apply_classes(selection, classes) {
    if (typeof classes === 'string') {
        selection.classed(classes, true);
    }
    for (const class_name of classes) {
        selection.classed(class_name, true);
    }
}

/** Generic filter function that gets all states with at least val of property.
 * @param {Trajectory} trajectory - the trajectory to filter on
 * @param {Object} svg - d3 selection to modify
 * @param {Dictionary} options - the params specific to this filter
 */
export function filter_min_opacity(trajectory, svg, globalUniqueStates) {
    const { property } = this.options;
    const { val } = this.options;
    const { className } = this;

    const selection = svg
        .select(`#g_${trajectory.name}`)
        .selectAll('*')
        .filter(function (d) {
            const d_val = globalUniqueStates.get(d.id)[property];
            return d_val === undefined || d_val <= val;
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
    const { property } = this.options;
    const { val } = this.options;
    const { className } = this;

    const selection = svg
        .select(`#g_${trajectory.name}`)
        .selectAll('*')
        .filter(function (d) {
            const d_val = globalUniqueStates.get(d.id)[property];
            return d_val === undefined || d_val >= val;
        });

    apply_classes(selection, className);
}

/** Generic filter function that gets all states that are between val1 and val2 of the given property
 * @param {Trajectory} trajectory - the trajectory to filter on
 * @param {Object} svg - d3 selection to modify
 * @param {Dictionary} options - the params specific to this filter
 */
export function filter_range_opacity(trajectory, svg, globalUniqueStates) {
    const { property } = this.options;
    const { val } = this.options;
    const { className } = this;

    const selection = svg
        .select(`#g_${trajectory.name}`)
        .selectAll('*')
        .filter(function (d) {
            const d_val = globalUniqueStates.get(d.id)[property];
            return d_val === undefined || d_val <= val[0] || d_val >= val[1];
        });

    apply_classes(selection, className);
}

/** Filter that changes the opacity of the given trajectory based on each state's
 * fuzzy memberships. The further away the cluster's fuzzy membership is from its actual
 * cluster label, the less opaque it is.
 * @param {Trajectory} trajectory - the trajectory to filter on
 * @param {Object} svg - d3 selection to modify
 */
export function filter_fuzzy_membership(trajectory, svg) {
    const { current_clustering } = trajectory;
    const current_membership_values = trajectory.fuzzy_memberships[current_clustering];
    const { idToCluster } = trajectory;
    const { uniqueStates } = trajectory;

    console.log(trajectory);
    // const className = this.className;

    // for each cluster that is in the current clustering,
    // create an extents array that contains its minimum / maximum membership percentage
    const extents = {};
    for (let i = 0; i < current_clustering; i++) {
        const minMax = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
        extents[i] = minMax;
    }

    // go through sequence and find min / max membership percentage
    for (let j = 0; j < uniqueStates.length; j++) {
        const state = uniqueStates[j];
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
    const scales = [];
    for (let k = 0; k < trajectory.current_clustering; k++) {
        scales.push(d3.scaleLinear().range([0, 0.5]).domain([extents[k][0], extents[k][1]]));
    }

    const selection = svg
        .select(`#g_${trajectory.name}`)
        .selectAll('*')
        .attr('opacity', function (d) {
            const value = current_membership_values[d.id];
            const scale_index = value.reduce((iMax, x, i, arr) => (x > arr[iMax] ? i : iMax), 0);
            return scales[scale_index](Math.max.apply(Math, value));
        });

    apply_classes(selection, 'fuzzy_membership');

    const invis_selection = svg
        .select(`#g_${trajectory.name}`)
        .selectAll('.fuzzy_membership')
        .filter(function () {
            return this.getAttribute('opacity') === 0.0;
        });

    apply_classes(invis_selection, 'invisible');
}

/** Build a dict of state number: clustering assignments and then determine how many times the state changed clusters
 * @param {Trajectory} trajectory - the trajectory to filter on
 * @param {Object} svg - d3 selection to modify
 */
export function filter_clustering_difference(trajectory, svg) {
    const clustering_assignments = {};
    let maxSize = -Number.MAX_SAFE_INTEGER;

    // for some reason, an extra labels object is created at the end
    for (const d of trajectory.uniqueStates) {
        const labels = new Set();
        for (const clustering of Object.values(trajectory.clusterings)) {
            for (let i = 0; i < clustering.length; i++) {
                if (clustering[i].includes(d)) {
                    labels.add(i);
                }
            }
        }
        maxSize = maxSize < labels.size ? labels.size : maxSize;
        clustering_assignments[d] = labels;
    }

    svg.select(`#g_${trajectory.name}`)
        .selectAll('*')
        .attr('class', function (d) {
            const instability = clustering_assignments[d.id].size / maxSize;
            if (instability > 0.75) {
                return 'strongly_unstable';
            }
            if (instability < 0.75 && instability > 0.5) {
                return 'moderately_unstable';
            }
            return 'stable';
        });
}

// won't work
export function filter_relationship(trajectory, svg) {
    const run = this.options.property;
    const attribute = this.options.relation_attribute;
    const { className } = this.options;

    // bold assumption to make, but will work for now
    const node = attribute !== 'timestep' ? '(n:State)' : '()';
    const entityType = attribute !== 'timestep' ? 'n' : 'r';

    const query = `MATCH ${node}-[r:${run}]-() RETURN DISTINCT ${entityType}.${attribute};`;

    axios.get('/api/run_cypher_query', { params: { query } }).then((response) => {
        const filter_array = response.data;
        const selection = svg
            .select(`#g_${trajectory.name}`)
            .selectAll('*')
            .filter(function (d) {
                return !filter_array.includes(d[attribute]);
            });
        apply_classes(selection, className);
    });
}

export function filter_chunks(trajectory, svg) {
    const { className } = this;
    const selection = svg.select(`#c_${trajectory.name}`).selectAll('*');
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
    const { sequence } = trajectory;
    const clusters = trajectory.clusterings[trajectory.current_clustering];
    const { idToCluster } = trajectory;

    const mode = this.options.selectVal;
    const slider_value = this.options.val;

    let window;
    if (mode === 'abs') {
        window = parseInt(slider_value);
    }

    let min = Number.MAX_SAFE_INTEGER;
    const dominants = [];

    // for each cluster, check who occurs the most in the array
    for (var i = 0; i < clusters.length; i++) {
        // build an array for this cluster with duplicates
        const clustered_data = sequence.map((stateID) => {
            if (idToCluster[stateID] === i) {
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

    if (mode === 'per') {
        const ws = slider_value / 100;
        window = Math.ceil(ws * min);
    }

    const timesteps = [];
    let count;

    for (i = 0; i < sequence.length - window; i += window) {
        count = 0;

        for (let j = 0; j < window; j++) {
            if (sequence[i + j].id === dominants[sequence[i + j].id]) {
                count++;
            }
        }
        for (let k = 0; k < window; k++) {
            timesteps.push(count / window);
        }
    }

    const selection = svg
        .select(`#g_${trajectory.name}`)
        .selectAll('*')
        .attr('opacity', function (_, i) {
            return timesteps[i];
        });

    apply_classes(selection, 'transitions');

    const invis_selection = svg
        .select(`#g_${trajectory.name}`)
        .selectAll('.transitions')
        .filter(function () {
            return this.getAttribute('opacity') === 0.0;
        });

    apply_classes(invis_selection, 'invisible');
}

function undoFilter(trajectory, svg, filter) {
    for (const cls of filter.className) {
        svg.select(`#${filter.group}_${trajectory.name}`)
            .selectChildren()
            .attr('opacity', 1.0)
            .classed(cls, false);
    }
}

export function apply_filters(trajectories, runs, ref) {
    for (const [name, trajectory] of Object.entries(trajectories)) {
        if (Object.keys(runs[name].filters).length > 0) {
            for (const k of Object.keys(runs[name].filters)) {
                const filter = runs[name].filters[k];
                trajectory.name = name;
                undoFilter(trajectory, d3.select(ref.current), filter);
            }
        }
    }

    for (const [name, trajectory] of Object.entries(trajectories)) {
        if (Object.keys(runs[name].filters).length > 0) {
            for (const k of Object.keys(runs[name].filters)) {
                const filter = runs[name].filters[k];
                if (filter.enabled) {
                    if (filter.enabledFor.includes(ref.current.getAttribute('id'))) {
                        trajectory.name = name;
                        filter.func(trajectory, d3.select(ref.current), GlobalStates);
                    }
                }
            }
        }
    }
}
