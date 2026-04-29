// ── Measure Summary Cards ────────────────────────────────────
function renderMeasureSummary(assessment) {
  const row = document.getElementById("measure-summary-row");

  // — Previous assessment (used by both scores card and measure cards) —
  const currentIndex = db.assessments.findIndex(a => a.id === assessment.id);
  const prev = currentIndex > 0 ? db.assessments[currentIndex - 1] : null;

  // — Scores card (first in row) —
  const capAvgs = CONFIG.capabilities.map(cap => capAvgScore(assessment, cap.id)).filter(v => v > 0);
  const overall = capAvgs.length ? capAvgs.reduce((a, b) => a + b, 0) / capAvgs.length : 0;
  const avgLevel = levelForScore(overall);
  const scoresCard = `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">📋</span>
        <div>
          <h3 class="measure-card-title">Capability Progress Towards Continuous Improvement</h3>
          <p class="measure-card-desc">${assessment.label} · ${formatDate(assessment.date)}</p>
        </div>
      </div>
      <button class="btn-link ratings-link" onclick="showRatingsModal(null)">ℹ Ratings</button>
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.35rem">
        <span style="width:130px;flex-shrink:0"></span>
        <span style="flex:1"></span>
        <span style="font-size:.65rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);min-width:55px;text-align:center">Score</span>
        <span style="font-size:.65rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);width:48px;text-align:center">Δ</span>
        <span style="font-size:.65rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);min-width:55px;text-align:center">Target</span>
      </div>
      ${CONFIG.capabilities.map(cap => {
        const avg = capAvgScore(assessment, cap.id);
        const lv = levelForScore(avg);
        const targets = CONFIG.measures.map(m => getMeasureTarget(assessment, cap.id, m.id)).filter(t => t > 0);
        const targetAvg = targets.length ? targets.reduce((a,b) => a+b,0) / targets.length : 0;
        const prevAvg = prev ? capAvgScore(prev, cap.id) : 0;
        const delta = avg > 0 && prevAvg > 0 ? avg - prevAvg : null;
        const directionHtml = delta !== null
          ? `<span class="delta ${delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat'}" style="font-size:.75rem">${delta > 0 ? '▲' : delta < 0 ? '▼' : '●'}${delta !== 0 ? Math.abs(delta).toFixed(1) : ''}</span>`
          : `<span class="delta delta-flat" style="font-size:.75rem">●</span>`;
        return `<div class="score-row">
          <span class="score-cap-name" title="${cap.name}">${shortName(cap.name)}</span>
          <div class="score-bar-wrap" style="flex:2">
            <div class="score-bar" style="width:${(avg/5)*100}%;background:${lv ? lv.color : 'var(--clr-bar-default)'}"></div>
          </div>
          <span style="min-width:55px;text-align:center;font-size:.85rem;color:var(--text-muted);font-family:var(--font-body)">${avg > 0 ? avg.toFixed(1) : '—'}</span>
          <span style="width:48px;text-align:center;flex-shrink:0">${directionHtml}</span>
          <span style="min-width:55px;text-align:center;font-size:.85rem;color:var(--text-muted);font-family:var(--font-body)">${avg > 0 ? targetAvg.toFixed(1) : '—'}</span>
        </div>`;
      }).join("")}
      <div class="avg-score">
        <span class="avg-label">Overall Continuous Improvement </span>
        <span class="measure-avg-badge" style="background:${avgLevel ? avgLevel.color : 'var(--clr-badge-empty)'}">
          ${overall > 0 ? overall.toFixed(1) : '—'}  / 5
        </span>
        <span class="avg-level-name">${avgLevel ? avgLevel.name : ''}</span>
      </div>
    </div>`;

  // — Dimension measure cards —

  // Render in display order: Governance, Risk, Reporting (Risk Mgmt card follows as 4th)
  const measureOrder = ['governance', 'risk', 'reporting'];
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
          <div class="mini-bar-fill" style="width:${(s/5)*100}%;background:${lv ? lv.color : 'var(--clr-fill-dark)'}"></div>
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
          <span class="measure-avg-badge" style="background:${level ? level.color : 'var(--clr-badge-empty)'}">
            ${badgeInner}
          </span>
        </div>
        <button class="btn-link ratings-link" onclick="${`showRatingsModal('${m.id}')`}">ℹ Ratings</button>
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
    return idx >= 0 ? (CONFIG.levels[idx]?.color || 'var(--clr-fill-muted)') : null;
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

  let exceedingCount = 0;
  let rcsaImproved = 0, rcsaWorsened = 0, rcsaUnchanged = 0;
  let csaImproved  = 0, csaWorsened  = 0, csaUnchanged  = 0;

  const bars = CONFIG.capabilities.map(cap => {
    const rm       = getRiskManagement(assessment, cap.id);
    const residual = rm.residualRating || '';
    const appetite = rm.appetiteRating || '';
    const rSev     = getSeverity(residual);
    const aSev     = getSeverity(appetite);
    const rColor   = getColor(residual);

    const barWidth = rSev !== null ? (rSev / maxSev) * 100 : 0;
    const barBg    = rColor || 'var(--clr-fill-dark)';

    if (rSev !== null && aSev !== null && rSev > aSev) exceedingCount++;

    const prevRm = previousAssessment ? getRiskManagement(previousAssessment, cap.id) : {};

    // RCSA Δ: increase in risks assessed = progress
    const risksAssessed     = rm.risksAssessed     ?? 0;
    const prevRisksAssessed = prevRm.risksAssessed  ?? 0;
    const raDelta = previousAssessment !== null ? risksAssessed - prevRisksAssessed : null;

    let rcsaDeltaHtml;
    if (raDelta === null) {
      rcsaDeltaHtml = `<span class="mini-bar-delta-risk risk-delta-none">—</span>`;
    } else if (raDelta > 0) {
      rcsaImproved++;
      rcsaDeltaHtml = `<span class="mini-bar-delta-risk risk-delta-improved">▲${raDelta}</span>`;
    } else if (raDelta < 0) {
      rcsaWorsened++;
      rcsaDeltaHtml = `<span class="mini-bar-delta-risk risk-delta-worsened">▼${Math.abs(raDelta)}</span>`;
    } else {
      rcsaUnchanged++;
      rcsaDeltaHtml = `<span class="mini-bar-delta-risk risk-delta-unchanged">●</span>`;
    }

    // CSA Δ: decrease in controls not assessed = progress
    const notAssessed     = rm.controlsNotAssessed     ?? 0;
    const prevNotAssessed = prevRm.controlsNotAssessed  ?? 0;
    const csaDelta = previousAssessment !== null ? notAssessed - prevNotAssessed : null;

    let csaDeltaHtml;
    if (csaDelta === null) {
      csaDeltaHtml = `<span class="mini-bar-delta-risk risk-delta-none">—</span>`;
    } else if (csaDelta < 0) {
      csaImproved++;
      csaDeltaHtml = `<span class="mini-bar-delta-risk risk-delta-improved">▼${Math.abs(csaDelta)}</span>`;
    } else if (csaDelta > 0) {
      csaWorsened++;
      csaDeltaHtml = `<span class="mini-bar-delta-risk risk-delta-worsened">▲${csaDelta}</span>`;
    } else {
      csaUnchanged++;
      csaDeltaHtml = `<span class="mini-bar-delta-risk risk-delta-unchanged">●</span>`;
    }

    return `<div class="mini-bar-row">
      <span class="mini-bar-label">${shortName(cap.name)}</span>
      <div class="mini-bar-track">
        <div class="mini-bar-fill" style="width:${barWidth}%;background:${barBg}"></div>
      </div>
      <span class="mini-bar-val">${getAbbrev(residual)}</span>
      <span class="mini-bar-val">${getAbbrev(appetite)}</span>
      ${rcsaDeltaHtml}
      ${csaDeltaHtml}
    </div>`;
  }).join('');

  const hasScored    = CONFIG.capabilities.some(cap => getSeverity(getRiskManagement(assessment, cap.id).residualRating) !== null);
  const hasTrendData = previousAssessment !== null;
  const badgeBg      = exceedingCount > 0 ? 'var(--clr-danger)' : (hasScored ? 'var(--clr-success)' : 'var(--clr-badge-empty)');
  let badgeText;
  if (!hasScored) {
    badgeText = '—';
  } else if (hasTrendData) {
    badgeText = `${exceedingCount} exceeding · RCSA ▲${rcsaImproved} · CSA ▼${csaImproved}`;
  } else {
    badgeText = `${exceedingCount} exceeding`;
  }

  const footerTally = hasTrendData
    ? `<span class="risk-tally">
        <span style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.7rem">RCSA</span>
        <span class="risk-delta-improved">▲${rcsaImproved}</span>
        <span class="risk-delta-unchanged">●${rcsaUnchanged}</span>
        <span class="risk-delta-worsened">▼${rcsaWorsened}</span>
        <span style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.7rem;margin-left:.4rem">CSA</span>
        <span class="risk-delta-improved">▼${csaImproved}</span>
        <span class="risk-delta-unchanged">●${csaUnchanged}</span>
        <span class="risk-delta-worsened">▲${csaWorsened}</span>
      </span>`
    : `<span style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.72rem">First assessment — no trend data</span>`;

  return `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">🛡️</span>
        <div>
          <h3 class="measure-card-title">ICT Risk Management - Are we treating the risks we've identified?</h3>
          <p class="measure-card-desc">· RCSA Δ = risks assessed · CSA Δ = controls not assessed</p>
        </div>
        <span class="measure-avg-badge" style="background:${badgeBg}">
          ${badgeText}
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:.25rem;padding-left:calc(90px + 0.4rem)">
        <span style="flex:1"></span>
        <span style="font-size:.62rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);width:24px;text-align:right">Res</span>
        <span style="font-size:.62rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);width:24px;text-align:right">App</span>
        <span style="font-size:.62rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);width:42px;text-align:center">RCSA Δ</span>
        <span style="font-size:.62rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);width:42px;text-align:center">CSA Δ</span>
      </div>
      <div class="mini-bars">${bars}</div>
      <div class="risk-mgmt-summary-footer">
        <span>${assessment.label} · ${formatDate(assessment.date)}</span>
        ${footerTally}
      </div>
    </div>`;
}
