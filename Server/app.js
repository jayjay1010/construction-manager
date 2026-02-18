// server/app.js
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import express from "express";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

import User from "./models/User.js";
import JobSite from "./models/JobSite.js";
import Timecard from "./models/Timecard.js";
import { requireAuth, requireRole } from "./middleware/auth.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 3000;


// Convert "hh:mm" + "AM/PM" into minutes since midnight
function toMinutes(timeStr, meridiem) {
  if (!timeStr || !meridiem) return null;

  const [hhStr, mmStr] = timeStr.split(":");
  let hh = Number(hhStr);
  const mm = Number(mmStr);

  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

  const isPm = meridiem === "PM";
  if (hh === 12) hh = isPm ? 12 : 0;
  else if (isPm) hh += 12;

  return hh * 60 + mm;
}

// Calculates total minutes for a day entry (start->breakOut) + (breakIn->end)
function calcTotalMinutes(entry) {
  const s = toMinutes(entry.start, entry.startTime);
  const bo = toMinutes(entry.breakOut, entry.breakOutTime);
  const bi = toMinutes(entry.breakIn, entry.breakInTime);
  const e = toMinutes(entry.end, entry.endTime);

  // If anything missing/invalid, treat as 0 for MVP
  if ([s, bo, bi, e].some((v) => v === null)) return 0;

  const part1 = bo - s;
  const part2 = e - bi;
  const total = part1 + part2;

  return total > 0 ? total : 0;
}

// Returns {weekStart, weekEnd} for the week containing the date (Mon..Sun)
function getWeekRange(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay(); // Sun=0, Mon=1, ...
  const diffToMon = (day === 0 ? -6 : 1) - day;

  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() + diffToMon);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return { weekStart, weekEnd };
}

/* -------------------- AUTH -------------------- */

// Register
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Missing field(s)" });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: "Email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
    });

    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: { id: user._id, name: user.name, role: user.role, email: user.email },
    });
  } catch (err) {
    return res.status(500).json({ error: "Register failed" });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    // ✅ This is the big guard (prevents bcrypt crash)
    if (!user.passwordHash) {
      return res.status(500).json({
        error: "Account is missing passwordHash (old/bad record). Delete it and re-register.",
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: { id: user._id, name: user.name, role: user.role, email: user.email },
    });
  } catch (err) {
    console.log("LOGIN ERROR:", err); // ✅ print real error
    return res.status(500).json({ error: err.message || "Login failed" });
  }
});

/* -------------------- JOB SITES -------------------- */

// Get active job sites
app.get("/jobsites", requireAuth, async (req, res) => {
  try {
    const sites = await JobSite.find({ status: "active" }).sort({ createdAt: -1 });
    return res.json(sites);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load jobsites" });
  }
});

// Create job site
app.post("/jobsites", requireAuth, async (req, res) => {
  try {
    const { jobName, jobNumber, location } = req.body;
    if (!jobName || !jobNumber) {
      return res.status(400).json({ error: "jobName and jobNumber required" });
    }

    const site = await JobSite.create({
      jobName,
      jobNumber,
      location: location || "",
      status: "active",
      requestedBy: req.user.userId,
    });

    return res.json(site);
  } catch (err) {
    return res.status(500).json({ error: "Failed to create jobsite" });
  }
});

