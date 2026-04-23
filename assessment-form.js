// ── Assessment Form — Build ───────────────────────────────────
function buildMeasureBlock(cap, m) {
  if (m.type === 'risk_profile') {
    const residualKeys   = Object.keys(CONFIG.riskScoreMatrix || {});
    const residualColors = residualKeys.map((_, i) => CONFIG.levels[i]?.color || '#888');

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
            ${residualKeys.map((key, i) => `<button type="button" class="risk-btn" data-value="${key}"
              onclick="selectRiskBtn(this,'${cap.id}','residual')" style="--risk-color:${residualColors[i]}">${key}</button>`).join('')}
          </div>
        </div>

        <div class="form-row" style="margin-top:.35rem">
          <label>Risk Appetite</label>
          <div class="risk-btn-group" id="risk-group-appetite-${cap.id}">
            ${residualKeys.map((key, i) => `<button type="button" class="risk-btn" data-value="${key}"
              onclick="selectRiskBtn(this,'${cap.id}','appetite')" style="--risk-color:${residualColors[i]}">${key}</button>`).join('')}
          </div>
        </div>

        <div class="form-row" style="margin-top:.35rem">
          <label>Control Effectiveness</label>
          <div class="risk-counts-grid">
            <div class="risk-count-row">
              <span class="risk-count-label">Open Risks</span>
              <input type="number" min="0" value="0" id="risk-openrisks-${cap.id}" class="risk-count-input"
                oninput="updateRiskScoreDisplay('${cap.id}')">
            </div>
            <div class="risk-count-row">
              <span class="risk-count-label">Controls — Not Assessed</span>
              <input type="number" min="0" value="0" id="risk-ctrl-na-${cap.id}" class="risk-count-input"
                oninput="updateRiskScoreDisplay('${cap.id}')">
            </div>
            <div class="risk-count-row">
              <span class="risk-count-label">Controls — Partially Effective</span>
              <input type="number" min="0" value="0" id="risk-ctrl-partial-${cap.id}" class="risk-count-input"
                oninput="updateRiskScoreDisplay('${cap.id}')">
            </div>
            <div class="risk-count-row">
              <span class="risk-count-label">Controls — Effective</span>
              <input type="number" min="0" value="0" id="risk-ctrl-eff-${cap.id}" class="risk-count-input"
                oninput="updateRiskScoreDisplay('${cap.id}')">
            </div>
          </div>
          <div id="risk-ctrl-display-${cap.id}" class="risk-ctrl-display"></div>
        </div>

        <div id="risk-score-display-${cap.id}" class="risk-score-display">
          <span style="color:var(--text-muted);font-size:.8rem">Select residual risk and appetite to calculate score</span>
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
          if (m.type === 'risk_profile') {
            const raw = a.measureScores?.[cap.id]?.[m.id];
            const riskData = (raw && typeof raw === 'object') ? raw : null;
            if (riskData) populateRiskProfileFields(cap.id, riskData);
            else resetRiskProfileFields(cap.id);
            const noteEl = document.getElementById(`note-${cap.id}-${m.id}`);
            if (noteEl) noteEl.value = getMeasureNote(a, cap.id, m.id) || "";
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

// ── Risk Profile Helpers ──────────────────────────────────────
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
  // Update derived control effectiveness display
  const ctrlEl = document.getElementById(`risk-ctrl-display-${capId}`);
  if (ctrlEl) {
    const na      = parseInt(document.getElementById(`risk-ctrl-na-${capId}`)?.value)      || 0;
    const partial = parseInt(document.getElementById(`risk-ctrl-partial-${capId}`)?.value) || 0;
    const eff     = parseInt(document.getElementById(`risk-ctrl-eff-${capId}`)?.value)     || 0;
    const total   = na + partial + eff;
    if (total > 0) {
      const derived = deriveControlRating(na, partial, eff);
      const color = { 'Effective': '#2ecc71', 'Partially Effective': '#e67e22', 'Not Assessed': '#e74c3c' }[derived] || '#888';
      const effPct = Math.round((eff / total) * 100);
      ctrlEl.innerHTML = `<span style="color:var(--text-muted);font-size:.75rem">${total} controls · ${effPct}% effective</span>
        <span class="lvl-badge" style="background:${color};margin-left:.5rem">${derived}</span>`;
    } else {
      ctrlEl.innerHTML = '';
    }
  }

  // Update score/target display
  const el = document.getElementById(`risk-score-display-${capId}`);
  if (!el) return;
  const residual = document.getElementById(`risk-residual-${capId}`)?.value;
  const appetite = document.getElementById(`risk-appetite-${capId}`)?.value;
  if (!residual && !appetite) {
    el.innerHTML = `<span style="color:var(--text-muted);font-size:.8rem">Select residual risk and appetite to calculate score</span>`;
    return;
  }
  const residualKeys = Object.keys(CONFIG.riskScoreMatrix || {});
  const residualMaturity = residual ? residualKeys.indexOf(residual) + 1 : 0;
  const appetiteMaturity = appetite ? residualKeys.indexOf(appetite) + 1 : 0;
  const rlv = levelForScore(residualMaturity);
  const alv = levelForScore(appetiteMaturity);
  const score  = calcRiskScore(capId);
  const lv     = levelForScore(score);
  const target = calcRiskTarget(capId);
  const tlv    = levelForScore(target);
  el.innerHTML = `
    <span class="risk-score-label">Residual Risk maturity level:</span>
    ${rlv ? `<span class="lvl-badge" style="background:${rlv.color}">${residualMaturity} · ${rlv.name}</span>` : '<span style="color:var(--text-muted)">—</span>'}
    <span class="risk-score-label" style="margin-left:.5rem">Appetite maturity level:</span><br/>
    ${alv ? `<span class="lvl-badge" style="background:${alv.color}">${appetiteMaturity} · ${alv.name}</span>` : '<span style="color:var(--text-muted)">—</span>'}
  `;
}

function calcRiskScore(capId) {
  const residual = document.getElementById(`risk-residual-${capId}`)?.value;
  const appetite = document.getElementById(`risk-appetite-${capId}`)?.value;
  if (!residual || !appetite) return 0;

  const residualKeys = Object.keys(CONFIG.riskScoreMatrix || {});
  const residualIdx  = residualKeys.indexOf(residual);
  const appetiteIdx  = residualKeys.indexOf(appetite);
  if (residualIdx < 0 || appetiteIdx < 0) return 0;

  // Higher index = lower risk severity. Residual within appetite when it is at same level or less severe.
  const appetiteStatus = residualIdx >= appetiteIdx ? 'Within Appetite' : 'Exceeds Appetite';

  return CONFIG.riskScoreMatrix?.[residual]?.[appetiteStatus]?.['Effective'] || 0;
}

function calcRiskTarget(capId) {
  const residual = document.getElementById(`risk-residual-${capId}`)?.value;
  if (!residual) return 0;
  return CONFIG.riskScoreMatrix?.[residual]?.['Within Appetite']?.['Effective'] || 0;
}

function populateRiskProfileFields(capId, riskData) {
  ['residual', 'appetite'].forEach(field => {
    const value = field === 'residual' ? riskData.residualRating : (riskData.appetiteRating || '');
    const hidden = document.getElementById(`risk-${field}-${capId}`);
    if (hidden) hidden.value = value || '';
    document.querySelectorAll(`#risk-group-${field}-${capId} .risk-btn`)
      .forEach(b => b.classList.toggle('selected', b.dataset.value === value));
  });
  const cc = riskData.controlCounts;
  if (cc) {
    const naEl      = document.getElementById(`risk-ctrl-na-${capId}`);
    const partialEl = document.getElementById(`risk-ctrl-partial-${capId}`);
    const effEl     = document.getElementById(`risk-ctrl-eff-${capId}`);
    const openEl    = document.getElementById(`risk-openrisks-${capId}`);
    if (naEl)      naEl.value      = cc.notAssessed ?? 0;
    if (partialEl) partialEl.value = cc.partial      ?? 0;
    if (effEl)     effEl.value     = cc.effective    ?? 0;
    if (openEl)    openEl.value    = cc.openRisks    ?? riskData.openRisks ?? 0;
  }
  updateRiskScoreDisplay(capId);
}

function resetRiskProfileFields(capId) {
  ['residual', 'appetite'].forEach(field => {
    const el = document.getElementById(`risk-${field}-${capId}`);
    if (el) el.value = '';
    document.querySelectorAll(`#risk-group-${field}-${capId} .risk-btn`)
      .forEach(b => b.classList.remove('selected'));
  });
  ['risk-ctrl-na', 'risk-ctrl-partial', 'risk-ctrl-eff', 'risk-openrisks'].forEach(prefix => {
    const el = document.getElementById(`${prefix}-${capId}`);
    if (el) el.value = 0;
  });
  updateRiskScoreDisplay(capId);
}

// ── Assessment Form — Save ────────────────────────────────────
function saveAssessment(e) {
  e.preventDefault();

  const selectedMeasures = new Set(
    [...document.querySelectorAll(".dimension-check:checked")].map(el => el.value)
  );

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
          const na        = parseInt(document.getElementById(`risk-ctrl-na-${cap.id}`)?.value)      || 0;
          const partial   = parseInt(document.getElementById(`risk-ctrl-partial-${cap.id}`)?.value) || 0;
          const eff       = parseInt(document.getElementById(`risk-ctrl-eff-${cap.id}`)?.value)     || 0;
          const openRisks = parseInt(document.getElementById(`risk-openrisks-${cap.id}`)?.value)    || 0;
          const score     = calcRiskScore(cap.id);
          const residualKeys = Object.keys(CONFIG.riskScoreMatrix || {});
          const appetiteStatus = (residual && appetite)
            ? (residualKeys.indexOf(residual) >= residualKeys.indexOf(appetite) ? 'Within Appetite' : 'Exceeds Appetite')
            : '';
          measureScores[cap.id][m.id] = (residual || appetite)
            ? { score, residualRating: residual, appetiteRating: appetite, appetiteStatus,
                controlCounts: { openRisks, notAssessed: na, partial, effective: eff },
                controlEffectiveness: deriveControlRating(na, partial, eff) }
            : 0;
          measureTargets[cap.id][m.id] = calcRiskTarget(cap.id) || 0;
          measureNotes[cap.id][m.id]   = document.getElementById(`note-${cap.id}-${m.id}`)?.value.trim() || '';
        } else {
          measureScores[cap.id][m.id]  = parseInt(document.getElementById(`score-${cap.id}-${m.id}`).value);
          measureTargets[cap.id][m.id] = parseInt(document.getElementById(`target-${cap.id}-${m.id}`).value);
          measureNotes[cap.id][m.id]   = document.getElementById(`note-${cap.id}-${m.id}`).value.trim();
        }
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
