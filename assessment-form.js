// ── Risk Rating Button Builder ────────────────────────────────
function buildRiskRatingBtns(capId, field) {
  const keys = Object.keys(CONFIG.riskScoreMatrix || {});
  return keys.map((key, i) => {
    const color = CONFIG.levels[i]?.color || 'var(--clr-fill-muted)';
    return `<button type="button" class="risk-btn" data-value="${key}"
      style="--risk-color:${color}"
      onclick="toggleRiskRatingBtn(this,'${capId}','${field}')">${key}</button>`;
  }).join('');
}

// ── Assessment Form — Build ───────────────────────────────────
function buildMeasureBlock(cap, m) {
  // Maturity slider block (Governance)
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
        <label>TIME ESTIMATE</label>
        <textarea id="timeest-${cap.id}-${m.id}" rows="2"
          placeholder="Describe how long you estimate it will take to reach the next maturity level for ${m.name}…"></textarea>
      </div>

      <div class="form-row" style="margin-top:.5rem">
        <label>Notes</label>
        <textarea id="note-${cap.id}-${m.id}" rows="2"
          placeholder="${m.name} observations for ${cap.name}…"></textarea>
      </div>
    </div>`;
}

// ── Card: Uploaded Policy Data (per capability, read-only) ───
function buildPolicyDataCard(cap) {
  return `
    <div class="policy-data-card" id="policy-card-${cap.id}">
      <div class="policy-data-card-hdr">
        <span>📋</span>
        <span>Uploaded Policy Data</span>
      </div>
      <p class="policy-no-data">No policy data uploaded</p>
    </div>`;
}

// ── Card: Uploaded Risk Data (per capability) ─────────────────
function buildRiskMgmtCard(cap) {
  return `
    <div class="risk-mgmt-card" data-measure="risk">
      <div class="risk-mgmt-card-header">
        <div class="risk-mgmt-card-title">
          <span>🛡️</span>
          <span>Uploaded Risk Data</span>
        </div>
        <p class="risk-mgmt-card-subtitle">Record the residual risk profile for this capability</p>
      </div>

      <div class="risk-mgmt-section">
        <label>Residual Risk Rating</label>
        <input type="hidden" id="residual-${cap.id}" value="">
        <div class="risk-btn-group" id="risk-group-residual-${cap.id}">
          ${buildRiskRatingBtns(cap.id, 'residual')}
        </div>
      </div>

      <div class="risk-mgmt-section">
        <label>Control Effectiveness</label>
        <div class="control-row">
          <span class="control-row-label">Risks — Draft</span>
          <input type="number" min="0" value="0" id="ctrl-draftrisks-${cap.id}" class="control-row-input">
        </div>
        <div class="control-row">
          <span class="control-row-label">Open Risks</span>
          <input type="number" min="0" value="0" id="ctrl-openrisks-${cap.id}" class="control-row-input">
        </div>
        <div class="control-row">
          <span class="control-row-label">Risks Assessed</span>
          <input type="number" min="0" value="0" id="ctrl-risksassessed-${cap.id}" class="control-row-input">
        </div>
        <div class="control-row">
          <span class="control-row-label">Controls — Not Assessed</span>
          <input type="number" min="0" value="0" id="ctrl-not-${cap.id}" class="control-row-input">
        </div>
        <div class="control-row">
          <span class="control-row-label">Controls — Partially Effective</span>
          <input type="number" min="0" value="0" id="ctrl-partial-${cap.id}" class="control-row-input">
        </div>
        <div class="control-row">
          <span class="control-row-label">Controls — Effective</span>
          <input type="number" min="0" value="0" id="ctrl-effective-${cap.id}" class="control-row-input">
        </div>
      </div>

      <div class="risk-mgmt-section">
        <label>Notes</label>
        <textarea id="note-risk-mgmt-${cap.id}" rows="3"
          placeholder="Risk management observations for ${cap.name}..."></textarea>
      </div>
    </div>`;
}

// ── KPI input block (per capability) ─────────────────────────
function buildKpiInputsBlock(cap) {
  const capKpis = (CONFIG.kpis || []).filter(k => k.capId === cap.id);
  if (!capKpis.length) return '';
  return `
    <div class="kpi-inputs-block">
      <div class="kpi-inputs-hdr">Strategic KPIs</div>
      ${capKpis.map(kpi => `
        <div class="kpi-input-row">
          <div class="kpi-input-meta">
            <span class="kpi-input-name">${kpi.label}</span>
            <span class="kpi-input-desc">${kpi.description}</span>
          </div>
          <div class="kpi-input-controls">
            <label class="kpi-ctrl-lbl">${kpi.numeratorLabel}</label>
            <input type="number" min="0" value="0" id="kpi-n-${kpi.id}"
              class="kpi-ctrl-input" oninput="updateKpiPct('${kpi.id}')" />
            <span class="kpi-ctrl-sep">/</span>
            <label class="kpi-ctrl-lbl">${kpi.denominatorLabel}</label>
            <input type="number" min="0" value="0" id="kpi-d-${kpi.id}"
              class="kpi-ctrl-input" oninput="updateKpiPct('${kpi.id}')" />
            <span class="kpi-ctrl-pct" id="kpi-pct-${kpi.id}">—</span>
          </div>
        </div>`).join('')}
    </div>`;
}

function updateKpiPct(kpiId) {
  const n  = parseFloat(document.getElementById(`kpi-n-${kpiId}`)?.value) || 0;
  const d  = parseFloat(document.getElementById(`kpi-d-${kpiId}`)?.value) || 0;
  const el = document.getElementById(`kpi-pct-${kpiId}`);
  if (el) el.textContent = d > 0 ? Math.round((n / d) * 100) + '%' : '—';
}

// The New/Edit Assessment screen is a clean data-load surface: one button group
// per regulatory lens (DORA / MiCA / NIST CSF), each with SOA + Policy + Mapping
// imports, plus a single shared Import Risk Data below. Each import button sets
// the target lens so the wizard writes to that lens's own slots.
function buildCapabilityFields() {
  const container = document.getElementById("capability-fields");

  const lensGroup = (key) => {
    const f = FRAMEWORKS[key];
    const dim = f.dimLabel;
    return `
    <div class="lens-import-group lens-import-${key}">
      <div class="lens-import-hd"><span class="lens-import-ico">${f.icon}</span><span class="lens-import-name">${f.label}</span></div>
      <div class="lens-import-btns">
        <div class="import-btn-item">
          <button type="button" class="btn btn-outline" onclick="setImportLens('${key}');showView('dora-soa-import');initDoraSoaImport()">📥 Import ${f.label} SOA</button>
          <span id="imp-soa-${key}" class="import-data-summary">No ${f.label} SOA uploaded</span>
        </div>
        <div class="import-btn-item">
          <button type="button" class="btn btn-outline" onclick="setImportLens('${key}');showView('policy-import');initPolicyImport()">📥 Import ${f.label} Policy Data</button>
          <span id="imp-pol-${key}" class="import-data-summary">No ${f.label} policy data uploaded</span>
        </div>
        <div class="import-btn-item">
          <button type="button" class="btn btn-outline" onclick="setImportLens('${key}');showView('dora-import');initDoraImport()">📥 Import ${f.label} Mapping</button>
          <span id="imp-map-${key}" class="import-data-summary">No ${f.label} mapping uploaded</span>
        </div>
      </div>
      <p class="lens-import-note">Policy Data groups by <b>${dim}</b>; Mapping links its objectives to the policy statements.</p>
    </div>`;
  };

  container.innerHTML = `
    <div class="lens-import-grid">
      ${lensGroup('dora')}
      ${lensGroup('mica')}
      ${lensGroup('nist')}
    </div>
    <div class="lens-import-shared">
      <div class="import-btn-item">
        <button type="button" class="btn btn-primary" onclick="setImportLens('dora');showView('riskonnect-import');initRiskonnectImport()">📥 Import Risk Data</button>
        <span id="rk-data-summary" class="import-data-summary">No risk data uploaded</span>
      </div>
      <p class="lens-import-note">Risk &amp; control data is the single control framework shared by all three lenses.</p>
    </div>`;
}

// ── Dimension Selector ────────────────────────────────────────
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
  const checkedDimensions = new Set(
    [...document.querySelectorAll(".dimension-check:checked")].map(el => el.value)
  );
  const checkedCaps = new Set(
    [...document.querySelectorAll(".capability-check:checked")].map(el => el.value)
  );
  // Show/hide entire capability cards
  document.querySelectorAll("[data-capability]").forEach(card => {
    card.style.display = checkedCaps.has(card.dataset.capability) ? "" : "none";
  });
  // Show/hide measure blocks within each card (.measure-block and .risk-mgmt-card)
  document.querySelectorAll("[data-measure]").forEach(block => {
    block.style.display = checkedDimensions.has(block.dataset.measure) ? "" : "none";
  });
  syncCapabilityAllCheckbox();
  updateSaveButtonState();
}

function toggleAllCapabilities(cb) {
  document.querySelectorAll(".capability-check").forEach(c => { c.checked = cb.checked; });
  updateDimensionVisibility();
}

function syncCapabilityAllCheckbox() {
  const allCb    = document.getElementById("capability-check-all");
  if (!allCb) return;
  const total   = document.querySelectorAll(".capability-check").length;
  const checked = document.querySelectorAll(".capability-check:checked").length;
  if (checked === total) {
    allCb.checked = true;
    allCb.indeterminate = false;
  } else if (checked === 0) {
    allCb.checked = false;
    allCb.indeterminate = false;
  } else {
    allCb.indeterminate = true;
  }
}

function updateSaveButtonState() {
  const totalCaps   = document.querySelectorAll(".capability-check").length;
  const checkedCaps = document.querySelectorAll(".capability-check:checked").length;
  const allShown = totalCaps > 0 && checkedCaps === totalCaps;
  const btn = document.getElementById("btn-save-assessment");
  if (!btn) return;
  btn.disabled = !allShown;
  btn.title = allShown ? "" : "Show all Capabilities before saving";
}

// ── Risk Rating Button Toggle ─────────────────────────────────
function toggleRiskRatingBtn(btn, capId, field) {
  const group = document.getElementById(`risk-group-${field}-${capId}`);
  const hiddenEl = document.getElementById(`${field}-${capId}`);
  if (btn.classList.contains('selected')) {
    btn.classList.remove('selected');
    if (hiddenEl) hiddenEl.value = '';
  } else {
    if (group) group.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    if (hiddenEl) hiddenEl.value = btn.dataset.value;
  }
}

function setRiskRatingBtns(capId, field, value) {
  const group = document.getElementById(`risk-group-${field}-${capId}`);
  if (group) group.querySelectorAll('.risk-btn').forEach(b => b.classList.toggle('selected', b.dataset.value === value));
  const hiddenEl = document.getElementById(`${field}-${capId}`);
  if (hiddenEl) hiddenEl.value = value || '';
}

function clearRiskRatingBtns(capId, field) {
  const group = document.getElementById(`risk-group-${field}-${capId}`);
  if (group) group.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('selected'));
  const hiddenEl = document.getElementById(`${field}-${capId}`);
  if (hiddenEl) hiddenEl.value = '';
}

function clearRiskCountInputs(capId) {
  ['ctrl-draftrisks', 'ctrl-openrisks', 'ctrl-risksassessed', 'ctrl-not', 'ctrl-partial', 'ctrl-effective'].forEach(prefix => {
    const el = document.getElementById(`${prefix}-${capId}`);
    if (el) el.value = 0;
  });
}

// ── Assessment Form — Open / Populate ────────────────────────
function openAssessmentForm(id) {
  editingId = id;
  document.getElementById("assessment-form").reset();
  document.getElementById("assessment-form-title").textContent = id ? "Edit Assessment" : "New Assessment";
  setDefaultDate();

  if (id) {
    const a = db.assessments.find(x => x.id === id);
    if (a) {
      document.getElementById("assessment-label").value = a.label || "";
      document.getElementById("assessment-date").value = a.date || "";
    }
  }
  refreshPolicyCards();
  showView("assessment");
}

function setSlider(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function updateMeasureDisplay(capId, measureId, value) {
  const v          = parseInt(value);
  const measure    = CONFIG.measures.find(m => m.id === measureId);
  const levelSpec  = measure ? measure.levels.find(l => l.level === v)     : null;
  const nextSpec   = measure ? measure.levels.find(l => l.level === v + 1) : null;
  const levelName  = levelSpec?.name  || CONFIG.levels[v - 1]?.name || String(v);
  const levelLabel = levelSpec?.label || null;
  const exitText   = levelSpec?.exit  || null;
  const exitPrefix = (nextSpec?.name && v < 5) ? `To reach <strong>${nextSpec.name}</strong>: ` : '';
  const lv = CONFIG.levels[v - 1];
  const el = document.getElementById(`display-${capId}-${measureId}`);
  if (el && lv) {
    el.innerHTML = `<span class="lvl-badge" style="background:${lv.color}">${v} · ${levelName}</span>
      ${levelLabel ? `<span class="lvl-desc">${levelLabel}</span>` : ""}
      ${exitText ? `<div style="margin-top:.4rem;font-size:.74rem;color:var(--text-muted);font-style:italic;line-height:1.45"><span style="display:block;font-family:var(--font-mono);font-size:.62rem;text-transform:uppercase;letter-spacing:.04em;font-style:normal;margin-bottom:.1rem">Exit condition:</span>${exitPrefix}${exitText}</div>` : ""}`;
  }
}

function updateTargetDisplay(capId, measureId, value) {
  const v         = parseInt(value);
  const measure   = CONFIG.measures.find(m => m.id === measureId);
  const levelSpec = measure ? measure.levels.find(l => l.level === v) : null;
  const levelName = levelSpec?.name || CONFIG.levels[v - 1]?.name || String(v);
  const lv = CONFIG.levels[v - 1];
  const el = document.getElementById(`target-display-${capId}-${measureId}`);
  if (el && lv) {
    el.innerHTML = `<span class="lvl-badge target-badge" style="border-color:${lv.color};color:${lv.color}">${v} · ${levelName}</span>`;
  }
}

// ── Assessment Form — Save ────────────────────────────────────
function saveAssessment(e) {
  e.preventDefault();

  // Fetch prevData so we can preserve imported data blobs (all data arrives via
  // the import wizards now — the form itself only captures label + date).
  const prevData = editingId ? db.assessments.find(a => a.id === editingId) : null;

  const assessment = {
    id: editingId || Date.now().toString(),
    label: document.getElementById("assessment-label").value.trim(),
    date: document.getElementById("assessment-date").value,
  };
  if (prevData) {
    // Shared control framework (risk data) + each lens's SOA / policy / mapping.
    ['riskRows', 'factSummary',
     'policyRows', 'riskPolicyFacts', 'policyStatements', 'doraRows', 'doraMeta', 'doraSoa', 'doraSoaMeta',
     'micaRows', 'micaMeta', 'micaSoa', 'micaSoaMeta', 'micaPolicyRows', 'micaPolicyMeta', 'micaGroups', 'micaFacts',
     'nistRows', 'nistMeta', 'nistSoa', 'nistSoaMeta', 'nistPolicyRows', 'nistPolicyMeta', 'nistGroups', 'nistFacts',
    ].forEach(k => { if (prevData[k] !== undefined) assessment[k] = prevData[k]; });
  }

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
