// ============================================================
// app.js — ICT Capability Maturity Tracker
// Loads config from config.json, stores data in localStorage
// with JSON export/import as the user's portable database.
// ============================================================

let CONFIG = null;
let db = { assessments: [] };
let editingId = null;
let currentDetailId = null;

// ── Bootstrap ────────────────────────────────────────────────
// Load config.json first, then initialise the app.
document.addEventListener("DOMContentLoaded", () => {
  fetch("config.json")
    .then(r => {
      if (!r.ok) throw new Error("Could not load config.json");
      return r.json();
    })
    .then(cfg => {
      CONFIG = cfg;
      document.getElementById("app-title").textContent = CONFIG.appTitle || "ICT Capability Maturity Tracker";
      document.title = CONFIG.appTitle || "ICT Capability Maturity Tracker";
      loadFromLocalStorage();
      setDefaultDate();
      buildCapabilityFields();
      buildDimensionSelector();
      buildRadarFilter();
      renderDashboard();
      bindEvents();
      document.getElementById("loading-overlay").style.display = "none";
      document.getElementById("app-main").style.display = "block";
    })
    .catch(err => {
      document.getElementById("loading-overlay").innerHTML =
        `<div class="loading-inner" style="color:#e74c3c">
           <span style="font-size:2rem">⚠️</span>
           <p><strong>Could not load config.json</strong></p>
           <p style="font-size:.85rem">${err.message}</p>
           <p style="font-size:.8rem;opacity:.6">Make sure config.json is in the same folder as index.html.</p>
         </div>`;
    });
});

// ── Storage ──────────────────────────────────────────────────
function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem("ict_maturity_db");
    if (saved) db = JSON.parse(saved);
  } catch (e) { console.warn("Could not load localStorage", e); }
}

function saveToLocalStorage() {
  localStorage.setItem("ict_maturity_db", JSON.stringify(db));
}

// ── Events ───────────────────────────────────────────────────
function bindEvents() {
  document.getElementById("btn-new-assessment").addEventListener("click", () => openAssessmentForm(null));
  document.getElementById("btn-back").addEventListener("click", () => showView("dashboard"));
  document.getElementById("btn-back-detail").addEventListener("click", () => showView("dashboard"));
  document.getElementById("btn-cancel").addEventListener("click", () => showView("dashboard"));
  document.getElementById("btn-export").addEventListener("click", exportJSON);
  document.getElementById("import-file").addEventListener("change", importJSON);
  document.getElementById("assessment-form").addEventListener("submit", saveAssessment);
  document.getElementById("btn-delete-assessment").addEventListener("click", deleteCurrentAssessment);
  document.getElementById("btn-edit-from-detail").addEventListener("click", () => {
    if (currentDetailId) openAssessmentForm(currentDetailId);
  });
}

// ── Views ────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  if (name === "dashboard") renderDashboard();
}

// ── Dashboard ────────────────────────────────────────────────
function renderDashboard() {
  if (!CONFIG) return;
  const hasData = db.assessments.length > 0;
  document.getElementById("no-data-message").style.display = hasData ? "none" : "flex";
  document.getElementById("dashboard-content").style.display = hasData ? "block" : "none";
  if (!hasData) return;

  const latest = db.assessments[db.assessments.length - 1];
  buildAssessmentFilter();
  renderRadar("radar-chart", null, getSelectedRadarCaps(), getSelectedAssessments());
  renderMeasureSummary(latest);
  renderHistory();
}

