import { isAuthenticated, requireSuperAdmin } from "../middleware/auth.js"
import catchAsyncErrors from "../middleware/catchAsyncErrors.js"
import  { Inventory } from "../model/inventory.js"
import ErrorHandler from "../utils/ErrorHandler.js"
import upload from "../middleware/upload.cjs"
import path from "path"
import fs from "fs"

// Dashboard Statistics
export const getDashboardStats = catchAsyncErrors(async (req, res, next) => {
  const totalInventory = await Inventory.countDocuments()
  const soldItems = await Inventory.countDocuments({ sold: true })
  const inStockItems = await Inventory.countDocuments({ sold: false, stock: { $gt: 0 } })

  // Calculate total inventory value
  const inventoryValue = await Inventory.aggregate([
    { $match: { sold: false } },
    { $group: { _id: null, total: { $sum: { $multiply: ["$price", "$stock"] } } } },
  ])

  // Calculate total sales revenue
  const salesRevenue = await Inventory.aggregate([
    { $match: { sold: true } },
    { $group: { _id: null, total: { $sum: "$price" } } },
  ])

  // Calculate percentage metrics
  const salesPercentage = totalInventory > 0 ? ((soldItems / totalInventory) * 100).toFixed(2) : 0
  const stockPercentage = totalInventory > 0 ? ((inStockItems / totalInventory) * 100).toFixed(2) : 0

  res.status(200).json({
    success: true,
    data: {
      totalInventory,
      soldItems,
      inStockItems,
      totalValue: inventoryValue[0]?.total || 0,
      salesRevenue: salesRevenue[0]?.total || 0,
      salesPercentage: Number.parseFloat(salesPercentage),
      stockPercentage: Number.parseFloat(stockPercentage),
      outOfStock: await Inventory.countDocuments({ stock: 0 }),
      lowStock: await Inventory.countDocuments({ stock: { $lte: 5, $gt: 0 } }),
    },
  })
})

// Get all inventory items
export const getAllInventory = catchAsyncErrors(async (req, res, next) => {
  const page = Number.parseInt(req.query.page) || 1
  const limit = Number.parseInt(req.query.limit) || 10
  const skip = (page - 1) * limit

  const filter = {}
  if (req.query.category) filter.category = req.query.category
  if (req.query.sold !== undefined) filter.sold = req.query.sold === "true"
  if (req.query.condition) filter.condition = req.query.condition

  const inventory = await Inventory.find(filter)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)

  const total = await Inventory.countDocuments(filter)

  res.status(200).json({
    success: true,
    data: inventory,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  })
})

// Get single inventory item
export const getInventoryById = catchAsyncErrors(async (req, res, next) => {
  const inventory = await Inventory.findById(req.params.id)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")

  if (!inventory) {
    return next(new ErrorHandler("Inventory item not found", 404))
  }

  res.status(200).json({
    success: true,
    data: inventory,
  })
})

// Create new inventory item
export const createInventory = [
  isAuthenticated,
  upload.single("image"),
  catchAsyncErrors(async (req, res, next) => {
    const { name, price, category, description, stock, condition, sku } = req.body

    // Validate required fields
    if (!name || !price || !category) {
      return next(new ErrorHandler("Name, price, and category are required", 400))
    }

    // Handle image upload
    let imageUrl = null
    if (req.file) {
      imageUrl = req.file.filename
    }

    const inventoryData = {
      name,
      price: Number.parseFloat(price),
      category,
      description,
      stock: Number.parseInt(stock) || 1,
      condition: condition || "new",
      sku,
      image: imageUrl,
      createdBy: req.admin._id,
      updatedBy: req.admin._id,
    }

    const inventory = await Inventory.create(inventoryData)

    res.status(201).json({
      success: true,
      message: "Inventory item created successfully",
      data: inventory,
    })
  }),
]

