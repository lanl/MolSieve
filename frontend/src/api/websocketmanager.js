class WebSocketManager {
    websockets = {};

    addKey(key) {
        this.websockets[key] = [];
    }

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
