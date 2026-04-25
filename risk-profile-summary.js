// ── Profile Cards ─────────────────────────────────────────────

function renderProfileCards(assessment) {
  const container = document.getElementById("profile-cards-container");
  if (!container) return;

  container.innerHTML = [
    renderMaturityProfileCard(assessment, "governance", "ICT Governance Profile Maturity", "#9b59b6"),
    renderMaturityProfileCard(assessment, "reporting",  "ICT Reporting Profile Maturity",  "#2ecc71"),
    renderMaturityProfileCard(assessment, "ict_risk",   "ICT Risk Profile Maturity",       "#e74c3c"),
    renderRiskManagementCard(assessment)
  ].join('');
}

// ── Cards 1, 2, 3: Maturity Profile ──────────────────────────

function renderMaturityProfileCard(assessment, measureId, title, accentColour) {
  const measure = CONFIG.measures.find(m => m.id === measureId);
  if (!measure) return '';

  const hasData = CONFIG.capabilities.some(cap => getMeasureScore(assessment, cap.id, measureId) > 0);
  if (!hasData) return '';

  const ratingsOnclick = measureId === 'ict_risk'
    ? 'showIctRiskRatingsModal()'
    : `showRatingsModal('${measureId}')`;

  const rows = CONFIG.capabilities.map(cap => {
    const score  = getMeasureScore(assessment, cap.id, measureId) || 0;
    const target = getMeasureTarget(assessment, cap.id, measureId) || 0;
    const lv     = score  > 0 ? CONFIG.levels[score  - 1] : null;
    const tlv    = target > 0 ? CONFIG.levels[target - 1] : null;
    const note   = assessment.measureNotes?.[cap.id]?.[measureId] || '';
    const weeks  = assessment.weeksToNext?.[cap.id] || 0;

    const currentBadge = score > 0
      ? `<span class="mini-bar-val">${score} · ${lv ? lv.name : ''}</span>`
      : `<span style="color:var(--text-muted)">—</span>`;

    const targetBadge = target > 0
      ? `<span class="mini-bar-val">${target} · ${tlv ? tlv.name : ''}</span>`
      : `<span style="color:var(--text-muted)">—</span>`;

    let statusHtml;
    if (score === 5) {
      statusHtml = `<span style="color:#2ecc71;font-family:var(--font-mono);font-size:0.75rem">✓ Optimising</span>`;
    } else if (score > 0 && target > 0 && score >= target) {
      statusHtml = `<span style="color:#2ecc71;font-family:var(--font-mono);font-size:0.75rem">✓ At target</span>`;
    } else if (score > 0 && target > 0 && score < target) {
      const gap = target - score;
      statusHtml = `<span style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.75rem">↑ ${gap} level${gap !== 1 ? 's' : ''} to go</span>`;
    } else {
      statusHtml = `<span style="color:var(--text-muted)">—</span>`;
    }

    let exitHtml;
    if (score === 5) {
      exitHtml = `<span style="color:#2ecc71;font-size:0.78rem">✓ Target state reached.</span>`;
    } else if (score > 0) {
      const levelSpec = measure.levels?.find(l => l.level === score);
      const exitText  = levelSpec?.exit || null;
      if (exitText) {
        exitHtml = `
          <span style="display:block;font-family:var(--font-mono);font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:0.2rem">TO REACH LEVEL ${score + 1}:</span>
          <span style="color:var(--text);font-style:italic;font-size:0.78rem;line-height:1.5">${exitText}</span>`;
      } else {
        exitHtml = `<span style="color:var(--text-muted);font-style:italic;font-size:0.78rem">— Exit condition not defined.</span>`;
      }
    } else {
      exitHtml = `<span style="color:var(--text-muted);font-style:italic;font-size:0.78rem">— Score this capability to see exit condition.</span>`;
    }

    const timeHtml = weeks > 0
      ? `<span style="color:var(--accent);font-family:var(--font-mono);font-size:0.82rem;font-weight:700">${weeks} wks</span>`
      : `<span style="color:var(--text-muted)">—</span>`;

    const noteHtml = note
      ? `<span style="font-size:0.75rem;color:var(--text-muted);font-style:italic">${note}</span>`
      : `<span style="color:var(--text-muted)">—</span>`;

    return `
      <tr>
        <td style="font-size:0.85rem;font-weight:600;min-width:160px">${shortName(cap.name)}</td>
        <td>${currentBadge}</td>
        <td>${targetBadge}</td>
        <td style="white-space:nowrap">${statusHtml}</td>
        <td style="max-width:380px">${exitHtml}</td>
        <td style="width:70px;text-align:right;white-space:nowrap">${timeHtml}</td>
        <td style="max-width:220px">${noteHtml}</td>
      </tr>`;
  }).join('');

  const scores = CONFIG.capabilities.map(cap => getMeasureScore(assessment, cap.id, measureId)).filter(s => s > 0);
  const avg    = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const avgLv  = avg > 0 ? CONFIG.levels[Math.round(avg) - 1] : null;

  return `
    <div class="profile-card">
      <details>
        <summary class="profile-card-summary">
          <div class="profile-card-title-block">
            <span class="profile-card-chevron">▶</span>
            <div class="profile-card-accent" style="background:${accentColour}"></div>
            <div>
              <div class="profile-card-title">${title}</div>
              <div class="profile-card-subtitle">Maturity progression across all capabilities</div>
            </div>
          </div>
          <button class="btn-link ratings-link" style="margin:0" onclick="event.stopPropagation();${ratingsOnclick}">ℹ Ratings</button>
        </summary>
        <div style="overflow-x:auto;margin-top:1.25rem">
          <table class="profile-table">
            <thead>
              <tr>
                <th>Capability</th>
                <th>Current</th>
                <th>Target</th>
                <th>Status</th>
                <th>Exit Condition</th>
                <th style="text-align:right">Est. Time</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr>
                <td colspan="6">Assessment: ${assessment.label} · ${formatDate(assessment.date)}</td>
                <td style="text-align:right">
                  ${avg > 0 ? `<span class="lvl-badge" style="background:${avgLv ? avgLv.color : '#555'}">Avg ${avg.toFixed(1)}</span>` : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>
    </div>`;
}

