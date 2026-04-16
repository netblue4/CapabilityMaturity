// ============================================================
// app.js — ICT Capability Maturity Tracker
// ============================================================

// ── State ────────────────────────────────────────────────────
let db = { assessments: [] };
let editingId = null;

// ── Init ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadFromLocalStorage();
  setDefaultDate();
  buildCapabilityFields();
  renderDashboard();
  bindEvents();
});

// ── Storage ──────────────────────────────────────────────────
function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem("ict_maturity_db");
    if (saved) db = JSON.parse(saved);
  } catch (e) { console.warn("Could not load local storage", e); }
}

function saveToLocalStorage() {
  localStorage.setItem("ict_maturity_db", JSON.stringify(db));
}

// ── Event Bindings ───────────────────────────────────────────
function bindEvents() {
  document.getElementById("btn-new-assessment").addEventListener("click", () => openAssessmentForm(null));
  document.getElementById("btn-back").addEventListener("click", () => showView("dashboard"));
  document.getElementById("btn-back-detail").addEventListener("click", () => showView("dashboard"));
  document.getElementById("btn-cancel").addEventListener("click", () => showView("dashboard"));
  document.getElementById("btn-export").addEventListener("click", exportJSON);
  document.getElementById("import-file").addEventListener("change", importJSON);
  document.getElementById("assessment-form").addEventListener("submit", saveAssessment);
  document.getElementById("btn-delete-assessment").addEventListener("click", deleteCurrentAssessment);
}

// ── Views ────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  if (name === "dashboard") renderDashboard();
}

// ── Dashboard ────────────────────────────────────────────────
function renderDashboard() {
  const hasData = db.assessments.length > 0;
  document.getElementById("no-data-message").style.display = hasData ? "none" : "flex";
  document.getElementById("dashboard-content").style.display = hasData ? "block" : "none";
  if (!hasData) return;

  const latest = db.assessments[db.assessments.length - 1];
  renderScoreList(latest);
  renderRadar(latest);
  renderHistory();
}

function renderScoreList(assessment) {
  const container = document.getElementById("score-list");
  container.innerHTML = CONFIG.capabilities.map(cap => {
    const score = assessment.scores[cap.id] || 0;
    const level = CONFIG.levels[score - 1];
    return `
      <div class="score-row">
        <span class="score-cap-name">${cap.name}</span>
        <div class="score-bar-wrap">
          <div class="score-bar" style="width:${(score/5)*100}%; background:${level ? level.color : '#ccc'}"></div>
        </div>
        <span class="score-badge" style="background:${level ? level.color : '#ccc'}">${score > 0 ? score + ' · ' + level.name : '—'}</span>
      </div>`;
  }).join("");

  const meta = document.getElementById("latest-meta");
  const avg = calcAvg(assessment);
  const avgLevel = CONFIG.levels[Math.round(avg) - 1] || CONFIG.levels[0];
  meta.innerHTML = `
    <div class="avg-score">
      <span class="avg-label">Average Score</span>
      <span class="avg-value" style="color:${avgLevel.color}">${avg} / 5</span>
      <span class="avg-level-name">${avgLevel.name}</span>
    </div>
    <div class="latest-info">📅 ${formatDate(assessment.date)} &nbsp;·&nbsp; ${assessment.label}</div>`;
}

function renderHistory() {
  const caps = CONFIG.capabilities;
  document.getElementById("th-caps").colSpan = caps.length;
  document.getElementById("th-caps").innerHTML = caps.map(c => `<span class="th-cap">${shortName(c.name)}</span>`).join("");

  const tbody = document.getElementById("history-tbody");
  const rows = [...db.assessments].reverse();
  tbody.innerHTML = rows.map((a, i) => {
    const isLatest = i === 0;
    const capCells = caps.map(cap => {
      const s = a.scores[cap.id] || 0;
      const lv = CONFIG.levels[s - 1];
      return `<td><span class="level-dot" style="background:${lv ? lv.color : '#ddd'}" title="${lv ? lv.name : 'Not scored'}">${s || '—'}</span></td>`;
    }).join("");
    return `
      <tr class="${isLatest ? 'row-latest' : ''}">
        <td>${formatDate(a.date)}</td>
        <td>${a.label}${isLatest ? ' <span class="tag-latest">latest</span>' : ''}</td>
        ${capCells}
        <td><strong>${calcAvg(a)}</strong></td>
        <td>
          <button class="btn-link" onclick="viewAssessment('${a.id}')">View</button>
          <button class="btn-link" onclick="openAssessmentForm('${a.id}')">Edit</button>
        </td>
      </tr>`;
  }).join("");
}

