import mongoose from "mongoose"

const inventorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter product name!"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Please enter product price!"],
      min: [0, "Price cannot be negative"],
    },
    category: {
      type: String,
      required: [true, "Please enter product category!"],
      trim: true,
    },
    image: {
      type: String,
      required: [true, "Please provide product image!"],
      // This will store the image filename like "image01.png"
    },
    description: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: [0, "Quantity cannot be negative"],
    },
    sold: {
      type: Boolean,
      default: false,
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    sku: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    condition: {
      type: String,
      enum: ["new", "used", "refurbished"],
      default: "new",
    },
    dateAdded: {
      type: Date,
      default: Date.now,
    },
    dateSold: {
      type: Date,
    },
    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true },
)

// Pre-save middleware to update sold status and date
inventorySchema.pre("save", function (next) {
  if (this.isModified("sold") && this.sold) {
    this.dateSold = new Date()
    this.inStock = false
  } else if (this.isModified("sold") && !this.sold) {
    this.dateSold = undefined
    this.inStock = this.quantity > 0
  }
  next()
})

// Method to get full image URL
inventorySchema.methods.getImageUrl = function () {
  return `/uploads/inventory/${this.image}`
}

// Method to mark as sold
inventorySchema.methods.markAsSold = function (soldBy) {
  this.sold = true
  this.soldBy = soldBy
  this.dateSold = new Date()
  this.inStock = false
  return this.save()
}

// Static method to get available inventory
inventorySchema.statics.getAvailableInventory = function () {
  return this.find({ sold: false, inStock: true })
}

export const Inventory = mongoose.model("Inventory", inventorySchema)
