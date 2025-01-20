export class WebRTCService {
    constructor(socket) {
        this.socket = socket;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.onStreamChange = null;
        this.onCallReceived = null;
        this.currentCallId = null;
        this.currentTargetUserId = null;

        // Bind socket event handlers
        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        console.log("Setting up WebRTC signal handlers");
        
        this.socket.on('webrtc-signal', async (data) => {
            console.log('WebRTC signal received:', data);
            try {
                switch (data.type) {
                    case 'offer':
                        console.log('Processing offer from:', data.fromUserId);
                        this.currentTargetUserId = data.fromUserId;
                        await this.handleOffer(data.offer, data.fromUserId);
                        break;
                    case 'answer':
                        console.log('Processing answer');
                        await this.handleAnswer(data.answer);
                        break;
                    case 'ice-candidate':
                        console.log('Processing ICE candidate');
                        if (this.peerConnection) {
                            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                        }
                        break;
                }
            } catch (error) {
                console.error('Error in WebRTC signal handling:', error);
            }
        });
    }

    async acquireMediaStream() {
        if (this.localStream) {
            // Stop any existing tracks
            this.localStream.getTracks().forEach(track => track.stop());
        }

        try {
            // Check if devices are available
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasVideo = devices.some(device => device.kind === 'videoinput');
            const hasAudio = devices.some(device => device.kind === 'audioinput');

            if (!hasVideo && !hasAudio) {
                throw new Error('No media devices found');
            }

            // Request media with fallbacks
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: hasVideo ? true : false,
                audio: hasAudio ? true : false
            });

            return this.localStream;
        } catch (error) {
            console.error('Error acquiring media stream:', error);
            throw new Error(
                error.name === 'NotAllowedError' ? 'Please allow camera and microphone access' :
                error.name === 'NotFoundError' ? 'No camera or microphone found' :
                error.name === 'NotReadableError' ? 'Camera or microphone is already in use' :
                'Failed to access media devices'
            );
        }
    }

    createPeerConnection(targetUserId) {
        const config = {
            iceServers: [
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };

        const pc = new RTCPeerConnection(config);

        pc.onicecandidate = ({ candidate }) => {
            if (candidate && this.currentTargetUserId) {
                console.log("Sending ICE candidate to:", this.currentTargetUserId);
                this.socket.emit('webrtc-signal', {
                    type: 'ice-candidate',
                    candidate,
                    targetUserId: this.currentTargetUserId
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log("ICE Connection State:", pc.iceConnectionState);
        };

        pc.ontrack = (event) => {
            console.log("Remote track received:", event.streams[0]);
            this.remoteStream = event.streams[0];
            this.onStreamChange?.({
                localStream: this.localStream,
                remoteStream: this.remoteStream
            });
        };

        return pc;
    }

    async startCall(targetUserId) {
        console.log("Starting call to:", targetUserId);
        this.currentTargetUserId = targetUserId;
        this.socket.emit('call-request', { targetUserId });
    }

    async initializeCall(targetUserId, isInitiator = true) {
        console.log("Initializing call:", { targetUserId, isInitiator });
        try {
            this.currentTargetUserId = targetUserId;
            this.peerConnection = this.createPeerConnection(targetUserId);
            
            const stream = await this.acquireMediaStream();
            console.log("Media stream acquired:", stream.getTracks().map(t => t.kind));

            stream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, stream);
            });

            if (isInitiator) {
                console.log("Creating and sending offer");
                const offer = await this.peerConnection.createOffer();
                await this.peerConnection.setLocalDescription(offer);
                
                this.socket.emit('webrtc-signal', {
                    type: 'offer',
                    offer,
                    targetUserId
                });
            }
        } catch (error) {
            console.error("Call initialization failed:", error);
            this.endCall();
            throw error;
        }
    }

    async handleOffer(offer, targetUserId) {
        try {
            if (this.peerConnection) {
                this.endCall();
            }

            this.peerConnection = this.createPeerConnection(targetUserId);
            await this.acquireMediaStream();

            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.socket.emit('webrtc-signal', {
                type: 'answer',
                answer,
                targetUserId
            });

            this.onStreamChange?.({
                localStream: this.localStream,
                remoteStream: this.remoteStream
            });
        } catch (error) {
            this.endCall();
            throw error;
        }
    }

    async handleAnswer(answer) {
        await this.peerConnection.setRemoteDescription(answer);
    }

    async handleIceCandidate(candidate) {
        await this.peerConnection.addIceCandidate(candidate);
    }

    endCall() {
        console.log("Ending call");
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        this.remoteStream = null;
        this.currentCallId = null;
        
        this.onStreamChange?.({
            localStream: null,
            remoteStream: null
        });
    }

    rejectCall(targetUserId) {
        this.socket.emit('call-rejected', { targetUserId });
    }
}
