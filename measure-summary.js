// ── Measure Summary Cards ────────────────────────────────────
function renderMeasureSummary(assessment) {
  const row = document.getElementById("measure-summary-row");

  // — Scores card (first in row) —
  const capAvgs = CONFIG.capabilities.map(cap => capAvgScore(assessment, cap.id)).filter(v => v > 0);
  const overall = capAvgs.length ? capAvgs.reduce((a, b) => a + b, 0) / capAvgs.length : 0;
  const avgLevel = levelForScore(overall);
  const scoresCard = `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">📋</span>
        <div>
          <h3 class="measure-card-title">Capability Maturity Summary - ICT Governance, Risk & Reporting</h3>
          <p class="measure-card-desc">${assessment.label} · ${formatDate(assessment.date)}</p>
        </div>
        <span class="measure-avg-badge" style="background:${avgLevel ? avgLevel.color : '#555'}">
          ${overall > 0 ? overall.toFixed(1) : '—'}
        </span>
      </div>
      <button class="btn-link ratings-link" onclick="showRatingsModal(null)">ℹ Ratings</button>
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.35rem">
        <span style="width:130px;flex-shrink:0"></span>
        <span style="flex:1"></span>
        <span style="font-size:.65rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);min-width:100px;text-align:center">Score</span>
        <span style="font-size:.65rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);min-width:100px;text-align:center">Target</span>
      </div>
      ${CONFIG.capabilities.map(cap => {
        const avg = capAvgScore(assessment, cap.id);
        const lv = levelForScore(avg);
        const targets = CONFIG.measures.map(m => getMeasureTarget(assessment, cap.id, m.id)).filter(t => t > 0);
        const targetAvg = targets.length ? targets.reduce((a,b) => a+b,0) / targets.length : 0;
        const tlv = levelForScore(targetAvg);
        return `<div class="score-row">
          <span class="score-cap-name" title="${cap.name}">${shortName(cap.name)}</span>
          <div class="score-bar-wrap">
            <div class="score-bar" style="width:${(avg/5)*100}%;background:${lv ? lv.color : '#ccc'}"></div>
          </div>
          <span class="score-badge" style="min-width:100px;text-align:center">${avg > 0 ? avg.toFixed(1) : '—'}</span>
          <span class="score-badge" style="min-width:100px;text-align:center">${avg > 0 ? targetAvg.toFixed(1) : '—'}</span> 
        </div>`;
      }).join("")}
      <div class="avg-score">
        <span class="avg-label">Overall Average</span>
        <span class="avg-value" style="color:${avgLevel ? avgLevel.color : '#fff'}">${overall.toFixed(1)} / 5</span>
        <span class="avg-level-name">${avgLevel ? avgLevel.name : ''}</span>
      </div>
    </div>`;

  // — Dimension measure cards (with previous assessment comparison) —
  const prev = db.assessments.length > 1 ? db.assessments[db.assessments.length - 2] : null;

  // Render in display order: Governance, Reporting, ICT Risk (Risk Mgmt card follows as 4th)
  const measureOrder = ['governance', 'reporting', 'ict_risk'];
  const orderedMeasures = measureOrder
    .map(id => CONFIG.measures.find(m => m.id === id))
    .filter(Boolean);

  const measureCards = orderedMeasures.map(m => {
    const scores = CONFIG.capabilities.map(cap => getMeasureScore(assessment, cap.id, m.id) || 0);
    const prevScores = prev ? CONFIG.capabilities.map(cap => getMeasureScore(prev, cap.id, m.id) || 0) : null;

    const valid = scores.filter(s => s > 0);
    const avg = valid.length ? valid.reduce((a,b) => a+b, 0) / valid.length : 0;
    const prevValid = prevScores ? prevScores.filter(s => s > 0) : [];
    const prevAvg = prevValid.length ? prevValid.reduce((a,b) => a+b, 0) / prevValid.length : 0;
    const level = levelForScore(avg);
    const avgDelta = prev && prevAvg > 0 && avg > 0 ? avg - prevAvg : null;

    const bars = CONFIG.capabilities.map((cap, i) => {
      const s = scores[i];
      const ps = prevScores ? prevScores[i] : 0;
      const t = getMeasureTarget(assessment, cap.id, m.id) || 0;
      const lv = levelForScore(s);
      const delta = s > 0 && ps > 0 ? s - ps : null;
      const deltaInner = delta !== null
        ? `<span class="delta ${delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat'}">${delta > 0 ? '▲' : delta < 0 ? '▼' : '●'}${delta !== 0 ? Math.abs(delta).toFixed(1) : ''}</span>`
        : `<span class="delta delta-flat">●</span>`;
      return `<div class="mini-bar-row">
        <span class="mini-bar-label">${shortName(cap.name)}</span>
        <div class="mini-bar-track">
          <div class="mini-bar-fill" style="width:${(s/5)*100}%;background:${lv ? lv.color : '#444'}"></div>
        </div>
        <span class="mini-bar-val">${s.toFixed(1) || '—'}</span>
        <span class="mini-bar-delta">${deltaInner}</span>
        <span class="mini-bar-target">${t > 0 ? t.toFixed(1) : '—'}</span>
      </div>`;
    }).join("");

    const badgeInner = prev && prevAvg > 0 && avg > 0
      ? `${prevAvg.toFixed(1)}<span class="badge-arrow">→</span>${avg.toFixed(1)}${avgDelta !== null ? `<span class="badge-delta ${avgDelta > 0 ? 'delta-up' : avgDelta < 0 ? 'delta-down' : ''}">${avgDelta > 0 ? ' ▲' : avgDelta < 0 ? ' ▼' : ''}</span>` : ''}`
      : avg > 0 ? avg.toFixed(1) : '—';

    return `
      <div class="card measure-card">
        <div class="measure-card-header">
          <span class="measure-icon">${m.icon}</span>
          <div>
            <h3 class="measure-card-title">${m.name}</h3>
            <p class="measure-card-desc">${m.description}</p>
          </div>
          <span class="measure-avg-badge" style="background:${level ? level.color : '#555'}">
            ${badgeInner}
          </span>
        </div>
        <button class="btn-link ratings-link" onclick="${m.id === 'ict_risk' ? 'showIctRiskRatingsModal()' : `showRatingsModal('${m.id}')`}">ℹ Ratings</button>
        <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:.25rem;padding-left:calc(90px + 0.4rem)">
          <span style="flex:1"></span>
          <span style="font-size:.62rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);width:24px;text-align:right">Sc</span>
          <span style="font-size:.62rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);width:48px;text-align:center">Δ</span>
          <span style="font-size:.62rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);width:36px;text-align:right">Tgt</span>
        </div>
        <div class="mini-bars">${bars}</div>
      </div>`;
  }).join("");

  document.getElementById("scores-card-slot").innerHTML = scoresCard;
  row.innerHTML = measureCards + renderRiskMgmtSummaryCard(assessment);
}

