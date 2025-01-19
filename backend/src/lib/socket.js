import { Server } from "socket.io";
import http from "http";
import express from "express";
import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://your-frontend-domain.com"],
    credentials: true,
    methods: ["GET", "POST"]
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

  // Handle WebRTC signaling
  socket.on("webrtc-signal", async (data) => {
    const { targetUserId } = data;
    const receiverSocketId = userSocketMap[targetUserId];

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("webrtc-signal", {
        ...data,
        fromUserId: userId
      });
    }
  });

  // Handle call requests
  socket.on("call-request", async ({ targetUserId }) => {
    const receiverSocketId = userSocketMap[targetUserId];
    
    if (receiverSocketId) {
      try {
        const fromUser = await User.findById(userId).select('fullName profilePic');
        io.to(receiverSocketId).emit("call-request", {
          fromUser,
          targetUserId
        });
      } catch (error) {
        console.error("Error fetching user for call request:", error);
      }
    }
  });

  // Handle call acceptance
  socket.on("call-accepted", ({ targetUserId }) => {
    const callerSocketId = userSocketMap[targetUserId];
    if (callerSocketId) {
      io.to(callerSocketId).emit("call-accepted", {
        targetUserId: userId
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
