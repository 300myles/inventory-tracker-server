import { Admin } from "../model/admin.js";
import jwt from "jsonwebtoken";
import sendMail from "../utils/sendMail.js";
import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import ErrorHandler from "../utils/ErrorHandler.js";
import { isAuthenticated, requireSuperAdmin } from "../middleware/auth.js";

function generateOTP(length = 6) {
  const chars = "0123456789";
  let result = "";
  for (let i = length; i > 0; --i)
    result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

// create activation token
const createOTPToken = (admin) => {
  return jwt.sign(admin, process.env.ACTIVATION_SECRET, {
    expiresIn: "30m",
  });
};

// Admin login
export const loginAdmin = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorHandler("Please provide email and password", 400));
  }

  // Convert email to lowercase for case-insensitive comparison
  const stringEmail = email.toLowerCase();

  // Find admin by email and include password field
  const admin = await Admin.findOne({ email: stringEmail }).select("+password");

  if (!admin) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  // Check if admin is verified
  if (!admin.isVerified) {
    return next(new ErrorHandler("Please verify your account first", 401));
  }

  // Compare password
  const isPasswordValid = await admin.comparePassword(password);

  if (!isPasswordValid) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  // Generate JWT token
  const token = admin.getJwtToken();

  const options = {
    expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    httpOnly: false,
    sameSite: "None",
    secure: false,
  };

  res
    .status(200)
    .cookie("admin_token", token, options)
    .json({
      success: true,
      message: "Login successful",
      admin: {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        isVerified: admin.isVerified,
      },
    });
});

// Get all admins (Super admin only)
export const getAllAdmins = [
  isAuthenticated,
  requireSuperAdmin,
  catchAsyncErrors(async (req, res, next) => {
    const admins = await Admin.find({}).select("-password");

    res.status(200).json({
      success: true,
      admins,
    });
  }),
];

// Create new admin (Super admin only)
export const createAdmin = [
  isAuthenticated,
  requireSuperAdmin,
  catchAsyncErrors(async (req, res, next) => {
    const { email, password, role = "admin" } = req.body;

    if (!email || !password) {
      return next(new ErrorHandler("Please provide email and password", 400));
    }

    // Convert email to lowercase
    const stringEmail = email.toLowerCase();

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: stringEmail });

    if (existingAdmin) {
      return next(
        new ErrorHandler("Admin with this email already exists", 400)
      );
    }

    // Validate role
    if (!["admin", "super-admin"].includes(role)) {
      return next(new ErrorHandler("Invalid role specified", 400));
    }

    // Create new admin with email as password initially
    const newAdmin = new Admin({
      email: stringEmail,
      password: email, // Password is set to email initially
      role,
      isVerified: true, // Auto-verify admin accounts
    });

    await newAdmin.save();

    res.status(201).json({
      success: true,
      message:
        "Admin created successfully. Default password is the email address.",
      admin: {
        id: newAdmin._id,
        email: newAdmin.email,
        role: newAdmin.role,
        isVerified: newAdmin.isVerified,
      },
    });
  }),
];

// Get current admin info
export const getAdmin = [
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    const admin = req.user;

    if (!admin) {
      return next(new ErrorHandler("Admin not found", 404));
    }

    res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        isVerified: admin.isVerified,
      },
    });
  }),
];

// Change password
export const changePassword = [
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(
        new ErrorHandler("Please provide current and new password", 400)
      );
    }

    if (newPassword.length < 6) {
      return next(
        new ErrorHandler("Password must be at least 6 characters long", 400)
      );
    }

    const admin = await Admin.findById(req.user._id).select("+password");

    if (!admin) {
      return next(new ErrorHandler("Admin not found", 404));
    }

    // Verify current password
    const isCurrentPasswordValid = await admin.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      return next(new ErrorHandler("Current password is incorrect", 400));
    }

    // Check if new password is same as current
    if (currentPassword === newPassword) {
      return next(
        new ErrorHandler(
          "New password must be different from current password",
          400
        )
      );
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  }),
];

