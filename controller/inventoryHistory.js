// controller/inventoryHistory.js
import { InventoryHistory } from "../model/inventoryHistory.js";
import { Inventory } from "../model/inventory.js";
import ErrorHandler from "../utils/ErrorHandler.js";
import catchAsyncErrors from "../middleware/catchAsyncErrors.js";

// 📜 Get history
export const getInventoryHistory = catchAsyncErrors(async (req, res, next) => {
  const history = await InventoryHistory.find()
    .populate("inventory", "name sku")
    .populate("createdBy", "name email")
    .sort({ timestamp: -1 });

  // Add "canReverse" field based on 72h
  const now = new Date();
  const historyWithFlag = history.map(h => {
    const ageHours = (now - h.timestamp) / (1000 * 60 * 60);
    return {
      ...h.toObject(),
      canReverse: ageHours <= 72 && !h.reversed,
    };
  });

  res.status(200).json({ success: true, data: historyWithFlag });
});

// 🔄 Reverse history entry
export const reverseInventoryHistory = catchAsyncErrors(async (req, res, next) => {
  const history = await InventoryHistory.findById(req.params.id).populate("inventory");

  if (!history) return next(new ErrorHandler("History record not found", 404));

  const ageHours = (Date.now() - history.timestamp) / (1000 * 60 * 60);
  if (ageHours > 72) {
    return next(new ErrorHandler("Reversal not allowed after 72 hours", 403));
  }
  if (history.reversed) {
    return next(new ErrorHandler("Already reversed", 400));
  }

  const inv = await Inventory.findById(history.inventory._id);
  if (!inv) return next(new ErrorHandler("Inventory not found", 404));

  if (history.action === "created") {
    // delete the created inventory
    await inv.deleteOne();
  } else if (history.action === "updated") {
    // restore previous state
    await Inventory.findByIdAndUpdate(inv._id, history.changes.before, { new: true });
  } else if (history.action === "sold") {
    // mark as unsold (restore)
    if (history.changes.before?.quantity !== undefined) {
      inv.quantity = history.changes.before.quantity;
    }
    await inv.save();
  }

  history.reversed = true;
  await history.save();

  res.status(200).json({ success: true, message: "Change reversed successfully" });
});
