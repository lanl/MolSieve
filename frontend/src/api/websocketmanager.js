/*
 * © 2025. Triad National Security, LLC. All rights reserved.
 * This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
 */
class WebSocketManager {
    websockets = {};

    /**
     * Add new websocket key array.
     *
     * @param {String} key - Name of new key array.
     */
    addKey(key) {
        this.websockets[key] = [];
    }

    /**
     * Connect to URL under the specified key.
     *
     * @param {String} url - URL to connect to.
     * @param {String} key - Key to associate URL with.
     * @returns {WebSocket} Websocket connection.
     */
    connect(url, key) {
        const socket = new WebSocket(url);
        this.websockets[key].push(socket);
        return socket;
    }

    /**
     * Clears all of the websockets associated with a key.
     *
     * @param {String} key - Key to clear in websockets dictionary.
     */
    clear(key) {
        for (const w of this.websockets[key]) {
            w.close(3001);
        }
        this.websockets[key] = [];
    }

    /**
     * Closes all of the websockets in the dictionary.
     *
     */
    clearAll() {
        for (const key of Object.keys(this.websockets)) {
            this.clear(key);
        }
    }
}

const instance = new WebSocketManager();

export default instance;