// Update inventory item
export const updateInventory = [
  isAuthenticated,
  upload.single("image"),
  catchAsyncErrors(async (req, res, next) => {
    const inventory = await Inventory.findById(req.params.id)

    if (!inventory) {
      return next(new ErrorHandler("Inventory item not found", 404))
    }

    const updateData = { ...req.body }
    updateData.updatedBy = req.admin._id

    // Handle new image upload
    if (req.file) {
      // Delete old image if exists
      if (inventory.image) {
        const oldImagePath = path.join("uploads/inventory", inventory.image)
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath)
        }
      }
      updateData.image = req.file.filename
    }

    // Convert numeric fields
    if (updateData.price) updateData.price = Number.parseFloat(updateData.price)
    if (updateData.stock) updateData.stock = Number.parseInt(updateData.stock)

    const updatedInventory = await Inventory.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate("createdBy updatedBy", "name email")

    res.status(200).json({
      success: true,
      message: "Inventory item updated successfully",
      data: updatedInventory,
    })
  }),
]

// Delete inventory item
export const deleteInventory = [
  isAuthenticated,
  requireSuperAdmin,
  catchAsyncErrors(async (req, res, next) => {
    const inventory = await Inventory.findById(req.params.id)

    if (!inventory) {
      return next(new ErrorHandler("Inventory item not found", 404))
    }

    // Delete associated image file
    if (inventory.image) {
      const imagePath = path.join("uploads/inventory", inventory.image)
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
      }
    }

    await Inventory.findByIdAndDelete(req.params.id)

    res.status(200).json({
      success: true,
      message: "Inventory item deleted successfully",
    })
  }),
]

// Mark item as sold
export const markAsSold = [
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    const inventory = await Inventory.findById(req.params.id)

    if (!inventory) {
      return next(new ErrorHandler("Inventory item not found", 404))
    }

    if (inventory.sold) {
      return next(new ErrorHandler("Item is already sold", 400))
    }

    await inventory.markAsSold()

    res.status(200).json({
      success: true,
      message: "Item marked as sold successfully",
      data: inventory,
    })
  }),
]

// Get available inventory
export const getAvailableInventory = catchAsyncErrors(async (req, res, next) => {
  const availableItems = await Inventory.getAvailableInventory()

  res.status(200).json({
    success: true,
    data: availableItems,
  })
})

// Serve inventory images
export const getInventoryImage = catchAsyncErrors(async (req, res, next) => {
  const { filename } = req.params
  const imagePath = path.join("uploads/inventory", filename)

  if (!fs.existsSync(imagePath)) {
    return next(new ErrorHandler("Image not found", 404))
  }

  // Set appropriate content type
  const ext = path.extname(filename).toLowerCase()
  const contentType =
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    }[ext] || "image/jpeg"

  res.setHeader("Content-Type", contentType)
  res.setHeader("Cache-Control", "public, max-age=31536000") // Cache for 1 year

  const imageStream = fs.createReadStream(imagePath)
  imageStream.pipe(res)
})

// Get inventory by category
export const getInventoryByCategory = catchAsyncErrors(async (req, res, next) => {
  const { category } = req.params

  const inventory = await Inventory.find({ category, sold: false })
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })

  res.status(200).json({
    success: true,
    data: inventory,
  })
})

// Search inventory
export const searchInventory = catchAsyncErrors(async (req, res, next) => {
  const { q, minPrice, maxPrice, category, condition } = req.query

  const filter = {}

  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      { sku: { $regex: q, $options: "i" } },
    ]
  }

  if (minPrice || maxPrice) {
    filter.price = {}
    if (minPrice) filter.price.$gte = Number.parseFloat(minPrice)
    if (maxPrice) filter.price.$lte = Number.parseFloat(maxPrice)
  }

  if (category) filter.category = category
  if (condition) filter.condition = condition

  const inventory = await Inventory.find(filter).populate("createdBy", "name email").sort({ createdAt: -1 })

  res.status(200).json({
    success: true,
    data: inventory,
  })
})
