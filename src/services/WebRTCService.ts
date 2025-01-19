import { WebSocketService } from './WebSocketService';

export class WebRTCService {
    private peerConnection: RTCPeerConnection;
    private webSocket: WebSocketService;
    private localStream?: MediaStream;
    
    constructor() {
        this.webSocket = WebSocketService.getInstance();
        this.peerConnection = this.createPeerConnection();
        this.setupSignaling();
    }

    private createPeerConnection() {
        const configuration = {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        };

        const pc = new RTCPeerConnection(configuration);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.webSocket.send({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        pc.ontrack = (event) => {
            this.onRemoteStream?.(event.streams[0]);
        };

        return pc;
    }

    private setupSignaling() {
        this.webSocket.onMessage(async (message) => {
            switch (message.type) {
                case 'offer':
                    await this.handleOffer(message.offer);
                    break;
                case 'answer':
                    await this.peerConnection.setRemoteDescription(message.answer);
                    break;
                case 'ice-candidate':
                    await this.peerConnection.addIceCandidate(message.candidate);
                    break;
            }
        });
    }

    async startCall() {
        this.localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream!);
        });

        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        this.webSocket.send({ type: 'offer', offer });
    }

    private async handleOffer(offer: RTCSessionDescriptionInit) {
        await this.peerConnection.setRemoteDescription(offer);
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.webSocket.send({ type: 'answer', answer });
    }

    onRemoteStream?: (stream: MediaStream) => void;
}