// ── Radar Chart ──────────────────────────────────────────────
function renderRadar(assessment) {
  const canvas = document.getElementById("radar-chart");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const maxR = Math.min(cx, cy) - 50;
  const caps = CONFIG.capabilities;
  const N = caps.length;
  const angleStep = (2 * Math.PI) / N;
  const startAngle = -Math.PI / 2;

  ctx.clearRect(0, 0, W, H);

  // Grid rings
  for (let lvl = 1; lvl <= 5; lvl++) {
    const r = (lvl / 5) * maxR;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = startAngle + i * angleStep;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Level label
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "10px Space Mono, monospace";
    ctx.fillText(lvl, cx + r * Math.cos(startAngle) + 4, cy + r * Math.sin(startAngle) - 4);
  }

  // Spokes
  for (let i = 0; i < N; i++) {
    const a = startAngle + i * angleStep;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + maxR * Math.cos(a), cy + maxR * Math.sin(a));
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Data polygon
  const scores = caps.map(c => assessment.scores[c.id] || 0);
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const a = startAngle + i * angleStep;
    const r = (scores[i] / 5) * maxR;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(52, 152, 219, 0.25)";
  ctx.fill();
  ctx.strokeStyle = "#3498db";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dots
  for (let i = 0; i < N; i++) {
    const a = startAngle + i * angleStep;
    const r = (scores[i] / 5) * maxR;
    const lv = CONFIG.levels[scores[i] - 1];
    ctx.beginPath();
    ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 5, 0, 2 * Math.PI);
    ctx.fillStyle = lv ? lv.color : "#888";
    ctx.fill();
  }

  // Labels
  ctx.font = "bold 11px DM Sans, sans-serif";
  for (let i = 0; i < N; i++) {
    const a = startAngle + i * angleStep;
    const labelR = maxR + 30;
    const x = cx + labelR * Math.cos(a);
    const y = cy + labelR * Math.sin(a);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = shortName(caps[i].name).split(" ");
    words.forEach((w, wi) => {
      ctx.fillText(w, x, y + (wi - (words.length - 1) / 2) * 14);
    });
  }
}

// ── Assessment Form ──────────────────────────────────────────
function openAssessmentForm(id) {
  editingId = id;
  const form = document.getElementById("assessment-form");
  form.reset();
  document.getElementById("assessment-form-title").textContent = id ? "Edit Assessment" : "New Assessment";
  setDefaultDate();

  if (id) {
    const a = db.assessments.find(x => x.id === id);
    if (a) {
      document.getElementById("assessment-label").value = a.label;
      document.getElementById("assessment-date").value = a.date;
      document.getElementById("assessment-notes").value = a.notes || "";
      CONFIG.capabilities.forEach(cap => {
        const slider = document.getElementById("score-" + cap.id);
        const note = document.getElementById("note-" + cap.id);
        const target = document.getElementById("target-" + cap.id);
        if (slider) slider.value = a.scores[cap.id] || 1;
        if (note) note.value = (a.capNotes && a.capNotes[cap.id]) || "";
        if (target) target.value = (a.targets && a.targets[cap.id]) || 3;
        updateSliderDisplay(cap.id, a.scores[cap.id] || 1);
        updateTargetDisplay(cap.id, (a.targets && a.targets[cap.id]) || 3);
      });
    }
  } else {
    CONFIG.capabilities.forEach(cap => {
      updateSliderDisplay(cap.id, 1);
      updateTargetDisplay(cap.id, 3);
    });
  }
  showView("assessment");
}

