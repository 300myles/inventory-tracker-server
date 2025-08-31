import mongoose from "mongoose";
import { connected } from "process";

// WhatsApp Bot Config Schema
const whatsAppBotSchema = new mongoose.Schema({
  botEnabled: { type: Boolean, default: true },
  botType: {
    type: String,
    default: "unofficial",
    enum: ["official", "unofficial"],
  },
  connected: { type: Boolean, default: false },
  lastQr: { type: String },
  qrGeneratedAt: { type: Date },
  groupLink: { type: String }, // 🔑 new field
});

// Always ensure only one document
whatsAppBotSchema.statics.getSingleton = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({}); // default doc
  }
  return config;
};

export const WhatsAppBot = mongoose.model("WhatsAppBot", whatsAppBotSchema);
