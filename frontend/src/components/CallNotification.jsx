import React from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

const CallNotification = () => {
    const { incomingCall, acceptCall, rejectCall, isCallLoading } = useChatStore();

    if (!incomingCall) return null;

    return (
        <div className="fixed top-4 right-4 z-50 bg-base-200 p-4 rounded-lg shadow-lg border border-base-300 animate-slide-in">
            <div className="flex items-center gap-4">
                <div className="avatar">
                    <div className="w-12 h-12 rounded-full">
                        <img src={incomingCall.profilePic || "/avatar.png"} alt="caller" />
                    </div>
                </div>
                <div>
                    <h3 className="font-medium">{incomingCall.fullName}</h3>
                    <p className="text-sm text-base-content/70">Incoming video call...</p>
                </div>
                <div className="flex gap-2 ml-4">
                    <button 
                        onClick={acceptCall} 
                        disabled={isCallLoading}
                        className="btn btn-circle btn-success btn-sm"
                    >
                        <Phone className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={rejectCall}
                        disabled={isCallLoading}
                        className="btn btn-circle btn-error btn-sm"
                    >
                        <PhoneOff className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CallNotification;