// ── ICT Risk Management Summary Card ─────────────────────────
function renderRiskMgmtSummaryCard(assessment) {
  const rp       = assessment.riskProfile || {};
  const riskKeys = Object.keys(CONFIG.riskScoreMatrix || {});
  const maxSev   = riskKeys.length || 4;

  // Returns 1–maxSev for known ratings, null for missing/unknown
  function getSeverity(value) {
    if (!value) return null;
    const idx = riskKeys.indexOf(value);
    return idx < 0 ? null : riskKeys.length - idx;
  }

  function getColor(value) {
    const idx = riskKeys.indexOf(value);
    return idx >= 0 ? (CONFIG.levels[idx]?.color || '#888') : null;
  }

  function getAbbrev(value) {
    if (!value) return '—';
    if (value.startsWith('Extreme'))     return 'EXT';
    if (value.startsWith('Significant')) return 'SIG';
    if (value.startsWith('Moderate'))    return 'MOD';
    if (value.startsWith('Low'))         return 'LOW';
    return value.slice(0, 3).toUpperCase();
  }

  const currentIndex       = db.assessments.findIndex(a => a.id === assessment.id);
  const previousAssessment = currentIndex > 0 ? db.assessments[currentIndex - 1] : null;
  const prevRp             = previousAssessment?.riskProfile || {};

  let exceedingCount = 0, improvedCount = 0, worsenedCount = 0, unchangedCount = 0;

  const bars = CONFIG.capabilities.map(cap => {
    const capRp    = rp[cap.id] || {};
    const residual = capRp.residualRating || '';
    const appetite = capRp.appetiteRating || '';
    const rSev     = getSeverity(residual);
    const aSev     = getSeverity(appetite);
    const rColor   = getColor(residual);
    const aColor   = getColor(appetite);

    const barWidth = rSev !== null ? (rSev / maxSev) * 100 : 0;
    const barBg    = rColor || '#444';

    if (rSev !== null && aSev !== null && rSev > aSev) exceedingCount++;

    const prevResidual = (prevRp[cap.id] || {}).residualRating || '';
    const prevSev      = getSeverity(prevResidual);
    const delta        = rSev !== null && prevSev !== null ? rSev - prevSev : null;

    let deltaHtml;
    if (delta === null) {
      deltaHtml = `<span class="mini-bar-delta-risk risk-delta-none">—</span>`;
    } else if (delta < 0) {
      improvedCount++;
      deltaHtml = `<span class="mini-bar-delta-risk risk-delta-improved">↓${Math.abs(delta)}</span>`;
    } else if (delta > 0) {
      worsenedCount++;
      deltaHtml = `<span class="mini-bar-delta-risk risk-delta-worsened">↑${delta}</span>`;
    } else {
      unchangedCount++;
      deltaHtml = `<span class="mini-bar-delta-risk risk-delta-unchanged">→</span>`;
    }

    return `<div class="mini-bar-row">
      <span class="mini-bar-label">${shortName(cap.name)}</span>
      <div class="mini-bar-track">
        <div class="mini-bar-fill" style="width:${barWidth}%;background:${barBg}"></div>
      </div>
      <span class="mini-bar-val">
        ${getAbbrev(residual)}
      </span>
      ${deltaHtml}
      <span class="mini-bar-val">
        ${getAbbrev(appetite)}
      </span>
    </div>`;
  }).join('');

  const hasScored    = CONFIG.capabilities.some(cap => getSeverity(rp[cap.id]?.residualRating) !== null);
  const hasTrendData = previousAssessment !== null;
  const badgeBg      = exceedingCount > 0 ? '#e74c3c' : (hasScored ? '#2ecc71' : '#555');
  let badgeText;
  if (!hasScored) {
    badgeText = '—';
  } else if (hasTrendData) {
    badgeText = `${exceedingCount} exceeding · ${improvedCount} improved`;
  } else {
    badgeText = `${exceedingCount} exceeding`;
  }

  const footerTally = hasTrendData
    ? `<span class="risk-tally">
        <span class="risk-delta-improved">▼${improvedCount}</span>
        <span class="risk-delta-unchanged">●${unchangedCount}</span>
        <span class="risk-delta-worsened">▲${worsenedCount}</span>
      </span>`
    : `<span style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.72rem">First assessment — no trend data</span>`;

  return `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">🛡️</span>
        <div>
          <h3 class="measure-card-title">ICT Risk Management</h3>
          <p class="measure-card-desc">Residual risk vs appetite</p>
        </div>
        <span class="measure-avg-badge risk-header-badge" style="background:${badgeBg}">
          ${badgeText}
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:.25rem;padding-left:calc(90px + 0.4rem)">
        <span style="flex:1"></span>
        <span style="font-size:.62rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);width:28px;text-align:right">Res</span>
        <span style="font-size:.62rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);width:48px;text-align:center">Δ</span>
        <span style="font-size:.62rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);width:32px;text-align:right">App</span>
      </div>
      <div class="mini-bars">${bars}</div>
      <div class="risk-mgmt-summary-footer">
        <span>${assessment.label} · ${formatDate(assessment.date)}</span>
        ${footerTally}
      </div>
    </div>`;
}
