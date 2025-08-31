import passport from "../utils/passport-setup.js"
import ErrorHandler from "../utils/ErrorHandler.js"
import catchAsyncErrors from "./catchAsyncErrors.js"
import jwt from "jsonwebtoken"
import { Admin } from "../model/admin.js"

// Middleware to authenticate admin login
export const authenticateAdmin = (req, res, next) => {
  passport.authenticate("local", (err, admin, info) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Authentication error",
        error: err.message,
      })
    }

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: info.message || "Authentication failed",
      })
    }

    // Log the admin in
    req.logIn(admin, (err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Login error",
          error: err.message,
        })
      }

      // Generate JWT token
      const token = admin.getJwtToken()

      res.cookie("admin_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      })

      return res.status(200).json({
        success: true,
        message: "Login successful",
        admin: {
          id: admin._id,
          email: admin.email,
          role: admin.role,
          isVerified: admin.isVerified,
        },
        token,
      })
    })
  })(req, res, next)
}

export const isAuthenticated = catchAsyncErrors(async (req, res, next) => {
  const token = req.cookies["admin_token"]

  if (!token) {
    return next(new ErrorHandler("Please login to continue", 401))
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY)

  if (!decoded) {
    return next(new ErrorHandler("Access token is not valid", 400))
  }

  const admin = await Admin.findById(decoded.id)

  if (!admin) {
    return next(new ErrorHandler("Please login to access this resource", 400))
  }

  // Set admin in request object
  req.user = admin
  next()
})

// Middleware to check if admin is authenticated (session-based)
export const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next()
  }

  return res.status(401).json({
    success: false,
    message: "Please log in to access this resource",
  })
}

// Middleware to check admin role
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      })
    }

    next()
  }
}

// Middleware to check if admin is a super-admin
export const requireSuperAdmin = catchAsyncErrors(async (req, res, next) => {
  // First check if user is authenticated
  if (!req.user) {
    return next(new ErrorHandler("Please login to access this resource", 401))
  }

  // Check if the admin role is super-admin
  if (req.user.role !== "super-admin") {
    return next(new ErrorHandler("Access denied. Super-admin privileges required", 403))
  }

  next()
})
