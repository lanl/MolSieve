import axios from 'axios';
import Trajectory from './trajectory';

// TODO: decouple trajectory from api calls

/**
 * Ajax query to the backend to retrieve the sequence for a trajectory, given
 * its name and properties.
 * @param {string} run - Name of the run to retrieve the sequence for
 * @param {Array<string>} properties - Properties of the trajectory to retrieve
 */
export function api_loadSequence(run, properties) {
    return new Promise((resolve, reject) => {
        axios
            .get('/api/load_sequence', {
                params: {
                    run,
                    properties: properties.toString(),
                },
            })
            .then((response) => {
                return resolve(response.data);
            })
            .catch((e) => {
                reject(e);
            });
    });
}

/**
 * Ajax query to the backend to run the PCCA clustering on a trajectory.
 * @param {string} run - Name of the run to run PCCA on
 * @param {number} clusters - Number of clusters to cluster the trajectory into. Ignored if optimal = 1
 * @param {number} optimal - Whether or not PCCA should try and find the optimal clustering between m_min and m_max
 * @param {number} mMin - When running optimal clustering, minimal cluster size to try; ignored if optimal = -1
 * @param {number} mMax - When running optimal clustering, maximum cluster size to try; ignored if optimal = -1
 * @param {Trajectory|undefined} trajectory - optional, if passed to the function will modify the trajectory object and return it
 */
