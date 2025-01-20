import { Server } from "socket.io";
import http from "http";
import express from "express";
import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://your-frontend-url.com"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// used to store online users
const userSocketMap = {}; // {userId: socketId}

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  
  if (!userId) {
    console.log("Rejecting socket connection - no userId provided");
    socket.disconnect();
    return;
  }

  console.log("User connected:", { userId, socketId: socket.id });
  userSocketMap[userId] = socket.id;
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Handle WebRTC signaling with logging
  socket.on("webrtc-signal", async (data) => {
    console.log("Received WebRTC signal:", { type: data.type, from: userId, to: data.targetUserId });
    const receiverSocketId = userSocketMap[data.targetUserId];

    if (receiverSocketId) {
      console.log("Forwarding WebRTC signal to:", receiverSocketId);
      io.to(receiverSocketId).emit("webrtc-signal", {
        ...data,
        fromUserId: userId
      });
    } else {
      console.log("Target user not found:", data.targetUserId);
    }
  });

  // Handle call requests
  socket.on("call-request", async ({ targetUserId }) => {
    console.log("Call request received:", { from: userId, to: targetUserId });
    const receiverSocketId = userSocketMap[targetUserId];
    
    if (receiverSocketId) {
      try {
        const fromUser = await User.findById(userId).select('fullName profilePic');
        console.log("Emitting call request to:", receiverSocketId);
        io.to(receiverSocketId).emit("call-request", {
          fromUser,
          targetUserId: userId // Important: Send caller's ID as targetUserId
        });
      } catch (error) {
        console.error("Error in call request:", error);
        socket.emit("call-error", { message: "Failed to initiate call" });
      }
    } else {
      socket.emit("call-error", { message: "User is offline" });
    }
  });

  // Handle call acceptance
  socket.on("call-accepted", ({ targetUserId }) => {
    console.log("Call accepted:", { by: userId, to: targetUserId });
    const callerSocketId = userSocketMap[targetUserId];
    if (callerSocketId) {
      io.to(callerSocketId).emit("call-accepted", {
        targetUserId: userId,
        acceptedBy: userId
      });
    }
  });

  // Handle call rejection
  socket.on("call-rejected", ({ targetUserId }) => {
    const callerSocketId = userSocketMap[targetUserId];
    if (callerSocketId) {
      io.to(callerSocketId).emit("call-rejected");
    }
  });

  // Handle call end
  socket.on("call-ended", ({ targetUserId }) => {
    const receiverSocketId = userSocketMap[targetUserId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-ended");
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", { userId, socketId: socket.id });
    if (userId && userSocketMap[userId]) {
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });

  // Handle existing message functionality
  socket.on("newMessage", (message) => {
    const receiverSocketId = userSocketMap[message.receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", message);
    }
  });
});

export { io, app, server };
