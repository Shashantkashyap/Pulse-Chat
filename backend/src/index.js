import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

import path from "path";

import { connectDB } from "./lib/db.js";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server } from "./lib/socket.js";

dotenv.config();

const PORT = process.env.PORT;
const __dirname = path.resolve();

const corsOptions = {
  origin: ["http://localhost:5173", "https://pulse-chat-3-frontend.onrender.com"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["set-cookie"]
};

app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));

app.use((req, res, next) => {
  const oldSetHeader = res.setHeader;
  res.setHeader = function(name, value) {
    console.log('Setting header:', name, value);
    return oldSetHeader.apply(this, arguments);
  };
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// app.use("/", (req, res) => {
//   res.send("Welcome to Pulse Chat API");
// });

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

server.listen(PORT, () => {
  console.log("server is running on PORT:" + PORT);
  connectDB();
});