// Forgot password - send OTP
export const forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ErrorHandler("Please provide email address", 400));
  }

  // Convert email to lowercase
  const stringEmail = email.toLowerCase();

  // Find admin by email
  const admin = await Admin.findOne({ email: stringEmail });

  if (!admin) {
    return next(new ErrorHandler("Admin with this email does not exist", 404));
  }

  // Generate OTP
  const code = generateOTP();

  try {
    // Save OTP to admin
    admin.verificationCode = code;
    await admin.save();

    // Send OTP email
    await sendMail({
      email: stringEmail,
      subject: "Admin Password Reset",
      html: `<p>Your password reset code is: <strong>${code}</strong></p>
             <p>This code will expire in 20 minutes.</p>`,
    });

    // Create OTP token
    const otpToken = createOTPToken({ finder: admin._id });

    const options = {
      expires: new Date(Date.now() + 20 * 60 * 1000), // 20 minutes
      httpOnly: false,
      sameSite: "None",
      secure: false,
    };

    res
      .status(200)
      .cookie("_admin_resetstate", otpToken, options)
      .json({
        success: true,
        message: `Password reset OTP has been sent to ${email}`,
      });
  } catch (error) {
    console.log(error);
    return next(new ErrorHandler("Failed to send reset email", 500));
  }
});

// Verify forgot password OTP
export const verifyForgotPassword = catchAsyncErrors(async (req, res, next) => {
  const { otpString } = req.body;

  if (!otpString) {
    return next(new ErrorHandler("Please provide OTP", 400));
  }

  const _admin_resetstate = req.cookies._admin_resetstate;

  if (!_admin_resetstate) {
    return next(
      new ErrorHandler("Reset session expired. Please try again", 401)
    );
  }

  try {
    const decoded = jwt.verify(
      _admin_resetstate,
      process.env.ACTIVATION_SECRET
    );
    const admin = await Admin.findById(decoded.finder);

    if (!admin) {
      res.clearCookie("_admin_resetstate");
      return next(new ErrorHandler("Admin not found", 404));
    }

    const decodedCode = Number.parseInt(admin.verificationCode);
    const otpStringAsInt = Number.parseInt(otpString);

    if (decodedCode !== otpStringAsInt) {
      return next(new ErrorHandler("Invalid OTP", 400));
    }

    res.status(200).json({
      success: true,
      message: "OTP verified. You can now reset your password",
    });
  } catch (error) {
    res.clearCookie("_admin_resetstate");
    return next(new ErrorHandler("Invalid or expired reset session", 401));
  }
});

// Reset password
export const resetPassword = catchAsyncErrors(async (req, res, next) => {
  const { newPassword } = req.body;

  if (!newPassword) {
    return next(new ErrorHandler("Please provide new password", 400));
  }

  if (newPassword.length < 6) {
    return next(
      new ErrorHandler("Password must be at least 6 characters long", 400)
    );
  }

  const _admin_resetstate = req.cookies._admin_resetstate;

  if (!_admin_resetstate) {
    return next(
      new ErrorHandler("Reset session expired. Please try again", 401)
    );
  }

  try {
    const decoded = jwt.verify(
      _admin_resetstate,
      process.env.ACTIVATION_SECRET
    );
    const admin = await Admin.findById(decoded.finder);

    if (!admin) {
      return next(new ErrorHandler("Admin not found", 404));
    }

    // Update password and clear verification code
    admin.password = newPassword;
    admin.verificationCode = undefined;
    await admin.save();

    // Clear reset cookie
    res.clearCookie("_admin_resetstate");

    res.status(200).json({
      success: true,
      message:
        "Password reset successful. You can now login with your new password",
    });
  } catch (error) {
    res.clearCookie("_admin_resetstate");
    return next(new ErrorHandler("Invalid or expired reset session", 401));
  }
});

// Delete admin (Super admin only)
export const deleteAdmin = [
  isAuthenticated,
  requireSuperAdmin,
  catchAsyncErrors(async (req, res, next) => {
    const { id } = req.params;

    if (!id) {
      return next(new ErrorHandler("Admin ID is required", 400));
    }

    // Prevent super-admin from deleting themselves
    if (id === req.user._id.toString()) {
      return next(new ErrorHandler("You cannot delete your own account", 400));
    }

    const admin = await Admin.findById(id);

    if (!admin) {
      return next(new ErrorHandler("Admin not found", 404));
    }

    await Admin.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Admin deleted successfully",
    });
  }),
];

// Logout admin
export const logoutAdmin = catchAsyncErrors(async (req, res, next) => {
  res.cookie("admin_token", "", {
    expires: new Date(0),
    httpOnly: false,
    sameSite: "None",
    secure: false,
  });

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});
