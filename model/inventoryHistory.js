// model/inventoryHistory.js
import mongoose from "mongoose";

const inventoryHistorySchema = new mongoose.Schema({
  inventory: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true },
  action: { type: String, enum: ["created", "updated", "sold"], required: true },
  changes: { type: Object }, // store details of change (before & after values, etc.)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  timestamp: { type: Date, default: Date.now },
  reversed: { type: Boolean, default: false }, // if it has been rolled back
});

inventoryHistorySchema.index({ timestamp: 1 });

export const InventoryHistory = mongoose.model("InventoryHistory", inventoryHistorySchema);
