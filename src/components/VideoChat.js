import React, { useEffect, useRef, useState } from 'react';
import { WebRTCService } from '../services/WebRTCService';

export const VideoChat = () => {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const webRTCRef = useRef(null);
    const [isCallStarted, setIsCallStarted] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    useEffect(() => {
        webRTCRef.current = new WebRTCService();
        webRTCRef.current.onRemoteStream = (stream) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = stream;
            }
        };
    }, []);

    const startCall = async () => {
        if (webRTCRef.current) {
            await webRTCRef.current.startCall();
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = webRTCRef.current.localStream;
            }
            setIsCallStarted(true);
        }
    };

    const toggleMute = () => {
        if (webRTCRef.current?.localStream) {
            const audioTracks = webRTCRef.current.localStream.getAudioTracks();
            audioTracks.forEach(track => track.enabled = !track.enabled);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (webRTCRef.current?.localStream) {
            const videoTracks = webRTCRef.current.localStream.getVideoTracks();
            videoTracks.forEach(track => track.enabled = !track.enabled);
            setIsVideoOff(!isVideoOff);
        }
    };

    return (
        <div className="video-chat">
            <div className="video-container">
                <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="local-video"
                />
                <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className="remote-video"
                />
            </div>
            <div className="controls">
                {!isCallStarted ? (
                    <button onClick={startCall} className="call-btn">
                        Start Call
                    </button>
                ) : (
                    <>
                        <button onClick={toggleMute} className="control-btn">
                            {isMuted ? 'Unmute' : 'Mute'}
                        </button>
                        <button onClick={toggleVideo} className="control-btn">
                            {isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
                        </button>
                    </>
                )}
            </div>
            <style jsx>{`
                .video-chat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 20px;
                    padding: 20px;
                }
                .video-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                    width: 100%;
                    max-width: 1200px;
                }
                video {
                    width: 100%;
                    max-width: 600px;
                    border-radius: 8px;
                    background: #1a1a1a;
                }
                .controls {
                    display: flex;
                    gap: 10px;
                }
                button {
                    padding: 10px 20px;
                    border-radius: 20px;
                    border: none;
                    cursor: pointer;
                    font-weight: bold;
                }
                .call-btn {
                    background: #4CAF50;
                    color: white;
                }
                .control-btn {
                    background: #2196F3;
                    color: white;
                }
            `}</style>
        </div>
    );
};
