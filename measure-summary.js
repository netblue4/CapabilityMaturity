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
function renderRiskMgmtSummaryCard(assessment, prev, opts = {}) {
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

  // ── Build rows ────────────────────────────────────────────────
  const tableRows = CONFIG.capabilities.map(cap => {
    const rm = getRiskManagement(assessment, cap.id);

    const abbrev = residualAbbrev(rm.residualRating);
    const rCol   = residualColor(rm.residualRating);
    const resBadge = (rm.risksAssessed > 0) && abbrev
      ? `<span class="risk-residual-badge" style="background:${rCol};color:#fff" title="${rm.residualRating}">${abbrev}</span>`
      : `<span class="risk-residual-badge risk-badge-na">—</span>`;

    const metricCells = riskMetrics.map(m => {
      const curr    = metricValue(assessment, cap.id, m.id);
      const prevVal = prev ? metricValue(prev, cap.id, m.id) : null;
      const cls     = ragClass(curr, m);
      return `<td class="rcsa-metric-cell ${cls}">${fmtValue(curr, m.unit)}${trendHtml(curr, prevVal)}</td>`;
    }).join('');

    return `<tr>
      <td class="rcsa-cap-cell">${shortName(cap.name)}</td>
      <td class="rcsa-residual-cell">${resBadge}</td>
      ${metricCells}
    </tr>`;
  }).join('');

  // ── Exec-mode dual bars (L1 vs L2 visual) ────────────────────
  function renderExecBars() {
    const l1Metrics = riskMetrics.filter(m => m.layer === 'L1');
    const l2Metrics = riskMetrics.filter(m => m.layer === 'L2');
    const capRows = CONFIG.capabilities.map(cap => {
      const rm = getRiskManagement(assessment, cap.id);
      const metrics = rm.metrics || {};
      const l1Vals = l1Metrics.map(m => metrics[m.id]?.value).filter(v => v !== null && v !== undefined);
      const l1Avg  = l1Vals.length ? Math.round(l1Vals.reduce((a,b) => a+b, 0) / l1Vals.length) : null;
      const l2Vals = l2Metrics.map(m => metrics[m.id]?.value).filter(v => v !== null && v !== undefined);
      const l2Avg  = l2Vals.length ? Math.round(l2Vals.reduce((a,b) => a+b, 0) / l2Vals.length) : null;
      const l1W = l1Avg !== null ? l1Avg : 0;
      const l2W = l2Avg !== null ? l2Avg : 0;
      return `<div class="rcsa-exec-bar-row">
        <span class="rcsa-exec-bar-lbl">${shortName(cap.name)}</span>
        <div class="rcsa-exec-bar-track">
          <div class="rcsa-exec-l1-fill" style="width:${l1W}%"></div>
          <div class="rcsa-exec-tick" style="left:80%"></div>
        </div>
        <span class="rcsa-exec-bar-pct rcsa-l1-pct${l1Avg !== null && l1Avg >= 80 ? ' rcsa-pct-good' : ''}">${l1Avg !== null ? l1Avg + '%' : '—'}</span>
        <div class="rcsa-exec-bar-track">
          <div class="rcsa-exec-l2-fill" style="width:${l2W}%"></div>
          <div class="rcsa-exec-tick" style="left:80%"></div>
        </div>
        <span class="rcsa-exec-bar-pct rcsa-l2-pct${l2Avg !== null && l2Avg >= 80 ? ' rcsa-pct-good' : ''}">${l2Avg !== null ? l2Avg + '%' : '—'}</span>
      </div>`;
    }).join('');
    return `
      <div class="rcsa-exec-bars">
        <div class="rcsa-exec-bars-title">Coverage at a Glance — Pre-DORA vs DORA</div>
        <div class="rcsa-exec-bars-key">
          <span class="rcsa-key-dot rcsa-key-l1"></span><span>Pre-DORA (L1) — ${l1Metrics.map(m => m.shortName).join(', ')}</span>
          <span class="rcsa-key-dot rcsa-key-l2" style="margin-left:.75rem"></span><span>DORA (L2) — ${l2Metrics.map(m => m.shortName).join(', ')}</span>
          <span style="margin-left:auto;color:var(--text-dim);font-size:.68rem">│ = 80% target</span>
        </div>
        <div class="rcsa-exec-bar-row rcsa-exec-bar-hdr">
          <span class="rcsa-exec-bar-lbl"></span>
          <span class="rcsa-exec-bar-track-hdr">Pre-DORA avg</span>
          <span class="rcsa-exec-bar-pct"></span>
          <span class="rcsa-exec-bar-track-hdr">DORA avg</span>
          <span class="rcsa-exec-bar-pct"></span>
        </div>
        ${capRows}
      </div>`;
  }

  // ── Metric column headers ─────────────────────────────────────
  const metricHeaders = riskMetrics.map(m => {
    const layerBadge = m.layer
      ? `<br><span class="metric-layer-badge metric-layer-${m.layer.toLowerCase()}">${m.layer}</span>`
      : '';
    return `<th title="${m.name} — ${m.formulaNote || ''}">${m.shortName || m.name}${layerBadge}</th>`;
  }).join('');

  // ── Metric legend ─────────────────────────────────────────────
  const legendHtml = riskMetrics.length > 0 ? `
    <div class="rcsa-ca-section">
      <div class="rcsa-ca-title">Metric Definitions &amp; Corrective Actions</div>
      ${riskMetrics.map(m => `
        <div class="rcsa-legend-item">
          <span class="rcsa-legend-short">${m.shortName || m.name}</span>
          ${m.layer ? `<span class="rcsa-legend-layer rcsa-legend-layer-${m.layer.toLowerCase()}">${m.layer}</span>` : ''}
          <span class="rcsa-legend-name">${m.name}</span>
          <span class="rcsa-legend-sep">—</span>
          <span class="rcsa-legend-desc">${m.description || ''}</span>
          <span class="rcsa-legend-arrow">→</span>
          <span class="rcsa-legend-action">${m.correctiveAction || ''}</span>
        </div>`).join('')}
    </div>` : '';

  return `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">🛡️</span>
        <div>
          <h3 class="measure-card-title">ICT RCSA &amp; CSA — Risk Management Metrics</h3>
          <p class="measure-card-desc">Quarterly metrics derived from Riskonnect data import. Trends show movement vs previous assessment.</p>
        </div>
      </div>
      ${opts.execMode ? renderExecBars() : ''}
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
      ${legendHtml}
    </div>`;
}
