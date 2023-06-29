import axios from 'axios';

import { API_URL } from './constants';

/**
 * Gets the metadata for a trajectory.
 *
 * @param {String} run - The trajectory to retrieve metadata for.
 * @returns {Object} Metadata object.
 */
export function apiLoadMetadata(run) {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/api/get_metadata`, { params: { run } })
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => reject(e));
    });
}

/**
 * Wrapper for websockets connected to celery tasks.
 *
 * @param {Function} onStart - Run when task begins.
 * @param {Function} onProgress - Run when task makes progress.
 * @param {Function} onComplete - Run when task completes.
 * @returns {Function} A function that takes a message and figures out what function to run.
 */
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

/**
 * Calculates the NEB on the path specified.
 * TODO: remove saveResults
 *
 * @param {String} run - The trajectory to run the NEB on.
 * @param {Number} start - Start timestep.
 * @param {Number} end - End timestep.
 * @param {Number} interpolate - Number of images to interpolate between each step in the path.
 * @param {Number} maxSteps - Maximum number of optimization steps.
 * @param {Number} fmax - Maximum optimization value before stopping.
 * @param {Bool} saveResults - Whether or not to save results to the database.
 * @returns {String} Task ID to connect to with a websocket.
 */
export function apiCalculateNEB(run, start, end, interpolate, maxSteps, fmax, saveResults) {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/calculate/neb_on_path`, {
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
                resolve(response.data);
            })
            .catch((e) => reject(e));
    });
}

/**
 * Generates an OVITO render of a state given its ID.
 *
 * @param {Number} id - The ID of the state to render.
 * @param {String} visScript - The script to use while rendering the state.
 * @param {AbortController} controller - Controller that can kill the operation in the middle of it.
 * @returns {Object} Object containing a base64 encoded image string and the ID of the state.
 */
export function apiGenerateOvitoImage(id, visScript, controller) {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/data/generate_ovito_image?id=${id}&visScript=${visScript}`, {
                signal: controller.signal,
            })
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => reject(e));
    });
}

/**
 * Loads the specified trajectory, runs PCCA on it and simplifies it.
 * TODO: Should get merged with apiModifyTrajectory
 *
 * @param {String} run - The trajectory to load.
 * @param {Number} mMin - Minimum number of PCCA clusters.
 * @param {Number} mMax - Maximum number of PCCA clusters.
 * @param {Number} chunkingThreshold - Simplification threshold.
 * @returns {Object} Object containing a newly simplified trajectory.
 */
export function apiLoadTrajectory(run, mMin, mMax, chunkingThreshold) {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/data/load_trajectory`, {
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
                reject(e.response.data.detail);
            });
    });
}

// see above
export function apiModifyTrajectory(run, mMin, mMax, numClusters, chunkingThreshold) {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/data/load_trajectory`, {
                params: {
                    run,
                    mMin,
                    mMax,
                    numClusters,
                    chunkingThreshold,
                },
            })
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => reject(e));
    });
}

/**
 * Clusters all of the states provided based on the properties provided.
 *
 * @param {Array<String>} properties - The properties to use while clustering.
 * @param {Array<Number>} states - The IDs of the states to cluster.
 * @returns {Object} Object of id : cluster number
 */
export function apiClusterStates(properties, states) {
    return new Promise((resolve, reject) => {
        axios
            .post(
                `${API_URL}/calculate/cluster_states`,
                JSON.stringify({ props: properties, stateIds: states }),
                {
                    headers: { 'Content-Type': 'application/json' },
                }
            )
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => reject(e));
    });
}

/**
 * Gets the sequence for the specified trajectory between a given range.
 *
 * @param {String} run - The trajectory to get the sequence for.
 * @param {Array<Number>} range - The range of the sequence to retrieve.
 * @returns {Array<Number>} - An array of IDs within the sequence.
 */
export function apiGetSequence(run, range) {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/data/get_sequence`, {
                params: { run, start: range[0], end: range[1] },
            })
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => reject(e));
    });
}

/**
 * Gets the properties for all of the currently loaded user scripts.
 *
 * @returns {Array<String>} Array of script properties.
 */
export function apiGetScriptProperties() {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/scripts/properties`)
            .then((response) => resolve(response.data))
            .catch((e) => reject(e));
    });
}

/**
 * Gets the visualization scripts currently loaded in the system.
 *
 * @returns {Array<String>} The filenames of the visualization scripts.
 */
export function apiGetVisScripts() {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/scripts/visual`)
            .then((response) => resolve(response.data))
            .catch((e) => reject(e));
    });
}

/**
 * Runs the connectivity difference calculation for the provided state IDs.
 * TODO: rename to selection distance
 * @param {Array<Number>} stateIDs - The IDs to use in the calculation.
 * @returns {String} The task ID to use to connect to a worker websocket.
 */
export function apiSubsetConnectivityDifference(stateIDs) {
    return new Promise((resolve, reject) => {
        axios
            .post(`${API_URL}/calculate/subset_connectivity_difference`, stateIDs)
            .then((response) => resolve(response.data))
            .catch((e) => reject(e));
    });
}

/**
 * Runs the distance function for the two state sets specified.
 *
 * @param {Array<Number>} stateSet1 - The first set of states.
 * @param {Array<Number>} stateSet2 - The second set of states.
 * @returns {Object} An object of {id : {id: distance}}
 */
export function apiSelectionDistance(stateSet1, stateSet2) {
    return new Promise((resolve, reject) => {
        axios
            .post(`${API_URL}/calculate/selection_distance`, { stateSet1, stateSet2 })
            .then((response) => resolve(response.data))
            .catch((e) => reject(e));
    });
}
