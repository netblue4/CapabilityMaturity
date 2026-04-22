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
