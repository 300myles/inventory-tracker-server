import express from "express";
const router = express.Router();
import {
  getDashboardStats,
  getAllInventory,
  getInventoryById,
  createInventory,
  updateInventory,
  deleteInventory,
  markAsSold,
  getAvailableInventory,
  getInventoryImage,
  getInventoryByCategory,
  searchInventory,
} from "../controller/inventory.js";

// Dashboard routes
router.get("/dashboard/stats", getDashboardStats);

// Image serving route
router.get("/images/:filename", getInventoryImage);

// Search and filter routes
router.get("/search", searchInventory);
router.get("/available", getAvailableInventory);
router.get("/category/:category", getInventoryByCategory);

// CRUD routes
router.get("/", getAllInventory);
router.post("/", createInventory);
router.get("/:id", getInventoryById);
router.put("/:id", updateInventory);
router.delete("/:id", deleteInventory);

// Special actions
router.put("/:id/sold", markAsSold);

export default router;