export function api_loadPCCA(run, clusters, optimal, mMin, mMax, trajectory) {
    return new Promise((resolve, reject) => {
        axios
            .get('/api/pcca', {
                params: {
                    run,
                    clusters,
                    optimal,
                    m_min: mMin,
                    m_max: mMax,
                },
            })
            .then((response) => {
                if (optimal === 1) {
                    const newTraj = trajectory === undefined ? new Trajectory() : trajectory;
                    const clusteredData = response.data;

                    newTraj.optimal_cluster_value = clusteredData.optimal_value;
                    newTraj.current_clustering = clusteredData.optimal_value;
                    newTraj.feasible_clusters = clusteredData.feasible_clusters;

                    for (const id of Object.keys(clusteredData.occurrence_matrix)) {
                        // need to cast keys to int, fix this in back-end
                        const entries = Object.entries(
                            clusteredData.occurrence_matrix[parseInt(id, 10)]
                        ).map(([key, value]) => [parseInt(key, 10), value]);

                        const abTransitionProb = new Map(entries);
                        newTraj.occurrenceMap.set(parseInt(id, 10), abTransitionProb);
                    }

                    for (const idx of newTraj.feasible_clusters) {
                        newTraj.clusterings[idx] = clusteredData.sets[idx];
                        newTraj.fuzzy_memberships[idx] = clusteredData.fuzzy_memberships[idx];
                    }
                    resolve(newTraj);
                } else {
                    if (trajectory === undefined) {
                        resolve(response.data);
                    }
                    const traj = response.data;
                    const fuzzyMemberships = Object.assign(
                        traj.fuzzy_memberships,
                        trajectory.fuzzy_memberships
                    );
                    const clusterings = Object.assign(traj.sets, trajectory.clusterings);
                    trajectory.current_clustering = parseInt(clusters, 10);
                    trajectory.fuzzy_memberships = fuzzyMemberships;
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
export function api_calculate_path_similarity(e1, e2, state_attributes, atom_attributes) {
    return new Promise(function (resolve, reject) {
        axios
            .post(
                '/api/calculate_path_similarity',
                JSON.stringify({
                    p1: JSON.parse(e1),
                    p2: JSON.parse(e2),
                    atom_attributes,
                    state_attributes,
                }),
                { headers: { 'Content-Type': 'application/json' } }
            )
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => {
                reject(e);
            });
    });
}

// TODO: add comment
export function api_performKSTest(rvs, cdf, property) {
    return new Promise(function (resolve, reject) {
        let processedCdf = null;
        try {
            processedCdf = JSON.parse(cdf);
        } catch (e) {
            processedCdf = cdf;
        }

        axios
            .post(
                '/api/perform_KS_Test',
                JSON.stringify({
                    rvs: JSON.parse(rvs),
                    cdf: processedCdf,
                    property,
                }),
                { headers: { 'Content-Type': 'application/json' } }
            )
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => {
                reject(e);
            });
    });
}

// TODO: add comment
export function api_load_metadata(run, trajectory) {
    return new Promise(function (resolve, reject) {
        axios
            .get('/api/get_metadata', { params: { run } })
            .then((response) => {
                if (trajectory === undefined) {
                    resolve(response.data);
                }
                trajectory.raw = response.data.raw;
                trajectory.LAMMPSBootstrapScript = response.data.LAMMPSBootstrapScript;
                return resolve(trajectory);
            })
            .catch((e) => {
                reject(e);
            });
    });
}

export function onMessageHandler(onStart, onProgress, onComplete) {
    return (message) => {
        const data = JSON.parse(message.data);
        if (data.type === 'TASK_COMPLETE') {
            onComplete(data);
        } else if (data.type === 'TASK_START') {
            onStart(data);
        } else {
            onProgress(data);
        }
    };
}

export function api_load_property(property) {
    return new Promise(function (resolve, reject) {
        axios
            .get('/api/load_property', { params: { prop: property } })
            .then((response) => {
                return resolve(response.data.propertyList);
            })
            .catch((e) => {
                reject(e);
            });
    });
}

// TODO: add comment
export function api_calculate_NEB(run, start, end, interpolate, maxSteps, fmax, saveResults) {
    return new Promise(function (resolve, reject) {
        axios
            .get('/api/calculate_neb_on_path', {
                params: {
                    run,
                    start,
                    end,
                    interpolate,
                    maxSteps,
                    fmax,
                    saveResults,
                },
            })
            .then((response) => {
                // TODO: can add saddlepoint and other calculations here
                resolve(response.data);
            })
            .catch((e) => {
                reject(e);
            });
    });
}

export function api_calculate_idToTimestep(run, trajectory) {
    return new Promise(function (resolve, reject) {
        axios
            .get('/api/idToTimestep', { params: { run } })
            .then((response) => {
                const idToTimestep = new Map(
                    response.data.map((state) => {
                        return [state.id, state.timesteps];
                    })
                );
                trajectory.idToTimestep = idToTimestep;
                resolve(trajectory);
            })
            .catch((e) => {
                reject(e);
            });
    });
}

// TODO: add comment
export function api_generate_ovito_image(number) {
    return new Promise(function (resolve, reject) {
        axios
            .get('/api/generate_ovito_image', { params: { number } })
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => {
                reject(e);
            });
    });
}

export function loadPropertiesForSubset(properties, subset) {
    return new Promise(function (resolve, reject) {
        axios
            .post(
                '/api/load_properties_for_subset',
                JSON.stringify({ props: properties, stateIds: subset }),
                { headers: { 'Content-Type': 'application/json' } }
            )
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => {
                reject(e);
            });
    });
}

export function loadPropertyForSubset(property, subset) {
    return loadPropertiesForSubset([property], subset);
}

export function apiLoadTrajectory(run, mMin, mMax, chunkingThreshold) {
    return new Promise(function (resolve, reject) {
        axios
            .get('/api/load_trajectory', {
                params: {
                    run,
                    mMin,
                    mMax,
                    chunkingThreshold,
                },
            })
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => {
                reject(e);
            });
    });
}

/**
 * [TODO:description]
 *
 * @param {[TODO:type]} properties - [TODO:description]
 * @param {[TODO:type]} states - [TODO:description]
 * @returns {[TODO:type]} [TODO:description]
 */
export function apiClusterStates(properties, states) {
    return new Promise(function (resolve, reject) {
        axios
            .post('/api/cluster_states', JSON.stringify({ props: properties, stateIds: states }), {
                headers: { 'Content-Type': 'application/json' },
            })
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => {
                reject(e);
            });
    });
}
