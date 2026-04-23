// ── Risk Profile Summary Table ────────────────────────────────
function renderRiskProfileSummary(assessment) {
  const container = document.getElementById("risk-profile-summary");
  if (!container) return;

  const riskMeasure = CONFIG.measures.find(m => m.type === 'risk_profile');
  if (!riskMeasure) { container.innerHTML = ''; return; }

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
        <td class="rpt-cell">${score > 0 ? `<span class="lvl-badge">${score}</span>${deltaHtml}` : '—'}</td>
        <td class="rpt-cell">${rd?.openRisks !== undefined && rd?.openRisks !== null ? rd.openRisks : '—'}</td>
        <td class="rpt-cell" style="${residualStyle}">${rd?.residualRating || '—'}</td>
        <td class="rpt-cell" style="${appetiteStyle}">${rd?.appetiteStatus || '—'}</td>
        <td class="rpt-cell">${tallyHtml}</td>
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
              <th>Score ${prevAssessment ? `<span class="rpt-vs-label">vs ${prevAssessment.label}</span>` : ''}</th>
              <th>Open Risks</th>
              <th>Residual Risk</th>
              <th>Appetite Status</th>
              <th>Riskonnect RCSA</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}
