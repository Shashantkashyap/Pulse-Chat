import React, { useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react';
import toast from 'react-hot-toast';

const VideoChat = () => {
    const { localStream, remoteStream, endVideoCall, selectedUser } = useChatStore();
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const [isVideoEnabled, setIsVideoEnabled] = React.useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = React.useState(true);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            console.log('Setting local video stream');
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            console.log('Setting remote video stream');
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    const toggleVideo = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
            setIsVideoEnabled(videoTrack.enabled);
        }
    };

    const toggleAudio = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            setIsAudioEnabled(audioTrack.enabled);
        }
    };

    const handleEndCall = () => {
        endVideoCall();
        toast.success('Call ended');
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
            <div className="relative w-full max-w-4xl p-4">
                <div className="aspect-video relative rounded-xl overflow-hidden bg-zinc-900">
                    {remoteStream ? (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <p className="text-xl">Connecting to {selectedUser?.fullName}...</p>
                        </div>
                    )}
                    
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute bottom-4 right-4 w-48 aspect-video object-cover rounded-lg border-2 border-primary"
                    />
                </div>

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
                    <button 
                        onClick={toggleVideo} 
                        className={`btn btn-circle ${!isVideoEnabled ? 'btn-error' : 'btn-primary'}`}
                    >
                        {isVideoEnabled ? <Video /> : <VideoOff />}
                    </button>
                    <button 
                        onClick={toggleAudio} 
                        className={`btn btn-circle ${!isAudioEnabled ? 'btn-error' : 'btn-primary'}`}
                    >
                        {isAudioEnabled ? <Mic /> : <MicOff />}
                    </button>
                    <button onClick={handleEndCall} className="btn btn-circle btn-error">
                        <PhoneOff />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VideoChat;
