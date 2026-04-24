// ── Risk Rating Button Builder ────────────────────────────────
function buildRiskRatingBtns(capId, field) {
  const keys = Object.keys(CONFIG.riskScoreMatrix || {});
  return keys.map((key, i) => {
    const color = CONFIG.levels[i]?.color || '#888';
    return `<button type="button" class="risk-btn" data-value="${key}"
      style="--risk-color:${color}"
      onclick="toggleRiskRatingBtn(this,'${capId}','${field}')">${key}</button>`;
  }).join('');
}

// ── Assessment Form — Build ───────────────────────────────────
function buildMeasureBlock(cap, m) {
  if (m.id === 'ict_risk') {
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

        <hr class="risk-section-divider">

        <input type="hidden" id="residual-${cap.id}" value="">
        <div class="form-row">
          <label>Residual Risk Rating</label>
          <div class="risk-btn-group" id="risk-group-residual-${cap.id}">
            ${buildRiskRatingBtns(cap.id, 'residual')}
          </div>
        </div>

        <input type="hidden" id="appetite-${cap.id}" value="">
        <div class="form-row">
          <label>Risk Appetite</label>
          <div class="risk-btn-group" id="risk-group-appetite-${cap.id}">
            ${buildRiskRatingBtns(cap.id, 'appetite')}
          </div>
        </div>

        <div class="form-row">
          <label>Control Effectiveness</label>
          <div class="risk-counts-grid">
            <div class="risk-count-row">
              <span class="risk-count-label">Open Risks</span>
              <input type="number" min="0" value="0" id="risk-openrisks-${cap.id}" class="risk-count-input">
            </div>
            <div class="risk-count-row">
              <span class="risk-count-label">Controls — Not Assessed</span>
              <input type="number" min="0" value="0" id="risk-ctrl-na-${cap.id}" class="risk-count-input">
            </div>
            <div class="risk-count-row">
              <span class="risk-count-label">Controls — Partially Effective</span>
              <input type="number" min="0" value="0" id="risk-ctrl-partial-${cap.id}" class="risk-count-input">
            </div>
            <div class="risk-count-row">
              <span class="risk-count-label">Controls — Effective</span>
              <input type="number" min="0" value="0" id="risk-ctrl-eff-${cap.id}" class="risk-count-input">
            </div>
          </div>
        </div>

        <div class="form-row">
          <label>Time Estimate</label>
          <textarea id="timeest-${cap.id}" rows="2"
            placeholder="Describe how long you estimate it will take to treat the risk to within tolerance..."></textarea>
        </div>

        <div class="form-row">
          <label>Notes</label>
          <textarea id="note-${cap.id}-${m.id}" rows="3"
            placeholder="${m.name} observations for ${cap.name}…"></textarea>
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
  const checked = new Set(
    [...document.querySelectorAll(".dimension-check:checked")].map(el => el.value)
  );
  document.querySelectorAll(".measure-block").forEach(block => {
    block.style.display = checked.has(block.dataset.measure) ? "" : "none";
  });
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
  ['risk-openrisks', 'risk-ctrl-na', 'risk-ctrl-partial', 'risk-ctrl-eff'].forEach(prefix => {
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
          const score  = getMeasureScore(a, cap.id, m.id) || 1;
          const target = getMeasureTarget(a, cap.id, m.id) || 3;
          const note   = getMeasureNote(a, cap.id, m.id) || "";
          setSlider(`score-${cap.id}-${m.id}`, score);
          setSlider(`target-${cap.id}-${m.id}`, target);
          const noteEl = document.getElementById(`note-${cap.id}-${m.id}`);
          if (noteEl) noteEl.value = note;
          updateMeasureDisplay(cap.id, m.id, score);
          updateTargetDisplay(cap.id, m.id, target);

          if (m.id === 'ict_risk') {
            const rp = a.riskProfile?.[cap.id];
            // Legacy: old format stored residualRating/appetiteRating inside measureScores as an object
            const legacyRaw = a.measureScores?.[cap.id]?.['ict_risk'];
            const legacy = (!rp && legacyRaw && typeof legacyRaw === 'object') ? legacyRaw : null;
            const effectiveRp = rp || (legacy ? {
              residualRating: legacy.residualRating || '',
              appetiteRating: legacy.appetiteRating || '',
              timeEstimate: '',
              controlCounts: legacy.controlCounts || {}
            } : null);

            if (effectiveRp) {
              setRiskRatingBtns(cap.id, 'residual', effectiveRp.residualRating || '');
              setRiskRatingBtns(cap.id, 'appetite', effectiveRp.appetiteRating || '');
              const timeEl = document.getElementById(`timeest-${cap.id}`);
              if (timeEl) timeEl.value = effectiveRp.timeEstimate || '';
              const cc = effectiveRp.controlCounts;
              if (cc) {
                const naEl      = document.getElementById(`risk-ctrl-na-${cap.id}`);
                const partialEl = document.getElementById(`risk-ctrl-partial-${cap.id}`);
                const effEl     = document.getElementById(`risk-ctrl-eff-${cap.id}`);
                const openEl    = document.getElementById(`risk-openrisks-${cap.id}`);
                if (naEl)      naEl.value      = cc.notAssessed ?? 0;
                if (partialEl) partialEl.value = cc.partial      ?? 0;
                if (effEl)     effEl.value     = cc.effective    ?? 0;
                if (openEl)    openEl.value    = cc.openRisks    ?? 0;
              }
            } else {
              clearRiskRatingBtns(cap.id, 'residual');
              clearRiskRatingBtns(cap.id, 'appetite');
              clearRiskCountInputs(cap.id);
            }
          }
        });
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
        if (m.id === 'ict_risk') {
          clearRiskRatingBtns(cap.id, 'residual');
          clearRiskRatingBtns(cap.id, 'appetite');
          clearRiskCountInputs(cap.id);
          const timeEl = document.getElementById(`timeest-${cap.id}`);
          if (timeEl) timeEl.value = '';
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

// ── Assessment Form — Save ────────────────────────────────────
function saveAssessment(e) {
  e.preventDefault();

  const selectedMeasures = new Set(
    [...document.querySelectorAll(".dimension-check:checked")].map(el => el.value)
  );

  const measureScores = {}, measureTargets = {}, measureNotes = {}, capNotes = {}, riskProfile = {};
  CONFIG.capabilities.forEach(cap => {
    measureScores[cap.id] = {};
    measureTargets[cap.id] = {};
    measureNotes[cap.id] = {};
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

    const na      = parseInt(document.getElementById(`risk-ctrl-na-${cap.id}`)?.value)      || 0;
    const partial = parseInt(document.getElementById(`risk-ctrl-partial-${cap.id}`)?.value) || 0;
    const eff     = parseInt(document.getElementById(`risk-ctrl-eff-${cap.id}`)?.value)     || 0;
    const openRisks = parseInt(document.getElementById(`risk-openrisks-${cap.id}`)?.value)  || 0;

    riskProfile[cap.id] = {
      residualRating: document.getElementById(`residual-${cap.id}`)?.value || '',
      appetiteRating: document.getElementById(`appetite-${cap.id}`)?.value || '',
      timeEstimate:   document.getElementById(`timeest-${cap.id}`)?.value.trim() || '',
      controlCounts:  { openRisks, notAssessed: na, partial, effective: eff }
    };
  });

  const assessment = {
    id: editingId || Date.now().toString(),
    label: document.getElementById("assessment-label").value.trim(),
    date: document.getElementById("assessment-date").value,
    notes: document.getElementById("assessment-notes").value.trim(),
    measureScores,
    measureTargets,
    measureNotes,
    capNotes,
    riskProfile
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
