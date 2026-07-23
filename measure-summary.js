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
  const riskKeys = Object.keys(CONFIG.riskScoreMatrix || {});

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
  function fmtN(n) { return n === 0 ? '—' : String(n); }

  // ── Per-capability table rows ─────────────────────────────────
  const tableRows = CONFIG.capabilities.map(cap => {
    const rm    = getRiskManagement(assessment, cap.id);
    const facts = ftForCap(assessment, cap.id);
    const pRows = ftPolicyRowsForCap(assessment, cap.id);

    const abbrev = residualAbbrev(rm.residualRating);
    const rCol   = residualColor(rm.residualRating);
    const resBadge = abbrev
      ? `<span class="risk-residual-badge" style="background:${rCol};color:#fff" title="${rm.residualRating}">${abbrev}</span>`
      : `<span class="risk-residual-badge risk-badge-na">—</span>`;

    const ps    = ftPolicyMetrics(pRows);
    const dFacts = ftLocPol(facts);
    const dCtrl  = ftControlMetrics(dFacts);
    const dRisk  = ftRiskMetrics(dFacts);
    const gFacts = ftGrpStd(facts);
    const gCtrl  = ftControlMetrics(gFacts);
    const gRisk  = ftRiskMetrics(gFacts);
    const pFacts = ftOperational(facts);
    const pCtrl  = ftControlMetrics(pFacts);
    const pRisk  = ftRiskMetrics(pFacts);

    const noData = facts.length === 0 && pRows.length === 0 && !abbrev;
    if (noData) {
      return `<tr>
        <td class="rcsa-cap-cell">${shortName(cap.name)}</td>
        <td class="rcsa-residual-cell">${resBadge}</td>
        <td colspan="26" style="text-align:center;color:var(--text-dim);font-size:.78rem">No data imported</td>
      </tr>`;
    }

    return `<tr>
      <td class="rcsa-cap-cell">${shortName(cap.name)}</td>
      <td class="rcsa-residual-cell">${resBadge}</td>
      <td class="ft-col-ps">${fmtN(ps.total)}</td>
      <td class="ft-col-ps">${fmtN(ps.locPol)}</td>
      <td class="ft-col-ps">${fmtN(ps.grpStd)}</td>
      <td class="ft-col-d">${fmtN(dCtrl.total)}</td>
      <td class="ft-col-d">${fmtN(dRisk.total)}</td>
      <td class="ft-col-d">${fmtN(dCtrl.implemented)}</td>
      <td class="ft-col-d">${fmtN(dCtrl.assessed)}</td>
      <td class="ft-col-d">${fmtN(dCtrl.effective)}</td>
      <td class="ft-col-d">${fmtN(dCtrl.partlyEffective)}</td>
      <td class="ft-col-d">${fmtN(dCtrl.notAssessed)}</td>
      <td class="ft-col-g">${fmtN(gCtrl.total)}</td>
      <td class="ft-col-g">${fmtN(gRisk.total)}</td>
      <td class="ft-col-g">${fmtN(gCtrl.implemented)}</td>
      <td class="ft-col-g">${fmtN(gCtrl.assessed)}</td>
      <td class="ft-col-g">${fmtN(gCtrl.effective)}</td>
      <td class="ft-col-g">${fmtN(gCtrl.partlyEffective)}</td>
      <td class="ft-col-g">${fmtN(gCtrl.notAssessed)}</td>
      <td class="ft-col-p">${fmtN(pRisk.total)}</td>
      <td class="ft-col-p">${fmtN(pRisk.open)}</td>
      <td class="ft-col-p">${fmtN(pRisk.draft)}</td>
      <td class="ft-col-p">${fmtN(pCtrl.total)}</td>
      <td class="ft-col-p">${fmtN(pCtrl.implemented)}</td>
      <td class="ft-col-p">${fmtN(pCtrl.assessed)}</td>
      <td class="ft-col-p">${fmtN(pCtrl.effective)}</td>
      <td class="ft-col-p">${fmtN(pCtrl.partlyEffective)}</td>
      <td class="ft-col-p">${fmtN(pCtrl.notAssessed)}</td>
    </tr>`;
  }).join('');

  // ── Exec-mode dual bars (Operational vs DORA implementation %) ─
  function renderExecBars() {
    const capRows = CONFIG.capabilities.map(cap => {
      const facts   = ftForCap(assessment, cap.id);
      const opFacts = ftOperational(facts);
      const dorFacts = [...ftLocPol(facts), ...ftGrpStd(facts)];
      const opImpl  = opFacts.filter(ftIsImplemented).length;
      const opPct   = opFacts.length > 0 ? Math.round((opImpl / opFacts.length) * 100) : null;
      const dorImpl = dorFacts.filter(ftIsImplemented).length;
      const dorPct  = dorFacts.length > 0 ? Math.round((dorImpl / dorFacts.length) * 100) : null;
      const opW  = opPct  !== null ? opPct  : 0;
      const dorW = dorPct !== null ? dorPct : 0;
      return `<div class="rcsa-exec-bar-row">
        <span class="rcsa-exec-bar-lbl">${shortName(cap.name)}</span>
        <div class="rcsa-exec-bar-track">
          <div class="rcsa-exec-l1-fill" style="width:${opW}%"></div>
          <div class="rcsa-exec-tick" style="left:80%"></div>
        </div>
        <span class="rcsa-exec-bar-pct rcsa-l1-pct${opPct !== null && opPct >= 80 ? ' rcsa-pct-good' : ''}">${opPct !== null ? opPct + '%' : '—'}</span>
        <div class="rcsa-exec-bar-track">
          <div class="rcsa-exec-l2-fill" style="width:${dorW}%"></div>
          <div class="rcsa-exec-tick" style="left:80%"></div>
        </div>
        <span class="rcsa-exec-bar-pct rcsa-l2-pct${dorPct !== null && dorPct >= 80 ? ' rcsa-pct-good' : ''}">${dorPct !== null ? dorPct + '%' : '—'}</span>
      </div>`;
    }).join('');
    return `
      <div class="rcsa-exec-bars">
        <div class="rcsa-exec-bars-title">Coverage at a Glance — Pre-DORA vs DORA</div>
        <div class="rcsa-exec-bars-key">
          <span class="rcsa-key-dot rcsa-key-l1"></span><span>Pre-DORA — Operational Controls Implemented</span>
          <span class="rcsa-key-dot rcsa-key-l2" style="margin-left:.75rem"></span><span>DORA — LocPol &amp; GrpStd Controls Implemented</span>
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

  return `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">🛡️</span>
        <div>
          <h3 class="measure-card-title">ICT RCSA &amp; CSA — Risk Management Metrics</h3>
          <p class="measure-card-desc">Metrics derived from Riskonnect and Policy Statement imports.</p>
        </div>
      </div>
      ${opts.execMode ? renderExecBars() : ''}
      <div class="rcsa-table-wrap">
        <table class="rcsa-metrics-table ft-metrics-table">
          <thead>
            <tr>
              <th class="rcsa-th-cap" rowspan="2">Capability</th>
              <th rowspan="2">Residual</th>
              <th colspan="3" class="ft-grp-hdr ft-grp-ps">Policy Objectives</th>
              <th colspan="7" class="ft-grp-hdr ft-grp-d">DORA LocPol Controls</th>
              <th colspan="7" class="ft-grp-hdr ft-grp-g">DORA GrpStd Controls</th>
              <th colspan="9" class="ft-grp-hdr ft-grp-p">Pre-DORA Operational</th>
            </tr>
            <tr>
              <th class="ft-col-ps ft-sub-hdr" title="Total policy statements">PS1</th>
              <th class="ft-col-ps ft-sub-hdr" title="Local Policy statements">PS2</th>
              <th class="ft-col-ps ft-sub-hdr" title="Group Standard statements">PS3</th>
              <th class="ft-col-d ft-sub-hdr" title="Total LocPol controls">D1</th>
              <th class="ft-col-d ft-sub-hdr" title="Unique risks">D2</th>
              <th class="ft-col-d ft-sub-hdr" title="Implemented controls">D3</th>
              <th class="ft-col-d ft-sub-hdr" title="Assessed controls">D4</th>
              <th class="ft-col-d ft-sub-hdr" title="Effective controls">D5</th>
              <th class="ft-col-d ft-sub-hdr" title="Partly effective">D6</th>
              <th class="ft-col-d ft-sub-hdr" title="Not assessed">D7</th>
              <th class="ft-col-g ft-sub-hdr" title="Total GrpStd controls">G1</th>
              <th class="ft-col-g ft-sub-hdr" title="Unique risks">G2</th>
              <th class="ft-col-g ft-sub-hdr" title="Implemented controls">G3</th>
              <th class="ft-col-g ft-sub-hdr" title="Assessed controls">G4</th>
              <th class="ft-col-g ft-sub-hdr" title="Effective controls">G5</th>
              <th class="ft-col-g ft-sub-hdr" title="Partly effective">G6</th>
              <th class="ft-col-g ft-sub-hdr" title="Not assessed">G7</th>
              <th class="ft-col-p ft-sub-hdr" title="Unique risks">P1</th>
              <th class="ft-col-p ft-sub-hdr" title="Open risks">P2</th>
              <th class="ft-col-p ft-sub-hdr" title="Draft risks">P3</th>
              <th class="ft-col-p ft-sub-hdr" title="Total operational controls">P4</th>
              <th class="ft-col-p ft-sub-hdr" title="Implemented controls">P5</th>
              <th class="ft-col-p ft-sub-hdr" title="Assessed controls">P6</th>
              <th class="ft-col-p ft-sub-hdr" title="Effective controls">P7</th>
              <th class="ft-col-p ft-sub-hdr" title="Partly effective">P8</th>
              <th class="ft-col-p ft-sub-hdr" title="Not assessed">P9</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <div class="ft-legend">
        <div class="ft-legend-row"><span class="ft-grp-dot ft-dot-ps"></span> <strong>PS1–PS3</strong> Policy Objectives · PS1=Total · PS2=Local Policy · PS3=Group Standard</div>
        <div class="ft-legend-row"><span class="ft-grp-dot ft-dot-d"></span> <strong>D1–D7</strong> DORA LocPol · D1=Controls · D2=Risks · D3=Implemented · D4=Assessed · D5=Effective · D6=Partly · D7=Not Assessed</div>
        <div class="ft-legend-row"><span class="ft-grp-dot ft-dot-g"></span> <strong>G1–G7</strong> DORA GrpStd · G1=Controls · G2=Risks · G3=Implemented · G4=Assessed · G5=Effective · G6=Partly · G7=Not Assessed</div>
        <div class="ft-legend-row"><span class="ft-grp-dot ft-dot-p"></span> <strong>P1–P9</strong> Pre-DORA · P1=Risks · P2=Open · P3=Draft · P4=Controls · P5=Implemented · P6=Assessed · P7=Effective · P8=Partly · P9=Not Assessed</div>
      </div>
    </div>`;
}
