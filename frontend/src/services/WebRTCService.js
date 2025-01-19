export class WebRTCService {
    constructor(socket) {
        this.socket = socket;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.onStreamChange = null;
        this.onCallReceived = null;
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

    createPeerConnection() {
        const configuration = {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        };

        const pc = new RTCPeerConnection(configuration);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('webrtc-signal', {
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        pc.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            this.onStreamChange?.({
                localStream: this.localStream,
                remoteStream: this.remoteStream
            });
        };

        return pc;
    }

    async startCall(targetUserId) {
        // First, emit call request without creating peer connection
        this.socket.emit('call-request', {
            targetUserId,
        });
    }

    async initializeCall(targetUserId, isInitiator = true) {
        try {
            // Clear any existing peer connection
            if (this.peerConnection) {
                this.endCall();
            }

            this.peerConnection = this.createPeerConnection();
            
            // Acquire media stream
            await this.acquireMediaStream();

            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            this.onStreamChange?.({
                localStream: this.localStream,
                remoteStream: this.remoteStream
            });

            if (isInitiator) {
                const offer = await this.peerConnection.createOffer();
                await this.peerConnection.setLocalDescription(offer);
                this.socket.emit('webrtc-signal', {
                    type: 'offer',
                    offer,
                    targetUserId
                });
            }
        } catch (error) {
            this.endCall();
            throw error;
        }
    }

    async handleOffer(offer, targetUserId) {
        try {
            if (this.peerConnection) {
                this.endCall();
            }

            this.peerConnection = this.createPeerConnection();
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
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
            });
            this.localStream = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.remoteStream = null;
        
        this.onStreamChange?.({
            localStream: null,
            remoteStream: null
        });
    }

    rejectCall(targetUserId) {
        this.socket.emit('call-rejected', { targetUserId });
    }
}
