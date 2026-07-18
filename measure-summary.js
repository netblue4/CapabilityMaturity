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
        const atTarget = avg > 0 && targetAvg > 0 && avg >= targetAvg;
        const directionHtml = delta !== null
          ? `<span class="delta ${delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat'}" style="font-size:.75rem">${delta > 0 ? '▲' : delta < 0 ? '▼' : '●'}${delta !== 0 ? Math.abs(delta).toFixed(1) : ''}</span>`
          : `<span class="delta delta-flat" style="font-size:.75rem">●</span>`;
        const valColor  = atTarget ? 'color:var(--clr-success);font-weight:600' : 'color:var(--text-muted)';
        return `<div class="score-row">
          <span class="score-cap-name" title="${cap.name}">${shortName(cap.name)}</span>
          <div class="score-bar-wrap" style="flex:2">
            <div class="score-bar" style="width:${(avg/5)*100}%;background:${lv ? lv.color : 'var(--clr-bar-default)'}"></div>
          </div>
          <span style="min-width:55px;text-align:center;font-size:.85rem;${valColor};font-family:var(--font-body)">${avg > 0 ? avg.toFixed(1) : '—'}</span>
          <span style="width:48px;text-align:center;flex-shrink:0">${directionHtml}</span>
          <span style="min-width:55px;text-align:center;font-size:.85rem;${valColor};font-family:var(--font-body)">${avg > 0 ? targetAvg.toFixed(1) : '—'}</span>
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
      const atTarget = s === 5 || (s > 0 && t > 0 && s >= t);
      const delta = s > 0 && ps > 0 ? s - ps : null;
      const deltaInner = delta !== null
        ? `<span class="delta ${delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat'}">${delta > 0 ? '▲' : delta < 0 ? '▼' : '●'}${delta !== 0 ? Math.abs(delta).toFixed(1) : ''}</span>`
        : `<span class="delta delta-flat">●</span>`;
      const valStyle = atTarget ? ' style="color:var(--clr-success);font-weight:600"' : '';
      return `<div class="mini-bar-row">
        <span class="mini-bar-label">${shortName(cap.name)}</span>
        <div class="mini-bar-track">
          <div class="mini-bar-fill" style="width:${(s/5)*100}%;background:${lv ? lv.color : 'var(--clr-fill-dark)'}"></div>
          <div class="mini-goal-line"></div>
        </div>
        <span class="mini-bar-val"${valStyle}>${s > 0 ? s.toFixed(1) : '—'}</span>
        <span class="mini-bar-delta">${deltaInner}</span>
        <span class="mini-bar-target"${atTarget && t > 0 ? valStyle : ''}>${t > 0 ? t.toFixed(1) : '—'}</span>
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

  function getAbbrev(value) {
    if (!value) return null;
    if (value.startsWith('Extreme'))     return 'EXT';
    if (value.startsWith('Significant')) return 'SIG';
    if (value.startsWith('Moderate'))    return 'MOD';
    if (value.startsWith('Low'))         return 'LOW';
    return value.slice(0, 3).toUpperCase();
  }

  function getColor(value) {
    const idx = riskKeys.indexOf(value);
    return idx >= 0 ? (CONFIG.levels[idx]?.color || null) : null;
  }

  // Lower index = higher severity (Extreme = 0)
  function getSevIdx(value) { return riskKeys.indexOf(value); }

  const currentIndex       = db.assessments.findIndex(a => a.id === assessment.id);
  const previousAssessment = currentIndex > 0 ? db.assessments[currentIndex - 1] : null;

  let extremeCount = 0, significantCount = 0, otherCount = 0;

  const rows = CONFIG.capabilities.map(cap => {
    const rm       = getRiskManagement(assessment, cap.id);
    const assessed = (rm.risksAssessed > 0) && !!rm.residualRating;
    const residual = rm.residualRating || '';
    const abbrev   = assessed ? getAbbrev(residual) : null;
    const color    = assessed ? getColor(residual)  : null;

    if      (!assessed)        { /* naCount — no-op */ }
    else if (abbrev === 'EXT') { extremeCount++; }
    else if (abbrev === 'SIG') { significantCount++; }
    else                       { otherCount++; }

    // Trend Δ vs previous assessment (lower sevIdx = worse, so improvement = sevIdx goes up)
    let trendHtml = `<span class="risk-trend"></span>`;
    if (assessed && previousAssessment) {
      const prevRm = getRiskManagement(previousAssessment, cap.id);
      if (prevRm.risksAssessed > 0 && prevRm.residualRating) {
        const curr = getSevIdx(residual);
        const prev = getSevIdx(prevRm.residualRating);
        if (curr > prev) {
          trendHtml = `<span class="risk-trend delta delta-up" title="Risk reduced">▼</span>`;
        } else if (curr < prev) {
          trendHtml = `<span class="risk-trend delta delta-down" title="Risk increased">▲</span>`;
        } else {
          trendHtml = `<span class="risk-trend delta delta-flat">●</span>`;
        }
      }
    }

    // Control health — only show non-zero counts
    let ctrlHtml = '';
    if (assessed) {
      const parts = [];
      if ((rm.controlsEffective   || 0) > 0) parts.push(`✅ ${rm.controlsEffective}`);
      if ((rm.controlsPartial     || 0) > 0) parts.push(`⚠ ${rm.controlsPartial}`);
      if ((rm.controlsNotAssessed || 0) > 0) parts.push(`❓ ${rm.controlsNotAssessed}`);
      ctrlHtml = parts.join(' · ');
    }

    // Row highlight via inline border for EXT/SIG
    const rowStyle = (abbrev === 'EXT' || abbrev === 'SIG') && color
      ? ` style="border-left:2px solid ${color};padding-left:.35rem;margin-left:-.4rem"`
      : '';

    // Badge
    const badgeHtml = assessed
      ? `<span class="risk-residual-badge" style="background:${color};color:#fff">${abbrev}</span>`
      : `<span class="risk-residual-badge risk-badge-na">NA</span>`;

    return `<div class="mini-bar-row"${rowStyle}>
      <span class="mini-bar-label">${shortName(cap.name)}</span>
      ${badgeHtml}
      ${trendHtml}
      <span class="risk-ctrl-health">${ctrlHtml}</span>
    </div>`;
  }).join('');

  // Summary badge
  const totalAssessed = extremeCount + significantCount + otherCount;
  let badgeText, badgeBg;
  if (totalAssessed === 0) {
    badgeText = 'No risks assessed';
    badgeBg   = 'var(--clr-badge-empty)';
  } else {
    const parts = [];
    if (extremeCount     > 0) parts.push(`${extremeCount} Extreme`);
    if (significantCount > 0) parts.push(`${significantCount} Significant`);
    if (otherCount       > 0) parts.push(`${otherCount} other`);
    badgeText = parts.join(' · ');
    badgeBg   = extremeCount > 0
      ? (CONFIG.levels[0]?.color || 'var(--clr-danger)')
      : significantCount > 0
        ? (CONFIG.levels[1]?.color || 'var(--clr-warning)')
        : 'var(--clr-success)';
  }

  return `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">🛡️</span>
        <div>
          <h3 class="measure-card-title">ICT RCSA & CSA - Risk Management</h3>
          <p class="measure-card-desc">Residual risk by capability · ✅ effective · ⚠ partial · ❓ not assessed</p>
        </div>
        <span class="measure-avg-badge" style="background:${badgeBg}">
          ${badgeText}
        </span>
      </div>
      <div class="mini-bars">${rows}</div>
    </div>`;
}
