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
    dateAdded: {
      type: Date,
      default: Date.now,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true },
)

// Pre-save middleware to update inStock status
inventorySchema.pre("save", function (next) {
  if (this.isModified("inStock") && this.inStock) {
    this.inStock = this.quantity > 0
  }
  next()
})

// Method to get full image URL
inventorySchema.methods.getImageUrl = function () {
  return `/uploads/inventory/${this.image}`
}

// Method to reduce quantity
inventorySchema.methods.reduceStock = function (qty) {
  if (qty <= 0) throw new Error("Quantity must be greater than 0")
  if (this.quantity < qty) throw new Error("Not enough stock available")

  this.quantity -= qty

  // if stock is empty, mark as out of stock
  if (this.quantity <= 0) {
    this.inStock = false
  }

  return this.save()
}


// Static method to get available inventory
inventorySchema.statics.getAvailableInventory = function () {
  return this.find({ inStock: true })
}

export const Inventory = mongoose.model("Inventory", inventorySchema)
