const API = "http://localhost:3000";

const el = (id) => document.getElementById(id);
const show = (id) => el(id).classList.remove("hidden");
const hide = (id) => el(id).classList.add("hidden");

let token = localStorage.getItem("cm_token") || "";
let me = JSON.parse(localStorage.getItem("cm_user") || "null");

let currentTimecardId = null;
let currentTimecard = null;
let jobSites = [];

function setSession(t, user) {
  token = t;
  me = user;
  localStorage.setItem("cm_token", t);
  localStorage.setItem("cm_user", JSON.stringify(user));
  renderUserBox();
}

function clearSession() {
  token = "";
  me = null;
  localStorage.removeItem("cm_token");
  localStorage.removeItem("cm_user");
  renderUserBox();
}

function renderUserBox() {
  el("userBox").textContent = me ? `${me.name}(${me.role})` : "";
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!headers["Content-Type"] && options.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function getSelectedDays(selector) {
  return Array.from(document.querySelectorAll(selector))
    .filter((c) => c.checked)
    .map((c) => c.value);
}

function calcHours(entries) {
  const totalMinutes = entries.reduce((sum, e) => sum + (e.totalMinutes || 0), 0);
  return (totalMinutes / 60).toFixed(2);
}

function weekLabel(tc) {
  const ws = new Date(tc.weekStart);
  const we = new Date(tc.weekEnd);
  return `${ws.toLocaleDateString()} - ${we.toLocaleDateString()}`;
}

function fmtEntryTime(t, m) {
  if (!t) return "";
  return `${t} ${m}`;
}

function renderEntries(tc) {
  const rows = tc.entries || [];
  if (rows.length === 0) {
    hide("entriesWrap");
    return;
  }

  show("entriesWrap");

  const jobName = tc.jobSiteId?.jobName || "";
  const jobNum = tc.jobSiteId?.jobNumber || "";

  const html = `
    <table class="table">
      <thead>
        <tr>
          <th>Job</th>
          <th>Day</th>
          <th>Date</th>
          <th>Start</th>
          <th>Break Out</th>
          <th>Break In</th>
          <th>End</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${jobName} / ${jobNum}</td>
            <td>${r.day}</td>
            <td>${new Date(r.date).toLocaleDateString()}</td>
            <td>${fmtEntryTime(r.start, r.startTime)}</td>
            <td>${fmtEntryTime(r.breakOut, r.breakOutTime)}</td>
            <td>${fmtEntryTime(r.breakIn, r.breakInTime)}</td>
            <td>${fmtEntryTime(r.end, r.endTime)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  el("entriesTable").innerHTML = html;
  el("tcTotalHours").textContent = calcHours(rows);
}

function renderTimecard(tc) {
  currentTimecard = tc;
  currentTimecardId = tc._id;

  el("tcName").textContent = me?.name || "";
  el("tcRole").textContent = me?.role || "";
  el("tcWeek").textContent = weekLabel(tc);
  el("tcStatus").textContent = tc.status;

  el("tcJobNumber").textContent = tc.jobSiteId?.jobNumber || "(select a job site)";
  el("tcMsg").textContent = "";
  renderEntries(tc);
}

async function loadJobSites() {
  jobSites = await api("/jobsites");
  const sel = el("jobSiteSelect");

  sel.innerHTML =
    `<option value="">Select Job Site</option>` +
    jobSites.map((s) => `<option value="${s._id}">${s.jobName} (#${s.jobNumber})</option>`).join("");
}

async function openDashboard() {
  hide("authSection");
  show("dashSection");
  hide("weekListSection");
  hide("timecardSection");
}

async function openWeekList() {
  hide("authSection");
  hide("dashSection");
  show("weekListSection");
  hide("timecardSection");

  const list = await api("/timecards/current-week");
  const wrap = el("weekList");

  if (list.length === 0) {
    wrap.innerHTML = `<p class="muted">No timecards yet this week. Click “New Timecard”.</p>`;
    return;
  }

  wrap.innerHTML = list
    .map((tc) => {
      const hours = calcHours(tc.entries || []);
      const status = tc.status;
      const jobName = tc.jobSiteId?.jobName || "";
      const jobNum = tc.jobSiteId?.jobNumber || "";
      return `
      <div class="card" style="margin:10px 0;">
        <div class="row space">
          <div>
            <div><b>${jobName}</b> (#${jobNum})</div>
            <div class="muted">${weekLabel(tc)} • ${hours} hrs • ${status}</div>
          </div>
          <button data-open="${tc._id}">Open</button>
        </div>
      </div>
    `;
    })
    .join("");

  wrap.querySelectorAll("button[data-open]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-open");
      await openTimecardById(id);
    });
  });
}

