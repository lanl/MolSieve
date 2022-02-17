class Trajectory {
    sequence;
    unique_states;
    optimal_cluster_value;
    feasible_clusters;
    clusterings = {};
    fuzzy_memberships = {};
    current_clustering;
    properties;
    raw;
    atom_properties;
    LAMMPSBootstrapScript;

    /** Loops through the sequence and applies the clustering to each state. Makes visualization a lot easier,
     * allows us to keep track of colorings and perform other calculations.
     */
    set_cluster_info() {
        for (var i = 0; i < this.sequence.length; i++) {
            for (
                var j = 0;
                j < this.clusterings[this.current_clustering].length;
                j++
            ) {
                if (
                    this.clusterings[this.current_clustering][j].includes(
                        this.sequence[i]["number"]
                    )
                ) {
                    this.sequence[i]["cluster"] = j;
                }
            }
            if (this.sequence[i]["cluster"] == null) {
                this.sequence[i]["cluster"] = -1;
            }
        }
    }

    /** Calculates a set of all the unique states in the sequence */
    calculate_unique_states() {
        if (this.unique_states == null) {
            var unique_states = new Set();
            for (var i = 0; i < this.sequence.length; i++) {
                unique_states.add(this.sequence[i].number);
            }
            this.unique_states = unique_states;
        }
    }

    /** Sets the metadata for the run in the this object
     * data - metadata for the run retrieved from get_metadata
     */
    set_metadata(data) {
        this.raw = data.raw;
        this.LAMMPSBootstrapScript = data.LAMMPSBootstrapScript;
    }
}

export default Trajectory;
