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

// ── Shared 4-table body (used by the card AND import review screens) ──
function renderFactSummaryTables(curr, prevF) {
  curr  = curr  || {};
  prevF = prevF || {};

  // ── Trend arrow ───────────────────────────────────────────────
  function arrow(cv, pv) {
    if (pv === null || pv === undefined) return '';
    const d = cv - pv;
    if (d > 0) return `<span class="ft-trend-up"> ▲${d}</span>`;
    if (d < 0) return `<span class="ft-trend-dn"> ▼${Math.abs(d)}</span>`;
    return '';
  }

  // ── Build lookup from previous rows ──────────────────────────
  function prevMap(rows, keyFn) {
    const m = {};
    (rows || []).forEach(r => { m[keyFn(r)] = r; });
    return m;
  }

  // ── REMOVED rows: in prev but not in current ──────────────────
  function removedRows(currRows, prevRows, keyFn) {
    const currKeys = new Set((currRows || []).map(keyFn));
    return (prevRows || []).filter(r => !currKeys.has(keyFn(r)));
  }

  // ── Table 1: Policy Objectives ────────────────────────────────
  function renderPoTable() {
    const rows = curr.policyObjectives || [];
    const pm   = prevMap(prevF.policyObjectives, r => r.capId + '||' + r.document);
    const gone = removedRows(rows, prevF.policyObjectives, r => r.capId + '||' + r.document);

    if (!rows.length && !gone.length) return '';

    const activeHtml = rows.map(r => {
      const p = pm[r.capId + '||' + r.document];
      return `<tr>
        <td class="ft-td-cap">${shortName(r.capName)}</td>
        <td class="ft-td-doc">${r.document}</td>
        <td class="ft-col-ps">${r.ps1}${arrow(r.ps1, p?.ps1)}</td>
        <td class="ft-col-ps">${r.ps2}${arrow(r.ps2, p?.ps2)}</td>
        <td class="ft-col-ps">${r.ps3}${arrow(r.ps3, p?.ps3)}</td>
      </tr>`;
    }).join('');

    const removedHtml = gone.map(r => `<tr class="ft-row-removed">
      <td class="ft-td-cap">${shortName(r.capName)}</td>
      <td class="ft-td-doc">${r.document}&nbsp;<span class="ft-removed-badge">REMOVED</span></td>
      <td class="ft-col-ps ft-removed-val">${r.ps1}</td>
      <td class="ft-col-ps ft-removed-val">${r.ps2}</td>
      <td class="ft-col-ps ft-removed-val">${r.ps3}</td>
    </tr>`).join('');

    return `
      <div class="ft-section">
        <div class="ft-section-hdr ft-hdr-ps">Policy Objectives</div>
        <div class="rcsa-table-wrap">
          <table class="rcsa-metrics-table ft-sub-table">
            <thead><tr>
              <th class="ft-th-cap">Capability</th>
              <th class="ft-th-doc">Document</th>
              <th class="ft-col-ps ft-sub-hdr" title="Total statements">Total</th>
              <th class="ft-col-ps ft-sub-hdr" title="Local Policy">LocPol</th>
              <th class="ft-col-ps ft-sub-hdr" title="Group Standard">GrpStd</th>
            </tr></thead>
            <tbody>${activeHtml}${removedHtml}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── Tables 2 & 3: LocPol / GrpStd Controls ───────────────────
  // Column order: Risks · Controls · Impl · Assessed · Eff · Partly · Not Assessed
  function renderControlTable(fsKey, title, colCls) {
    const rows = curr[fsKey] || [];
    const pm   = prevMap(prevF[fsKey], r => r.capId + '||' + r.document);
    const gone = removedRows(rows, prevF[fsKey], r => r.capId + '||' + r.document);

    if (!rows.length && !gone.length) return '';

    const KEYS = ['risks','controls','implemented','assessed','effective','partly','notAssessed'];

    function dataCells(r, p, cls, removed) {
      return KEYS.map(k =>
        `<td class="${cls}${removed ? ' ft-removed-val' : ''}">${r[k]}${removed ? '' : arrow(r[k], p?.[k])}</td>`
      ).join('');
    }

    const activeHtml = rows.map(r => {
      const p = pm[r.capId + '||' + r.document];
      return `<tr>
        <td class="ft-td-cap">${shortName(r.capName)}</td>
        <td class="ft-td-doc">${r.document}</td>
        ${dataCells(r, p, colCls, false)}
      </tr>`;
    }).join('');

    const removedHtml = gone.map(r => `<tr class="ft-row-removed">
      <td class="ft-td-cap">${shortName(r.capName)}</td>
      <td class="ft-td-doc">${r.document}&nbsp;<span class="ft-removed-badge">REMOVED</span></td>
      ${dataCells(r, null, colCls, true)}
    </tr>`).join('');

    return `
      <div class="ft-section">
        <div class="ft-section-hdr ${colCls.replace('ft-col-','ft-hdr-')}">${title}</div>
        <div class="rcsa-table-wrap">
          <table class="rcsa-metrics-table ft-sub-table">
            <thead><tr>
              <th class="ft-th-cap">Capability</th>
              <th class="ft-th-doc">Document</th>
              <th class="${colCls} ft-sub-hdr" title="Unique risks">Risks</th>
              <th class="${colCls} ft-sub-hdr" title="Total controls">Controls</th>
              <th class="${colCls} ft-sub-hdr" title="Implemented">Impl</th>
              <th class="${colCls} ft-sub-hdr" title="Assessed">Assessed</th>
              <th class="${colCls} ft-sub-hdr" title="Effective">Effective</th>
              <th class="${colCls} ft-sub-hdr" title="Partly effective">Partly</th>
              <th class="${colCls} ft-sub-hdr" title="Not assessed">Not Ass.</th>
            </tr></thead>
            <tbody>${activeHtml}${removedHtml}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── Table 4: Pre-DORA Operational ────────────────────────────
  function renderOpTable() {
    const rows = curr.operational || [];
    const pm   = prevMap(prevF.operational, r => r.capId);
    const gone = removedRows(rows, prevF.operational, r => r.capId);

    if (!rows.length && !gone.length) return '';

    const KEYS = ['risks','open','draft','controls','implemented','assessed','effective','partly','notAssessed'];

    function dataCells(r, p, removed) {
      return KEYS.map(k =>
        `<td class="ft-col-p${removed ? ' ft-removed-val' : ''}">${r[k]}${removed ? '' : arrow(r[k], p?.[k])}</td>`
      ).join('');
    }

    const activeHtml = rows.map(r => {
      const p = pm[r.capId];
      return `<tr>
        <td class="ft-td-cap">${shortName(r.capName)}</td>
        ${dataCells(r, p, false)}
      </tr>`;
    }).join('');

    const removedHtml = gone.map(r => `<tr class="ft-row-removed">
      <td class="ft-td-cap">${shortName(r.capName)}&nbsp;<span class="ft-removed-badge">REMOVED</span></td>
      ${dataCells(r, null, true)}
    </tr>`).join('');

    return `
      <div class="ft-section">
        <div class="ft-section-hdr ft-hdr-p">Pre-DORA Operational</div>
        <div class="rcsa-table-wrap">
          <table class="rcsa-metrics-table ft-sub-table">
            <thead><tr>
              <th class="ft-th-cap">Capability</th>
              <th class="ft-col-p ft-sub-hdr" title="Unique risks">Risks</th>
              <th class="ft-col-p ft-sub-hdr" title="Open risks">Open</th>
              <th class="ft-col-p ft-sub-hdr" title="Draft risks">Draft</th>
              <th class="ft-col-p ft-sub-hdr" title="Total controls">Controls</th>
              <th class="ft-col-p ft-sub-hdr" title="Implemented">Impl</th>
              <th class="ft-col-p ft-sub-hdr" title="Assessed">Assessed</th>
              <th class="ft-col-p ft-sub-hdr" title="Effective">Effective</th>
              <th class="ft-col-p ft-sub-hdr" title="Partly effective">Partly</th>
              <th class="ft-col-p ft-sub-hdr" title="Not assessed">Not Ass.</th>
            </tr></thead>
            <tbody>${activeHtml}${removedHtml}</tbody>
          </table>
        </div>
      </div>`;
  }

  return renderPoTable() +
    renderControlTable('locPolControls', 'DORA — Local Policy Controls', 'ft-col-d') +
    renderControlTable('grpStdControls', 'DORA — Group Standard Controls', 'ft-col-g') +
    renderOpTable();
}

// ── ICT Risk Management Metrics Card ─────────────────────────
function renderRiskMgmtSummaryCard(assessment, prev) {
  const curr  = assessment.factSummary || {};
  const prevF = prev?.factSummary     || {};

  const noData = !curr.policyObjectives?.length && !curr.locPolControls?.length &&
                 !curr.grpStdControls?.length   && !curr.operational?.length;

  return `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">🛡️</span>
        <div>
          <h3 class="measure-card-title">ICT RCSA &amp; CSA — Risk Management Metrics</h3>
          <p class="measure-card-desc">Metrics derived from Riskonnect and Policy Statement imports.${prev ? ' ▲▼ shows movement vs previous assessment.' : ''}</p>
        </div>
      </div>
      ${noData ? '<p class="policy-no-data" style="margin:.5rem 0">No risk or policy data imported yet.</p>' : ''}
      ${renderFactSummaryTables(curr, prevF)}
    </div>`;
}