// Capability scores card + dimension measure cards
function renderMeasureSummary(assessment) {
  const row = document.getElementById("measure-summary-row");

  // — Scores card (first in row) —
  const overall = overallAvg(assessment);
  const avgLevel = levelForScore(overall);
  const scoresCard = `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">📋</span>
        <div>
          <h3 class="measure-card-title">Latest Capability Scores</h3>
          <p class="measure-card-desc">${assessment.label} · ${formatDate(assessment.date)}</p>
        </div>
        <span class="measure-avg-badge" style="background:${avgLevel ? avgLevel.color : '#555'}">
          ${overall > 0 ? overall.toFixed(1) : '—'}
        </span>
      </div>
      <button class="btn-link ratings-link" onclick="showRatingsModal(null)">ℹ Ratings</button>
      ${CONFIG.capabilities.map(cap => {
        const avg = capAvgScore(assessment, cap.id);
        const lv = levelForScore(avg);
        return `<div class="score-row">
          <span class="score-cap-name" title="${cap.name}">${shortName(cap.name)}</span>
          <div class="score-bar-wrap">
            <div class="score-bar" style="width:${(avg/5)*100}%;background:${lv ? lv.color : '#ccc'}"></div>
          </div>
          <span class="score-badge" style="background:${lv ? lv.color : '#555'}">${avg > 0 ? avg.toFixed(1) + ' · ' + lv.name : '—'}</span>
        </div>`;
      }).join("")}
      <div class="avg-score">
        <span class="avg-label">Overall Average</span>
        <span class="avg-value" style="color:${avgLevel ? avgLevel.color : '#fff'}">${overall.toFixed(1)} / 5</span>
        <span class="avg-level-name">${avgLevel ? avgLevel.name : ''}</span>
      </div>
    </div>`;

  // — Dimension measure cards (with previous assessment comparison) —
  const prev = db.assessments.length > 1 ? db.assessments[db.assessments.length - 2] : null;

  const measureCards = CONFIG.measures.map(m => {
    const scores = CONFIG.capabilities.map(cap => getMeasureScore(assessment, cap.id, m.id) || 0);
    const prevScores = prev ? CONFIG.capabilities.map(cap => getMeasureScore(prev, cap.id, m.id) || 0) : null;

    const valid = scores.filter(s => s > 0);
    const avg = valid.length ? valid.reduce((a,b) => a+b, 0) / valid.length : 0;
    const prevValid = prevScores ? prevScores.filter(s => s > 0) : [];
    const prevAvg = prevValid.length ? prevValid.reduce((a,b) => a+b, 0) / prevValid.length : 0;
    const level = levelForScore(avg);
    const avgDelta = prev && prevAvg > 0 && avg > 0 ? avg - prevAvg : null;

    const bars = CONFIG.capabilities.map((cap, i) => {
      const s = scores[i];
      const ps = prevScores ? prevScores[i] : 0;
      const lv = levelForScore(s);
      const delta = s > 0 && ps > 0 ? s - ps : null;
      const deltaHtml = delta !== null
        ? `<span class="delta ${delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat'}">
             ${delta > 0 ? '▲' : delta < 0 ? '▼' : '●'}${delta !== 0 ? Math.abs(delta).toFixed(1) : ''}
           </span>`
        : '';
      return `<div class="mini-bar-row">
        <span class="mini-bar-label">${shortName(cap.name)}</span>
        <div class="mini-bar-track">
          <div class="mini-bar-fill" style="width:${(s/5)*100}%;background:${lv ? lv.color : '#444'}"></div>
        </div>
        <span class="mini-bar-val">${s || '—'}</span>${deltaHtml}
      </div>`;
    }).join("");

    const badgeInner = prev && prevAvg > 0 && avg > 0
      ? `${prevAvg.toFixed(1)}<span class="badge-arrow">→</span>${avg.toFixed(1)}${avgDelta !== null ? `<span class="badge-delta ${avgDelta > 0 ? 'delta-up' : avgDelta < 0 ? 'delta-down' : ''}">${avgDelta > 0 ? ' ▲' : avgDelta < 0 ? ' ▼' : ''}</span>` : ''}`
      : avg > 0 ? avg.toFixed(1) : '—';

    return `
      <div class="card measure-card">
        <div class="measure-card-header">
          <span class="measure-icon">${m.icon}</span>
          <div>
            <h3 class="measure-card-title">${m.name}</h3>
            <p class="measure-card-desc">${m.description}</p>
          </div>
          <span class="measure-avg-badge" style="background:${level ? level.color : '#555'}">
            ${badgeInner}
          </span>
        </div>
        <button class="btn-link ratings-link" onclick="showRatingsModal('${m.id}')">ℹ Ratings</button>
        <div class="mini-bars">${bars}</div>
      </div>`;
  }).join("");

  row.innerHTML = scoresCard + measureCards;
}

// ── Ratings Modal ────────────────────────────────────────────
function showRatingsModal(measureId) {
  const m = measureId ? CONFIG.measures.find(x => x.id === measureId) : null;
  document.getElementById("modal-title").textContent = m
    ? `${m.name} — Rating Scale`
    : "Overall Score — Rating Scale";
  document.getElementById("modal-body").innerHTML = `
    <p class="modal-desc">${m
      ? `Each capability is rated 1–5 for <strong>${m.name}</strong>. The score shown is the average across all rated capabilities.`
      : `The overall score is the average of all dimension ratings (${CONFIG.measures.map(x => x.name).join(", ")}) across all rated capabilities.`
    }</p>
    <div class="modal-levels">
      ${CONFIG.levels.map(lv => {
        const label = m ? (m.levels.find(l => l.level === lv.level) || {}).label : null;
        return `<div class="modal-level-row">
          <span class="lvl-badge" style="background:${lv.color};min-width:105px;text-align:center">${lv.level} · ${lv.name}</span>
          <div>
            <div class="modal-level-desc">${lv.description}</div>
            ${label ? `<div class="modal-level-label">${label}</div>` : ""}
          </div>
        </div>`;
      }).join("")}
    </div>`;
  document.getElementById("ratings-modal").style.display = "flex";
}