async function createNewTimecard() {
  hide("authSection");
  hide("dashSection");
  hide("weekListSection");
  show("timecardSection");

  await loadJobSites();

  currentTimecardId = null;
  currentTimecard = null;

  el("tcName").textContent = me?.name || "";
  el("tcRole").textContent = me?.role || "";
  el("tcWeek").textContent = "Current Week";
  el("tcJobNumber").textContent = "(select a job site)";
  el("tcStatus").textContent = "draft";
  el("entriesTable").innerHTML = "";
  el("tcTotalHours").textContent = "0.00";
  hide("entriesWrap");

  el("tcMsg").textContent = "Select a job site first, then use Quick Fill and click Add.";
  el("jobSiteSelect").value = "";
}

async function openTimecardById(id) {
  hide("authSection");
  hide("dashSection");
  hide("weekListSection");
  show("timecardSection");

  await loadJobSites();

  const tc = await api(`/timecards/${id}`);
  el("jobSiteSelect").value = tc.jobSiteId?._id || "";
  renderTimecard(tc);
}

async function ensureTimecardCreated() {
  if (currentTimecardId) return currentTimecardId;

  const jobSiteId = el("jobSiteSelect").value;
  if (!jobSiteId) throw new Error("Pick a job site first");

  const tc = await api("/timecards/new", {
    method: "POST",
    body: JSON.stringify({ jobSiteId }),
  });

  renderTimecard(tc);
  el("tcWeek").textContent = weekLabel(tc);
  return tc._id;
}

function buildEditDaysCheckboxes(entries) {
  const existingDays = new Set((entries || []).map((e) => e.day));
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  el("editDaysRow").innerHTML = days
    .map(
      (d) => `
    <label>
      <input type="checkbox" class="editDayChk" value="${d}" ${existingDays.has(d) ? "" : "disabled"}>
      ${d}
    </label>
  `
    )
    .join("");
}

// -------------------- EVENTS --------------------
renderUserBox();

// Register
el("btnRegister").addEventListener("click", async () => {
  try {
    el("authMsg").textContent = "";

    const payload = {
      name: el("regName").value.trim(),
      email: el("regEmail").value.trim(),
      password: el("regPassword").value,
      role: el("regRole").value,
    };

    const data = await api("/auth/register", { method: "POST", body: JSON.stringify(payload) });
    setSession(data.token, data.user);
    openDashboard();
  } catch (e) {
    el("authMsg").textContent = e.message;
  }
});

// Login
el("btnLogin").addEventListener("click", async () => {
  try {
    el("authMsg").textContent = "";

    const payload = {
      email: el("loginEmail").value.trim(),
      password: el("loginPassword").value,
    };

    const data = await api("/auth/login", { method: "POST", body: JSON.stringify(payload) });
    setSession(data.token, data.user);
    openDashboard();
  } catch (e) {
    el("authMsg").textContent = e.message;
  }
});

// Dashboard nav
el("btnWeekList").addEventListener("click", openWeekList);
el("btnNewTimecard").addEventListener("click", createNewTimecard);
el("btnWeekNewTimecard").addEventListener("click", createNewTimecard);

el("btnBackToDash1").addEventListener("click", openDashboard);
el("btnBackToDash2").addEventListener("click", openDashboard);

// Logout
el("btnLogout").addEventListener("click", () => {
  clearSession();
  show("authSection");
  hide("dashSection");
  hide("weekListSection");
  hide("timecardSection");
});

// Create Job Site (auto-select after create)
el("btnCreateJobSite").addEventListener("click", async () => {
  try {
    const jobName = prompt("Job Name (ex: CSUN - Sierra Hall)");
    if (!jobName) return;

    const jobNumber = prompt("Job Number (ex: A1023)");
    if (!jobNumber) return;

    const location = prompt("Location (optional)") || "";

    // if server returns created site, we can auto-select it
    const created = await api("/jobsites", {
      method: "POST",
      body: JSON.stringify({ jobName, jobNumber, location }),
    });

    await loadJobSites();

    if (created?._id) {
      el("jobSiteSelect").value = created._id;
      el("jobSiteSelect").dispatchEvent(new Event("change"));
    }

    alert("Job Site created.");
  } catch (e) {
    alert(e.message);
  }
});

