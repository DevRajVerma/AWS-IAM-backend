const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    lastLogin: {
      type: String,
      default: "Never",
    },
    role: {
      type: String,
      enum: ["admin", "readOnly", "s3Uploader", "ec2Manager"],
      default: "readOnly",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "pending",
    },
  },
  {
    timestamps: true, // This adds createdAt and updatedAt automatically
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Virtual for formatted last login
userSchema.virtual("lastLoginFormatted").get(function () {
  if (this.lastLogin === "Never") return "Never";
  return this.lastLogin;
});

// Ensure virtual fields are serialized
userSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("User", userSchema);
