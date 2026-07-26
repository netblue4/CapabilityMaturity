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

  const orderedMeasures = CONFIG.measures;

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
  row.innerHTML = measureCards;
  const rmSlot = document.getElementById("riskmgmt-card-row");
  if (rmSlot) rmSlot.innerHTML = renderThemedRiskSection(assessment);
  const opcovSlot = document.getElementById("opcov-card-row");
  if (opcovSlot) opcovSlot.innerHTML = '';
  document.getElementById("risk-card-row").innerHTML = renderRiskMgmtSummaryCard(assessment, prev);
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
  // Column order: Inherent · Residual · Open · Draft · Controls · Impl · Assessed · Eff · Partly · Not Ass.
  // Identical structure to Operational except "Document" replaces "Risk Title"
  function renderControlTable(fsKey, title, colCls) {
    const rows = curr[fsKey] || [];
    const pm   = prevMap(prevF[fsKey], r => r.capId + '||' + r.document);
    const gone = removedRows(rows, prevF[fsKey], r => r.capId + '||' + r.document);

    if (!rows.length && !gone.length) return '';

    const KEYS = ['open','draft','controls','implemented','assessed','effective','partly','notAssessed'];

    function scoreCell(val, removed) {
      return `<td class="${colCls}${removed ? ' ft-removed-val' : ''}">${val != null ? val.toFixed(1) : '—'}</td>`;
    }
    function dataCells(r, p, cls, removed) {
      return KEYS.map(k =>
        `<td class="${cls}${removed ? ' ft-removed-val' : ''}">${r[k] ?? 0}${removed ? '' : arrow(r[k] ?? 0, p?.[k])}</td>`
      ).join('');
    }

    const activeHtml = rows.map(r => {
      const p = pm[r.capId + '||' + r.document];
      return `<tr>
        <td class="ft-td-cap">${shortName(r.capName)}</td>
        <td class="ft-td-doc">${r.document}</td>
        ${scoreCell(r.inherentScore, false)}
        ${scoreCell(r.residualScore, false)}
        ${dataCells(r, p, colCls, false)}
      </tr>`;
    }).join('');

    const removedHtml = gone.map(r => `<tr class="ft-row-removed">
      <td class="ft-td-cap">${shortName(r.capName)}</td>
      <td class="ft-td-doc">${r.document}&nbsp;<span class="ft-removed-badge">REMOVED</span></td>
      ${scoreCell(r.inherentScore, true)}
      ${scoreCell(r.residualScore, true)}
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
              <th class="${colCls} ft-sub-hdr" title="Inherent risk score">Inherent</th>
              <th class="${colCls} ft-sub-hdr" title="Residual risk score">Residual</th>
              <th class="${colCls} ft-sub-hdr" title="Open risks">Open</th>
              <th class="${colCls} ft-sub-hdr" title="Draft risks">Draft</th>
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
    const keyFn = r => r.capId + '||' + ftNorm(r.riskTitle || '');
    const pm   = prevMap(prevF.operational, keyFn);
    const gone = removedRows(rows, prevF.operational, keyFn);

    if (!rows.length && !gone.length) return '';

    const KEYS = ['open','draft','controls','implemented','assessed','effective','partly','notAssessed'];

    function numCells(r, p, removed) {
      return KEYS.map(k =>
        `<td class="ft-col-p${removed ? ' ft-removed-val' : ''}">${r[k] ?? 0}${removed ? '' : arrow(r[k] ?? 0, p?.[k])}</td>`
      ).join('');
    }
    function scoreCell(val, removed) {
      return `<td class="ft-col-p${removed ? ' ft-removed-val' : ''}">${val != null ? val.toFixed(1) : '—'}</td>`;
    }

    const activeHtml = rows.map(r => {
      const p = pm[keyFn(r)];
      return `<tr>
        <td class="ft-td-cap">${shortName(r.capName)}</td>
        <td class="ft-td-rtitle" title="${r.riskTitle || ''}">${r.riskTitle || '—'}</td>
        ${scoreCell(r.inherentScore, false)}
        ${scoreCell(r.residualScore, false)}
        ${numCells(r, p, false)}
      </tr>`;
    }).join('');

    const removedHtml = gone.map(r => `<tr class="ft-row-removed">
      <td class="ft-td-cap">${shortName(r.capName)}&nbsp;<span class="ft-removed-badge">REMOVED</span></td>
      <td class="ft-td-rtitle ft-removed-val">${r.riskTitle || '—'}</td>
      ${scoreCell(r.inherentScore, true)}
      ${scoreCell(r.residualScore, true)}
      ${numCells(r, null, true)}
    </tr>`).join('');

    return `
      <div class="ft-section">
        <div class="ft-section-hdr ft-hdr-p">Pre-DORA Operational</div>
        <div class="rcsa-table-wrap">
          <table class="rcsa-metrics-table ft-sub-table">
            <thead><tr>
              <th class="ft-th-cap">Capability</th>
              <th class="ft-th-rtitle">Risk Title</th>
              <th class="ft-col-p ft-sub-hdr" title="Inherent risk score">Inherent</th>
              <th class="ft-col-p ft-sub-hdr" title="Residual risk score">Residual</th>
              <th class="ft-col-p ft-sub-hdr" title="Open risk">Open</th>
              <th class="ft-col-p ft-sub-hdr" title="Draft risk">Draft</th>
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

// ── Policy Operationalisation + Cross Team Cooperation KPI sections ──
function renderKpiSection(curr, prevF, currA, prevA) {
  const ks     = curr?.kpiSummary  || {};
  const prevKs = prevF?.kpiSummary || {};

  function pct(n, d)  { return d > 0 ? Math.round((n / d) * 100) : null; }
  function ppArrow(cv, pv, lowerIsBetter) {
    if (pv == null || cv == null) return '';
    const d = cv - pv;
    if (!d) return '';
    const good = lowerIsBetter ? d < 0 : d > 0;
    return good
      ? `<span class="ft-trend-up"> ▲${Math.abs(d)}pp</span>`
      : `<span class="ft-trend-dn"> ▼${Math.abs(d)}pp</span>`;
  }
  function nArrow(cv, pv, lowerIsBetter) {
    if (pv == null || cv == null) return '';
    const d = cv - pv;
    if (!d) return '';
    const good = lowerIsBetter ? d < 0 : d > 0;
    return good
      ? `<span class="ft-trend-up"> ▲${Math.abs(d)}</span>`
      : `<span class="ft-trend-dn"> ▼${Math.abs(d)}</span>`;
  }

  // Generic count/rate row: numKey/denKey read from current (c) and previous (p) sub-objects.
  function row(label, sub, c, p, numKey, denKey, lowerIsBetter, subTitle) {
    if (!c) return '';
    const cp  = pct(c[numKey], c[denKey]);
    const pp2 = p ? pct(p[numKey], p[denKey]) : null;
    const titleAttr = subTitle ? ` title="${subTitle}"` : '';
    return `<tr>
      <td class="kpi-td-label">${label}</td>
      <td class="kpi-td-sub"${titleAttr}>${sub}</td>
      <td class="kpi-td-count">${c[numKey]}/${c[denKey]}${nArrow(c[numKey], p?.[numKey], lowerIsBetter)}</td>
      <td class="kpi-td-pct">${cp != null ? cp+'%' : '—'}${ppArrow(cp, pp2, lowerIsBetter)}</td>
    </tr>`;
  }

  function tableBlock(title, rows) {
    if (!rows.length) return '';
    return `
      <div class="ft-section">
        <div class="ft-section-hdr kpi-section-hdr">${title}</div>
        <div class="rcsa-table-wrap">
          <table class="rcsa-metrics-table ft-sub-table kpi-table">
            <thead><tr>
              <th class="kpi-td-label">KPI</th>
              <th class="kpi-td-sub">Description</th>
              <th class="kpi-td-count">Count</th>
              <th class="kpi-td-pct">Rate</th>
            </tr></thead>
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── Block 1: Policy Operationalisation ──────────────────────────
  const polRows = [];
  polRows.push(row('LocPol Coverage', 'Local-policy statements referenced by ≥1 control (any status)',
    ks.locPolCoverage, prevKs.locPolCoverage, 'covered', 'total', false));
  polRows.push(row('LocPol Blind Spots', 'Statements with no implemented control',
    ks.locPolOperationalisation, prevKs.locPolOperationalisation, 'blindSpots', 'total', true));
  polRows.push(row('GrpStd Coverage', 'Group-standard requirements referenced by ≥1 control (any status)',
    ks.grpStdCoverage, prevKs.grpStdCoverage, 'covered', 'total', false));
  polRows.push(row('GrpStd Operationalised', 'Requirements with ≥1 implemented control',
    ks.grpStdOperationalisation, prevKs.grpStdOperationalisation, 'operationalised', 'total', false));
  polRows.push(row('Orphan Controls', 'Policy controls citing a ref not in the policy register',
    ks.orphanControls, prevKs.orphanControls, 'orphans', 'total', true));
  if (ks.policyControlEffectiveness && ks.policyControlEffectiveness.total > 0) {
    polRows.push(row('Policy Control Effectiveness', 'Implemented policy controls rated effective (green design + op)',
      ks.policyControlEffectiveness, prevKs.policyControlEffectiveness, 'effective', 'total', false));
  } else if (ks.policyControlEffectiveness) {
    polRows.push(`<tr>
      <td class="kpi-td-label">Policy Control Effectiveness</td>
      <td class="kpi-td-sub">Implemented policy controls rated effective (green design + op)</td>
      <td class="kpi-td-count kpi-not-recorded" colspan="2">No implemented policy controls yet</td>
    </tr>`);
  }
  polRows.push(row('GrpStd Localisation', 'Requirements a local policy maps to (via cited ref)',
    ks.grpStdLocalisation, prevKs.grpStdLocalisation, 'localised', 'total', false));
  if (ks.chainCompleteness) {
    const c = ks.chainCompleteness, p = prevKs.chainCompleteness;
    const cp = pct(c.complete, c.total), pp2 = p ? pct(p.complete, p.total) : null;
    const gaps = (c.details || [])
      .filter(d => !d.complete)
      .map(d => {
        const missing = ['Policy','Risk','Control','Assessed']
          .filter((_, i) => ![d.hasPolicy,d.hasRisk,d.hasControl,d.hasAssessment][i]);
        return `${shortName(d.capName)}: missing ${missing.join(', ')}`;
      }).join('\n');
    polRows.push(`<tr>
      <td class="kpi-td-label">Full Chain Complete</td>
      <td class="kpi-td-sub" title="${gaps}">Policy → Risk → Control → Assessment (hover for gaps)</td>
      <td class="kpi-td-count">${c.complete}/${c.total}${nArrow(c.complete, p?.complete, false)}</td>
      <td class="kpi-td-pct">${cp != null ? cp+'%' : '—'}${ppArrow(cp, pp2, false)}</td>
    </tr>`);
  }

  // ── Block 2: Cross Team Cooperation (manual KPIs) ───────────────
  const ctcRows = [];

  // Manual KPIs from config
  (CONFIG.kpis || []).forEach(kpi => {
    const cv = currA?.kpiValues?.[kpi.id];
    const pv = prevA?.kpiValues?.[kpi.id];
    const hasData = cv && (cv.d > 0);
    if (!hasData) {
      ctcRows.push(`<tr>
        <td class="kpi-td-label">${kpi.label}</td>
        <td class="kpi-td-sub">${kpi.description}</td>
        <td class="kpi-td-count kpi-not-recorded" colspan="2">Not recorded this period</td>
      </tr>`);
      return;
    }
    const cp = pct(cv.n, cv.d);
    const pp2 = (pv && pv.d > 0) ? pct(pv.n, pv.d) : null;
    ctcRows.push(`<tr>
      <td class="kpi-td-label">${kpi.label}</td>
      <td class="kpi-td-sub">${kpi.description}</td>
      <td class="kpi-td-count">${cv.n}/${cv.d}${nArrow(cv.n, pv?.n, false)}</td>
      <td class="kpi-td-pct">${cp != null ? cp+'%' : '—'}${ppArrow(cp, pp2, false)}</td>
    </tr>`);
  });

  const filteredPol = polRows.filter(Boolean);
  const filteredCtc = ctcRows.filter(Boolean);
  return tableBlock('Policy Operationalisation', filteredPol) +
         tableBlock('Cross Team Cooperation',    filteredCtc);
}

// ── Risk themes (by control type) ────────────────────────────
const RISK_THEMES = [
  { key: 'locPol',      name: 'Local Policy',   dora: true,  rowBy: 'document', rowHeader: 'Local policy',   covPrefix: 'Policy Operationalisation Coverage',  desc: 'DORA local-policy controls — the risks they touch and the control evidence behind them.' },
  { key: 'grpStd',      name: 'Group Standard', dora: true,  rowBy: 'document', rowHeader: 'Group standard', covPrefix: 'Policy Operationalisation Coverage',  desc: 'DORA group-standard controls — the risks they touch and the control evidence behind them.' },
  { key: 'operational', name: 'Pre-DORA',       dora: false, rowBy: 'risk',     rowHeader: 'Risk',           covPrefix: 'Control Operationalisation Coverage', desc: 'Pre-DORA operational controls (narrow disruption-risk scope) — our established control base.' },
];

// One themed Risk Management card + its scoped Policy Operationalisation card.
function renderThemedRiskSection(assessment) {
  return RISK_THEMES.map(t => `
    <div class="theme-block">
      ${renderRiskPortfolioCard(assessment, t)}
      ${renderOpCoverageCard(assessment, t)}
    </div>`).join('');
}

// ── Risk Management — Portfolio Health Card ──────────────────
// theme (optional) = { key, name, dora }: scopes the card to one control type.
function renderRiskPortfolioCard(assessment, theme) {
  const tk = theme ? theme.key : null;
  const s  = buildRiskPortfolioSummary(assessment.riskPolicyFacts || [], tk);
  const title = theme ? `Risk Management — ${theme.name}` : 'Risk Management — Portfolio Health';
  const desc  = theme ? theme.desc
    : 'Operational compliance — are we doing what our local policies, group standards and DORA say we should? The control evidence behind our risk ratings, from the RCSA.';

  if (!s) {
    return `
      <div class="card measure-card">
        <div class="measure-card-header">
          <span class="measure-icon">🛡️</span>
          <div><h3 class="measure-card-title">${title}</h3><p class="measure-card-desc">${desc}</p></div>
        </div>
        <p class="policy-no-data" style="margin:.5rem 0">No ${theme ? theme.name.toLowerCase() + ' controls' : 'risk data'} yet.</p>
      </div>`;
  }

  const tk2 = theme ? theme.key : '';
  const tile = (label, num, sub, cls, onclick) => `
    <div class="rm-tile${onclick ? ' rm-tile-clickable' : ''}"${onclick ? ` onclick="${onclick}" title="Click for the per-risk breakdown"` : ''}>
      <div class="rm-tile-lbl">${label}${onclick ? ' <span class="rm-tile-more">▸</span>' : ''}</div>
      <div class="rm-tile-num ${cls || ''}">${num}</div>
      <div class="rm-tile-sub">${sub}</div>
    </div>`;

  // DORA themes swap Risk Reduction (not control-type-attributable) for
  // implemented rate; Pre-DORA keeps the reduction tile with its drill-down.
  const fifthTile = (theme && theme.dora)
    ? tile('Controls Implemented', s.implementedPct + '%', `of ${theme.name.toLowerCase()} controls implemented (${s.ctrlImplemented}/${s.ctrlCount})`, '')
    : tile('Risk Reduction', s.reductionPct != null ? s.reductionPct + '%' : '—', `controls cut risk from ${s.avgInherent} to ${s.avgResidual}`, 'rm-num-good', `showRiskReductionModal('${assessment.id}', '${tk2}')`);

  const tiles = [
    tile('Total Risks',      s.total, `${s.open} open · ${s.draft} draft · ${s.closed} closed`, ''),
    tile('Risks Assessed',   s.assessedPct + '%', `${s.assessed} of ${s.active} active risks rated`, ''),
    tile('Severe',           s.severe, `residual ≥ ${s.severeThreshold} (${s.severe}/${s.assessed} assessed)`, s.severe > 0 ? 'rm-num-warn' : ''),
    tile('Control Coverage', s.ctrlCoveragePct != null ? s.ctrlCoveragePct + '%' : '—', `of controls behind assessed risks are checked (${s.ctrlAssessed}/${s.ctrlTotal})`, ''),
    fifthTile,
    tile('Under-assured',    s.underAssuredCount, `residual risk ratings lacking control evidence (${s.underAssuredCount}/${s.assessed} assessed)`, s.underAssuredCount > 0 ? 'rm-num-warn' : '', `showUnderAssuredModal('${assessment.id}', '${tk2}')`),
  ].join('');

  // Severity distribution bar — portfolio view only (dropped on theme cards).
  const sevDefs = [
    { k: 'extreme',     label: 'Extreme',     color: '#b34d4d' },
    { k: 'significant', label: 'Significant', color: '#bc7439' },
    { k: 'moderate',    label: 'Moderate',    color: '#d1c73b' },
    { k: 'low',         label: 'Low',         color: '#418f64' },
  ];
  const totalSev = sevDefs.reduce((n, d) => n + s.severity[d.k], 0);
  const segs = totalSev > 0
    ? sevDefs.filter(d => s.severity[d.k] > 0).map(d =>
        `<div class="rm-sev-seg" style="width:${100 * s.severity[d.k] / totalSev}%;background:${d.color}" title="${d.label}: ${s.severity[d.k]}"></div>`).join('')
    : '<div class="rm-sev-empty">No assessed risks yet</div>';
  const legend = sevDefs.map(d =>
    `<span class="rm-sev-leg"><span class="rm-sev-dot" style="background:${d.color}"></span>${d.label} ${s.severity[d.k]}</span>`).join('');
  const sevBlock = theme ? '' : `
      <div class="rm-sev">
        <div class="rm-sev-hdr">Residual severity of assessed risks</div>
        <div class="rm-sev-bar">${segs}</div>
        <div class="rm-sev-legend">${legend}</div>
      </div>`;

  const trunc = t => (t.length > 42 ? t.slice(0, 42) + '…' : t);
  const under = s.underAssuredCount ? `
    <div class="rm-underassured">
      <span class="rm-ua-flag">⚠ ${s.underAssuredCount} assessed ${s.underAssuredCount === 1 ? 'risk' : 'risks'} not backed by control evidence (&lt; ${s.underAssuredFloor}% of controls assessed):</span>
      <span class="rm-ua-list">${s.underAssured.map(trunc).join(' · ')}</span>
      <span class="rm-ua-more" onclick="showUnderAssuredModal('${assessment.id}', '${tk2}')">See all →</span>
    </div>` : '';

  const weak = s.weakMitigationCount ? `
    <div class="rm-underassured">
      <span class="rm-ua-flag">⚠ ${s.weakMitigationCount} ${s.weakMitigationCount === 1 ? 'risk' : 'risks'} where controls aren't earning their keep (&lt; ${s.weakThreshold}% reduction with implemented controls):</span>
      <span class="rm-ua-list">${s.weakMitigation.map(r => `${trunc(r.title)} (${r.reductionPct}%${r.effective ? ', ' + r.effective + ' eff' : ''})`).join(' · ')}</span>
      <span class="rm-ua-more" onclick="showRiskReductionModal('${assessment.id}', '${tk2}')">See all →</span>
    </div>` : '';

  return `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">🛡️</span>
        <div>
          <h3 class="measure-card-title">${title}</h3>
          <p class="measure-card-desc">${desc}</p>
        </div>
      </div>
      <button class="btn-link ratings-link" onclick="showMetricsModal('riskPortfolio')">ℹ Metrics</button>
      <div class="rm-tiles">${tiles}</div>
      ${sevBlock}
      ${under}
      ${weak}
    </div>`;
}

// ── Policy Operationalisation Coverage Card ──────────────────
// Per-capability funnel: five independent coverage bars + a confidence chip
// that judges how well risk-assessment claims are backed by control evidence.
function renderOpCoverageCard(assessment, theme) {
  const rowBy = theme ? theme.rowBy : null;
  const named = !!rowBy && rowBy !== 'capability';
  const oc = buildOperationalisationCoverage(assessment.riskPolicyFacts || [], theme ? theme.key : null, rowBy);
  const ocTitle = theme ? `${theme.covPrefix} — ${theme.name}` : 'Policy Operationalisation Coverage';
  if (!oc.rows.length) {
    return `
      <div class="card measure-card">
        <div class="measure-card-header">
          <span class="measure-icon">🎯</span>
          <div>
            <h3 class="measure-card-title">${ocTitle}</h3>
            <p class="measure-card-desc">How far each capability's risks and controls have progressed, and how well risk conclusions are backed by control evidence.</p>
          </div>
        </div>
        <p class="policy-no-data" style="margin:.5rem 0">No ${theme ? theme.name.toLowerCase() + ' controls' : 'risk data imported'} yet.</p>
      </div>`;
  }

  const bar = o => {
    const p = o.d > 0 ? Math.round(100 * o.n / o.d) : 0;
    return `<div class="opcov-cell">
      <div class="opcov-bar"><div class="opcov-bar-fill" style="width:${p}%"></div></div>
      <span class="opcov-val"><b>${o.d > 0 ? p + '%' : '—'}</b><span class="opcov-frac">${o.n}/${o.d}</span></span>
    </div>`;
  };

  const chipMap = {
    none:     { cls: 'opcov-chip-none',     txt: '– None' },
    low:      { cls: 'opcov-chip-low',      txt: '⚠ Low' },
    building: { cls: 'opcov-chip-building', txt: '◐ Building' },
    ok:       { cls: 'opcov-chip-ok',       txt: '● OK' },
  };

  const bodyRows = oc.rows.map(r => {
    const c = chipMap[r.chip] || chipMap.none;
    const title = r.index != null
      ? `Confidence ${r.index}% = control-assessed ÷ risk-assessed`
      : 'No approved risks assessed yet';
    return `<tr>
      <td class="opcov-cap" title="${r.capName}">${named ? r.capName : shortName(r.capName)}</td>
      <td>${bar(r.approved)}</td>
      <td>${bar(r.assessed)}</td>
      <td>${bar(r.owned)}</td>
      <td>${bar(r.implemented)}</td>
      <td>${bar(r.ctrlAssessed)}</td>
      <td class="opcov-chip-cell"><span class="opcov-chip ${c.cls}" title="${title}">${c.txt}</span></td>
    </tr>`;
  }).join('');

  const ru = oc.rollup;
  const rollup = [
    ru.low      ? `<span class="opcov-chip opcov-chip-low">${ru.low} Low</span>` : '',
    ru.building ? `<span class="opcov-chip opcov-chip-building">${ru.building} Building</span>` : '',
    ru.ok       ? `<span class="opcov-chip opcov-chip-ok">${ru.ok} OK</span>` : '',
    ru.none     ? `<span class="opcov-chip opcov-chip-none">${ru.none} None</span>` : '',
  ].filter(Boolean).join('');

  return `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">🎯</span>
        <div style="flex:1">
          <h3 class="measure-card-title">${ocTitle}</h3>
          <p class="measure-card-desc">Each capability's progress across the risk and control lifecycle. Confidence flags where risk conclusions run ahead of the control evidence.</p>
        </div>
        <div class="opcov-rollup">${rollup}</div>
      </div>
      <div class="card-info-links">
        <button class="btn-link ratings-link ratings-link-inline" onclick="showMetricsModal('opCoverage')">ℹ Metrics</button>
        <button class="btn-link ratings-link ratings-link-inline" onclick="showConfidenceModal()">ℹ Confidence</button>
      </div>
      <div class="rcsa-table-wrap">
        <table class="opcov-table${named ? ' opcov-table-named' : ''}">
          <thead><tr>
            <th class="opcov-cap">${theme ? theme.rowHeader : ''}</th>
            <th>Risks Approved<span class="opcov-th-sub">open / all risks</span></th>
            <th>Risks Assessed<span class="opcov-th-sub">assessed / all risks</span></th>
            <th>Ctrl Owned<span class="opcov-th-sub">owned / controls</span></th>
            <th>Ctrl Impl<span class="opcov-th-sub">impl / controls</span></th>
            <th>Ctrl Assessed<span class="opcov-th-sub">assessed / controls</span></th>
            <th class="opcov-chip-cell">Confidence</th>
          </tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
      ${renderOpCoverageLegend()}
    </div>`;
}

// ── In-card legend (so it travels with the screenshot into slides) ──
function renderOpCoverageLegend() {
  const cfg   = (CONFIG && CONFIG.opCoverage) || {};
  const floor = cfg.ownershipFloorPct != null ? cfg.ownershipFloorPct : 20;
  const low   = cfg.confidenceLowPct  != null ? cfg.confidenceLowPct  : 40;
  const ok    = cfg.confidenceOkPct   != null ? cfg.confidenceOkPct   : 75;
  return `
    <div class="opcov-legend">
      <span class="opcov-legend-lead"><b>Confidence</b> = controls assessed ÷ risks assessed — how well risk conclusions are backed by control evidence:</span>
      <span class="opcov-legend-item"><span class="opcov-chip opcov-chip-ok">● OK</span> evidence keeps pace (≥ ${ok}%)</span>
      <span class="opcov-legend-item"><span class="opcov-chip opcov-chip-building">◐ Building</span> partial evidence (${low}–${ok - 1}%)</span>
      <span class="opcov-legend-item"><span class="opcov-chip opcov-chip-low">⚠ Low</span> risks ran ahead of controls (&lt; ${low}%, or &lt; ${floor}% of controls owned)</span>
      <span class="opcov-legend-item"><span class="opcov-chip opcov-chip-none">– None</span> no risks assessed yet</span>
    </div>`;
}

// ── ICT Risk Management Metrics Card ─────────────────────────
// mode 'detail' (edit assessment screen): full fact-summary tables.
// mode 'exec'   (executive report):       Coverage & Governance KPI metrics only.
function renderRiskMgmtSummaryCard(assessment, prev, mode = 'detail') {
  const curr  = assessment.factSummary || {};
  const prevF = prev?.factSummary     || {};

  if (mode === 'exec') {
    // Recompute kpiSummary live from stored facts so new metric definitions
    // apply to previously-saved assessments without needing a re-import.
    const currLive = { ...curr,  kpiSummary: buildKpiSummary(assessment.policyRows || [], assessment.riskPolicyFacts || []) };
    const prevLive = prev
      ? { ...prevF, kpiSummary: buildKpiSummary(prev.policyRows || [], prev.riskPolicyFacts || []) }
      : {};
    const kpiHtml = renderKpiSection(currLive, prevLive, assessment, prev);
    return `
      <div class="card measure-card">
        <div class="measure-card-header">
          <span class="measure-icon">🛡️</span>
          <div>
            <h3 class="measure-card-title">ICT RCSA &amp; CSA — Risk Management Metrics</h3>
            <p class="measure-card-desc">Coverage &amp; governance KPIs derived from Riskonnect and Policy Statement imports.${prev ? ' ▲▼ shows movement vs previous assessment.' : ''}</p>
          </div>
        </div>
        <button class="btn-link ratings-link" onclick="showMetricsModal('rcsa')">ℹ Metrics</button>
        ${kpiHtml || '<p class="policy-no-data" style="margin:.5rem 0">No KPI metrics recorded yet.</p>'}
      </div>`;
  }

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
      <button class="btn-link ratings-link" onclick="showMetricsModal('rcsa')">ℹ Metrics</button>
      ${noData ? '<p class="policy-no-data" style="margin:.5rem 0">No risk or policy data imported yet.</p>' : ''}
      ${renderFactSummaryTables(curr, prevF)}
    </div>`;
}
