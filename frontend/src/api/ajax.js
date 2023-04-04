import axios from 'axios';

import { API_URL } from './constants';

/**
 * Ajax query to the backend to retrieve the sequence for a trajectory, given
 * its name and properties.
 * @param {string} run - Name of the run to retrieve the sequence for
 * @param {Array<string>} properties - Properties of the trajectory to retrieve
 */
export function apiLoadSequence(run, properties) {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/api/load_sequence`, {
                params: {
                    run,
                    properties: properties.toString(),
                },
            })
            .then((response) => {
                return resolve(response.data);
            })
            .catch((e) => reject(e));
    });
}

// TODO: add comment
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

// TODO: add comment
export function apiCalculateNEB(run, start, end, interpolate, maxSteps, fmax, saveResults) {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/api/calculate_neb_on_path`, {
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

export function apiGenerateOvitoImage(id, visScript, controller) {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/api/generate_ovito_image?id=${id}&visScript=${visScript}`, {
                signal: controller.signal,
            })
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => reject(e));
    });
}

export function apiLoadTrajectory(run, mMin, mMax, chunkingThreshold) {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/api/load_trajectory`, {
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
            .catch((e) => reject(e));
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
            .post(
                `${API_URL}/api/cluster_states`,
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

export function apiModifyTrajectory(run, numClusters, chunkingThreshold) {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/api/modify_trajectory`, {
                params: {
                    run,
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

export function apiGetSequence(run, range) {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/api/get_sequence`, { params: { run, start: range[0], end: range[1] } })
            .then((response) => {
                resolve(response.data);
            })
            .catch((e) => reject(e));
    });
}

export function apiGetScriptProperties() {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/api/script_properties`)
            .then((response) => resolve(response.data))
            .catch((e) => reject(e));
    });
}

export function apiGetVisScripts() {
    return new Promise((resolve, reject) => {
        axios
            .get(`${API_URL}/api/vis_scripts`)
            .then((response) => resolve(response.data))
            .catch((e) => reject(e));
    });
}

export function apiSubsetConnectivityDifference(stateIDs) {
    return new Promise((resolve, reject) => {
        axios
            .post(`${API_URL}/api/subset_connectivity_difference`, stateIDs)
            .then((response) => resolve(response.data))
            .catch((e) => reject(e));
    });
}

export function apiSelectionDistance(stateSet1, stateSet2) {
    return new Promise((resolve, reject) => {
        axios
            .post(`${API_URL}/api/selection_distance`, { stateSet1, stateSet2 })
            .then((response) => resolve(response.data))
            .catch((e) => reject(e));
    });
}
