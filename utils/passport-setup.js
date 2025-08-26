import passport from "passport"
import { Strategy as LocalStrategy } from "passport-local"
import { Admin } from "../model/admin.js"

// Local Strategy for email/password authentication
passport.use(
  new LocalStrategy(
    {
      usernameField: "email", // Use email instead of username
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        // Find admin by email and include password field (since it's select: false by default)
        const admin = await Admin.findOne({ email }).select("+password")

        if (!admin) {
          return done(null, false, { message: "Invalid email or password" })
        }

        // Check if admin is verified
        if (!admin.isVerified) {
          return done(null, false, { message: "Please verify your email first" })
        }

        // Compare password using the method from admin model
        const isPasswordValid = await admin.comparePassword(password)

        if (!isPasswordValid) {
          return done(null, false, { message: "Invalid email or password" })
        }

        // Authentication successful
        return done(null, admin)
      } catch (error) {
        return done(error, null)
      }
    },
  ),
)

// Serialize admin for session
passport.serializeUser((admin, done) => {
  done(null, admin._id)
})

// Deserialize admin from session
passport.deserializeUser(async (id, done) => {
  try {
    const admin = await Admin.findById(id)
    done(null, admin)
  } catch (error) {
    done(error, null)
  }
})

export default passport
