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

    const HDR = 'font-size:.62rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);flex-shrink:0';

    // 5 level tick lines at 20%, 40%, 60%, 80%, 100%
    const levelLines = [1, 2, 3, 4, 5].map(l => {
      const ls = m.levels ? m.levels.find(ls => ls.level === l) : null;
      return `<div class="mini-goal-line" style="left:${l * 20}%"></div>`;
    }).join('');

    // 5 level labels for header track
    const levelHdrLabels = [1, 2, 3, 4, 5].map(l => {
      const ls = m.levels ? m.levels.find(ls => ls.level === l) : null;
      const abbrev = abbrevMeasureLevel(ls?.name || '');
      return `<span class="mini-goal-lbl" style="left:${l * 20}%">${abbrev}</span>`;
    }).join('');

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
          ${levelLines}
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
          <div class="mini-bar-track mini-bar-track-hdr" style="overflow:visible">
            ${levelHdrLabels}
          </div>
          <span style="${HDR};width:24px;text-align:right">SC</span>
          <span style="${HDR};width:48px;text-align:center">Δ</span>
        </div>
        <div class="mini-bars">${bars}</div>
      </div>`;
  }).join("");

  document.getElementById("scores-card-slot").innerHTML = scoresCard;
  row.innerHTML = measureCards + renderRiskMgmtSummaryCard(assessment, prev);
}

// ── ICT Risk Management Metrics Card ─────────────────────────
function renderRiskMgmtSummaryCard(assessment, prev) {
  const riskMetrics = CONFIG.riskMetrics || [];
  const riskKeys    = Object.keys(CONFIG.riskScoreMatrix || {});

  // ── Helpers ──────────────────────────────────────────────────
  function residualAbbrev(v) {
    if (!v) return null;
    if (v.startsWith('Extreme'))     return 'EXT';
    if (v.startsWith('Significant')) return 'SIG';
    if (v.startsWith('Moderate'))    return 'MOD';
    if (v.startsWith('Low'))         return 'LOW';
    return null;
  }
  function residualColor(v) {
    const idx = riskKeys.indexOf(v);
    return idx >= 0 ? (CONFIG.levels[idx]?.color || null) : null;
  }
  function metricValue(a, capId, metricId) {
    return getRiskManagement(a, capId)?.metrics?.[metricId]?.value ?? null;
  }
  function ragClass(value, metric) {
    if (value === null) return 'rcsa-metric-na';
    if (value >= metric.thresholds.good)    return 'rcsa-metric-good';
    if (value >= metric.thresholds.warning) return 'rcsa-metric-warn';
    return 'rcsa-metric-bad';
  }
  function fmtValue(value, unit) {
    if (value === null) return '—';
    return unit === 'percent' ? value + '%' : String(value);
  }
  function trendHtml(curr, prevVal) {
    if (curr === null || prevVal === null || prevVal === undefined) return '';
    const d = curr - prevVal;
    if (d > 0) return `<span class="rcsa-trend-up"> ▲</span>`;
    if (d < 0) return `<span class="rcsa-trend-dn"> ▼</span>`;
    return '';
  }

  // ── Build rows + collect corrective actions ───────────────────
  // caGroups: { `metricId|action` → { shortName, action, entries:[{capName,value}] } }
  const caGroups = {};
  let countGood = 0, countWarn = 0, countBad = 0, countNoData = 0;

  const tableRows = CONFIG.capabilities.map(cap => {
    const rm         = getRiskManagement(assessment, cap.id);
    const hasAnyData = (rm.risksAssessed > 0) || (rm.risksDraft > 0) || (rm.openRisks > 0) || !!rm.residualRating;

    // Residual badge
    const abbrev = residualAbbrev(rm.residualRating);
    const rCol   = residualColor(rm.residualRating);
    const resBadge = (rm.risksAssessed > 0) && abbrev
      ? `<span class="risk-residual-badge" style="background:${rCol};color:#fff" title="${rm.residualRating}">${abbrev}</span>`
      : `<span class="risk-residual-badge risk-badge-na">—</span>`;

    // Per-metric cells + RAG tracking
    let worstStatus = 'good';
    const metricCells = riskMetrics.map(m => {
      const curr    = metricValue(assessment, cap.id, m.id);
      const prevVal = prev ? metricValue(prev, cap.id, m.id) : null;
      const cls     = ragClass(curr, m);

      if (curr !== null) {
        if (cls === 'rcsa-metric-bad')  worstStatus = 'bad';
        else if (cls === 'rcsa-metric-warn' && worstStatus !== 'bad') worstStatus = 'warn';

        if (cls === 'rcsa-metric-bad' || cls === 'rcsa-metric-warn') {
          const key = `${m.id}|${m.correctiveAction}`;
          if (!caGroups[key]) caGroups[key] = { name: m.shortName || m.name, action: m.correctiveAction, entries: [] };
          caGroups[key].entries.push({ capName: shortName(cap.name), value: fmtValue(curr, m.unit), cls });
        }
      }
      return `<td class="rcsa-metric-cell ${cls}">${fmtValue(curr, m.unit)}${trendHtml(curr, prevVal)}</td>`;
    }).join('');

    if (hasAnyData) {
      if      (worstStatus === 'bad')  countBad++;
      else if (worstStatus === 'warn') countWarn++;
      else                             countGood++;
    } else {
      countNoData++;
    }

    return `<tr>
      <td class="rcsa-cap-cell">${shortName(cap.name)}</td>
      <td class="rcsa-residual-cell">${resBadge}</td>
      ${metricCells}
    </tr>`;
  }).join('');

  // ── Metric column headers ─────────────────────────────────────
  const metricHeaders = riskMetrics.map(m =>
    `<th title="${m.name} — ${m.formulaNote || ''}">${m.shortName || m.name}</th>`
  ).join('');

  // ── Corrective actions ────────────────────────────────────────
  const caEntries = Object.values(caGroups);
  const caHtml = caEntries.length > 0 ? `
    <div class="rcsa-ca-section">
      <div class="rcsa-ca-title">Corrective Actions Required</div>
      ${caEntries.map(g => {
        const capList = g.entries.map(e =>
          `<span class="${e.cls === 'rcsa-metric-bad' ? 'rcsa-ca-bad' : 'rcsa-ca-warn'}">${e.capName} (${e.value})</span>`
        ).join(' · ');
        return `<div class="rcsa-ca-item">
          <span class="rcsa-ca-metric">${g.name}:</span>
          <span class="rcsa-ca-caps">${capList}</span>
          <span class="rcsa-ca-arrow">→</span>
          <span class="rcsa-ca-action">${g.action}</span>
        </div>`;
      }).join('')}
    </div>` : '';

  // ── Summary badge ─────────────────────────────────────────────
  let badgeText, badgeBg;
  const total = CONFIG.capabilities.length;
  if (riskMetrics.length === 0 || countNoData === total) {
    badgeText = 'No data imported';
    badgeBg   = 'var(--clr-badge-empty)';
  } else if (countBad > 0) {
    badgeText = `${countBad} below target`;
    badgeBg   = CONFIG.levels[0]?.color || 'var(--clr-danger)';
  } else if (countWarn > 0) {
    badgeText = `${countWarn} need attention`;
    badgeBg   = CONFIG.levels[1]?.color || '#bc7439';
  } else {
    badgeText = `${countGood} on track`;
    badgeBg   = CONFIG.levels[3]?.color || 'var(--clr-success)';
  }

  return `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">🛡️</span>
        <div>
          <h3 class="measure-card-title">ICT RCSA &amp; CSA — Risk Management Metrics</h3>
          <p class="measure-card-desc">Quarterly metrics derived from Riskonnect data import. Trends show movement vs previous assessment.</p>
        </div>
        <span class="measure-avg-badge" style="background:${badgeBg}">${badgeText}</span>
      </div>
      <div class="rcsa-table-wrap">
        <table class="rcsa-metrics-table">
          <thead>
            <tr>
              <th class="rcsa-th-cap">Capability</th>
              <th>Residual</th>
              ${metricHeaders}
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      ${caHtml}
    </div>`;
}
