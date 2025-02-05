import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { WebRTCService } from '../services/WebRTCService';

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [], // Initialize as empty array
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isInCall: false,
  webRTC: null,
  localStream: null,
  remoteStream: null,
  incomingCall: null,
  isCallLoading: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: Array.isArray(res.data) ? res.data : [] }); // Ensure array
    } catch (error) {
      set({ users: [] }); // Reset to empty array on error
      toast.error(error.response?.data?.message || 'Failed to load users');
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;

      set({
        messages: [...get().messages, newMessage],
      });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
  },

  setSelectedUser: (selectedUser) => {
    set({ 
      selectedUser,
      messages: [], // Clear messages when changing users
      isMessagesLoading: false
    });
  },

  initializeWebRTC: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket?.connected) {
        console.log('Socket not connected, skipping WebRTC initialization');
        return;
    }

    console.log('Initializing WebRTC with socket:', socket.id);
    const webRTC = new WebRTCService(socket);
    
    set({ webRTC });

    socket.on('call-request', (data) => {
        console.log('Received call request from:', data.fromUser?._id);
        const { authUser } = useAuthStore.getState();
        
        // Verify this call is not from ourselves
        if (data.fromUser?._id === authUser?._id) {
          console.log('Ignoring self-call');
          return;
        }

        set({ incomingCall: data.fromUser });
        new Audio('/call-ringtone.mp3').play().catch(console.error);
    });

    socket.on('call-accepted', async (data) => {
        console.log('Call accepted:', data);
        const { targetUserId } = data;
        try {
            await webRTC.initializeCall(targetUserId, true);
            set({ isInCall: true, incomingCall: null });
        } catch (error) {
            console.error('Error in call acceptance:', error);
            toast.error('Failed to establish call');
        }
    });

    socket.on('call-rejected', () => {
        set({ incomingCall: null });
        toast.error('Call was rejected');
    });

    socket.on('webrtc-signal', async (data) => {
        switch (data.type) {
            case 'offer':
                await webRTC.handleOffer(data.offer, data.targetUserId);
                break;
            case 'answer':
                await webRTC.handleAnswer(data.answer);
                break;
            case 'ice-candidate':
                await webRTC.handleIceCandidate(data.candidate);
                break;
        }
    });
  },

  startVideoCall: async (userId) => {
    const { webRTC } = get();
    const { authUser } = useAuthStore.getState();

    if (!webRTC) {
        toast.error('Video call service not initialized');
        return;
    }

    // Prevent calling yourself
    if (userId === authUser?._id) {
      toast.error('Cannot call yourself');
      return;
    }

    try {
        set({ isCallLoading: true });
        console.log('Starting video call to:', userId);
        await webRTC.startCall(userId);
        toast.success('Calling user...');
    } catch (error) {
        console.error('Video call error:', error);
        toast.error(error.message || 'Failed to start video call');
        webRTC.endCall();
    } finally {
        set({ isCallLoading: false });
    }
  },

  acceptCall: async () => {
    const { webRTC, incomingCall } = get();
    if (!webRTC || !incomingCall) return;

    try {
        set({ isCallLoading: true });
        await webRTC.initializeCall(incomingCall._id, false);
        set({ isInCall: true, incomingCall: null });
        webRTC.socket.emit('call-accepted', { targetUserId: incomingCall._id });
    } catch (error) {
        set({ incomingCall: null });
        toast.error(error.message || 'Failed to accept call');
        webRTC.endCall();
    } finally {
        set({ isCallLoading: false });
    }
  },

  rejectCall: () => {
    const { webRTC, incomingCall } = get();
    if (!webRTC || !incomingCall) return;

    webRTC.rejectCall(incomingCall._id);
    set({ incomingCall: null });
  },

  endVideoCall: () => {
    const { webRTC } = get();
    if (!webRTC) return;

    webRTC.endCall();
    set({ isInCall: false });
  },
}));