function buildCapabilityFields() {
  const container = document.getElementById("capability-fields");
  container.innerHTML = CONFIG.capabilities.map(cap => `
    <div class="card cap-card">
      <div class="cap-card-header">
        <div>
          <h3 class="cap-name">${cap.name}</h3>
          <p class="cap-desc">${cap.description}</p>
        </div>
      </div>
      ${cap.questions ? `
      <details class="guiding-questions">
        <summary>Guiding questions</summary>
        <ul>${cap.questions.map(q => `<li>${q}</li>`).join("")}</ul>
      </details>` : ""}
      <div class="score-section">
        <div class="slider-row">
          <label>Current Maturity Level</label>
          <div class="slider-wrap">
            <input type="range" min="1" max="5" value="1" id="score-${cap.id}"
              oninput="updateSliderDisplay('${cap.id}', this.value)" />
            <div class="slider-labels">
              ${CONFIG.levels.map(l => `<span>${l.level}</span>`).join("")}
            </div>
          </div>
          <div id="display-${cap.id}" class="level-display"></div>
        </div>
        <div class="slider-row">
          <label>Target Level</label>
          <div class="slider-wrap">
            <input type="range" min="1" max="5" value="3" id="target-${cap.id}"
              oninput="updateTargetDisplay('${cap.id}', this.value)" />
            <div class="slider-labels">
              ${CONFIG.levels.map(l => `<span>${l.level}</span>`).join("")}
            </div>
          </div>
          <div id="target-display-${cap.id}" class="level-display target"></div>
        </div>
        <div class="form-row">
          <label>Notes for this capability</label>
          <textarea id="note-${cap.id}" rows="2" placeholder="Observations, gaps, actions..."></textarea>
        </div>
      </div>
    </div>
  `).join("");
}

function updateSliderDisplay(capId, value) {
  const v = parseInt(value);
  const level = CONFIG.levels[v - 1];
  const el = document.getElementById("display-" + capId);
  if (el && level) {
    el.innerHTML = `<span class="lvl-badge" style="background:${level.color}">${v} · ${level.name}</span><span class="lvl-desc">${level.description}</span>`;
  }
}

function updateTargetDisplay(capId, value) {
  const v = parseInt(value);
  const level = CONFIG.levels[v - 1];
  const el = document.getElementById("target-display-" + capId);
  if (el && level) {
    el.innerHTML = `<span class="lvl-badge target-badge" style="border-color:${level.color};color:${level.color}">${v} · ${level.name}</span>`;
  }
}

// ── Save / Delete ────────────────────────────────────────────
function saveAssessment(e) {
  e.preventDefault();
  const scores = {}, capNotes = {}, targets = {};
  CONFIG.capabilities.forEach(cap => {
    scores[cap.id] = parseInt(document.getElementById("score-" + cap.id).value);
    capNotes[cap.id] = document.getElementById("note-" + cap.id).value.trim();
    targets[cap.id] = parseInt(document.getElementById("target-" + cap.id).value);
  });

  const assessment = {
    id: editingId || Date.now().toString(),
    label: document.getElementById("assessment-label").value.trim(),
    date: document.getElementById("assessment-date").value,
    notes: document.getElementById("assessment-notes").value.trim(),
    scores,
    capNotes,
    targets
  };

  if (editingId) {
    const idx = db.assessments.findIndex(a => a.id === editingId);
    if (idx > -1) db.assessments[idx] = assessment;
  } else {
    db.assessments.push(assessment);
  }

  // Sort by date
  db.assessments.sort((a, b) => a.date.localeCompare(b.date));
  saveToLocalStorage();
  editingId = null;
  showView("dashboard");
}

let currentDetailId = null;

