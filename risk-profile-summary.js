// ── Risk Profile Summary Card ─────────────────────────────────
function renderRiskProfileSummary(assessment) {
  const container = document.getElementById("risk-profile-summary");
  if (!container) return;

  const hasData = CONFIG.capabilities.some(cap => getMeasureScore(assessment, cap.id, 'ict_risk') > 0);
  if (!hasData) { container.innerHTML = ''; return; }

  const ictMeasure = CONFIG.measures.find(m => m.id === 'ict_risk');

  const RATING_COLORS = {
    'Critical': { bg: '#e74c3c', text: '#fff' },
    'High':     { bg: '#e67e22', text: '#fff' },
    'Medium':   { bg: '#f1c40f', text: '#000' },
    'Low':      { bg: '#2ecc71', text: '#fff' }
  };

  function ratingBadge(value) {
    if (!value) return '<span style="color:var(--text-muted)">—</span>';
    const c = RATING_COLORS[value];
    if (!c) return `<span style="color:var(--text-muted)">${value}</span>`;
    return `<span class="lvl-badge" style="background:${c.bg};color:${c.text};font-family:var(--font-mono);font-size:.75rem">${value}</span>`;
  }

  const rows = CONFIG.capabilities.map(cap => {
    const score = getMeasureScore(assessment, cap.id, 'ict_risk');
    const lv    = levelForScore(score);
    const rp    = assessment.riskProfile?.[cap.id] || {};
    const note  = assessment.measureNotes?.[cap.id]?.['ict_risk'] || '';

    const scoreBadge = score > 0
      ? `<span class="lvl-badge" style="background:${lv ? lv.color : '#555'}">${score} · ${lv ? lv.name : ''}</span>`
      : '<span style="color:var(--text-muted)">—</span>';

    let exitHtml;
    if (score === 5) {
      exitHtml = `<span style="color:#2ecc71;font-size:.82rem">✓ Target state reached. Maintain through continuous reassessment.</span>`;
    } else if (score > 0 && ictMeasure) {
      const levelSpec = ictMeasure.levels?.find(l => l.level === score);
      const exitText  = levelSpec?.exit || null;
      if (exitText) {
        exitHtml = `
          <span class="risk-exit-label">To reach level ${score + 1}:</span>
          <span class="risk-exit-text">${exitText}</span>`;
      } else {
        exitHtml = `<span style="color:var(--text-muted);font-style:italic;font-size:.80rem">— Exit condition not defined for this level.</span>`;
      }
    } else {
      exitHtml = `<span style="color:var(--text-muted);font-style:italic;font-size:.80rem">— Score this capability to see the exit condition.</span>`;
    }

    const timeText = rp.timeEstimate
      ? `<span class="risk-time-text">${rp.timeEstimate}</span>`
      : `<span class="risk-time-none">Not estimated</span>`;

    return `
      <tr>
        <td style="font-size:.85rem;font-weight:600">${shortName(cap.name)}</td>
        <td>${scoreBadge}</td>
        <td>${ratingBadge(rp.residualRating)}</td>
        <td>${ratingBadge(rp.appetiteRating)}</td>
        <td class="rpt-notes-cell">${note || '<span style="color:var(--text-muted)">—</span>'}</td>
      </tr>
      <tr>
        <td colspan="5" style="padding:0;border-bottom:1px solid var(--border)">
          <div class="risk-exit-row">
            <div class="risk-exit-condition">${exitHtml}</div>
            <div class="risk-time-col">
              <span class="risk-time-label">Time estimate to within tolerance:</span>
              ${timeText}
            </div>
          </div>
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="card risk-profile-card">
      <div class="risk-profile-card-header">
        <div class="risk-profile-card-title-block">
          <span class="risk-profile-card-icon">🛡️</span>
          <div>
            <div class="risk-profile-card-title">Risk Profile Summary</div>
            <div class="risk-profile-card-subtitle">Residual risk status across all capabilities</div>
          </div>
        </div>
        <button class="btn-link ratings-link" onclick="showIctRiskRatingsModal()">ℹ Ratings</button>
      </div>
      <div style="overflow-x:auto">
        <table class="risk-profile-table">
          <thead>
            <tr>
              <th>Capability</th>
              <th>Maturity Score</th>
              <th>Residual Risk</th>
              <th>Risk Appetite</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}
