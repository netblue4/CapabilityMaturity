// ── Detail View ───────────────────────────────────────────────
function viewAssessment(id) {
  currentDetailId = id;
  const a = db.assessments.find(x => x.id === id);
  if (!a) return;
  document.getElementById("detail-title").textContent = `${a.label} — ${formatDate(a.date)}`;

  const content = document.getElementById("detail-content");
  const overall = overallAvg(a);
  const avgLevel = levelForScore(overall);

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

  document.querySelectorAll(".dimension-check").forEach(cb => cb.checked = true);
  CONFIG.measures.forEach(m => {
    const hasScore = CONFIG.capabilities.some(cap => getMeasureScore(source, cap.id, m.id) > 0);
    const cb = document.querySelector(`.dimension-check[value="${m.id}"]`);
    if (cb) cb.checked = hasScore;
  });

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