function closeRatingsModal(e) {
  if (e.target.id === "ratings-modal") {
    document.getElementById("ratings-modal").style.display = "none";
  }
}

// History table
function renderHistory() {
  const caps = CONFIG.capabilities;
  const measures = CONFIG.measures;

  // Build thead
  document.getElementById("history-thead").innerHTML = `
    <tr>
      <th rowspan="2">Date</th>
      <th rowspan="2">Label</th>
      ${caps.map(c => `<th colspan="${measures.length}" class="th-cap-group">${shortName(c.name)}</th>`).join("")}
      <th rowspan="2">Avg</th>
      <th rowspan="2">Actions</th>
    </tr>
    <tr>
      ${caps.map(() => measures.map(m => `<th class="th-measure" title="${m.name}">${m.icon}</th>`).join("")).join("")}
    </tr>`;

  const tbody = document.getElementById("history-tbody");
  const rows = [...db.assessments].reverse();
  tbody.innerHTML = rows.map((a, i) => {
    const isLatest = i === 0;
    const capCells = caps.map(cap =>
      measures.map(m => {
        const s = getMeasureScore(a, cap.id, m.id);
        const lv = levelForScore(s);
        return `<td><span class="level-dot" style="background:${lv ? lv.color : '#333'}" title="${lv ? lv.name : 'Not scored'}">${s || '—'}</span></td>`;
      }).join("")
    ).join("");

    return `
      <tr class="${isLatest ? 'row-latest' : ''}">
        <td>${formatDate(a.date)}</td>
        <td>${a.label}${isLatest ? ' <span class="tag-latest">latest</span>' : ''}</td>
        ${capCells}
        <td><strong>${overallAvg(a).toFixed(1)}</strong></td>
        <td>
          <button class="btn-link" onclick="viewAssessment('${a.id}')">View</button>
          <button class="btn-link" onclick="openAssessmentForm('${a.id}')">Edit</button>
          <button class="btn-link" onclick="copyAssessment('${a.id}')">Copy</button>
        </td>
      </tr>`;
  }).join("");
}

// ── Radar Cap Filter ─────────────────────────────────────────
function buildRadarFilter() {
  const container = document.getElementById("radar-cap-checkboxes");
  if (!container) return;
  container.innerHTML = CONFIG.capabilities.map(cap => `
    <label class="cap-filter-label">
      <input type="checkbox" class="radar-cap-check" value="${cap.id}" checked
        onchange="updateRadarFilter()" />
      ${cap.name}
    </label>
  `).join("");
  updateCapFilterCount();
}

function updateCapFilterCount() {
  const total = CONFIG.capabilities.length;
  const checked = document.querySelectorAll(".radar-cap-check:checked").length;
  const el = document.getElementById("cap-filter-count");
  if (el) el.textContent = checked < total ? `${checked} / ${total}` : total;
}

function getSelectedRadarCaps() {
  const checked = new Set(
    [...document.querySelectorAll(".radar-cap-check:checked")].map(el => el.value)
  );
  const selected = CONFIG.capabilities.filter(cap => checked.has(cap.id));
  return selected.length > 0 ? selected : CONFIG.capabilities;
}

