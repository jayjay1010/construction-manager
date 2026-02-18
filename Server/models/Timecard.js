import mongoose from "mongoose";

const DayEntrySchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      required: true,
    },
    date: { type: Date, required: true },

    start: { type: String, default: "" },
    startTime: { type: String, enum: ["AM", "PM"], default: "AM" },

    breakOut: { type: String, default: "" },
    breakOutTime: { type: String, enum: ["AM", "PM"], default: "AM" },

    breakIn: { type: String, default: "" },
    breakInTime: { type: String, enum: ["AM", "PM"], default: "AM" },

    end: { type: String, default: "" },
    endTime: { type: String, enum: ["AM", "PM"], default: "PM" },

    totalMinutes: { type: Number, default: 0 },
  },
  { _id: false }
);

const TimecardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    jobSiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobSite",
      required: true,
    },

    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },

    entries: { type: [DayEntrySchema], default: [] },

    status: {
      type: String,
      enum: ["draft", "submitted", "approved"],
      default: "draft",
    },

    // Make signature match what your server expects (easy MVP)
    signature: {
      imageDataUrl: { type: String, default: "" },
      signedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// Helpful for queries (not unique)
TimecardSchema.index({ userId: 1, jobSiteId: 1, weekStart: 1 }, { unique: false });

export default mongoose.model("Timecard", TimecardSchema);