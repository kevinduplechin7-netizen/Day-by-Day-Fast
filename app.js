const KEY_ACTIVE = "fastbutton_active_start_utc";
const KEY_SESSIONS = "fastbutton_sessions_v1";
const KEY_GOAL_HOURS = "fastbutton_goal_hours_v1";

let deferredPrompt = null;

const el = (id) => document.getElementById(id);

const btnMain = el("btnMain");
const timerLabel = el("timerLabel");
const stateLabel = el("stateLabel");
const weekTotal = el("weekTotal");
const monthTotal = el("monthTotal");

const goalDone = el("goalDone");
const goalTotal = el("goalTotal");
const goalRemain = el("goalRemain");
const progressFill = el("progressFill");
const progressLabel = el("progressLabel");
const milestonesEl = el("milestones");

const rangeTotal = el("rangeTotal");
const rangeAvg = el("rangeAvg");
const rangeMax = el("rangeMax");
const rangeCount = el("rangeCount");

const logList = el("logList");
const toast = el("toast");

const modalBackdrop = el("modalBackdrop");
const modalAdd = el("modalAdd");
const modalInfo = el("modalInfo");
const modalGoal = el("modalGoal");

const startInput = el("startInput");
const endInput = el("endInput");
const manualDuration = el("manualDuration");
const overlapWarning = el("overlapWarning");

const btnInstall = el("btnInstall");
const goalHoursInput = el("goalHoursInput");

const pad2 = (n) => String(n).padStart(2, "0");