function buildAssessmentFilter() {
  const container = document.getElementById("radar-assessment-checkboxes");
  if (!container) return;
  const prev = new Set(
    [...document.querySelectorAll(".radar-assessment-check:checked")].map(el => el.value)
  );
  const hasPrev = document.querySelectorAll(".radar-assessment-check").length > 0;
  container.innerHTML = db.assessments.map(a => {
    const checked = !hasPrev || prev.has(a.id);
    const d = new Date(a.date + "T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    return `
      <label class="cap-filter-label">
        <input type="checkbox" class="radar-assessment-check" value="${a.id}" ${checked ? "checked" : ""}
          onchange="updateRadarFilter()" />
        ${a.label} <span class="assessment-filter-date">${d}</span>
      </label>`;
  }).join("");
  updateAssessmentFilterCount();
}

function updateAssessmentFilterCount() {
  const total = db.assessments.length;
  const checked = document.querySelectorAll(".radar-assessment-check:checked").length;
  const el = document.getElementById("assessment-filter-count");
  if (el) el.textContent = checked < total ? `${checked} / ${total}` : total;
}

function getSelectedAssessments() {
  const checked = new Set(
    [...document.querySelectorAll(".radar-assessment-check:checked")].map(el => el.value)
  );
  const selected = db.assessments.filter(a => checked.has(a.id));
  return selected.length > 0 ? selected : [db.assessments[db.assessments.length - 1]];
}

function updateRadarFilter() {
  updateCapFilterCount();
  updateAssessmentFilterCount();
  if (db.assessments.length === 0) return;
  renderRadar("radar-chart", null, getSelectedRadarCaps(), getSelectedAssessments());
}

// ── Radar (average score per capability) ─────────────────────
function renderRadar(canvasId, assessment, capsOverride, assessmentsOverride) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const maxR = Math.min(cx, cy) - 52;
  const caps = capsOverride || CONFIG.capabilities;
  const N = caps.length;
  const angleStep = (2 * Math.PI) / N;
  const startAngle = -Math.PI / 2;

  // Resolve which assessments to draw
  const assessmentList = assessmentsOverride || (assessment ? [assessment] : []);
  const multiMode = assessmentList.length > 1;

  ctx.clearRect(0, 0, W, H);

  // Grid rings
  for (let lvl = 1; lvl <= 5; lvl++) {
    const r = (lvl / 5) * maxR;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = startAngle + i * angleStep;
      i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
              : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "9px Space Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText(lvl, cx + r * Math.cos(startAngle) + 3, cy + r * Math.sin(startAngle) - 3);
  }

  // Spokes
  for (let i = 0; i < N; i++) {
    const a = startAngle + i * angleStep;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + maxR * Math.cos(a), cy + maxR * Math.sin(a));
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (multiMode) {
    // ── Multi-assessment: one polygon per assessment, colour-coded ──
    const COLORS = ["#94a3b8", "#a78bfa", "#34d399", "#fb923c", "#f472b6", "#60a5fa", "#fbbf24", "#f87171", "#4ade80", "#38bdf8"];
    assessmentList.forEach((a, i) => {
      const isLatest = i === assessmentList.length - 1;
      const color = COLORS[i % COLORS.length];
      const avgScores = caps.map(c => capAvgScore(a, c.id));
      ctx.beginPath();
      for (let j = 0; j < N; j++) {
        const ang = startAngle + j * angleStep;
        const r = (avgScores[j] / 5) * maxR;
        j === 0 ? ctx.moveTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang))
                : ctx.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
      }
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, isLatest ? 0.15 : 0.07);
      ctx.fill();
      ctx.strokeStyle = isLatest ? color : hexToRgba(color, 0.65);
      ctx.lineWidth = isLatest ? 2.5 : 1.5;
      ctx.stroke();
      for (let j = 0; j < N; j++) {
        const ang = startAngle + j * angleStep;
        const r = (avgScores[j] / 5) * maxR;
        ctx.beginPath();
        ctx.arc(cx + r * Math.cos(ang), cy + r * Math.sin(ang), isLatest ? 5 : 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      }
    });
    // Legend: one entry per assessment
    const legendX = 8, legendY = H - assessmentList.length * 16 - 8;
    assessmentList.forEach((a, i) => {
      const color = COLORS[i % COLORS.length];
      const isLatest = i === assessmentList.length - 1;
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY + i * 16, 10, 10);
      ctx.fillStyle = isLatest ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.5)";
      ctx.font = `${isLatest ? "bold " : ""}9px DM Sans, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const label = a.label.length > 22 ? a.label.slice(0, 21) + "…" : a.label;
      ctx.fillText(label, legendX + 14, legendY + i * 16);
    });

  } else {
    // ── Single assessment: measure polygons + average polygon ──
    const a = assessmentList[0];
    if (!a) return;

    CONFIG.measures.forEach(m => {
      const scores = caps.map(c => getMeasureScore(a, c.id, m.id) || 0);
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const ang = startAngle + i * angleStep;
        const r = (scores[i] / 5) * maxR;
        i === 0 ? ctx.moveTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang))
                : ctx.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
      }
      ctx.closePath();
      ctx.fillStyle = hexToRgba(m.color, 0.1);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(m.color, 0.6);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    const avgScores = caps.map(c => capAvgScore(a, c.id));
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const ang = startAngle + i * angleStep;
      const r = (avgScores[i] / 5) * maxR;
      i === 0 ? ctx.moveTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang))
              : ctx.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(52,152,219,0.15)";
    ctx.fill();
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    for (let i = 0; i < N; i++) {
      const ang = startAngle + i * angleStep;
      const r = (avgScores[i] / 5) * maxR;
      const lv = levelForScore(avgScores[i]);
      ctx.beginPath();
      ctx.arc(cx + r * Math.cos(ang), cy + r * Math.sin(ang), 5, 0, 2 * Math.PI);
      ctx.fillStyle = lv ? lv.color : "#888";
      ctx.fill();
    }

    // Legend: measures
    const legendX = 8, legendY = H - CONFIG.measures.length * 16 - 8;
    CONFIG.measures.forEach((m, i) => {
      ctx.fillStyle = m.color;
      ctx.fillRect(legendX, legendY + i * 16, 10, 10);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "9px DM Sans, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(m.name, legendX + 14, legendY + i * 16);
    });
  }

  // Labels (always drawn)
  for (let i = 0; i < N; i++) {
    const a = startAngle + i * angleStep;
    const labelR = maxR + 28;
    const x = cx + labelR * Math.cos(a);
    const y = cy + labelR * Math.sin(a);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "bold 10px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = shortName(caps[i].name).split(" ");
    words.forEach((w, wi) => {
      ctx.fillText(w, x, y + (wi - (words.length - 1) / 2) * 13);
    });
  }
}