// Job site dropdown change updates job #
el("jobSiteSelect").addEventListener("change", () => {
  const jobSiteId = el("jobSiteSelect").value;
  const site = jobSites.find((s) => s._id === jobSiteId);
  el("tcJobNumber").textContent = site ? site.jobNumber : "(select a job site)";
});

// Add Template
el("btnAddTemplate").addEventListener("click", async () => {
  try {
    el("tcMsg").textContent = "";

    const id = await ensureTimecardCreated();

    const days = getSelectedDays(".dayChk");
    if (days.length === 0) throw new Error("Select at least one day");

    const payload = {
      start: el("tStart").value.trim(),
      startTime: el("tStartM").value,
      breakOut: el("tBreakOut").value.trim(),
      breakOutTime: el("tBreakOutM").value,
      breakIn: el("tBreakIn").value.trim(),
      breakInTime: el("tBreakInM").value,
      end: el("tEnd").value.trim(),
      endTime: el("tEndM").value,
      days,
    };

    await api(`/timecards/${id}/add-template`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const tc = await api(`/timecards/${id}`);
    renderTimecard(tc);
  } catch (e) {
    el("tcMsg").textContent = e.message;
  }
});

// Edit Days modal open
el("btnEditDays").addEventListener("click", async () => {
  try {
    el("editMsg").textContent = "";
    if (!currentTimecardId) throw new Error("Add entries first");

    const tc = await api(`/timecards/${currentTimecardId}`);
    renderTimecard(tc);

    buildEditDaysCheckboxes(tc.entries);
    show("editModal");
  } catch (e) {
    el("tcMsg").textContent = e.message;
  }
});

el("btnRemoveDays").addEventListener("click", async () => {
  try {
    el("editMsg").textContent = "";
    if (!currentTimecardId) throw new Error("No timecard");

    const days = Array.from(document.querySelectorAll(".editDayChk"))
      .filter((c) => c.checked && !c.disabled)
      .map((c) => c.value);

    if (days.length === 0) throw new Error("Select days to remove");

    await api(`/timecards/${currentTimecardId}/remove-days`, {
      method: "POST",
      body: JSON.stringify({ days }),
    });

    const tc = await api(`/timecards/${currentTimecardId}`);
    renderTimecard(tc);
    hide("editModal");
  } catch (e) {
    el("editMsg").textContent = e.message;
  }
});

el("btnCloseEdit").addEventListener("click", () => hide("editModal"));

// Apply edits
el("btnApplyEdit").addEventListener("click", async () => {
  try {
    el("editMsg").textContent = "";

    const days = Array.from(document.querySelectorAll(".editDayChk"))
      .filter((c) => c.checked && !c.disabled)
      .map((c) => c.value);

    if (days.length === 0) throw new Error("Select days to edit");

    const patch = {
      start: el("eStart").value.trim(),
      startTime: el("eStartM").value,
      breakOut: el("eBreakOut").value.trim(),
      breakOutTime: el("eBreakOutM").value,
      breakIn: el("eBreakIn").value.trim(),
      breakInTime: el("eBreakInM").value,
      end: el("eEnd").value.trim(),
      endTime: el("eEndM").value,
    };

    await api(`/timecards/${currentTimecardId}/edit-days`, {
      method: "POST",
      body: JSON.stringify({ days, patch }),
    });

    const tc = await api(`/timecards/${currentTimecardId}`);
    renderTimecard(tc);

    hide("editModal");
  } catch (e) {
    el("editMsg").textContent = e.message;
  }
});

// Submit
el("btnSubmit").addEventListener("click", async () => {
  try {
    el("tcMsg").textContent = "";
    if (!currentTimecardId) throw new Error("No timecard to submit");

    await api(`/timecards/${currentTimecardId}/submit`, {
      method: "POST",
      body: JSON.stringify({ signatureDataUrl: "" }),
    });

    const tc = await api(`/timecards/${currentTimecardId}`);
    renderTimecard(tc);

    el("tcMsg").textContent = "Submitted!";
  } catch (e) {
    el("tcMsg").textContent = e.message;
  }
});

// Initial view
if (token && me) {
  openDashboard();
} else {
  show("authSection");
  hide("dashSection");
  hide("weekListSection");
  hide("timecardSection");
}


