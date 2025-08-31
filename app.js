import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import cookieParser from "cookie-parser";
import admin from "./routes/admin.js";
import inventory from "./routes/inventory.js";
import whatsappbot from "./routes/whatsappbot.js";
import { startBot } from "./utils/WhatsAppBot.js";
import { createAdmin } from "./controller/admin.js";
import inventoryHistoryRoutes from "./routes/inventoryHistory.js";


export const app = express();

dotenv.config({
  path: process.env.NODE_ENV !== "PRODUCTION" ? ".env" : ".env",
});

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(passport.initialize());
app.use(passport.session());


const allowedOrigins = [
  "http://localhost:3000"
];


app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Routes
app.use("/api/admin", admin);
app.use("/api/inventory", inventory);
app.use("/api/inventory-history", inventoryHistoryRoutes);
app.use("/api/whatsappbot", whatsappbot);

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});