/** Generic filter function that gets all states with at least val of property.
 * @param {string} property - property to filter on
 * @param {string} name - name of the trajectory
 * @param {Object} svg - d3 selection of svg to modify
 * @param {number} val - min value
 */
export function filter_min_opacity(property, name, svg, val) {
    console.log('in filter function!');
    svg.select(`#g_${name}`)
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
export function filter_max_opacity(property, name, svg, val) {
    svg.select(`#g_${name}`)
        .selectAll("rect")
        .filter(function (d, i) {
            return d[property] >= val;
        })
        .attr("opacity", 0);
}

/** Generic filter function that gets all states that are between val1 and val2 of the given property
 * @param {string} property - property to filter on
 * @param {string} name - name of the trajectory
 * @param {Object} svg - d3 selection of svg to modify
 * @param {Array<number>} Array of 2 values where 0 is min and 1 is max
 */
export function filter_range_opacity(property, name, svg, vals) {
    svg.select(`#g_${name}`)
        .selectAll("rect")
        .filter(function (d, i) {
            return d[property] <= vals[0] || d[property] >= vals[1];
        })
        .attr("opacity", 0);
}
