import { Server } from "socket.io";
import http from "http";
import express from "express";
import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  },
});

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// used to store online users
const userSocketMap = {}; // {userId: socketId}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap[userId] = socket.id;

  // io.emit() is used to send events to all the connected clients
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
    console.log("A user disconnected", socket.id);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
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
