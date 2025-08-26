import express from "express"
const router = express.Router()

import {
  loginAdmin,
  getAllAdmins,
  createAdmin,
  getAdmin,
  changePassword,
  forgotPassword,
  verifyForgotPassword,
  resetPassword,
  deleteAdmin,
  logoutAdmin,
} from "../controller/admin.js"

// Authentication routes
router.post("/login", loginAdmin)
router.get("/logout", logoutAdmin)

// Password management routes
router.post("/forgot-password", forgotPassword)
router.post("/verify-forgot-password", verifyForgotPassword)
router.post("/reset-password", resetPassword)
router.put("/change-password", changePassword)

// Admin management routes
router.get("/get-admin", getAdmin)
router.get("/get-all-admins", getAllAdmins)
router.post("/create-admin", createAdmin)
router.delete("/delete-admin/:id", deleteAdmin)

export default router