// ── Assessment Form ──────────────────────────────────────────
function buildCapabilityFields() {
  const container = document.getElementById("capability-fields");
  container.innerHTML = CONFIG.capabilities.map(cap => `
    <div class="card cap-card" id="capcard-${cap.id}">
      <div class="cap-card-header">
        <div>
          <h3 class="cap-name">${cap.name}</h3>
          <p class="cap-desc">${cap.description}</p>
        </div>
      </div>

      <div class="measures-grid">
        ${CONFIG.measures.map(m => `
          <div class="measure-block" data-measure="${m.id}" style="--m-color:${m.color}">
            <div class="measure-block-header">
              <span class="measure-icon-sm">${m.icon}</span>
              <span class="measure-block-name">${m.name}</span>
            </div>
            <p class="measure-block-desc">${m.description}</p>

            <div class="slider-row">
              <div class="slider-wrap">
                <input type="range" min="1" max="5" value="1"
                  id="score-${cap.id}-${m.id}"
                  oninput="updateMeasureDisplay('${cap.id}','${m.id}',this.value)" />
                <div class="slider-labels">
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                </div>
              </div>
              <div id="display-${cap.id}-${m.id}" class="level-display"></div>
            </div>

            <div class="form-row" style="margin-top:.5rem">
              <label>Target Level</label>
              <div class="slider-wrap">
                <input type="range" min="1" max="5" value="3"
                  id="target-${cap.id}-${m.id}"
                  oninput="updateTargetDisplay('${cap.id}','${m.id}',this.value)" />
                <div class="slider-labels">
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                </div>
              </div>
              <div id="target-display-${cap.id}-${m.id}" class="level-display target"></div>
            </div>

            <div class="form-row" style="margin-top:.5rem">
              <label>Notes</label>
              <textarea id="note-${cap.id}-${m.id}" rows="2"
                placeholder="${m.name} observations for ${cap.name}…"></textarea>
            </div>
          </div>
        `).join("")}
      </div>

      <div class="form-row" style="margin-top:1rem">
        <label>Overall notes for this capability</label>
        <textarea id="capnote-${cap.id}" rows="2" placeholder="General observations…"></textarea>
      </div>
    </div>
  `).join("");
}

// ── Dimension Selector ───────────────────────────────────────
function buildDimensionSelector() {
  const container = document.getElementById("dimension-checkboxes");
  container.innerHTML = CONFIG.measures.map(m => `
    <label class="dimension-check-label">
      <input type="checkbox" class="dimension-check" value="${m.id}" checked
        onchange="updateDimensionVisibility()" />
      <span>${m.icon}</span> ${m.name}
    </label>
  `).join("");
}

function updateDimensionVisibility() {
  const checked = new Set(
    [...document.querySelectorAll(".dimension-check:checked")].map(el => el.value)
  );
  document.querySelectorAll(".measure-block").forEach(block => {
    block.style.display = checked.has(block.dataset.measure) ? "" : "none";
  });
}

