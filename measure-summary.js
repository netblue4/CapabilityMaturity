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

    const GOAL_PCT = 60; // 3/5 = 60%
    const HDR = 'font-size:.62rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);flex-shrink:0';

    const bars = CONFIG.capabilities.map((cap, i) => {
      const s  = scores[i];
      const ps = prevScores ? prevScores[i] : 0;
      const lv = levelForScore(s);
      const atGoal = s >= 3;
      const delta = s > 0 && ps > 0 ? s - ps : null;
      const deltaInner = delta !== null
        ? `<span class="delta ${delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat'}">${delta > 0 ? '▲' : delta < 0 ? '▼' : '●'}${delta !== 0 ? Math.abs(delta) : ''}</span>`
        : `<span class="delta delta-flat">●</span>`;
      const valStyle = atGoal ? ' style="color:var(--clr-success);font-weight:600"' : '';
      return `<div class="mini-bar-row">
        <span class="mini-bar-label">${shortName(cap.name)}</span>
        <div class="mini-bar-track">
          <div class="mini-bar-fill" style="width:${(s/5)*100}%;background:${lv ? lv.color : 'var(--clr-fill-dark)'}"></div>
          <div class="mini-goal-line"></div>
        </div>
        <span class="mini-bar-val"${valStyle}>${s > 0 ? s : '—'}</span>
        <span class="mini-bar-delta">${deltaInner}</span>
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
        <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:.4rem">
          <span class="mini-bar-label"></span>
          <div class="mini-bar-track mini-bar-track-hdr">
            <span class="mini-goal-lbl" style="left:${GOAL_PCT}%">▾ TGT 3</span>
          </div>
          <span style="${HDR};width:24px;text-align:right">SC</span>
          <span style="${HDR};width:48px;text-align:center">Δ</span>
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
  const HDR = 'font-size:.62rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);flex-shrink:0';

  function getResidualAbbrev(value) {
    if (!value) return null;
    if (value.startsWith('Extreme'))     return 'EXT';
    if (value.startsWith('Significant')) return 'SIG';
    if (value.startsWith('Moderate'))    return 'MOD';
    if (value.startsWith('Low'))         return 'LOW';
    return null;
  }

  function getResidualColor(value) {
    const idx = riskKeys.indexOf(value);
    return idx >= 0 ? (CONFIG.levels[idx]?.color || null) : null;
  }

  // Sustainability level counts for summary badge
  const sustCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, na: 0 };

  const rows = CONFIG.capabilities.map(cap => {
    const rm        = getRiskManagement(assessment, cap.id);
    const residual  = rm.residualRating || '';
    const abbrev    = getResidualAbbrev(residual);
    const rColor    = getResidualColor(residual);

    // Sustainability level — use stored value if set, otherwise derive
    const sustLevel = rm.sustainabilityLevel || computeSustainabilityLevel(rm);
    const sustDef   = sustLevelDef(sustLevel);
    const sustColor = CONFIG.levels[sustLevel - 1]?.color || 'var(--clr-badge-empty)';

    const hasAnyData = (rm.risksAssessed > 0) || (rm.risksDraft > 0) || (rm.openRisks > 0) || !!rm.residualRating;
    if (!hasAnyData) {
      sustCounts.na++;
    } else {
      sustCounts[sustLevel] = (sustCounts[sustLevel] || 0) + 1;
    }

    // Residual badge
    const residualBadge = (rm.risksAssessed > 0) && abbrev
      ? `<span class="risk-residual-badge" style="background:${rColor};color:#fff" title="${residual}">${abbrev}</span>`
      : `<span class="risk-residual-badge risk-badge-na">NA</span>`;

    // Sustainability level badge — only show if capability has any data
    const sustBadge = hasAnyData
      ? `<span class="sust-level-badge" style="background:${sustColor}" title="${sustDef ? sustDef.name : ''}">
           ${sustLevel}<span class="sust-level-short">${sustDef && sustLevel >= 4 ? (sustLevel === 5 ? 'E' : 'J') : ''}</span>
         </span>`
      : `<span class="sust-level-badge sust-badge-na" title="No risk data">—</span>`;

    // Pending flag — draft risks not yet formally assessed
    const draft = rm.risksDraft || 0;
    const pendingHtml = draft > 0
      ? `<span class="risk-gap-flag" title="${draft} draft risk${draft > 1 ? 's' : ''} pending assessment">⚠${draft}</span>`
      : `<span class="risk-gap-flag"></span>`;

    // Row highlight for out-of-tolerance (sustLevel 2 or 3)
    const rowBorder = (sustLevel === 2 || sustLevel === 3) && hasAnyData
      ? ` style="border-left:2px solid ${sustColor};padding-left:.35rem;margin-left:-.4rem"`
      : '';

    // Control columns
    const eff  = rm.controlsEffective   || 0;
    const part = rm.controlsPartial     || 0;
    const naC  = rm.controlsNotAssessed || 0;
    const rmAssessed = rm.risksAssessed > 0;
    const effHtml  = rmAssessed ? (eff  > 0 ? `${eff}`  : '—') : '—';
    const partHtml = rmAssessed ? (part > 0 ? `${part}` : '—') : '—';
    const naHtml   = rmAssessed ? (naC  > 0 ? `${naC}`  : '—') : '—';

    return `<div class="mini-bar-row"${rowBorder}>
      <span class="mini-bar-label">${shortName(cap.name)}</span>
      <div class="mini-bar-track"></div>
      ${sustBadge}
      ${residualBadge}
      ${pendingHtml}
      <span class="risk-ctrl-col">${effHtml}</span>
      <span class="risk-ctrl-col">${partHtml}</span>
      <span class="risk-ctrl-col">${naHtml}</span>
    </div>`;
  }).join('');

  // Summary badge — show worst sustainability concern
  const worstLevel = [1, 2, 3].find(l => sustCounts[l] > 0);
  let badgeText, badgeBg;
  if (sustCounts.na === CONFIG.capabilities.length) {
    badgeText = 'No risks assessed';
    badgeBg   = 'var(--clr-badge-empty)';
  } else if (worstLevel) {
    const def = sustLevelDef(worstLevel);
    badgeText = `${sustCounts[worstLevel]} ${def ? def.shortName : 'Level ' + worstLevel}`;
    if (sustCounts[worstLevel + 1] || sustCounts[worstLevel + 2]) {
      const higher = [2,3,4,5].filter(l => l > worstLevel && sustCounts[l] > 0)
        .map(l => `${sustCounts[l]} L${l}`).join(' · ');
      if (higher) badgeText += ' · ' + higher;
    }
    badgeBg = CONFIG.levels[worstLevel - 1]?.color || 'var(--clr-danger)';
  } else {
    // All within tolerance
    const evid = sustCounts[5] || 0;
    const judg = sustCounts[4] || 0;
    if (evid > 0 && judg === 0) {
      badgeText = `${evid} Within Tolerance — Evidenced`;
      badgeBg   = CONFIG.levels[4]?.color || 'var(--clr-success)';
    } else if (evid > 0) {
      badgeText = `${evid} Evidenced · ${judg} Judgment`;
      badgeBg   = CONFIG.levels[3]?.color || 'var(--clr-success)';
    } else {
      badgeText = `${judg} Within Tolerance`;
      badgeBg   = CONFIG.levels[3]?.color || 'var(--clr-success)';
    }
  }

  return `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">🛡️</span>
        <div>
          <h3 class="measure-card-title">ICT RCSA & CSA — Risk Management Sustainability</h3>
          <p class="measure-card-desc">Can our teams consistently perform their risk controls without it becoming unsustainable?</p>
        </div>
        <span class="measure-avg-badge" style="background:${badgeBg}">
          ${badgeText}
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:.25rem;padding-left:calc(90px + 0.4rem)">
        <span style="flex:1"></span>
        <span style="${HDR};width:44px;text-align:center">Sust</span>
        <span style="${HDR};width:36px;text-align:center">Risk</span>
        <span style="${HDR};width:28px;text-align:center">Pend</span>
        <span style="${HDR};width:48px;text-align:right">Eff</span>
        <span style="${HDR};width:48px;text-align:right">Part Eff</span>
        <span style="${HDR};width:48px;text-align:right">Not Ass</span>
      </div>
      <div class="mini-bars">${rows}</div>
    </div>`;
}
