import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.MODE === "development" ? "https://pulse-chat-3.onrender.com" : "/";
const SOCKET_URL = "https://pulse-chat-3.onrender.com";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");

      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      const { authUser } = get();
      console.log("Logged in successfully", res.data);
      console.log("Logged in successfully", authUser);
      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(error.response.data.message);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser?._id) return;

    try {
      get().disconnectSocket();
      console.log("Connecting to socket URL:", SOCKET_URL);
      const socket = io(SOCKET_URL, {
        query: { userId: authUser._id },
        withCredentials: true,
        transports: ['websocket'],
        reconnection: true
      });

      socket.on("connect", () => {
        console.log("Socket connected with ID:", socket.id);
        set({ socket }); // Only set socket after successful connection
      });

      // Add error handling
      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
      });

      socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
      });

      socket.on("error", (error) => {
        console.error("Socket error:", error);
      });

      // Set up online users listener
      socket.on("getOnlineUsers", (userIds) => {
        console.log("Received online users:", userIds);
        set({ onlineUsers: userIds });
      });

    } catch (error) {
      console.error("Socket initialization error:", error);
    }
  },
  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
  },
}));
