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
    if (migrateRemovedMeasures(db)) saveToLocalStorage();
  } catch (e) { console.warn("Could not load localStorage", e); }
}

// One-time cleanup: the maturity-slider model (Governance/Risk/Reporting
// dimensions, targets, notes, time-estimates, per-capability notes) was
// removed. Governance is now derived from the policy upload's Document Status.
// Keep only measureScores[cap].riskManagement (from the Riskonnect import);
// strip everything else so no dormant data lingers.
function migrateRemovedMeasures(database) {
  let changed = false;
  (database?.assessments || []).forEach(a => {
    if (a.measureScores) {
      Object.keys(a.measureScores).forEach(capId => {
        const entry = a.measureScores[capId];
        if (!entry || typeof entry !== 'object') return;
        Object.keys(entry).forEach(k => {
          if (k !== 'riskManagement') { delete entry[k]; changed = true; }
        });
      });
    }
    ['measureTargets', 'measureNotes', 'measureTimeEstimates', 'capNotes', 'notes', 'riskProfile', 'weeksToNext'].forEach(k => {
      if (k in a) { delete a[k]; changed = true; }
    });
  });
  return changed;
}

function saveToLocalStorage() {
  try {
    localStorage.setItem("ict_maturity_db", JSON.stringify(db));
  } catch (e) {
    console.error("Could not save to localStorage", e);
    alert("Warning: could not save data to browser storage. Your data may not persist after a page reload.\n\n" + e.message);
  }
}

// ── Events ───────────────────────────────────────────────────
function bindEvents() {
  document.getElementById("btn-new-assessment").addEventListener("click", () => openAssessmentForm(null));
  document.getElementById("btn-back").addEventListener("click", () => showView("dashboard"));
  document.getElementById("btn-cancel").addEventListener("click", () => showView("dashboard"));
  document.getElementById("btn-export").addEventListener("click", exportJSON);
  document.getElementById("import-file").addEventListener("change", importJSON);
  document.getElementById("assessment-form").addEventListener("submit", saveAssessment);
}

// ── Views ────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  if (name === "dashboard") renderDashboard();
}