function viewAssessment(id) {
  currentDetailId = id;
  const a = db.assessments.find(x => x.id === id);
  if (!a) return;
  document.getElementById("detail-title").textContent = `${a.label} — ${formatDate(a.date)}`;
  const content = document.getElementById("detail-content");
  const avg = calcAvg(a);
  const avgLevel = CONFIG.levels[Math.round(avg) - 1] || CONFIG.levels[0];

  content.innerHTML = `
    <div class="dashboard-grid">
      <div class="card radar-card">
        <h3 class="card-title">Maturity Radar</h3>
        <canvas id="detail-radar" width="380" height="380"></canvas>
      </div>
      <div class="card summary-card">
        <h3 class="card-title">Scores</h3>
        ${CONFIG.capabilities.map(cap => {
          const score = a.scores[cap.id] || 0;
          const target = a.targets ? (a.targets[cap.id] || 0) : 0;
          const lv = CONFIG.levels[score - 1];
          const tlv = CONFIG.levels[target - 1];
          const note = a.capNotes ? a.capNotes[cap.id] : "";
          return `
            <div class="detail-cap-row">
              <div class="detail-cap-name">${cap.name}</div>
              <div class="detail-cap-scores">
                <span class="lvl-badge" style="background:${lv ? lv.color : '#888'}">${score} · ${lv ? lv.name : '—'}</span>
                ${target ? `<span class="arrow-sep">→</span><span class="lvl-badge target-badge" style="border-color:${tlv ? tlv.color : '#888'};color:${tlv ? tlv.color : '#888'}">${target} · ${tlv ? tlv.name : '—'}</span>` : ''}
              </div>
              ${note ? `<div class="detail-cap-note">${note}</div>` : ''}
            </div>`;
        }).join("")}
        <div class="avg-score" style="margin-top:1rem">
          <span class="avg-label">Average</span>
          <span class="avg-value" style="color:${avgLevel.color}">${avg} / 5</span>
          <span class="avg-level-name">${avgLevel.name}</span>
        </div>
      </div>
    </div>
    ${a.notes ? `<div class="card"><h3 class="card-title">Notes</h3><p>${a.notes}</p></div>` : ''}`;

  showView("detail");
  setTimeout(() => {
    const detailCanvas = document.getElementById("detail-radar");
    if (detailCanvas) renderRadar(a);
    // swap canvas id temporarily
    const orig = document.getElementById("radar-chart");
    detailCanvas.id = "radar-chart";
    renderRadar(a);
    detailCanvas.id = "detail-radar";
    if (orig) orig.id = "radar-chart";
  }, 50);
}

function deleteCurrentAssessment() {
  if (!currentDetailId) return;
  if (!confirm("Delete this assessment? This cannot be undone.")) return;
  db.assessments = db.assessments.filter(a => a.id !== currentDetailId);
  saveToLocalStorage();
  currentDetailId = null;
  showView("dashboard");
}

// ── Import / Export ──────────────────────────────────────────
function exportJSON() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ict-maturity-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const imported = JSON.parse(evt.target.result);
      if (imported.assessments) {
        if (confirm(`Import ${imported.assessments.length} assessment(s)? This will merge with existing data.`)) {
          // Merge: add records that don't already exist by id
          imported.assessments.forEach(a => {
            if (!db.assessments.find(x => x.id === a.id)) db.assessments.push(a);
          });
          db.assessments.sort((a, b) => a.date.localeCompare(b.date));
          saveToLocalStorage();
          renderDashboard();
          alert("Import successful!");
        }
      } else {
        alert("Invalid file: missing assessments array.");
      }
    } catch {
      alert("Could not parse JSON file.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

// ── Helpers ──────────────────────────────────────────────────
function calcAvg(assessment) {
  const vals = CONFIG.capabilities.map(c => assessment.scores[c.id] || 0).filter(v => v > 0);
  if (!vals.length) return 0;
  return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function shortName(name) {
  return name
    .replace("ICT ", "")
    .replace("Management", "Mgmt")
    .replace("Performance & Capacity", "Perf & Cap")
    .replace("Disaster Recovery", "DR");
}

function setDefaultDate() {
  const today = new Date().toISOString().slice(0, 10);
  const dateInput = document.getElementById("assessment-date");
  if (dateInput && !dateInput.value) dateInput.value = today;
}