// Update a job site (MVP: only the creator can edit)
app.put("/jobsites/:id", requireAuth, async (req, res) => {
  try {
    const { jobName, jobNumber } = req.body;
    if (!jobName || !jobNumber) {
      return res.status(400).json({ error: "jobName and jobNumber required" });
    }

    const site = await JobSite.findById(req.params.id);
    if (!site) return res.status(404).json({ error: "Not found" });

    // Optional: only allow the person who created it
    if (site.requestedBy?.toString() !== req.user.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    site.jobName = jobName;
    site.jobNumber = jobNumber;
    await site.save();

    return res.json(site);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update jobsite" });
  }
});

/* -------------------- TIME CARDS -------------------- */

// Get my current-week timecards
app.get("/timecards/current-week", requireAuth, async (req, res) => {
  try {
    const { weekStart, weekEnd } = getWeekRange(new Date());

    const tcs = await Timecard.find({
      userId: req.user.userId,
      weekStart,
      weekEnd,
    })
      .populate("jobSiteId")
      .sort({ createdAt: -1 });

    return res.json(tcs);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load timecards" });
  }
});

// Create a new timecard for current week + selected job site
app.post("/timecards/new", requireAuth, async (req, res) => {
  try {
    const { jobSiteId } = req.body;
    if (!jobSiteId) return res.status(400).json({ error: "jobSiteId required" });

    const { weekStart, weekEnd } = getWeekRange(new Date());

    const tc = await Timecard.create({
      userId: req.user.userId,
      jobSiteId,
      weekStart,
      weekEnd,
      entries: [],
      status: "draft",
      signature: { imageDataUrl: "", signedAt: null },
    });

    const populated = await Timecard.findById(tc._id).populate("jobSiteId");
    return res.json(populated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to create timecard" });
  }
});

// Get a timecard by id 
app.get("/timecards/:id", requireAuth, async (req, res) => {
  try {
    const tc = await Timecard.findById(req.params.id).populate("jobSiteId");
    if (!tc) return res.status(404).json({ error: "Not found" });

    if (tc.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(tc);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load timecard" });
  }
});

// Add entries using template + selected days
app.post("/timecards/:id/add-template", requireAuth, async (req, res) => {
  try {
    const tc = await Timecard.findById(req.params.id);
    if (!tc) return res.status(404).json({ error: "Not found" });

    if (tc.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (tc.status !== "draft") {
      return res.status(400).json({ error: "Timecard locked" });
    }

    const {
      start,
      startTime,
      breakOut,
      breakOutTime,
      breakIn,
      breakInTime,
      end,
      endTime,
      days,
    } = req.body;

    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json({ error: "Select days" });
    }

    const dayToIndex = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

    // Remove existing entries for selected days
    tc.entries = tc.entries.filter((e) => !days.includes(e.day));

    // Add fresh entries
    for (const day of days) {
      const idx = dayToIndex[day];
      if (idx === undefined) continue;

      const date = new Date(tc.weekStart);
      date.setDate(date.getDate() + idx);

      const entry = {
        day,
        date,
        start,
        startTime,
        breakOut,
        breakOutTime,
        breakIn,
        breakInTime,
        end,
        endTime,
      };

      entry.totalMinutes = calcTotalMinutes(entry);
      tc.entries.push(entry);
    }

    // Keep entries in Mon..Sun order
    tc.entries.sort((a, b) => dayToIndex[a.day] - dayToIndex[b.day]);

    await tc.save();
    return res.json(tc);
  } catch (err) {
    return res.status(500).json({ error: "Failed to add template" });
  }
});

app.post("/timecards/:id/remove-days", requireAuth, async (req, res) => {
  try {
    const tc = await Timecard.findById(req.params.id);
    if (!tc) return res.status(404).json({ error: "Not found" });

    if (tc.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (tc.status !== "draft") {
      return res.status(400).json({ error: "Timecard locked" });
    }

    const { days } = req.body;
    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json({ error: "Select days to remove" });
    }

    tc.entries = tc.entries.filter((e) => !days.includes(e.day));
    await tc.save();
    return res.json(tc);
  } catch (err) {
    console.error("REMOVE DAYS ERROR:", err); // ✅ add this
    return res.status(500).json({ error: "Failed to remove days" });
  }
});

// Edit selected days (patch fields)
app.post("/timecards/:id/edit-days", requireAuth, async (req, res) => {
  try {
    const tc = await Timecard.findById(req.params.id);
    if (!tc) return res.status(404).json({ error: "Not found" });

    if (tc.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (tc.status !== "draft") {
      return res.status(400).json({ error: "Timecard locked" });
    }

    const { days, patch } = req.body;
    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json({ error: "Select days" });
    }
    if (!patch) return res.status(400).json({ error: "Missing patch" });

    tc.entries = tc.entries.map((e) => {
      if (!days.includes(e.day)) return e;

      const updated = { ...e.toObject(), ...patch };
      updated.totalMinutes = calcTotalMinutes(updated);
      return updated;
    });

    await tc.save();
    return res.json(tc);
  } catch (err) {
    return res.status(500).json({ error: "Failed to edit days" });
  }
});

// Submit (signature dataUrl optional)
app.post("/timecards/:id/submit", requireAuth, async (req, res) => {
  try {
    const tc = await Timecard.findById(req.params.id);
    if (!tc) return res.status(404).json({ error: "Not found" });

    if (tc.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (tc.status !== "draft") {
      return res.status(400).json({ error: "Already submitted" });
    }

    const { signatureDataUrl } = req.body;

    if (signatureDataUrl) {
      tc.signature = tc.signature || { imageDataUrl: "", signedAt: null };
      tc.signature.imageDataUrl = signatureDataUrl;
      tc.signature.signedAt = new Date();
    }

    tc.status = "submitted";
    await tc.save();
    return res.json(tc);
  } catch (err) {
    return res.status(500).json({ error: "Failed to submit timecard" });
  }
});

// Foreman approve
app.post(
  "/timecards/:id/approve",
  requireAuth,
  requireRole("foreman"),
  async (req, res) => {
    try {
      const tc = await Timecard.findById(req.params.id);
      if (!tc) return res.status(404).json({ error: "Not found" });

      if (tc.status !== "submitted") {
        return res.status(400).json({ error: "Must be submitted" });
      }

      tc.status = "approved";
      await tc.save();
      return res.json(tc);
    } catch (err) {
      return res.status(500).json({ error: "Failed to approve timecard" });
    }
  }
);

// Crew view (foreman)
app.get("/crew/timecards", requireAuth, requireRole("foreman"), async (req, res) => {
  try {
    const { weekStart, weekEnd } = getWeekRange(new Date());

    const tcs = await Timecard.find({ weekStart, weekEnd })
      .populate("jobSiteId")
      .populate("userId", "name role")
      .sort({ createdAt: -1 });

    return res.json(tcs);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load crew timecards" });
  }
});

app.get("/", (_, res) => res.send("Construction Manager API running ✅"));

/* -------------------- Start Server -------------------- */

try {
  // Use MONGO_URI 
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Mongo connected");

  app.listen(PORT, () => console.log(`Server running on ${PORT}`));
} catch (err) {
  console.error("Mongo connection failed:", err.message);
  process.exit(1);
}