function openAssessmentForm(id) {
  editingId = id;
  document.getElementById("assessment-form").reset();
  document.getElementById("assessment-form-title").textContent = id ? "Edit Assessment" : "New Assessment";
  setDefaultDate();

  // Default all dimension checkboxes to checked
  document.querySelectorAll(".dimension-check").forEach(cb => cb.checked = true);

  if (id) {
    const a = db.assessments.find(x => x.id === id);
    if (a) {
      document.getElementById("assessment-label").value = a.label || "";
      document.getElementById("assessment-date").value = a.date || "";
      document.getElementById("assessment-notes").value = a.notes || "";
      CONFIG.capabilities.forEach(cap => {
        document.getElementById("capnote-" + cap.id).value =
          (a.capNotes && a.capNotes[cap.id]) || "";
        CONFIG.measures.forEach(m => {
          const score = getMeasureScore(a, cap.id, m.id) || 1;
          const target = getMeasureTarget(a, cap.id, m.id) || 3;
          const note = getMeasureNote(a, cap.id, m.id) || "";
          setSlider(`score-${cap.id}-${m.id}`, score);
          setSlider(`target-${cap.id}-${m.id}`, target);
          const noteEl = document.getElementById(`note-${cap.id}-${m.id}`);
          if (noteEl) noteEl.value = note;
          updateMeasureDisplay(cap.id, m.id, score);
          updateTargetDisplay(cap.id, m.id, target);
        });
      });
      // Pre-check only dimensions that have scores in this assessment
      CONFIG.measures.forEach(m => {
        const hasScore = CONFIG.capabilities.some(cap => getMeasureScore(a, cap.id, m.id) > 0);
        const cb = document.querySelector(`.dimension-check[value="${m.id}"]`);
        if (cb) cb.checked = hasScore;
      });
    }
  } else {
    CONFIG.capabilities.forEach(cap => {
      CONFIG.measures.forEach(m => {
        setSlider(`score-${cap.id}-${m.id}`, 1);
        setSlider(`target-${cap.id}-${m.id}`, 3);
        updateMeasureDisplay(cap.id, m.id, 1);
        updateTargetDisplay(cap.id, m.id, 3);
      });
    });
  }
  updateDimensionVisibility();
  showView("assessment");
}

