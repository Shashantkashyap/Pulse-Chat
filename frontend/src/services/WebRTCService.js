export class WebRTCService {
    constructor(socket) {
        this.socket = socket;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.onStreamChange = null;
        this.onCallReceived = null;
        this.currentCallId = null;

        // Bind socket event handlers
        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        this.socket.on('webrtc-signal', async (data) => {
            console.log('Received WebRTC signal:', data);
            try {
                switch (data.type) {
                    case 'offer':
                        await this.handleOffer(data.offer, data.fromUserId);
                        break;
                    case 'answer':
                        await this.handleAnswer(data.answer);
                        break;
                    case 'ice-candidate':
                        if (this.peerConnection) {
                            await this.peerConnection.addIceCandidate(data.candidate);
                        }
                        break;
                }
            } catch (error) {
                console.error('Error handling WebRTC signal:', error);
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
        console.log("Creating peer connection for:", targetUserId);
        
        const config = {
            iceServers: [
                { 
                    urls: [
                        'stun:stun1.l.google.com:19302',
                        'stun:stun2.l.google.com:19302'
                    ]
                }
            ],
            iceCandidatePoolSize: 10
        };

        const pc = new RTCPeerConnection(config);

        pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                console.log("Sending ICE candidate");
                this.socket.emit('webrtc-signal', {
                    type: 'ice-candidate',
                    candidate,
                    targetUserId
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log("ICE Connection State:", pc.iceConnectionState);
        };

        pc.ontrack = (event) => {
            console.log("Received remote track");
            this.remoteStream = event.streams[0];
            this.onStreamChange?.({
                localStream: this.localStream,
                remoteStream: this.remoteStream
            });
        };

        return pc;
    }

    async startCall(targetUserId) {
        console.log("Initiating call to:", targetUserId);
        this.currentCallId = targetUserId;
        this.socket.emit('call-request', { targetUserId });
    }

    async initializeCall(targetUserId, isInitiator = true) {
        try {
            console.log("Initializing call:", { targetUserId, isInitiator });
            
            // Cleanup any existing call
            this.endCall();

            // Create new peer connection
            this.peerConnection = this.createPeerConnection(targetUserId);
            
            // Get media stream
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            // Add tracks to peer connection
            this.localStream.getTracks().forEach(track => {
                console.log("Adding track to peer connection:", track.kind);
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Update UI with local stream
            this.onStreamChange?.({
                localStream: this.localStream,
                remoteStream: this.remoteStream
            });

            if (isInitiator) {
                console.log("Creating offer");
                const offer = await this.peerConnection.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                });
                await this.peerConnection.setLocalDescription(offer);
                
                this.socket.emit('webrtc-signal', {
                    type: 'offer',
                    offer,
                    targetUserId
                });
            }
        } catch (error) {
            console.error("Error in initializeCall:", error);
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
