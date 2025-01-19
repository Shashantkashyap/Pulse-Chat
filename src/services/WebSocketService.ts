export class WebSocketService {
    private ws: WebSocket;
    private static instance: WebSocketService;

    private constructor() {
        this.ws = new WebSocket('ws://localhost:3000');
        this.setupWebSocket();
    }

    static getInstance() {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    private setupWebSocket() {
        this.ws.onopen = () => console.log('WebSocket Connected');
        this.ws.onclose = () => console.log('WebSocket Disconnected');
        this.ws.onerror = (error) => console.error('WebSocket Error:', error);
    }

    send(message: any) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    onMessage(callback: (message: any) => void) {
        this.ws.onmessage = (event) => {
            callback(JSON.parse(event.data));
        };
    }
}