function setSlider(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function updateMeasureDisplay(capId, measureId, value) {
  const v = parseInt(value);
  const measure = CONFIG.measures.find(m => m.id === measureId);
  const levelLabel = measure ? (measure.levels.find(l => l.level === v) || {}).label : null;
  const lv = CONFIG.levels[v - 1];
  const el = document.getElementById(`display-${capId}-${measureId}`);
  if (el && lv) {
    el.innerHTML = `<span class="lvl-badge" style="background:${lv.color}">${v} · ${lv.name}</span>
      ${levelLabel ? `<span class="lvl-desc">${levelLabel}</span>` : ""}`;
  }
}

function updateTargetDisplay(capId, measureId, value) {
  const v = parseInt(value);
  const lv = CONFIG.levels[v - 1];
  const el = document.getElementById(`target-display-${capId}-${measureId}`);
  if (el && lv) {
    el.innerHTML = `<span class="lvl-badge target-badge" style="border-color:${lv.color};color:${lv.color}">${v} · ${lv.name}</span>`;
  }
}

// ── Save / Delete ────────────────────────────────────────────
function saveAssessment(e) {
  e.preventDefault();

  const selectedMeasures = new Set(
    [...document.querySelectorAll(".dimension-check:checked")].map(el => el.value)
  );

  // measureScores[capId][measureId] = score
  const measureScores = {}, measureTargets = {}, measureNotes = {}, capNotes = {};
  CONFIG.capabilities.forEach(cap => {
    measureScores[cap.id] = {};
    measureTargets[cap.id] = {};
    measureNotes[cap.id] = {};
    capNotes[cap.id] = document.getElementById("capnote-" + cap.id).value.trim();
    CONFIG.measures.forEach(m => {
      if (selectedMeasures.has(m.id)) {
        measureScores[cap.id][m.id] = parseInt(document.getElementById(`score-${cap.id}-${m.id}`).value);
        measureTargets[cap.id][m.id] = parseInt(document.getElementById(`target-${cap.id}-${m.id}`).value);
        measureNotes[cap.id][m.id] = document.getElementById(`note-${cap.id}-${m.id}`).value.trim();
      } else {
        measureScores[cap.id][m.id] = 0;
        measureTargets[cap.id][m.id] = 0;
        measureNotes[cap.id][m.id] = "";
      }
    });
  });

  const assessment = {
    id: editingId || Date.now().toString(),
    label: document.getElementById("assessment-label").value.trim(),
    date: document.getElementById("assessment-date").value,
    notes: document.getElementById("assessment-notes").value.trim(),
    measureScores,
    measureTargets,
    measureNotes,
    capNotes
  };

  if (editingId) {
    const idx = db.assessments.findIndex(a => a.id === editingId);
    if (idx > -1) db.assessments[idx] = assessment;
  } else {
    db.assessments.push(assessment);
  }
  db.assessments.sort((a, b) => a.date.localeCompare(b.date));
  saveToLocalStorage();
  editingId = null;
  showView("dashboard");
}

// ── Detail View ──────────────────────────────────────────────
function viewAssessment(id) {
  currentDetailId = id;
  const a = db.assessments.find(x => x.id === id);
  if (!a) return;
  document.getElementById("detail-title").textContent = `${a.label} — ${formatDate(a.date)}`;

  const content = document.getElementById("detail-content");
  const overall = overallAvg(a);
  const avgLevel = levelForScore(overall);

  // Per-capability detail rows
  const capRows = CONFIG.capabilities.map(cap => {
    const measureCells = CONFIG.measures.map(m => {
      const score = getMeasureScore(a, cap.id, m.id) || 0;
      const target = getMeasureTarget(a, cap.id, m.id) || 0;
      const note = getMeasureNote(a, cap.id, m.id) || "";
      const lv = levelForScore(score);
      const tlv = levelForScore(target);
      const mlabel = m.levels.find(l => l.level === score);
      return `
        <div class="detail-measure-cell">
          <div class="detail-measure-header">
            <span class="measure-icon-sm">${m.icon}</span>
            <span class="detail-measure-name">${m.name}</span>
          </div>
          <div class="detail-measure-scores">
            <span class="lvl-badge" style="background:${lv ? lv.color : '#555'}">${score > 0 ? score + ' · ' + lv.name : '—'}</span>
            ${target ? `<span class="arrow-sep">→</span><span class="lvl-badge target-badge" style="border-color:${tlv ? tlv.color : '#888'};color:${tlv ? tlv.color : '#888'}">${target} · ${tlv ? tlv.name : '—'}</span>` : ''}
          </div>
          ${mlabel ? `<div class="detail-measure-label">${mlabel.label}</div>` : ''}
          ${note ? `<div class="detail-cap-note">${note}</div>` : ''}
        </div>`;
    }).join("");

    const capNote = a.capNotes ? a.capNotes[cap.id] : "";
    const capAvg = capAvgScore(a, cap.id);
    const capLv = levelForScore(capAvg);

    return `
      <div class="card detail-cap-card">
        <div class="detail-cap-card-header">
          <div>
            <h3 class="detail-cap-title">${cap.name}</h3>
            ${capNote ? `<p class="detail-cap-note">${capNote}</p>` : ""}
          </div>
          <span class="lvl-badge" style="background:${capLv ? capLv.color : '#555'};font-size:.8rem">
            Avg ${capAvg > 0 ? capAvg.toFixed(1) : '—'}
          </span>
        </div>
        <div class="detail-measures-grid">${measureCells}</div>
      </div>`;
  }).join("");

  content.innerHTML = `
    <div class="dashboard-grid" style="margin-bottom:1.25rem">
      <div class="card radar-card">
        <h3 class="card-title">Maturity Radar</h3>
        <canvas id="detail-radar-canvas" width="360" height="360"></canvas>
      </div>
      <div class="card">
        <h3 class="card-title">Summary</h3>
        ${CONFIG.capabilities.map(cap => {
          const avg = capAvgScore(a, cap.id);
          const lv = levelForScore(avg);
          return `<div class="score-row">
            <span class="score-cap-name" title="${cap.name}">${shortName(cap.name)}</span>
            <div class="score-bar-wrap">
              <div class="score-bar" style="width:${(avg/5)*100}%;background:${lv ? lv.color : '#ccc'}"></div>
            </div>
            <span class="score-badge" style="background:${lv ? lv.color : '#555'}">${avg > 0 ? avg.toFixed(1) + ' · ' + lv.name : '—'}</span>
          </div>`;
        }).join("")}
        <div class="avg-score">
          <span class="avg-label">Overall</span>
          <span class="avg-value" style="color:${avgLevel ? avgLevel.color : '#fff'}">${overall.toFixed(1)} / 5</span>
          <span class="avg-level-name">${avgLevel ? avgLevel.name : ''}</span>
        </div>
        ${a.notes ? `<p style="margin-top:.75rem;font-size:.85rem;color:var(--text-muted);border-top:1px solid var(--border);padding-top:.75rem">${a.notes}</p>` : ''}
      </div>
    </div>
    ${capRows}`;

  showView("detail");
  setTimeout(() => renderRadar("detail-radar-canvas", a), 60);
}

function deleteCurrentAssessment() {
  if (!currentDetailId) return;
  if (!confirm("Delete this assessment? This cannot be undone.")) return;
  db.assessments = db.assessments.filter(a => a.id !== currentDetailId);
  saveToLocalStorage();
  currentDetailId = null;
  showView("dashboard");
}

function copyAssessment(id) {
  const source = db.assessments.find(a => a.id === id);
  if (!source) return;

  editingId = null;
  document.getElementById("assessment-form").reset();
  document.getElementById("assessment-form-title").textContent = "New Assessment";
  document.getElementById("assessment-label").value = "";
  document.getElementById("assessment-date").value = new Date().toISOString().slice(0, 10);
  document.getElementById("assessment-notes").value = source.notes || "";

  // Pre-check dimensions that had scores in the source
  document.querySelectorAll(".dimension-check").forEach(cb => cb.checked = true);
  CONFIG.measures.forEach(m => {
    const hasScore = CONFIG.capabilities.some(cap => getMeasureScore(source, cap.id, m.id) > 0);
    const cb = document.querySelector(`.dimension-check[value="${m.id}"]`);
    if (cb) cb.checked = hasScore;
  });

  // Load all scores, targets and notes from the source assessment
  CONFIG.capabilities.forEach(cap => {
    document.getElementById("capnote-" + cap.id).value = (source.capNotes && source.capNotes[cap.id]) || "";
    CONFIG.measures.forEach(m => {
      const score = getMeasureScore(source, cap.id, m.id) || 1;
      const target = getMeasureTarget(source, cap.id, m.id) || 3;
      const note = getMeasureNote(source, cap.id, m.id) || "";
      setSlider(`score-${cap.id}-${m.id}`, score);
      setSlider(`target-${cap.id}-${m.id}`, target);
      const noteEl = document.getElementById(`note-${cap.id}-${m.id}`);
      if (noteEl) noteEl.value = note;
      updateMeasureDisplay(cap.id, m.id, score);
      updateTargetDisplay(cap.id, m.id, target);
    });
  });

  updateDimensionVisibility();
  showView("assessment");
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
        if (confirm(`Import ${imported.assessments.length} assessment(s)? Existing records with the same ID will be skipped.`)) {
          imported.assessments.forEach(a => {
            if (!db.assessments.find(x => x.id === a.id)) db.assessments.push(a);
          });
          db.assessments.sort((a, b) => a.date.localeCompare(b.date));
          saveToLocalStorage();
          renderDashboard();
          alert("Import successful!");
        }
      } else {
        alert("Invalid file: expected an object with an 'assessments' array.");
      }
    } catch { alert("Could not parse the JSON file. Please check it is valid."); }
  };
  reader.readAsText(file);
  e.target.value = "";
}

