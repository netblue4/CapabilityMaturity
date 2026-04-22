// ============================================================
// app.js — ICT Capability Maturity Tracker
// Loads config from config.json, stores data in localStorage
// with JSON export/import as the user's portable database.
// ============================================================

let CONFIG = null;
let db = { assessments: [] };
let editingId = null;
let currentDetailId = null;
let animationFrameId = null;

const RISK_COLORS = {
  'Critical': '#e74c3c', 'High': '#e67e22', 'Medium': '#f1c40f', 'Low': '#2ecc71',
  'Exceeds Appetite': '#e74c3c', 'Within Appetite': '#2ecc71',
  'Not Assessed': '#e74c3c', 'Partially Effective': '#e67e22', 'Effective': '#2ecc71'
};

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
  stopRadarAnimation();
  const hasData = db.assessments.length > 0;
  document.getElementById("no-data-message").style.display = hasData ? "none" : "flex";
  document.getElementById("dashboard-content").style.display = hasData ? "block" : "none";
  if (!hasData) return;

  const latest = db.assessments[db.assessments.length - 1];
  buildAssessmentFilter();
  renderRadar("radar-chart", null, getSelectedRadarCaps(), getSelectedAssessments());
  renderMeasureSummary(latest);
  renderRiskProfileSummary(latest);
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
      <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-bottom:.35rem">
        <span style="font-size:.65rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);min-width:100px;text-align:center">Score</span>
        <span style="font-size:.65rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);width:36px;text-align:center">Target</span>
      </div>
      ${CONFIG.capabilities.map(cap => {
        const avg = capAvgScore(assessment, cap.id);
        const lv = levelForScore(avg);
        const targets = CONFIG.measures.map(m => getMeasureTarget(assessment, cap.id, m.id)).filter(t => t > 0);
        const targetAvg = targets.length ? Math.round(targets.reduce((a,b) => a+b,0) / targets.length) : 0;
        const tlv = levelForScore(targetAvg);
        return `<div class="score-row">
          <span class="score-cap-name" title="${cap.name}">${shortName(cap.name)}</span>
          <div class="score-bar-wrap">
            <div class="score-bar" style="width:${(avg/5)*100}%;background:${lv ? lv.color : '#ccc'}"></div>
          </div>
          <span class="score-badge" style="background:${lv ? lv.color : '#555'}">${avg > 0 ? avg.toFixed(1) + ' · ' + lv.name : '—'}</span>
          <span class="score-target-badge">${targetAvg > 0 ? `<span class="lvl-badge target-badge" style="border-color:${tlv ? tlv.color : '#555'};color:${tlv ? tlv.color : '#555'};min-width:0;padding:.15rem .45rem">${targetAvg}</span>` : '<span style="color:var(--text-muted)">—</span>'}</span>
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

  document.getElementById("scores-card-slot").innerHTML = scoresCard;
  row.innerHTML = measureCards;
}

// ── Risk Profile Summary Table ────────────────────────────────
function renderRiskProfileSummary(assessment) {
  const container = document.getElementById("risk-profile-summary");
  if (!container) return;

  const riskMeasure = CONFIG.measures.find(m => m.type === 'risk_profile');
  if (!riskMeasure) { container.innerHTML = ''; return; }

  // Find the previous assessment for score comparison
  const idx = db.assessments.indexOf(assessment);
  const prevAssessment = idx > 0 ? db.assessments[idx - 1] : null;

  const capsWithData = CONFIG.capabilities.filter(cap => {
    const raw = assessment.measureScores?.[cap.id]?.[riskMeasure.id];
    return raw && typeof raw === 'object' && (raw.residualRating || raw.appetiteStatus || raw.controlCounts || raw.controlEffectiveness);
  });

  if (capsWithData.length === 0) { container.innerHTML = ''; return; }

  const rows = CONFIG.capabilities.map(cap => {
    const raw = assessment.measureScores?.[cap.id]?.[riskMeasure.id];
    const rd = (raw && typeof raw === 'object') ? raw : null;
    const score     = getMeasureScore(assessment, cap.id, riskMeasure.id);
    const prevScore = prevAssessment ? getMeasureScore(prevAssessment, cap.id, riskMeasure.id) : 0;
    const lv = levelForScore(score);

    const residualStyle = rd?.residualRating ? `color:${RISK_COLORS[rd.residualRating]};font-weight:600` : '';
    const appetiteStyle = rd?.appetiteStatus ? `color:${RISK_COLORS[rd.appetiteStatus]}` : '';
    const note = assessment.measureNotes?.[cap.id]?.[riskMeasure.id] || '';
    const cc = rd?.controlCounts;
    const derivedCtrl = cc
      ? (cc.derivedRating || deriveControlRating(cc.notAssessed || 0, cc.partial || 0, cc.effective || 0))
      : (rd?.controlEffectiveness || null);
    const ctrlColor = RISK_COLORS[derivedCtrl] || '#8b949e';
    const ctrlBadge = derivedCtrl
      ? `<span class="lvl-badge" style="background:${ctrlColor}">${derivedCtrl}</span>`
      : '—';
    const tallyHtml = cc && (cc.notAssessed || cc.partial || cc.effective)
      ? `<span class="control-tally"><span style="color:#2ecc71">✓ ${cc.effective || 0}</span><span style="color:#e67e22">◑ ${cc.partial || 0}</span><span style="color:#e74c3c">○ ${cc.notAssessed || 0}</span></span>`
      : '—';

    let deltaHtml = '';
    if (score > 0 && prevScore > 0) {
      if (score > prevScore)      deltaHtml = `<span class="trend-icon trend-up" title="Improved from ${prevScore}">▲</span>`;
      else if (score < prevScore) deltaHtml = `<span class="trend-icon trend-down" title="Degraded from ${prevScore}">▼</span>`;
      else                        deltaHtml = `<span class="trend-icon trend-flat" title="No change">→</span>`;
    }

    return `
      <tr>
        <td class="rpt-cap-name">${shortName(cap.name)}</td>
        <td class="rpt-cell" style="${residualStyle}">${rd?.residualRating || '—'}</td>
        <td class="rpt-cell" style="${appetiteStyle}">${rd?.appetiteStatus || '—'}</td>
        <td class="rpt-cell">${ctrlBadge}</td>
        <td class="rpt-cell">${tallyHtml}</td>
        <td class="rpt-cell">${rd?.openRisks !== undefined && rd?.openRisks !== null ? rd.openRisks : '—'}</td>
        <td class="rpt-cell">${score > 0 ? `<span class="lvl-badge" style="background:${lv ? lv.color : '#555'}">${score} · ${lv ? lv.name : ''}</span>${deltaHtml}` : '—'}</td>
        <td class="rpt-notes-cell">${note || '—'}</td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="card" style="margin-bottom:1.25rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">
        <h3 class="card-title" style="margin-bottom:0">Risk Profile Summary — ${assessment.label}</h3>
        <button class="btn-link ratings-link" style="margin-bottom:0" onclick="showRiskMatrixModal()">ℹ Ratings</button>
      </div>
      <div style="overflow-x:auto">
        <table class="risk-profile-table">
          <thead>
            <tr>
              <th>Capability</th>
              <th>Residual Risk</th>
              <th>Appetite Status</th>
              <th>Controls</th>
              <th>Control Counts</th>
              <th>Open Risks</th>
              <th>Score ${prevAssessment ? `<span class="rpt-vs-label">vs ${prevAssessment.label}</span>` : ''}</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
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

function showRiskMatrixModal() {
  const residuals = CONFIG.riskProfile?.residualRating || [];
  const appetites = CONFIG.riskProfile?.appetiteStatus || [];
  const ctrls     = CONFIG.riskProfile?.controlEffectiveness || [];

  let tableRows = '';
  residuals.forEach(res => {
    tableRows += `
      <tr style="background:var(--bg3)">
        <td colspan="4" style="padding:.4rem .7rem;font-family:var(--font-mono);font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text)">${res}</td>
      </tr>`;
    appetites.forEach(app => {
      ctrls.forEach(ctrl => {
        const baseScore = CONFIG.riskScoreMatrix?.[res]?.[app]?.[ctrl] || 0;
        const lv = levelForScore(baseScore);
        const badge = baseScore > 0
          ? `<span class="lvl-badge" style="background:${lv ? lv.color : '#555'}">${baseScore} · ${lv ? lv.name : ''}</span>`
          : '—';
        tableRows += `
          <tr>
            <td style="padding:.4rem .7rem;font-size:.8rem"></td>
            <td style="padding:.4rem .7rem;font-size:.8rem;color:var(--text-muted)">${app}</td>
            <td style="padding:.4rem .7rem;font-size:.8rem">${ctrl}</td>
            <td style="padding:.4rem .7rem">${badge}</td>
          </tr>`;
      });
    });
  });

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:640px">
      <div class="modal-header">
        <h3>Risk Profile Score Calculation</h3>
        <button class="modal-close" id="risk-matrix-modal-close">✕</button>
      </div>
      <p class="modal-desc">Scores are auto-calculated from Residual Risk Rating, Risk Appetite Status and a derived Control Effectiveness rating. The derived rating is calculated from control counts: 80%+ effective = Effective, 1–79% effective = Partially Effective, 0% effective or no controls entered = Not Assessed. Modifiers: Open Risks ≥5 reduces score by 1. Open Risks ≥10 reduces score by 2. More than 50% of controls Not Assessed reduces score by 1. Minimum score is 1.</p>
      <div style="overflow-x:auto">
        <table class="risk-profile-table">
          <thead>
            <tr>
              <th>Residual Risk</th>
              <th>Appetite Status</th>
              <th>Control Effectiveness</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#risk-matrix-modal-close').addEventListener('click', () => overlay.remove());
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
          <button class="btn-link btn-link-danger" onclick="deleteAssessment('${a.id}')">Delete</button>
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
function buildMeasureBlock(cap, m) {
  if (m.type === 'risk_profile') {
    return `
      <div class="measure-block" data-measure="${m.id}" style="--m-color:${m.color}">
        <div class="measure-block-header">
          <span class="measure-icon-sm">${m.icon}</span>
          <span class="measure-block-name">${m.name}</span>
        </div>
        <p class="measure-block-desc">${m.description}</p>

        <input type="hidden" id="risk-residual-${cap.id}" value="">
        <input type="hidden" id="risk-appetite-${cap.id}" value="">

        <div class="form-row" style="margin-top:.5rem">
          <label>Residual Risk Rating</label>
          <div class="risk-btn-group" id="risk-group-residual-${cap.id}">
            <button type="button" class="risk-btn" data-value="Critical"
              onclick="selectRiskBtn(this,'${cap.id}','residual')" style="--risk-color:#e74c3c">Critical</button>
            <button type="button" class="risk-btn" data-value="High"
              onclick="selectRiskBtn(this,'${cap.id}','residual')" style="--risk-color:#e67e22">High</button>
            <button type="button" class="risk-btn" data-value="Medium"
              onclick="selectRiskBtn(this,'${cap.id}','residual')" style="--risk-color:#f1c40f">Medium</button>
            <button type="button" class="risk-btn" data-value="Low"
              onclick="selectRiskBtn(this,'${cap.id}','residual')" style="--risk-color:#2ecc71">Low</button>
          </div>
        </div>

        <div class="form-row" style="margin-top:.35rem">
          <label>Risk Appetite Status</label>
          <div class="risk-btn-group" id="risk-group-appetite-${cap.id}">
            <button type="button" class="risk-btn" data-value="Exceeds Appetite"
              onclick="selectRiskBtn(this,'${cap.id}','appetite')" style="--risk-color:#e74c3c">Exceeds Appetite</button>
            <button type="button" class="risk-btn" data-value="Within Appetite"
              onclick="selectRiskBtn(this,'${cap.id}','appetite')" style="--risk-color:#2ecc71">Within Appetite</button>
          </div>
        </div>

        <div class="form-row" style="margin-top:.35rem">
          <label>Control Effectiveness</label>
          <div class="control-counts-row">
            <div class="control-count-field">
              <span class="control-count-label" style="color:#e74c3c">Not Assessed</span>
              <input type="number" class="control-count-input" id="controls-not-assessed-${cap.id}"
                min="0" step="1" value="0"
                oninput="updateControlCountsDisplay('${cap.id}')">
            </div>
            <div class="control-count-field">
              <span class="control-count-label" style="color:#e67e22">Partially Effective</span>
              <input type="number" class="control-count-input" id="controls-partial-${cap.id}"
                min="0" step="1" value="0"
                oninput="updateControlCountsDisplay('${cap.id}')">
            </div>
            <div class="control-count-field">
              <span class="control-count-label" style="color:#2ecc71">Effective</span>
              <input type="number" class="control-count-input" id="controls-effective-${cap.id}"
                min="0" step="1" value="0"
                oninput="updateControlCountsDisplay('${cap.id}')">
            </div>
          </div>
          <div id="derived-ctrl-display-${cap.id}" class="derived-rating-display">
            <span style="color:var(--text-muted);font-style:italic">— Enter control counts above</span>
          </div>
        </div>

        <div class="form-row" style="margin-top:.35rem">
          <label>Open Risks</label>
          <input type="number" id="risk-openrisks-${cap.id}" min="0" step="1" value="0"
            style="width:90px" oninput="updateRiskScoreDisplay('${cap.id}')">
        </div>

        <div id="risk-score-display-${cap.id}" class="risk-score-display">
          <span style="color:var(--text-muted);font-size:.8rem">Select all options to calculate score</span>
        </div>

        <div class="form-row" style="margin-top:.75rem">
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
      </div>`;
  }

  // Standard slider block
  return `
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
    </div>`;
}

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
        ${CONFIG.measures.map(m => buildMeasureBlock(cap, m)).join("")}
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
          if (m.type === 'risk_profile') {
            const raw = a.measureScores?.[cap.id]?.[m.id];
            const riskData = (raw && typeof raw === 'object') ? raw : null;
            if (riskData) populateRiskProfileFields(cap.id, riskData);
            else resetRiskProfileFields(cap.id);
            const target = getMeasureTarget(a, cap.id, m.id) || 3;
            const note = getMeasureNote(a, cap.id, m.id) || "";
            setSlider(`target-${cap.id}-${m.id}`, target);
            const noteEl = document.getElementById(`note-${cap.id}-${m.id}`);
            if (noteEl) noteEl.value = note;
            updateTargetDisplay(cap.id, m.id, target);
          } else {
            const score = getMeasureScore(a, cap.id, m.id) || 1;
            const target = getMeasureTarget(a, cap.id, m.id) || 3;
            const note = getMeasureNote(a, cap.id, m.id) || "";
            setSlider(`score-${cap.id}-${m.id}`, score);
            setSlider(`target-${cap.id}-${m.id}`, target);
            const noteEl = document.getElementById(`note-${cap.id}-${m.id}`);
            if (noteEl) noteEl.value = note;
            updateMeasureDisplay(cap.id, m.id, score);
            updateTargetDisplay(cap.id, m.id, target);
          }
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
        if (m.type === 'risk_profile') {
          resetRiskProfileFields(cap.id);
          setSlider(`target-${cap.id}-${m.id}`, 3);
          updateTargetDisplay(cap.id, m.id, 3);
        } else {
          setSlider(`score-${cap.id}-${m.id}`, 1);
          setSlider(`target-${cap.id}-${m.id}`, 3);
          updateMeasureDisplay(cap.id, m.id, 1);
          updateTargetDisplay(cap.id, m.id, 3);
        }
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

// ── Risk Profile Helpers ─────────────────────────────────────
function selectRiskBtn(btn, capId, field) {
  const group = btn.closest('.risk-btn-group');
  group.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const el = document.getElementById(`risk-${field}-${capId}`);
  if (el) el.value = btn.dataset.value;
  updateRiskScoreDisplay(capId);
}

function deriveControlRating(na, partial, effective) {
  const total = na + partial + effective;
  if (total === 0) return 'Not Assessed';
  const effectivePct = (effective / total) * 100;
  if (effectivePct >= 80) return 'Effective';
  if (effectivePct >= 1)  return 'Partially Effective';
  return 'Not Assessed';
}

function updateControlCountsDisplay(capId) {
  const na      = parseInt(document.getElementById(`controls-not-assessed-${capId}`)?.value) || 0;
  const partial = parseInt(document.getElementById(`controls-partial-${capId}`)?.value) || 0;
  const eff     = parseInt(document.getElementById(`controls-effective-${capId}`)?.value) || 0;
  const total   = na + partial + eff;
  const derived = deriveControlRating(na, partial, eff);
  const el = document.getElementById(`derived-ctrl-display-${capId}`);
  if (el) {
    if (total === 0) {
      el.innerHTML = `<span style="color:var(--text-muted);font-style:italic">— Enter control counts above</span>`;
    } else {
      const effPct = Math.round((eff / total) * 100);
      const color  = RISK_COLORS[derived] || '#888';
      el.innerHTML = `<span style="color:var(--text-muted)">Total: ${total} · ${effPct}% effective</span>
        <span class="lvl-badge" style="background:${color}">${derived}</span>`;
    }
  }
  updateRiskScoreDisplay(capId);
}

function ctrlEffectivenessBadgeHtml(rd) {
  if (!rd) return '';
  const cc = rd.controlCounts;
  const derived = cc
    ? (cc.derivedRating || deriveControlRating(cc.notAssessed || 0, cc.partial || 0, cc.effective || 0))
    : rd.controlEffectiveness;
  if (!derived) return '';
  const color = RISK_COLORS[derived] || '#888';
  const tally = cc
    ? ` <span style="opacity:.7;font-size:.85em">(✓${cc.effective || 0} ◑${cc.partial || 0} ○${cc.notAssessed || 0})</span>`
    : '';
  return `<span class="risk-detail-badge" style="--risk-color:${color}">${derived}${tally}</span>`;
}

function updateRiskScoreDisplay(capId) {
  const el = document.getElementById(`risk-score-display-${capId}`);
  if (!el) return;
  const score = calcRiskScore(capId);
  if (score === 0) {
    el.innerHTML = `<span style="color:var(--text-muted);font-size:.8rem">Select all options to calculate score</span>`;
    return;
  }
  const lv = levelForScore(score);
  el.innerHTML = `<span class="risk-score-label">Calculated Score:</span>
    <span class="lvl-badge" style="background:${lv ? lv.color : '#555'}">${score} · ${lv ? lv.name : ''}</span>`;
}

function calcRiskScore(capId) {
  const residual  = document.getElementById(`risk-residual-${capId}`)?.value;
  const appetite  = document.getElementById(`risk-appetite-${capId}`)?.value;
  if (!residual || !appetite) return 0;

  const na        = parseInt(document.getElementById(`controls-not-assessed-${capId}`)?.value) || 0;
  const partial   = parseInt(document.getElementById(`controls-partial-${capId}`)?.value) || 0;
  const eff       = parseInt(document.getElementById(`controls-effective-${capId}`)?.value) || 0;
  const total     = na + partial + eff;
  const openRisks = parseInt(document.getElementById(`risk-openrisks-${capId}`)?.value) || 0;

  const derived = deriveControlRating(na, partial, eff);
  let score = CONFIG.riskScoreMatrix?.[residual]?.[appetite]?.[derived] || 0;
  if (score === 0) return 0;

  if (openRisks >= 10)     score -= 2;
  else if (openRisks >= 5) score -= 1;

  if (total > 0 && (na / total) > 0.5) score -= 1;

  return Math.min(5, Math.max(1, score));
}

function populateRiskProfileFields(capId, riskData) {
  ['residual', 'appetite'].forEach(field => {
    const value = field === 'residual' ? riskData.residualRating : riskData.appetiteStatus;
    const hidden = document.getElementById(`risk-${field}-${capId}`);
    if (hidden) hidden.value = value || '';
    document.querySelectorAll(`#risk-group-${field}-${capId} .risk-btn`)
      .forEach(b => b.classList.toggle('selected', b.dataset.value === value));
  });

  let na = 0, partial = 0, eff = 0;
  if (riskData.controlCounts) {
    na      = riskData.controlCounts.notAssessed ?? 0;
    partial = riskData.controlCounts.partial      ?? 0;
    eff     = riskData.controlCounts.effective    ?? 0;
  } else if (riskData.controlEffectiveness) {
    console.info(`Legacy controlEffectiveness data detected for capability ${capId} — control counts set to 0.`);
  }
  const naEl = document.getElementById(`controls-not-assessed-${capId}`);
  const partialEl = document.getElementById(`controls-partial-${capId}`);
  const effEl = document.getElementById(`controls-effective-${capId}`);
  if (naEl)      naEl.value      = na;
  if (partialEl) partialEl.value = partial;
  if (effEl)     effEl.value     = eff;

  const openEl = document.getElementById(`risk-openrisks-${capId}`);
  if (openEl) openEl.value = riskData.openRisks ?? 0;
  updateControlCountsDisplay(capId);
}

function resetRiskProfileFields(capId) {
  ['residual', 'appetite'].forEach(field => {
    const el = document.getElementById(`risk-${field}-${capId}`);
    if (el) el.value = '';
    document.querySelectorAll(`#risk-group-${field}-${capId} .risk-btn`)
      .forEach(b => b.classList.remove('selected'));
  });
  const naEl = document.getElementById(`controls-not-assessed-${capId}`);
  const partialEl = document.getElementById(`controls-partial-${capId}`);
  const effEl = document.getElementById(`controls-effective-${capId}`);
  if (naEl)      naEl.value      = 0;
  if (partialEl) partialEl.value = 0;
  if (effEl)     effEl.value     = 0;
  const openEl = document.getElementById(`risk-openrisks-${capId}`);
  if (openEl) openEl.value = 0;
  updateControlCountsDisplay(capId);
}

// ── Save / Delete ────────────────────────────────────────────
function saveAssessment(e) {
  e.preventDefault();

  const selectedMeasures = new Set(
    [...document.querySelectorAll(".dimension-check:checked")].map(el => el.value)
  );

  // measureScores[capId][measureId] = score (or risk profile object)
  const measureScores = {}, measureTargets = {}, measureNotes = {}, capNotes = {};
  CONFIG.capabilities.forEach(cap => {
    measureScores[cap.id] = {};
    measureTargets[cap.id] = {};
    measureNotes[cap.id] = {};
    capNotes[cap.id] = document.getElementById("capnote-" + cap.id).value.trim();
    CONFIG.measures.forEach(m => {
      if (selectedMeasures.has(m.id)) {
        if (m.type === 'risk_profile') {
          const residual  = document.getElementById(`risk-residual-${cap.id}`)?.value || '';
          const appetite  = document.getElementById(`risk-appetite-${cap.id}`)?.value || '';
          const na        = parseInt(document.getElementById(`controls-not-assessed-${cap.id}`)?.value) || 0;
          const partial   = parseInt(document.getElementById(`controls-partial-${cap.id}`)?.value) || 0;
          const eff       = parseInt(document.getElementById(`controls-effective-${cap.id}`)?.value) || 0;
          const openRisks = parseInt(document.getElementById(`risk-openrisks-${cap.id}`)?.value) || 0;
          const derivedRating = deriveControlRating(na, partial, eff);
          const score = calcRiskScore(cap.id);
          measureScores[cap.id][m.id] = (residual || appetite || na || partial || eff)
            ? { score, residualRating: residual, appetiteStatus: appetite,
                controlCounts: { notAssessed: na, partial, effective: eff, derivedRating },
                openRisks }
            : 0;
        } else {
          measureScores[cap.id][m.id] = parseInt(document.getElementById(`score-${cap.id}-${m.id}`).value);
        }
        measureTargets[cap.id][m.id] = parseInt(document.getElementById(`target-${cap.id}-${m.id}`).value);
        measureNotes[cap.id][m.id]   = document.getElementById(`note-${cap.id}-${m.id}`).value.trim();
      } else {
        measureScores[cap.id][m.id]  = 0;
        measureTargets[cap.id][m.id] = 0;
        measureNotes[cap.id][m.id]   = "";
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
      const score  = getMeasureScore(a, cap.id, m.id) || 0;
      const target = getMeasureTarget(a, cap.id, m.id) || 0;
      const note   = getMeasureNote(a, cap.id, m.id) || "";
      const lv     = levelForScore(score);
      const tlv    = levelForScore(target);

      if (m.type === 'risk_profile') {
        const raw    = a.measureScores?.[cap.id]?.[m.id];
        const rd     = (raw && typeof raw === 'object') ? raw : null;
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
            ${rd ? `
              <div class="risk-detail-fields">
                ${rd.residualRating ? `<span class="risk-detail-badge" style="--risk-color:${RISK_COLORS[rd.residualRating] || '#888'}">${rd.residualRating} Risk</span>` : ''}
                ${rd.appetiteStatus ? `<span class="risk-detail-badge" style="--risk-color:${RISK_COLORS[rd.appetiteStatus] || '#888'}">${rd.appetiteStatus}</span>` : ''}
                ${ctrlEffectivenessBadgeHtml(rd)}
                ${rd.openRisks !== undefined && rd.openRisks !== null ? `<span class="risk-detail-badge" style="--risk-color:#8b949e">${rd.openRisks} Open ${rd.openRisks === 1 ? 'Risk' : 'Risks'}</span>` : ''}
              </div>` : ''}
            ${note ? `<div class="detail-cap-note">${note}</div>` : ''}
          </div>`;
      }

      // Standard measure cell
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
    const capAvg  = capAvgScore(a, cap.id);
    const capLv   = levelForScore(capAvg);

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

function deleteAssessment(id) {
  if (!confirm("Delete this assessment? This cannot be undone.")) return;
  db.assessments = db.assessments.filter(a => a.id !== id);
  saveToLocalStorage();
  renderHistory();
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
      if (m.type === 'risk_profile') {
        const raw = source.measureScores?.[cap.id]?.[m.id];
        const riskData = (raw && typeof raw === 'object') ? raw : null;
        if (riskData) populateRiskProfileFields(cap.id, riskData);
        else resetRiskProfileFields(cap.id);
        const target = getMeasureTarget(source, cap.id, m.id) || 3;
        const note   = getMeasureNote(source, cap.id, m.id) || "";
        setSlider(`target-${cap.id}-${m.id}`, target);
        const noteEl = document.getElementById(`note-${cap.id}-${m.id}`);
        if (noteEl) noteEl.value = note;
        updateTargetDisplay(cap.id, m.id, target);
      } else {
        const score  = getMeasureScore(source, cap.id, m.id) || 1;
        const target = getMeasureTarget(source, cap.id, m.id) || 3;
        const note   = getMeasureNote(source, cap.id, m.id) || "";
        setSlider(`score-${cap.id}-${m.id}`, score);
        setSlider(`target-${cap.id}-${m.id}`, target);
        const noteEl = document.getElementById(`note-${cap.id}-${m.id}`);
        if (noteEl) noteEl.value = note;
        updateMeasureDisplay(cap.id, m.id, score);
        updateTargetDisplay(cap.id, m.id, target);
      }
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
  if (!assessment.measureScores || !assessment.measureScores[capId]) return 0;
  const val = assessment.measureScores[capId][measureId];
  if (val && typeof val === 'object') return val.score || 0;
  return val || 0;
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

// ── Radar Animation ──────────────────────────────────────────
function toggleRadarAnimation() {
  if (animationFrameId) {
    stopRadarAnimation();
  } else {
    startRadarAnimation();
  }
}

function startRadarAnimation() {
  if (db.assessments.length < 2) return;
  const btn = document.getElementById("btn-animate-radar");
  if (btn) { btn.textContent = "⏹ Stop"; btn.classList.add("active"); }

  const caps = getSelectedRadarCaps();
  const assessments = db.assessments; // already sorted chronologically
  const canvas = document.getElementById("radar-chart");
  const HOLD_MS = 1500;
  const TRANS_MS = 700;
  const CYCLE_MS = HOLD_MS + TRANS_MS;
  let startTime = null;

  function frame(ts) {
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    const total = assessments.length * CYCLE_MS;
    const t = elapsed % total;
    const idx = Math.floor(t / CYCLE_MS);
    const cycleT = t % CYCLE_MS;
    const curr = assessments[idx];
    const next = assessments[(idx + 1) % assessments.length];

    if (cycleT < HOLD_MS) {
      renderRadar("radar-chart", null, caps, [curr]);
      drawAnimLabel(curr.label, formatDate(curr.date), 1);
    } else {
      const p = easeInOut((cycleT - HOLD_MS) / TRANS_MS);
      renderRadar("radar-chart", null, caps, [interpolateAssessment(curr, next, p)]);
      if (p < 0.5) {
        drawAnimLabel(curr.label, formatDate(curr.date), 1 - p * 2);
      } else {
        drawAnimLabel(next.label, formatDate(next.date), (p - 0.5) * 2);
      }
    }
    animationFrameId = requestAnimationFrame(frame);
  }
  animationFrameId = requestAnimationFrame(frame);
}

function stopRadarAnimation() {
  if (!animationFrameId) return;
  cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  const btn = document.getElementById("btn-animate-radar");
  if (btn) { btn.textContent = "▶ All"; btn.classList.remove("active"); }
  const lbl = document.getElementById("radar-anim-label");
  if (lbl) { lbl.style.display = "none"; lbl.innerHTML = ""; }
}

function interpolateAssessment(fromA, toA, t) {
  const measureScores = {};
  CONFIG.capabilities.forEach(cap => {
    measureScores[cap.id] = {};
    CONFIG.measures.forEach(m => {
      const f = getMeasureScore(fromA, cap.id, m.id) || 0;
      const s = getMeasureScore(toA, cap.id, m.id) || 0;
      measureScores[cap.id][m.id] = f + (s - f) * t;
    });
  });
  return { id: "_anim", measureScores };
}

function drawAnimLabel(label, date, opacity) {
  const el = document.getElementById("radar-anim-label");
  if (!el) return;
  if (opacity <= 0) {
    el.style.opacity = 0;
    return;
  }
  el.style.display = "flex";
  el.style.opacity = opacity;
  el.innerHTML = `<span class="radar-anim-title">${label}</span><span class="radar-anim-date">${date}</span>`;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
