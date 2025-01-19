export class WebSocketService {
    static instance = null;

    constructor() {
        this.ws = new WebSocket('ws://localhost:3000');
        this.setupWebSocket();
    }

    static getInstance() {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    setupWebSocket() {
        this.ws.onopen = () => console.log('WebSocket Connected');
        this.ws.onclose = () => console.log('WebSocket Disconnected');
        this.ws.onerror = (error) => console.error('WebSocket Error:', error);
    }

    send(message) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    onMessage(callback) {
        this.ws.onmessage = (event) => {
            callback(JSON.parse(event.data));
        };
    }
}
