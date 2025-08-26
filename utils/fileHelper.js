const fs = require("fs")
const path = require("path")

// Ensure directory exists
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

// Delete file safely
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    }
    return false
  } catch (error) {
    console.error("Error deleting file:", error)
    return false
  }
}

// Get file extension
const getFileExtension = (filename) => {
  return path.extname(filename).toLowerCase()
}

// Validate image file
const isValidImageFile = (filename) => {
  const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
  return validExtensions.includes(getFileExtension(filename))
}

// Generate unique filename
const generateUniqueFilename = (originalName) => {
  const timestamp = Date.now()
  const random = Math.round(Math.random() * 1e9)
  const extension = path.extname(originalName)
  return `inv_${timestamp}_${random}${extension}`
}

module.exports = {
  ensureDirectoryExists,
  deleteFile,
  getFileExtension,
  isValidImageFile,
  generateUniqueFilename,
}
