import http from "http";
import { Server } from "socket.io";
import { app } from "./app.js";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import pino from "pino";
import connectDatabase from "./database/db.js";
import dotenv from "dotenv";
import { Admin } from "./model/admin.js";

process.on("uncaughtException", (err) => {
  console.log(`Error: ${err.message}`);
  console.log(`shutting down the server for handling uncaught exception`);
});

// config
dotenv.config();

// connect db
connectDatabase();

// create server
const server = app.listen(process.env.PORT, () => {
  console.log(`Server is running on port:${process.env.PORT}`);
});

// Initialize Socket.IO
export const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"], // ✅ allow your frontend
    credentials: true,
  },
});

// 🔑 Middleware to authenticate socket connection
io.use((socket, next) => {
  try {
    // 1. Try to read token from cookies
    if (socket.handshake.headers.cookie) {
      const cookies = cookie.parse(socket.handshake.headers.cookie);
      const token = cookies["admin_token"]; // same name you set in res.cookie()
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        socket.user = decoded; // attach admin info
        return next();
      }
    }
  } catch (err) {
    next(new Error("Invalid token"));
  }
});


const connectedAdmins = new Map();

// Handle connections
io.on("connection", (socket) => {
  console.log(`✅ New client connected: ${socket.id}`);
  if (socket.user?.email) {
    connectedAdmins.set(socket.user.email, socket.id);
  }

  // Listen for frontend "register" event
  socket.on("register", async (data) => {
    try {
      let admin = await Admin.findOne({ email: data?.email });

      if (admin) {
        socket.join(admin.email);
        socket.email = admin.email;
        console.log(`👤 Admin ${admin.email} joined room: ${admin.email}`);
      }
    } catch (error) {
      console.error("Error in register event:", error);
      socket.emit("error", { message: "Registration failed" });
    }
    socket.emit("registered", data); // confirm registration back to frontend
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ Client disconnected (${socket.id}): ${reason}`);
    connectedAdmins.delete(socket.user?.email);
  });
});

export { connectedAdmins };

// unhandled promise rejection
process.on("unhandledRejection", (err) => {
  console.log(`Shutting down the server for ${err.message}`);
  console.log(`shutting down the server for unhandle promise rejection`);

  server.close(() => {
    process.exit(1);
  });
});
