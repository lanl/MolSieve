import Trajectory from "./trajectory";
const axios = require("axios").default;

/**
 * Ajax query to the backend to retrieve the sequence for a trajectory, given
 * its name and properties.
 * @param {string} run - Name of the run to retrieve the sequence for
 * @param {Array<string>} properties - Properties of the trajectory to retrieve
 * @param {Trajectory|undefined} trajectory - optional, if passed to the function will modify the trajectory object and return it
 */
export function api_loadSequence(run, properties, trajectory) {
    return new Promise((resolve, reject) => {
        axios
            .get("/load_sequence", {
                params: {
                    run: run,
                    properties: properties.toString()
                },
            })
            .then((response) => {
		if(trajectory === undefined) {
                    return resolve(response.data);		    
		}                                
		trajectory.sequence = response.data;
                return resolve(trajectory);

            }).catch(e => {
		reject(e);
	    });
    });
}

/**
 * Ajax query to the backend to run the PCCA clustering on a trajectory. 
 * @param {string} run - Name of the run to run PCCA on
 * @param {number} clusters - Number of clusters to cluster the trajectory into. Ignored if optimal = 1
 * @param {number} optimal - Whether or not PCCA should try and find the optimal clustering between m_min and m_max
 * @param {number} m_min - When running optimal clustering, minimal cluster size to try; ignored if optimal = -1
 * @param {number} m_max - When running optimal clustering, maximum cluster size to try; ignored if optimal = -1
 * @param {Trajectory|undefined} trajectory - optional, if passed to the function will modify the trajectory object and return it
 */
export function api_loadPCCA(run, clusters, optimal, m_min, m_max, trajectory) {
    return new Promise((resolve, reject) => {
        axios
            .get("/pcca", {
                params: {
                    run: run,
                    clusters: clusters,
                    optimal: optimal,
                    m_min: m_min,
                    m_max: m_max,
                },
            })
            .then((response) => {
		if(optimal === 1) {
		    var new_traj = (trajectory === undefined) ? new Trajectory() : trajectory;
		    var clustered_data = response.data;                        
		    new_traj.optimal_cluster_value =
                        clustered_data.optimal_value;
		    new_traj.current_clustering = clustered_data.optimal_value;
		    new_traj.feasible_clusters =
                        clustered_data.feasible_clusters;
		    for (var idx of new_traj.feasible_clusters) {
                        new_traj.clusterings[idx] = clustered_data.sets[idx];
                        new_traj.fuzzy_memberships[idx] =
			    clustered_data.fuzzy_memberships[idx];
		    }
		    resolve(new_traj);
		} else {
		    if (trajectory === undefined) {
			resolve(response.data);
		    }
		    const traj = response.data;
		    const fuzzy_memberships = Object.assign(traj.fuzzy_memberships, trajectory.fuzzy_memberships);
		    const clusterings = Object.assign(traj.sets, trajectory.clusterings);
		    trajectory.current_clustering = parseInt(clusters);
		    trajectory.fuzzy_memberships = fuzzy_memberships;
		    trajectory.clusterings = clusterings;
                    trajectory.set_cluster_info();
		    resolve(trajectory);
		}
            })
            .catch((e) => {
                return reject(e);
            });
    });
}
/** Ajax call to calculate the similarity between two paths
 * @param {object} extents1 - Javascript object with name, the sequence object the path starts with, and the sequence object the path ends with
 * @param {object} extents2 - Same as above
 * @param {array} atom_attributes - Array of strings with atom attributes to be compared in similarity calculation
 * @param {array} state_attributes - Array of string with state attributes to be compared in similarity calculation
 * @return {number} similarity score
 */
export function api_calculate_path_similarity(e1,e2, state_attributes, atom_attributes) {
    return new Promise(function(resolve, reject) {
	axios.post('/calculate_path_similarity', JSON.stringify({'p1': JSON.parse(e1),
								 'p2': JSON.parse(e2),
								 'atom_attributes': atom_attributes,
								 'state_attributes': state_attributes}),
		   { headers: {'Content-Type':'application/json'}}).then((response) => {
		       	    resolve(response.data);
		   }).catch((e) => {
		       reject(e);
		   })
    });
}

export function api_load_metadata(run, trajectory) {
    return new Promise(function(resolve,reject) {
	axios.get('/get_metadata', {params:{'run':run}}).then((response) => {
	    if (trajectory === undefined) {
		resolve(response.data);
	    }            
	    trajectory.raw = response.data.raw;
	    trajectory.LAMMPSBootstrapScript = response.data.LAMMPSBootstrapScript;            
	    return resolve(trajectory);
	}).catch((e) => {
	    reject(e);
	});
    });    
}