function nowUtcMs() {
  return Date.now();
}
function toIsoLocalInput(ms) {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
function parseLocalInputToUtcMs(val) {
  return new Date(val).getTime();
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(KEY_SESSIONS);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveSessions(sessions) {
  localStorage.setItem(KEY_SESSIONS, JSON.stringify(sessions));
}
function loadActiveStartUtcMs() {
  const raw = localStorage.getItem(KEY_ACTIVE);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
function setActiveStartUtcMs(msOrNull) {
  if (msOrNull == null) localStorage.removeItem(KEY_ACTIVE);
  else localStorage.setItem(KEY_ACTIVE, String(msOrNull));
}

function loadGoalHours() {
  const raw = localStorage.getItem(KEY_GOAL_HOURS);
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return 5000; // default goal
}
function saveGoalHours(n) {
  localStorage.setItem(KEY_GOAL_HOURS, String(Math.max(0, Math.floor(n))));
}

function msToParts(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes };
}

function numberWords(n) {
  const ones = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  if (n < 20) return ones[n] ?? String(n);
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o === 0 ? tens[t] : `${tens[t]}-${ones[o]}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return r === 0 ? `${ones[h]} hundred` : `${ones[h]} hundred ${numberWords(r)}`;
  }
  if (n < 10000) {
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    return r === 0 ? `${ones[th]} thousand` : `${ones[th]} thousand ${numberWords(r)}`;
  }
  return String(n);
}

function fmtDuration(ms) {
  const { hours, minutes } = msToParts(Math.max(0, ms));
  if (hours === 0 && minutes === 0) return "zero hours";
  if (hours === 0) return `${numberWords(minutes)} minutes`;
  if (minutes === 0) return `${numberWords(hours)} hours`;
  return `${numberWords(hours)} hours, ${numberWords(minutes)} minutes`;
}

function fmtHoursOnly(hours) {
  const h = Math.max(0, Math.floor(hours));
  return `${numberWords(h)} hours`;
}

function startOfWeekLocal(ms) {
  const d = new Date(ms);
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const diff = (day === 0 ? -6 : 1 - day); // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d.getTime();
}
function startOfMonthLocal(ms) {
  const d = new Date(ms);
  d.setDate(1);
  d.setHours(0,0,0,0);
  return d.getTime();
}
function startOfYearLocal(ms) {
  const d = new Date(ms);
  d.setMonth(0, 1);
  d.setHours(0,0,0,0);
  return d.getTime();
}

function inRangeByEnd(s, rangeStartMs, rangeEndMsExclusive) {
  return s.endUtcMs >= rangeStartMs && s.endUtcMs < rangeEndMsExclusive;
}

function calcRangeStats(sessions, range) {
  const now = Date.now();
  let start = 0;

  if (range === "week") start = startOfWeekLocal(now);
  if (range === "month") start = startOfMonthLocal(now);
  if (range === "year") start = startOfYearLocal(now);

  const end = now + 3650 * 24 * 3600 * 1000;
  const inRange = sessions.filter((s) => inRangeByEnd(s, start, end));

  const durations = inRange.map((s) => s.durationMs);
  const total = durations.reduce((a, b) => a + b, 0);
  const count = inRange.length;
  const max = count ? Math.max(...durations) : 0;
  const avg = count ? Math.floor(total / count) : 0;

  return { total, count, max, avg };
}

function totalLifetimeMs(sessions) {
  return sessions.reduce((a, s) => a + (Number(s.durationMs) || 0), 0);
}

function overlapsAny(sessions, startUtcMs, endUtcMs) {
  return sessions.some((s) => !(endUtcMs <= s.startUtcMs || startUtcMs >= s.endUtcMs));
}

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 2400);
}

function openModal(which) {
  modalBackdrop.hidden = false;
  which.hidden = false;
}
function closeModals() {
  modalBackdrop.hidden = true;
  modalAdd.hidden = true;
  modalInfo.hidden = true;
  modalGoal.hidden = true;
}

function physiologyStage(hours) {
  const stages = [
    { min: 0, max: 4, title: "Fed state", body: "Your body is primarily using recent dietary energy. Insulin tends to be higher as glucose is managed and stored." },
    { min: 4, max: 8, title: "Insulin falling", body: "Insulin typically begins to decline. Fuel use shifts gradually toward stored energy. Hunger can be driven by routine cues." },
    { min: 8, max: 12, title: "Glycogen use increasing", body: "Liver glycogen is used more. Fat oxidation rises as the body transitions toward greater metabolic flexibility." },
    { min: 12, max: 24, title: "Fat metabolism dominant", body: "Fat becomes a primary fuel. Ketones begin to rise. Many people report steadier energy during this window." },
    { min: 24, max: 48, title: "Deeper ketosis", body: "Ketones can contribute more to brain energy. Cellular maintenance signaling (including autophagy pathways) is often discussed in research." },
    { min: 48, max: 120, title: "Extended fasting state", body: "The body is strongly fat-adapted. Longer fasts are commonly undertaken with medical guidance, depending on the person and context." },
    { min: 120, max: Infinity, title: "Long-duration fasting", body: "Very long fasts carry additional risks for some people and are typically done with professional supervision." },
  ];
  return stages.find((s) => hours >= s.min && hours < s.max) ?? stages[0];
}

function buildMilestones(goalHours, doneHours) {
  // Simple premium ladder; labels are intentionally non-medical
  const ms = [
    { pct: 0.10, title: "Apprentice", sub: "Ten percent of your goal" },
    { pct: 0.25, title: "Practiced", sub: "One quarter complete" },
    { pct: 0.50, title: "Committed", sub: "Halfway" },
    { pct: 0.75, title: "Seasoned", sub: "Three quarters complete" },
    { pct: 1.00, title: "Expert", sub: "Goal reached" },
  ];

  milestonesEl.innerHTML = "";
  const frac = goalHours > 0 ? (doneHours / goalHours) : 0;

  ms.forEach((m) => {
    const target = Math.round(goalHours * m.pct);
    const on = goalHours > 0 ? (doneHours >= target) : false;

    const wrap = document.createElement("div");
    wrap.className = "mile";

    const left = document.createElement("div");
    left.className = "mileLeft";
    left.innerHTML = `<div class="mileTitle">${m.title}</div><div class="mileSub">${m.sub} • ${numberWords(target)} hours</div>`;

    const badge = document.createElement("div");
    badge.className = "badge" + (on ? " on" : "");
    badge.textContent = on ? "Reached" : "Next";

    wrap.appendChild(left);
    wrap.appendChild(badge);
    milestonesEl.appendChild(wrap);
  });
}

function render() {
  const sessions = loadSessions()
    .map((s) => ({
      id: s.id,
      startUtcMs: Number(s.startUtcMs),
      endUtcMs: Number(s.endUtcMs),
      durationMs: Number(s.durationMs),
      note: s.note || "",
    }))
    .filter((s) => Number.isFinite(s.startUtcMs) && Number.isFinite(s.endUtcMs) && Number.isFinite(s.durationMs))
    .sort((a, b) => b.endUtcMs - a.endUtcMs);

  saveSessions(sessions);

  const activeStart = loadActiveStartUtcMs();
  const isFasting = activeStart != null;

  stateLabel.textContent = isFasting ? "Fasting" : "Not fasting";
  btnMain.textContent = isFasting ? "End fast" : "Start fast";

  const now = Date.now();
  const activeMs = isFasting ? (now - activeStart) : 0;
  timerLabel.textContent = isFasting ? fmtDuration(activeMs) : "zero hours";

  // mini totals
  const week = calcRangeStats(sessions, "week");
  const month = calcRangeStats(sessions, "month");
  weekTotal.textContent = fmtDuration(week.total);
  monthTotal.textContent = fmtDuration(month.total);

  // goal stats
  const goalHours = loadGoalHours();
  const doneMs = totalLifetimeMs(sessions);
  const doneHours = Math.floor(doneMs / 3600000);
  const remainHours = Math.max(0, goalHours - doneHours);
  const pct = goalHours > 0 ? Math.min(1, doneHours / goalHours) : 0;

  goalDone.textContent = fmtHoursOnly(doneHours);
  goalTotal.textContent = fmtHoursOnly(goalHours);
  goalRemain.textContent = fmtHoursOnly(remainHours);
  progressFill.style.width = `${Math.round(pct * 1000) / 10}%`;
  progressLabel.textContent = `${numberWords(Math.round(pct * 100))} percent`;

  buildMilestones(goalHours, doneHours);

  // range stats (default follows selected)
  const selected = document.querySelector(".segBtn.isOn")?.dataset?.range || "week";
  const stats = calcRangeStats(sessions, selected);
  rangeTotal.textContent = fmtDuration(stats.total);
  rangeAvg.textContent = fmtDuration(stats.avg);
  rangeMax.textContent = fmtDuration(stats.max);
  rangeCount.textContent = numberWords(stats.count);

  // physiology panel content
  if (isFasting) {
    const hrs = activeMs / 3600000;
    const st = physiologyStage(hrs);
    el("physNow").innerHTML = `
      <div style="font-weight:850; margin-bottom:6px;">${st.title}</div>
      <div style="color: rgba(12,20,18,.70); font-weight:650; line-height:1.4;">${st.body}</div>
      <div style="margin-top:10px; color: rgba(12,20,18,.60); font-weight:750; font-size:12px;">
        Current fast: ${fmtDuration(activeMs)}
      </div>
    `;
  } else {
    el("physNow").innerHTML = `
      <div style="font-weight:850; margin-bottom:6px;">No active fast</div>
      <div style="color: rgba(12,20,18,.70); font-weight:650; line-height:1.4;">
        Start a fast to see time-based physiology milestones.
      </div>
    `;
  }

  // log
  logList.innerHTML = "";
  if (!sessions.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No entries yet.";
    logList.appendChild(empty);
    return;
  }

  sessions.slice(0, 80).forEach((s) => {
    const d = new Date(s.endUtcMs);
    const dateStr = d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
    const timeStr = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

    const item = document.createElement("div");
    item.className = "logItem";

    const left = document.createElement("div");
    left.className = "logMain";
    left.innerHTML = `
      <div class="logDate">${dateStr}</div>
      <div class="logSub">${fmtDuration(s.durationMs)} • ended at ${timeStr}</div>
    `;

    const right = document.createElement("div");
    right.className = "logBtns";

    const btnDel = document.createElement("button");
    btnDel.className = "smallBtn";
    btnDel.textContent = "Delete";
    btnDel.onclick = () => {
      const next = loadSessions().filter((x) => x.id !== s.id);
      saveSessions(next);
      showToast("Deleted entry.");
      render();
    };

    right.appendChild(btnDel);

    item.appendChild(left);
    item.appendChild(right);
    logList.appendChild(item);
  });
}

function onTick() {
  const activeStart = loadActiveStartUtcMs();
  if (activeStart != null) {
    const ms = Date.now() - activeStart;
    timerLabel.textContent = fmtDuration(ms);
  }
}

btnMain.addEventListener("click", () => {
  const activeStart = loadActiveStartUtcMs();
  if (activeStart == null) {
    setActiveStartUtcMs(nowUtcMs());
    showToast("Fast started.");
    render();
    return;
  }

  const ms = Date.now() - activeStart;
  const ok = confirm(`End fast?\n\nDuration: ${fmtDuration(ms)}`);
  if (!ok) return;

  const sessions = loadSessions();
  const endUtcMs = Date.now();
  const startUtcMs = activeStart;

  const session = {
    id: `s_${endUtcMs}_${Math.random().toString(16).slice(2)}`,
    startUtcMs,
    endUtcMs,
    durationMs: Math.max(0, endUtcMs - startUtcMs),
  };

  sessions.unshift(session);
  saveSessions(sessions);
  setActiveStartUtcMs(null);

  showToast(`Logged: ${fmtDuration(session.durationMs)}`);
  render();
});

el("btnAddMissed").addEventListener("click", () => {
  const now = Date.now();
  const startGuess = now - 16 * 3600000;
  startInput.value = toIsoLocalInput(startGuess);
  endInput.value = toIsoLocalInput(now);
  overlapWarning.hidden = true;
  manualDuration.textContent = `Duration: ${fmtDuration(now - startGuess)}`;
  openModal(modalAdd);
});

function updateManualDuration() {
  if (!startInput.value || !endInput.value) return;
  const startMs = parseLocalInputToUtcMs(startInput.value);
  const endMs = parseLocalInputToUtcMs(endInput.value);
  const dur = endMs - startMs;
  manualDuration.textContent = `Duration: ${fmtDuration(dur)}`;

  const sessions = loadSessions();
  overlapWarning.hidden = !overlapsAny(sessions, startMs, endMs);
}
startInput.addEventListener("change", updateManualDuration);
endInput.addEventListener("change", updateManualDuration);

el("btnSaveManual").addEventListener("click", () => {
  if (!startInput.value || !endInput.value) return;

  const startMs = parseLocalInputToUtcMs(startInput.value);
  const endMs = parseLocalInputToUtcMs(endInput.value);

  if (!(endMs > startMs)) {
    alert("End must be after start.");
    return;
  }

  const dur = endMs - startMs;

  const sevenDays = 7 * 24 * 3600000;
  if (dur > sevenDays) {
    const ok = confirm("This entry is longer than seven days. Save anyway?");
    if (!ok) return;
  }

  const sessions = loadSessions();
  sessions.unshift({
    id: `m_${endMs}_${Math.random().toString(16).slice(2)}`,
    startUtcMs: startMs,
    endUtcMs: endMs,
    durationMs: dur,
  });
  saveSessions(sessions);

  closeModals();
  showToast(`Logged: ${fmtDuration(dur)}`);
  render();
});

el("btnCancelManual").addEventListener("click", closeModals);
el("btnCloseModal").addEventListener("click", closeModals);

el("btnPhys").addEventListener("click", () => openModal(modalInfo));
el("btnCloseInfo").addEventListener("click", closeModals);

el("btnGoal").addEventListener("click", () => {
  goalHoursInput.value = String(loadGoalHours());
  openModal(modalGoal);
});
el("btnEditGoal").addEventListener("click", () => {
  goalHoursInput.value = String(loadGoalHours());
  openModal(modalGoal);
});
el("btnCloseGoal").addEventListener("click", closeModals);
el("btnCancelGoal").addEventListener("click", closeModals);
el("btnSaveGoal").addEventListener("click", () => {
  const n = Number(goalHoursInput.value);
  if (!Number.isFinite(n) || n < 0) {
    alert("Please enter a valid number of hours.");
    return;
  }
  saveGoalHours(n);
  closeModals();
  showToast("Goal updated.");
  render();
});

modalBackdrop.addEventListener("click", closeModals);

el("btnDisclaimer").addEventListener("click", () => openModal(modalInfo));

document.querySelectorAll(".segBtn").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".segBtn").forEach((x) => x.classList.remove("isOn"));
    b.classList.add("isOn");
    render();
  });
});

// export / import
el("btnExport").addEventListener("click", () => {
  const payload = {
    exportedAtUtcMs: Date.now(),
    activeStartUtcMs: loadActiveStartUtcMs(),
    goalHours: loadGoalHours(),
    sessions: loadSessions(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fastbutton-backup.json";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported backup.");
});

el("fileImport").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.sessions)) throw new Error("Invalid backup");
    saveSessions(data.sessions);
    if (data.activeStartUtcMs != null) setActiveStartUtcMs(Number(data.activeStartUtcMs));
    if (data.goalHours != null) saveGoalHours(Number(data.goalHours));
    showToast("Imported backup.");
    render();
  } catch {
    alert("Import failed. Please choose a valid backup file.");
  } finally {
    e.target.value = "";
  }
});

// PWA install button (Android/Chrome)
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.hidden = false;
});
btnInstall.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  btnInstall.hidden = true;
});

// service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

render();
setInterval(onTick, 1000);
