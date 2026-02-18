import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // ✅ THIS IS THE KEY FIX
    passwordHash: { type: String, required: true },

    role: {
      type: String,
      enum: ["foreman", "journeyman", "apprentice"],
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);