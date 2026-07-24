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
  if (m.id === 'risk') {
    // Maturity slider block for ICT Risk Management Framework — same layout as Governance/Reporting
    return `
      <div class="measure-block" data-measure="${m.id}" style="--m-color:${m.color || 'var(--clr-danger)'}">
        <div class="measure-block-header">
          <span class="measure-icon-sm">${m.icon}</span>
          <span class="measure-block-name">Capability Maturity · ICT Risk Management Framework</span>
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
            placeholder="Describe how long you estimate it will take to reach the next maturity level for ICT Risk…"></textarea>
        </div>

        <div class="form-row" style="margin-top:.5rem">
          <label>Notes</label>
          <textarea id="note-${cap.id}-${m.id}" rows="3"
            placeholder="ICT Risk maturity observations for ${cap.name}…"></textarea>
        </div>
      </div>`;
  }

  // Standard slider block (Governance, Reporting)
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

function buildCapabilityFields() {
  const container = document.getElementById("capability-fields");
  // All 3 measures in order: Governance, Reporting, Risk
  const orderedMeasures = ['governance', 'reporting', 'risk']
    .map(id => CONFIG.measures.find(m => m.id === id))
    .filter(Boolean);

  const allCapCheckbox = `
    <label class="dimension-check-label" style="border-color:var(--accent)">
      <input type="checkbox" id="capability-check-all" checked
        onchange="toggleAllCapabilities(this)" />
      <span style="font-family:var(--font-mono);font-size:0.75rem;font-weight:700;color:var(--accent)">ALL</span>
    </label>`;

  const capCheckboxes = CONFIG.capabilities.map((cap, i) => `
    <label class="dimension-check-label">
      <input type="checkbox" class="capability-check" value="${cap.id}" checked
        onchange="updateDimensionVisibility()" />
      <span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--accent)">${i + 1}</span>
      ${shortName(cap.name)}
    </label>
  `).join('');

  const capFilterCard = `
    <div class="card form-meta cap-nav-card">
      <div class="form-row" style="margin-bottom:0">
        <label>Capabilities to Rate</label>
        <div class="dimension-checks">${allCapCheckbox}${capCheckboxes}</div>
      </div>
    </div>`;

  const importBtnsRow = `
    <div class="import-btn-row">
      <div class="import-btn-item">
        <button type="button" class="btn btn-outline"
          onclick="showView('riskonnect-import');initRiskonnectImport()">📥 Import Risk Data</button>
        <span id="rk-data-summary" class="import-data-summary">No risk data uploaded</span>
      </div>
      <div class="import-btn-item">
        <button type="button" class="btn btn-outline"
          onclick="showView('policy-import');initPolicyImport()">📥 Import Policy Data</button>
        <span id="policy-import-summary" class="import-data-summary">No policy data uploaded</span>
      </div>
    </div>`;

  container.innerHTML = importBtnsRow + capFilterCard + CONFIG.capabilities.map(cap => `
    <div class="card cap-card" id="capcard-${cap.id}" data-capability="${cap.id}">
      <div class="cap-card-header">
        <div>
          <h3 class="cap-name">${cap.name}</h3>
          <p class="cap-desc">${cap.description}</p>
        </div>
      </div>

      <!-- Governance · Reporting · Risk — all three side by side -->
      <div class="measures-grid measures-grid-3">
        ${orderedMeasures.map(m => buildMeasureBlock(cap, m)).join("")}
      </div>

      <div class="form-row" style="margin-top:1rem">
        <label>Overall notes for this capability</label>
        <textarea id="capnote-${cap.id}" rows="2" placeholder="General observations…"></textarea>
      </div>
    </div>
  `).join("");
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
  const totalDims   = document.querySelectorAll(".dimension-check").length;
  const checkedDims = document.querySelectorAll(".dimension-check:checked").length;
  const allShown = totalCaps > 0 && checkedCaps === totalCaps &&
                   totalDims > 0 && checkedDims === totalDims;
  const btn = document.getElementById("btn-save-assessment");
  if (!btn) return;
  btn.disabled = !allShown;
  btn.title = allShown ? "" : "Select all Capabilities and Dimensions before saving";
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

  document.querySelectorAll(".dimension-check").forEach(cb => cb.checked = true);
  document.querySelectorAll(".capability-check").forEach(cb => cb.checked = true);
  const allCapCb = document.getElementById("capability-check-all");
  if (allCapCb) { allCapCb.checked = true; allCapCb.indeterminate = false; }

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
          // getMeasureScore handles legacy "ict_risk" key fallback
          const score  = getMeasureScore(a, cap.id, m.id) || 1;
          const target = getMeasureTarget(a, cap.id, m.id) || 3;
          const note   = getMeasureNote(a, cap.id, m.id) || "";
          setSlider(`score-${cap.id}-${m.id}`, score);
          setSlider(`target-${cap.id}-${m.id}`, target);
          const noteEl = document.getElementById(`note-${cap.id}-${m.id}`);
          if (noteEl) noteEl.value = note;
          updateMeasureDisplay(cap.id, m.id, score);
          updateTargetDisplay(cap.id, m.id, target);

          // Time estimate on each maturity measure card
          if (['governance', 'risk', 'reporting'].includes(m.id)) {
            const timeEstEl = document.getElementById(`timeest-${cap.id}-${m.id}`);
            if (timeEstEl) {
              let timeEst = a.measureTimeEstimates?.[cap.id]?.[m.id] || '';
              // Backward compat: weeksToNext used to be a single number per capability on "risk"
              if (!timeEst && m.id === 'risk' && a.weeksToNext?.[cap.id]) {
                console.info(`Legacy weeksToNext for ${cap.id} — using as risk time estimate.`);
                timeEst = String(a.weeksToNext[cap.id]);
              }
              timeEstEl.value = timeEst;
            }
          }
        });

        // riskManagement fields — prefer new structure, fall back to legacy riskProfile
        const rmData   = a.measureScores?.[cap.id]?.riskManagement;
        const legacyRp = a.riskProfile?.[cap.id];

        let rm;
        if (rmData && typeof rmData === 'object') {
          rm = rmData;
        } else if (legacyRp) {
          console.info(`Legacy riskProfile for ${cap.id} — restoring into risk management fields.`);
          rm = legacyRp;
        } else {
          // Very old format: ict_risk key inside measureScores was an object
          const legacyRaw = a.measureScores?.[cap.id]?.['ict_risk'];
          rm = (legacyRaw && typeof legacyRaw === 'object' && !('score' in legacyRaw)) ? legacyRaw : {};
        }

        setRiskRatingBtns(cap.id, 'residual', rm.residualRating || '');
        setRiskRatingBtns(cap.id, 'appetite', rm.appetiteRating || '');

        // Control counts — support old controlCounts sub-object shape
        const cc = rm.controlCounts || {};
        const draftEl   = document.getElementById(`ctrl-draftrisks-${cap.id}`);
        const openEl    = document.getElementById(`ctrl-openrisks-${cap.id}`);
        const notEl     = document.getElementById(`ctrl-not-${cap.id}`);
        const partialEl = document.getElementById(`ctrl-partial-${cap.id}`);
        const effEl     = document.getElementById(`ctrl-effective-${cap.id}`);
        const risksAssessedEl = document.getElementById(`ctrl-risksassessed-${cap.id}`);
        if (draftEl)          draftEl.value          = rm.risksDraft          ?? 0;
        if (openEl)           openEl.value           = rm.openRisks           ?? cc.openRisks   ?? 0;
        if (risksAssessedEl)  risksAssessedEl.value  = rm.risksAssessed       ?? 0;
        if (notEl)            notEl.value            = rm.controlsNotAssessed ?? cc.notAssessed ?? 0;
        if (partialEl)        partialEl.value        = rm.controlsPartial     ?? cc.partial     ?? 0;
        if (effEl)            effEl.value            = rm.controlsEffective   ?? cc.effective   ?? 0;

        // Risk management notes — new location; fall back to legacy riskMgmtNotes field
        const rmNote = getMeasureNote(a, cap.id, 'riskManagement') || rm.riskMgmtNotes || '';
        const notesEl = document.getElementById(`note-risk-mgmt-${cap.id}`);
        if (notesEl) notesEl.value = rmNote;
      });

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
      // Risk management card clear (form.reset() clears inputs but not CSS button states)
      clearRiskRatingBtns(cap.id, 'residual');
      clearRiskRatingBtns(cap.id, 'appetite');
      clearRiskCountInputs(cap.id);
    });
  }
  updateDimensionVisibility();
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

  const selectedMeasures = new Set(
    [...document.querySelectorAll(".dimension-check:checked")].map(el => el.value)
  );

  // Fetch prevData before the loop so we can preserve imported risk values
  const prevData = editingId ? db.assessments.find(a => a.id === editingId) : null;

  const measureScores = {}, measureTargets = {}, measureNotes = {}, measureTimeEstimates = {}, capNotes = {};
  CONFIG.capabilities.forEach(cap => {
    measureScores[cap.id] = {};
    measureTargets[cap.id] = {};
    measureNotes[cap.id] = {};
    measureTimeEstimates[cap.id] = {};
    capNotes[cap.id] = document.getElementById("capnote-" + cap.id).value.trim();

    CONFIG.measures.forEach(m => {
      if (selectedMeasures.has(m.id)) {
        measureScores[cap.id][m.id]  = parseInt(document.getElementById(`score-${cap.id}-${m.id}`).value) || 1;
        measureTargets[cap.id][m.id] = parseInt(document.getElementById(`target-${cap.id}-${m.id}`).value) || 3;
        measureNotes[cap.id][m.id]   = document.getElementById(`note-${cap.id}-${m.id}`)?.value.trim() || '';
      } else {
        measureScores[cap.id][m.id]  = 0;
        measureTargets[cap.id][m.id] = 0;
        measureNotes[cap.id][m.id]   = "";
      }
    });

    // Time estimates live on each maturity measure card (governance, risk, reporting)
    ['governance', 'risk', 'reporting'].forEach(mId => {
      measureTimeEstimates[cap.id][mId] = document.getElementById(`timeest-${cap.id}-${mId}`)?.value.trim() || '';
    });

    // riskManagement: preserve whatever the Riskonnect import stored (no manual UI)
    measureScores[cap.id].riskManagement = prevData?.measureScores?.[cap.id]?.riskManagement || {};
    measureNotes[cap.id].riskManagement  = prevData?.measureNotes?.[cap.id]?.riskManagement  || '';
  });

  // Preserve imported data blobs that live outside the form fields
  const assessment = {
    id: editingId || Date.now().toString(),
    label: document.getElementById("assessment-label").value.trim(),
    date: document.getElementById("assessment-date").value,
    notes: document.getElementById("assessment-notes").value.trim(),
    measureScores,
    measureTargets,
    measureNotes,
    measureTimeEstimates,
    capNotes,
  };
  if (prevData) {
    if (prevData.riskRows)         assessment.riskRows         = prevData.riskRows;
    if (prevData.policyRows)       assessment.policyRows       = prevData.policyRows;
    if (prevData.riskPolicyFacts)  assessment.riskPolicyFacts  = prevData.riskPolicyFacts;
    if (prevData.policyStatements) assessment.policyStatements = prevData.policyStatements;
    if (prevData.factSummary)      assessment.factSummary      = prevData.factSummary;
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
