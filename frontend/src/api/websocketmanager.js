class WebSocketManager {
    websockets = [];

    connect(url) {
        const socket = new WebSocket(url);
        this.websockets.push(socket);
        return socket;
    }

    /**
     * Closes all of the websocket connections with code 3001 - interrupted.
     */
    clear() {
        for (const w of this.websockets) {
            w.close(3001);
        }
        this.websockets = [];
    }
}

const instance = new WebSocketManager();

export default instance;