// ── Card 4: ICT Risk Management ───────────────────────────────

function renderRiskManagementCard(assessment) {
  if (!assessment.riskProfile) return '';

  const hasData = CONFIG.capabilities.some(cap => {
    const rp = assessment.riskProfile[cap.id];
    return rp && rp.residualRating;
  });
  if (!hasData) return '';

  const riskKeys = Object.keys(CONFIG.riskScoreMatrix || {});

  function ratingBadge(value) {
    if (!value) return `<span style="color:var(--text-muted)">—</span>`;
    const idx       = riskKeys.indexOf(value);
    const lv        = idx >= 0 ? CONFIG.levels[idx] : null;
    const textColor = lv?.color === '#f1c40f' ? '#000' : '#fff';
    return `<span class="lvl-badge" style="background:${lv ? lv.color : '#555'};color:${textColor};font-family:var(--font-mono);font-size:0.75rem">${value}</span>`;
  }

  let totalEffective = 0, totalPartial = 0, totalNotAssessed = 0, totalOpenRisks = 0;

  const rows = CONFIG.capabilities.map(cap => {
    const rp       = assessment.riskProfile[cap.id] || {};
    const residual = rp.residualRating || '';
    const appetite = rp.appetiteRating || '';
    const note     = rp.riskMgmtNotes || assessment.measureNotes?.[cap.id]?.['ict_risk'] || '';

    const openRisks   = rp.openRisks           || 0;
    const notAssessed = rp.controlsNotAssessed  || 0;
    const partial     = rp.controlsPartial      || 0;
    const effective   = rp.controlsEffective    || 0;

    totalEffective   += effective;
    totalPartial     += partial;
    totalNotAssessed += notAssessed;
    totalOpenRisks   += openRisks;

    let openRisksHtml;
    if (!openRisks) {
      openRisksHtml = `<span style="color:var(--text-muted)">—</span>`;
    } else if (openRisks >= 10) {
      openRisksHtml = `<span style="font-family:var(--font-mono);font-size:0.85rem;color:#e74c3c">${openRisks}</span>`;
    } else if (openRisks >= 5) {
      openRisksHtml = `<span style="font-family:var(--font-mono);font-size:0.85rem;color:#e67e22">${openRisks}</span>`;
    } else {
      openRisksHtml = `<span style="font-family:var(--font-mono);font-size:0.85rem">${openRisks}</span>`;
    }

    const hasControls = notAssessed > 0 || partial > 0 || effective > 0;
    const controlsHtml = hasControls ? `
      <div class="controls-summary">
        <span class="controls-summary-line"><span style="color:#e74c3c">○</span> Not Assessed: ${notAssessed}</span>
        <span class="controls-summary-line"><span style="color:#e67e22">◑</span> Part. Effective: ${partial}</span>
        <span class="controls-summary-line"><span style="color:#2ecc71">✓</span> Effective: ${effective}</span>
      </div>` : `<span style="color:var(--text-muted)">—</span>`;

    const noteHtml = note
      ? `<span style="font-size:0.75rem;color:var(--text-muted);font-style:italic">${note}</span>`
      : `<span style="color:var(--text-muted)">—</span>`;

    return `
      <tr>
        <td style="font-size:0.85rem;font-weight:600;min-width:160px">${shortName(cap.name)}</td>
        <td>${ratingBadge(residual)}</td>
        <td>${ratingBadge(appetite)}</td>
        <td style="text-align:center">${openRisksHtml}</td>
        <td>${controlsHtml}</td>
        <td><span class="rcsa-source">Riskonnect RCSA &amp; CSA</span></td>
        <td style="max-width:260px">${noteHtml}</td>
      </tr>`;
  }).join('');

  const footerTally = `
    <span class="footer-controls-tally">
      <span style="color:#2ecc71">✓ ${totalEffective}</span>
      <span style="color:#e67e22">◑ ${totalPartial}</span>
      <span style="color:#e74c3c">○ ${totalNotAssessed}</span>
      <span style="color:var(--text-muted)">· ${totalOpenRisks} open risks</span>
    </span>`;

  return `
    <div class="profile-card">
      <details>
        <summary class="profile-card-summary">
          <div class="profile-card-title-block">
            <span class="profile-card-chevron">▶</span>
            <span style="font-size:1.3rem;line-height:1;flex-shrink:0">🛡️</span>
            <div>
              <div class="profile-card-title">ICT Risk Management</div>
              <div class="profile-card-subtitle">Residual risk and control data from Riskonnect RCSA &amp; CSA cycle</div>
            </div>
          </div>
        </summary>
        <div style="overflow-x:auto;margin-top:1.25rem">
          <table class="profile-table">
            <thead>
              <tr>
                <th>Capability</th>
                <th>Residual Risk</th>
                <th>Risk Appetite</th>
                <th style="text-align:center">Open Risks</th>
                <th>Controls</th>
                <th>RCSA / CSA</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr>
                <td colspan="4">Assessment: ${assessment.label} · ${formatDate(assessment.date)}</td>
                <td colspan="3" style="text-align:right">${footerTally}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>
    </div>`;
}
