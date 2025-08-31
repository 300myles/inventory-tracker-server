import * as baileys from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import pino from "pino";
import { Boom } from "@hapi/boom";
import { Admin } from "../model/admin.js";
import { Inventory } from "../model/inventory.js";
import { WhatsAppBot } from "../model/whatsappbot.js";
import fs from "fs";
import path from "path";
import { io } from "../server.js";

const {
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} = baileys;

let sockInstance = null; // 🔑 store active socket
let allowedGroupJid = null;

// 🚀 START BOT
export async function startBot() {
  if (sockInstance) {
    console.log("⚠️ Bot already running.");
    return sockInstance;
  }

  const config = await WhatsAppBot.getSingleton();
  if (!config.botEnabled) {
    console.log("⚠️ WhatsApp Bot is disabled in config.");
    return null;
  }

  const authFolder =
    config.botType === "official" ? "auth_official" : "auth_info";
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`📦 Using Baileys v${version.join(".")}, Latest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false, // QR handled via DB
    browser: ["InventoryBot", "Chrome", "120.0.0.0"],
    generateHighQualityLinkPreview: true,
  });

  sock.ev.on("creds.update", saveCreds);

  // 🔌 CONNECTION EVENTS
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    console.log("📡 connection.update event:", update);

    // Save QR to DB for frontend
    if (qr) {
      const qrImage = await qrcode.toDataURL(qr);
      await WhatsAppBot.updateOne(
        {},
        { lastQr: qrImage, qrGeneratedAt: new Date() },
        { upsert: true }
      );
      console.log("📲 QR saved to DB (dashboard only).");

      io.emit("whatsapp:qr", { qrImage });
    }

    if (connection === "open") {
      console.log(`✅ WhatsApp Bot (${config.botType}) connected!`);
      io.emit("whatsapp:connected", {
        success: true,
        message: "QR scanned successfully",
      });
      await WhatsAppBot.updateMany({}, { lastQr: null, connected: true });

      // Resolve group link → group JID
      if (config.groupLink) {
        try {
          const url = new URL(config.groupLink);
          const inviteCode = url.pathname.split("/").pop().split("?")[0];
          console.log("🔑 Invite code extracted:", inviteCode);

          const groupInfo = await sock.groupGetInviteInfo(inviteCode);
          allowedGroupJid = groupInfo.id;
          console.log(
            "📌 Monitoring group:",
            groupInfo.subject,
            allowedGroupJid
          );
        } catch (err) {
          console.error("❌ Failed to resolve group link:", err.message);
        }
      }
    }

    if (connection === "close") {
      const reasonCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log("❌ Connection closed with code:", reasonCode);

      // auto-reconnect unless logged out
      if (reasonCode !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnecting...");
        sockInstance = null;
        await startBot();
      } else {
        console.log("🛑 Logged out. Not reconnecting.");
        sockInstance = null;
      }
    }
  });

  // 📩 MESSAGE HANDLER
  sock.ev.on("messages.upsert", async ({ messages }) => {
    if (config.botType !== "unofficial") return;
    if (!allowedGroupJid) return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    if (from !== allowedGroupJid) return;

    const sender = msg.key.participant;
    const agent = msg.pushName || "Unknown";
    const phone = sender?.split("@")[0];

    const text =
      msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    console.log("👤 Sender:", phone, "| Msg:", text);

    const match = text.match(/SOLD:\s*(\d+)\s*\|\s*Product:\s*(.+)/i);
    if (!match) return;

    const quantity = parseInt(match[1], 10);
    const productName = match[2].trim();

    try {
      let product = await Inventory.findOne({
        name: new RegExp("^" + productName + "$", "i"),
      });
      if (!product)
        product = await Inventory.findOne({
          name: new RegExp(productName, "i"),
        });

      if (!product) {
        await sock.sendMessage(from, {
          text: `⚠️ Product "${productName}" not found.`,
        });
        return;
      }

      if (product.quantity < quantity) {
        await sock.sendMessage(from, {
          text: `⚠️ Only ${product.quantity} available.`,
        });
        return;
      }

      // ✅ Update stock
      product.quantity -= quantity;
      if (product.quantity <= 0) product.inStock = false;
      await product.save();

      await sock.sendMessage(from, {
        text: `✅ ${quantity} ${product.name} sold by ${agent}\nRemaining: ${product.quantity}`,
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { text: "❌ Error updating inventory." });
    }
  });

  // Save reference globally
  sockInstance = sock;
  return sock;
}

// 🛑 STOP BOT
export async function stopBot({ deleteSession = false } = {}) {
  if (!sockInstance) {
    console.log("⚠️ No active bot instance.");
    return;
  }

  try {
    if (deleteSession) {
      // full logout → requires rescanning
      await sockInstance.logout();
      sockInstance = null;
      console.log("🛑 WhatsApp bot logged out (session deleted).");

      // Clean up auth folders
      const folders = ["auth_info", "auth_official"];
      for (const folder of folders) {
        const folderPath = path.resolve(process.cwd(), folder);
        if (fs.existsSync(folderPath)) {
          await fs.promises.rm(folderPath, { recursive: true, force: true });
          console.log(`🧹 Deleted folder: ${folderPath}`);
        }
      }
    } else {
      // graceful stop → session is preserved
      await sockInstance.ws.close(); // close socket connection
      sockInstance = null;
      console.log("🛑 WhatsApp bot stopped (session preserved).");
    }
  } catch (err) {
    console.error("❌ Error stopping bot:", err);
    throw err;
  }
}

// 📊 BOT STATUS
export function botStatus() {
  return sockInstance ? "running" : "stopped";
}
