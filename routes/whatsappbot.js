import express from "express";
import { WhatsAppBot } from "../model/whatsappbot.js";
import { isAuthenticated, requireSuperAdmin } from "../middleware/auth.js";
import catchAsyncErrors from "../middleware/catchAsyncErrors.js";

const router = express.Router();

// start the bot (only admins should call this)
const startWhatsAppBot = [
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    const { enabled, type, groupLink } = req.body;
    // Check if bot is enabled in config
    const config = await WhatsAppBot.getSingleton();

    console.log("Current Bot Config:", config);
    

    if (enabled !== undefined) config.botEnabled = enabled;
    if (type) config.botType = type;
    if (groupLink) config.groupLink = groupLink;

    await config.save();

    // Logic to start WhatsApp bot
    // Assuming startBot is a function that starts the bot
    try {
      // Dynamically import to avoid circular dependency
      const { startBot } = await import("../utils/WhatsAppBot.js");
      await startBot();
      res.status(200).json({
        success: true,
        message: "WhatsApp bot started successfully",
      });
    } catch (error) {
      console.error("Error starting bot:", error);
      res.status(500).json({ success: false, message: "Failed to start bot." });
    }
  }),
];
router.post("/bot/start", startWhatsAppBot);

// stop the bot (only admins should call this)
router.post(
  "/bot/stop",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    const { enabled, type, groupLink, deleteSession } = req.body;
    // Check if bot is enabled in config
    const config = await WhatsAppBot.getSingleton();
    if (enabled !== undefined) config.botEnabled = enabled;
    if (type) config.botType = type;
    if (groupLink) config.groupLink = groupLink;
    await config.save();
    // Logic to stop WhatsApp bot
    try {
      // Dynamically import to avoid circular dependency
      const { stopBot } = await import("../utils/WhatsAppBot.js");
      await stopBot({deleteSession});
      res.status(200).json({
        success: true,
        message: "WhatsApp bot stopped successfully",
      });
    } catch (error) {
      console.error("Error stopping bot:", error);
      res.status(500).json({ success: false, message: "Failed to stop bot." });
    }
  })
);

// Toggle bot state + type + group link
router.patch("/bot/state", [
  isAuthenticated,
  requireSuperAdmin,
  catchAsyncErrors(async (req, res) => {
    const { enabled, type, groupLink } = req.body;
    const update = {};
    if (enabled !== undefined) update.botEnabled = enabled;
    if (type) update.botType = type;
    if (groupLink) update.groupLink = groupLink;

    await WhatsAppBot.updateOne({}, update, { upsert: true });
    res.json({ success: true, ...update });
  }),
]);

// Get QR (only admins should call this)
router.get("/bot/qr", [
  isAuthenticated,
  catchAsyncErrors(async (req, res) => {
  const config = await WhatsAppBot.getSingleton();
  if (!config?.lastQr) return res.json({ qr: null });
  res.json({ qr: config.lastQr, generatedAt: config.qrGeneratedAt });
}),]);

// Get current bot config (optional, for dashboard display)
router.get("/bot/config", [
  isAuthenticated,
  catchAsyncErrors(async (req, res) => {
  const config = await WhatsAppBot.getSingleton();
  res.json(config);
}),]);

export default router;
