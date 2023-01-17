import axios from 'axios';

/**
 * Ajax query to the backend to retrieve the sequence for a trajectory, given
 * its name and properties.
 * @param {string} run - Name of the run to retrieve the sequence for
 * @param {Array<string>} properties - Properties of the trajectory to retrieve
 */
export function apiLoadSequence(run, properties) {
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

/** Ajax call to calculate the similarity between two paths
 * @param {object} extents1 - Javascript object with name, the sequence object the path starts with, and the sequence object the path ends with
 * @param {object} extents2 - Same as above
 * @param {array} atomAttributes - Array of strings with atom attributes to be compared in similarity calculation
 * @param {array} stateAttributes - Array of string with state attributes to be compared in similarity calculation
 * @return {number} similarity score
 */
export function apiCalculatePathSimilarity(e1, e2, stateAttributes, atomAttributes) {
    return new Promise((resolve, reject) => {
        axios
            .post(
                '/api/calculate_path_similarity',
                JSON.stringify({
                    p1: JSON.parse(e1),
                    p2: JSON.parse(e2),
                    atom_attributes: atomAttributes,
                    state_attributes: stateAttributes,
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
export function apiPerformKSTest(rvs, cdf, property) {
    return new Promise((resolve, reject) => {
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
export function apiLoadMetadata(run) {
    return new Promise((resolve, reject) => {
        axios
            .get('/api/get_metadata', { params: { run } })
            .then((response) => {
                resolve(response.data);
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

export function apiLoadProperty(property) {
    return new Promise((resolve, reject) => {
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
export function apiCalculateNEB(run, start, end, interpolate, maxSteps, fmax, saveResults) {
    return new Promise((resolve, reject) => {
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

export function apiCalculateIDToTimestep(run) {
    return new Promise((resolve, reject) => {
        axios
            .get('/api/idToTimestep', { params: { run } })
            .then((response) => {
                const idToTimestep = new Map(
                    response.data.map((state) => {
                        return [state.id, state.timesteps];
                    })
                );
                resolve(idToTimestep);
            })
            .catch((e) => {
                reject(e);
            });
    });
}

export function apiGenerateOvitoImage(id) {
    return new Promise((resolve, reject) => {
        axios
            .get(`/api/generate_ovito_image?id=${id}`)
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => {
                reject(e);
            });
    });
}

export function loadPropertiesForSubset(properties, subset) {
    return new Promise((resolve, reject) => {
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
    return new Promise((resolve, reject) => {
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
    return new Promise((resolve, reject) => {
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

export function apiModifyTrajectory(run, numClusters, chunkingThreshold) {
    return new Promise((resolve, reject) => {
        axios
            .get('/api/modify_trajectory', {
                params: {
                    run,
                    numClusters,
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

export function apiGetSequence(run, range) {
    return new Promise((resolve, reject) => {
        axios
            .get(`/api/get_sequence`, { params: { run, start: range[0], end: range[1] } })
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => {
                reject(e);
            });
    });
}

export function apiGetScriptProperties() {
    return new Promise((resolve, reject) => {
        axios
            .get('/api/script_properties')
            .then((response) => resolve(response.data))
            .catch((e) => reject(e));
    });
}