// ── Data Helpers ─────────────────────────────────────────────
function getMeasureScore(assessment, capId, measureId) {
  return assessment.measureScores && assessment.measureScores[capId]
    ? assessment.measureScores[capId][measureId] || 0
    : 0;
}

function getMeasureTarget(assessment, capId, measureId) {
  return assessment.measureTargets && assessment.measureTargets[capId]
    ? assessment.measureTargets[capId][measureId] || 0
    : 0;
}

function getMeasureNote(assessment, capId, measureId) {
  return assessment.measureNotes && assessment.measureNotes[capId]
    ? assessment.measureNotes[capId][measureId] || ""
    : "";
}

// Average of all measure scores for a capability
function capAvgScore(assessment, capId) {
  const vals = CONFIG.measures.map(m => getMeasureScore(assessment, capId, m.id)).filter(v => v > 0);
  return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 0;
}

// Overall average across all capabilities and measures
function overallAvg(assessment) {
  const vals = CONFIG.capabilities.flatMap(cap =>
    CONFIG.measures.map(m => getMeasureScore(assessment, cap.id, m.id))
  ).filter(v => v > 0);
  return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 0;
}

function levelForScore(score) {
  if (!score || score < 1) return null;
  return CONFIG.levels[Math.round(score) - 1] || CONFIG.levels[CONFIG.levels.length - 1];
}

// ── UI Helpers ───────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function shortName(name) {
  return name
    .replace("ICT ", "")
    .replace("Management", "Mgmt")
    .replace("Performance & Capacity", "Perf & Cap")
    .replace("Disaster Recovery", "DR");
}

function setDefaultDate() {
  const el = document.getElementById("assessment-date");
  if (el && !el.value) el.value = new Date().toISOString().slice(0, 10);
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
