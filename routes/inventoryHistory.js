// routes/inventoryHistory.js
import express from "express";
import { getInventoryHistory, reverseInventoryHistory } from "../controller/inventoryHistory.js";
import { isAuthenticated } from "../middleware/auth.js";

const router = express.Router();

router.get("/", isAuthenticated, getInventoryHistory);
router.post("/:id/reverse", isAuthenticated, reverseInventoryHistory);

export default router;
