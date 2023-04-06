import axios from 'axios';

import { API_URL } from './constants';

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
            .catch((e) => reject(e));
    });
}

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
            .post(`${API_URL}/calculate/subset_connectivity_difference`, stateIDs)
            .then((response) => resolve(response.data))
            .catch((e) => reject(e));
    });
}

export function apiSelectionDistance(stateSet1, stateSet2) {
    return new Promise((resolve, reject) => {
        axios
            .post(`${API_URL}/calculate/selection_distance`, { stateSet1, stateSet2 })
            .then((response) => resolve(response.data))
            .catch((e) => reject(e));
    });
}
