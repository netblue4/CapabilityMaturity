// ── Executive Report ──────────────────────────────────────────

function showExecReportModal() {
  if (db.assessments.length < 2) {
    alert('You need at least 2 assessments to generate a report.');
    return;
  }
  const opts = db.assessments.map(a =>
    `<option value="${a.id}">${a.label} · ${formatDate(a.date)}</option>`
  ).join('');
  ['exec-prev-sel', 'exec-curr-sel', 'exec-plan-sel'].forEach(id => {
    document.getElementById(id).innerHTML = opts;
  });
  const n = db.assessments.length;
  document.getElementById('exec-prev-sel').value = db.assessments[Math.max(0, n - 2)].id;
  document.getElementById('exec-curr-sel').value = db.assessments[n - 1].id;
  document.getElementById('exec-plan-sel').value = db.assessments[n - 1].id;
  document.getElementById('exec-report-modal').style.display = 'flex';
}

function closeExecReportModal() {
  document.getElementById('exec-report-modal').style.display = 'none';
}

function generateExecReport() {
  const prevA    = db.assessments.find(a => a.id === document.getElementById('exec-prev-sel').value);
  const currentA = db.assessments.find(a => a.id === document.getElementById('exec-curr-sel').value);
  const plannedA = db.assessments.find(a => a.id === document.getElementById('exec-plan-sel').value);
  if (!prevA || !currentA || !plannedA) return;
  closeExecReportModal();

  document.getElementById('exec-report-content').innerHTML = `
    <div class="exec-report-top no-print">
      <div>
        <h2 class="exec-report-title">Policy vs Operational Compliance</h2>
        <p class="exec-report-sub">${currentA.label} · ${formatDate(currentA.date)}</p>
      </div>
      <button class="btn btn-outline" onclick="window.print()">🖨 Print / Save PDF</button>
    </div>
    <div class="exec-report-top print-only" style="display:none">
      <h2 class="exec-report-title">Policy vs Operational Compliance</h2>
      <p class="exec-report-sub">${currentA.label} · ${formatDate(currentA.date)}</p>
    </div>
    ${execComplianceSummary(currentA, prevA)}
    <div class="exec-sec-div">Policy Layer — Governance (Policy Compliance)</div>
    <div class="exec-rcsa-wrap">${renderGovernanceCard(currentA)}</div>
    <div class="exec-sec-div">Operational Layer — Operational Compliance</div>
    <div class="exec-sc-grid">${RISK_THEMES.map(t => renderRiskPortfolioCard(currentA, t, prevA, { exec: true })).join('')}</div>
    ${renderExecCallouts(currentA)}
    <div class="exec-sec-div">Supporting Detail — RCSA &amp; CSA Metrics</div>
    <div class="exec-rcsa-wrap">${renderRiskMgmtSummaryCard(currentA, prevA, 'exec')}</div>
    <div class="exec-sec-div">Appendix — Operationalisation Detail</div>
    <div class="exec-rcsa-wrap">${renderMergedRiskTable(currentA)}</div>
    <div class="exec-sec-div">Appendix — Metric Definitions</div>
    ${renderMetricsAppendix()}
  `;
  showView('exec-report');
}

// ── Exec "so what" callouts (below the three score cards) ──────
// The headline findings an exec reads first, summarised once for all themes
// (the per-card callouts are dropped to avoid saying it twice).
function renderExecCallouts(assessment) {
  const s  = buildRiskPortfolioSummary(assessment.riskPolicyFacts || [], null);
  if (!s) return '';
  const ns = buildMergedRiskRows(assessment.riskPolicyFacts || [], assessment.policyRows || [])
    .filter(r => r.notStarted).length;
  const co = [];
  if (s.underAssuredCount) co.push(['danger', '⚠',
    `<b>${s.underAssuredCount} risk ${s.underAssuredCount === 1 ? 'rating is' : 'ratings are'} under-assured</b> — assessed, but the controls behind them mostly haven't been checked, so the ratings can't yet be defended to an auditor.`]);
  if (s.draft) co.push(['warn', '📝',
    `<b>${s.draft} ${s.draft === 1 ? 'risk is' : 'risks are'} still in draft</b> — logged but not yet formally in the RCSA. These are risk blind spots: identified but not treated.`]);
  if (ns) co.push(['info', '📄',
    `<b>${ns} approved ${ns === 1 ? 'policy/standard has' : 'policies &amp; standards have'} no controls in place yet</b> — operationalisation hasn't started for them, and we cannot prove compliance to these policies with implemented controls.`]);
  if (!co.length) return '';
  return `<div class="exec-callouts">${co.map(([k, i, t]) =>
    `<div class="exec-callout exec-callout-${k}"><span class="eci">${i}</span><span>${t}</span></div>`).join('')}</div>`;
}

// ── Appendix — Operationalisation Detail (merged single table) ──
// The three themed coverage tables collapsed into one sortable table: one row
// per risk × theme × document, plus "not started" rows for registered
// policies/standards with no controls yet. Sorting is a live-screen aid —
// the print/screenshot captures whatever order is currently applied.
let _mergedRows = [];
let _mergedSort = { col: null, dir: 1 };
let _mergedMeta = {};

const MRT_CHIP = { none: ['opcov-chip-none', '– None'], low: ['opcov-chip-low', '⚠ Low'], building: ['opcov-chip-building', '◐ Building'], ok: ['opcov-chip-ok', '● OK'] };
const MRT_BAND = { extreme: ['sev-extreme', 'Extreme'], significant: ['sev-significant', 'Significant'], moderate: ['sev-moderate', 'Moderate'], low: ['sev-low', 'Low'] };
const MRT_FIELD = { capability: r => r.capName, theme: r => r.themeName, document: r => r.document || '', risk: r => r.riskTitle || '' };

function mrtHead() {
  const arrow = c => _mergedSort.col === c ? `<span class="mrt-arrow">${_mergedSort.dir === 1 ? '▲' : '▼'}</span>` : '';
  const sTh = (k, label) => `<th class="mrt-sort" onclick="sortMergedTable('${k}')">${label}${arrow(k)}</th>`;
  return `<tr>
    ${sTh('capability', 'Capability')}${sTh('theme', 'Theme')}${sTh('document', 'Document')}${sTh('risk', 'Risk')}
    <th>Residual Risk</th>
    <th>Ctrl Impl<span class="opcov-th-sub">impl / controls</span></th>
    <th>Ctrl Assessed<span class="opcov-th-sub">assessed / controls</span></th>
    <th class="opcov-chip-cell">Confidence</th>
  </tr>`;
}

// Static header (no sort handlers / arrows) for the standalone print/PDF export.
function mrtHeadPrint() {
  return `<tr>
    <th>Capability</th><th>Theme</th><th>Document</th><th>Risk</th>
    <th>Residual Risk</th>
    <th>Ctrl Impl<span class="opcov-th-sub">impl / controls</span></th>
    <th>Ctrl Assessed<span class="opcov-th-sub">assessed / controls</span></th>
    <th class="opcov-chip-cell">Confidence</th>
  </tr>`;
}

function mrtBody(rows) {
  const pct = (n, d) => d > 0 ? Math.round(n / d * 100) : 0;
  const cell = o => o.d > 0
    ? `<span class="opcov-val"><b>${pct(o.n, o.d)}%</b><span class="opcov-frac">${o.n}/${o.d}</span></span>`
    : `<span class="mrt-dash">—</span>`;
  const residual = r => {
    if (!r.assessed) return `<span class="mrt-status">${r.open ? 'Open · not assessed' : r.draft ? 'Draft' : '—'}</span>`;
    const b = MRT_BAND[r.residualBand];
    return b ? `<span class="sev-chip ${b[0]}">${b[1]}</span>` : `<span class="sev-chip sev-low">${r.residual}</span>`;
  };
  return rows.map(r => {
    const c = MRT_CHIP[r.chip] || MRT_CHIP.none;
    return `<tr class="${r.notStarted ? 'mrt-ns' : ''}">
      <td class="mrt-cap">${r.capName}</td>
      <td class="mrt-theme">${r.themeName}</td>
      <td class="mrt-doc">${r.document || '<span class="mrt-dash">—</span>'}</td>
      <td class="mrt-risk">${r.notStarted ? '<span class="mrt-nostart">not started</span>' : r.riskTitle}</td>
      <td>${residual(r)}</td>
      <td>${cell(r.implemented)}</td>
      <td>${cell(r.ctrlAssessed)}</td>
      <td class="opcov-chip-cell"><span class="opcov-chip ${c[0]}">${c[1]}</span></td>
    </tr>`;
  }).join('');
}

function renderMergedRiskTable(assessment) {
  _mergedRows = buildMergedRiskRows(assessment.riskPolicyFacts || [], assessment.policyRows || []);
  _mergedSort = { col: null, dir: 1 };
  _mergedMeta = { label: assessment.label, date: formatDate(assessment.date) };
  const ns = _mergedRows.filter(r => r.notStarted);
  const nsNote = ns.length
    ? `<p class="mrt-note">${ns.length} registered ${ns.length === 1 ? 'document has' : 'documents have'} no operationalised controls yet — shown as <span class="mrt-nostart">not started</span>.</p>`
    : '';
  return `
    <div class="card measure-card merged-risk-card">
      <div class="measure-card-header">
        <span class="measure-icon">📋</span>
        <div style="flex:1">
          <h3 class="measure-card-title">Operationalisation Detail — All Risks</h3>
          <p class="measure-card-desc">Every risk × theme in one view: residual rating, control implementation and assessment, and the confidence behind each. Click <b>Capability</b>, <b>Theme</b>, <b>Document</b> or <b>Risk</b> to sort.</p>
        </div>
        <button class="btn btn-outline no-print" style="align-self:flex-start;white-space:nowrap" onclick="printMergedRiskTable()">🖨 Export detail table (PDF)</button>
      </div>
      <div class="rcsa-table-wrap">
        <table class="opcov-table merged-risk-table">
          <thead id="merged-risk-thead">${mrtHead()}</thead>
          <tbody id="merged-risk-tbody">${mrtBody(_mergedRows)}</tbody>
        </table>
      </div>
      ${nsNote}
      ${renderOpCoverageLegend()}
    </div>`;
}

function sortMergedTable(col) {
  if (_mergedSort.col === col) _mergedSort.dir *= -1;
  else _mergedSort = { col, dir: 1 };
  const f = MRT_FIELD[col];
  const dir = _mergedSort.dir;
  const sorted = _mergedRows.slice().sort((a, b) =>
    (a.notStarted ? 1 : 0) - (b.notStarted ? 1 : 0) || f(a).localeCompare(f(b)) * dir);
  const tb = document.getElementById('merged-risk-tbody');
  const th = document.getElementById('merged-risk-thead');
  if (tb) tb.innerHTML = mrtBody(sorted);
  if (th) th.innerHTML = mrtHead();
}

// ── Standalone detail-table export (Print → PDF) ──────────────
// Opens the merged table alone in a clean landscape, light-theme print view —
// header repeats on every page, rows never split across a page break, colour
// chips preserved. Respects the current on-screen sort (reads the live tbody),
// so the user sorts however they like, exports, and pastes each PDF page into
// its own appendix slide. Every risk is listed in full (nothing collapsed).
function printMergedRiskTable() {
  const tb = document.getElementById('merged-risk-tbody');
  if (!tb) return;
  const rowsHtml = tb.innerHTML;                        // current sort order
  const cssHref  = new URL('style.css', location.href).href;
  const meta     = _mergedMeta || {};
  const nsCount  = _mergedRows.filter(r => r.notStarted).length;
  const nsNote   = nsCount
    ? `<p class="mrt-note">${nsCount} registered ${nsCount === 1 ? 'document has' : 'documents have'} no operationalised controls yet — shown as <span class="mrt-nostart">not started</span>.</p>`
    : '';
  const subtitle = [meta.label, meta.date].filter(Boolean).join(' · ');
  const doc = `<!doctype html>
<html data-theme="light">
<head>
<meta charset="utf-8">
<title>Operationalisation Detail${meta.label ? ' — ' + meta.label : ''}</title>
<link rel="stylesheet" href="${cssHref}">
<style>
  html, body { background:#fff; margin:0; }
  .mrt-print-page { padding: 10px 14px; }
  .mrt-print-head { margin: 0 0 8px; }
  .mrt-print-head h1 { font-size: 15px; margin: 0 0 2px; }
  .mrt-print-head p  { font-size: 11px; color:#555; margin: 0; }
  table.merged-risk-table { width:100%; border-collapse:collapse; }
  .mrt-print-hint { font-size:11px; color:#888; margin:8px 0 0; }
  @media print {
    @page { size: 33.87cm 19.05cm; margin: 0.7cm; }   /* PowerPoint widescreen 13.33in x 7.5in */
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    /* neutralise the app stylesheet's own print-hide rules in this window */
    body *, html { visibility: visible !important; }
    .mrt-print-hint { display: none !important; }
    table.merged-risk-table thead { display: table-header-group; } /* repeat header on every page */
    table.merged-risk-table tr { break-inside: avoid; page-break-inside: avoid; } /* never split a row */
  }
</style>
</head>
<body>
  <div class="mrt-print-page">
    <div class="mrt-print-head">
      <h1>Operationalisation Detail — All Risks</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
    </div>
    <table class="opcov-table merged-risk-table">
      <thead>${mrtHeadPrint()}</thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${nsNote}
    ${renderOpCoverageLegend()}
    <p class="mrt-print-hint">Print / Save as PDF opens automatically. Landscape widescreen — one PDF page per appendix slide.</p>
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 200);
    });
  <\/script>
</body>
</html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups for this site to export the detail table.'); return; }
  w.document.open();
  w.document.write(doc);
  w.document.close();
}

// ── Appendix — Metric Definitions ─────────────────────────────
// The same content shown in the ℹ Metrics / ℹ Confidence popups, rendered
// inline as natural-size, full-width tables. The definitions are identical
// across all three risk themes, so they're printed once here — a clean
// appendix slide the user copies straight into PowerPoint.
function renderMetricsAppendix() {
  const defCard = info => `
    <div class="card measure-card metrics-def-card">
      <h3 class="measure-card-title">${info.title.replace(/ · Metrics$/, '')}</h3>
      ${metricsInfoBody(info)}
    </div>`;
  const conf = confidenceInfo();
  return [
    defCard(METRICS_INFO.compliance),
    defCard(METRICS_INFO.riskPortfolio),
    defCard(METRICS_INFO.opCoverage),
    `<div class="card measure-card metrics-def-card">
      <h3 class="measure-card-title">${conf.title}</h3>
      ${metricsInfoBody(conf, ["Rating", "How it's calculated", "What it means"])}
    </div>`,
  ].join('');
}

// ── Policy vs Operational Compliance summary ──────────────────
// Two-layer split: policies written & approved (policy compliance) vs.
// policies actually operationalised (operational compliance), with the
// confidence behind the operational claim.
function execComplianceSummary(a, prev) {
  const ks = buildKpiSummary(a.policyRows || [], a.riskPolicyFacts || []);
  const rp = buildRiskPortfolioSummary(a.riskPolicyFacts || []);
  const oc = buildOperationalisationCoverage(a.riskPolicyFacts || []);
  const polRows = a.policyRows || [];
  const locCount = polRows.filter(r => isLocPolType(r.type)).length;
  const grpCount = polRows.filter(r => isGrpStdType(r.type)).length;

  const pct  = (n, d) => (d > 0 ? Math.round(100 * n / d) : 0);
  // Count metric (e.g. "77 policy statements"): big neutral number, no bar.
  const metricNum = (val, lbl) => `<div class="pvo-metric"><span class="pvo-val">${val}</span><span class="pvo-lbl">${lbl}</span></div>`;
  // Percentage metric: accent-coloured number + a meter bar filled to the value.
  const metricPct = (p, lbl, arrow = '') => {
    const w = Math.max(0, Math.min(100, p));
    return `<div class="pvo-metric"><span class="pvo-val pvo-val-pct">${p}%${arrow}</span><span class="pvo-lbl">${lbl}</span><span class="pvo-meter"><i style="width:${w}%"></i></span></div>`;
  };

  // Previous-quarter percentages for quarter-over-quarter arrows.
  const pv = {};
  if (prev) {
    const g   = o => o || { covered: 0, total: 0, operationalised: 0, localised: 0 };
    const pk  = buildKpiSummary(prev.policyRows || [], prev.riskPolicyFacts || []);
    const pf  = prev.riskPolicyFacts || [];
    const ppd = pf.filter(f => f.controlType === 'operational' && ftIsImplemented(f));
    const ppdMapped = ppd.filter(f => (f.matchedPolicyRows || []).length > 0).length;
    pv.locCov  = g(pk.locPolCoverage).total          ? pct(g(pk.locPolCoverage).covered,          g(pk.locPolCoverage).total)          : null;
    pv.grpCov  = g(pk.grpStdCoverage).total          ? pct(g(pk.grpStdCoverage).covered,          g(pk.grpStdCoverage).total)          : null;
    pv.loc     = pk.grpStdLocalisation               ? pct(pk.grpStdLocalisation.localised,       pk.grpStdLocalisation.total)         : null;
    pv.locBack = g(pk.locPolOperationalisation).total ? pct(g(pk.locPolOperationalisation).operationalised, g(pk.locPolOperationalisation).total) : null;
    pv.grpBack = g(pk.grpStdOperationalisation).total ? pct(g(pk.grpStdOperationalisation).operationalised, g(pk.grpStdOperationalisation).total) : null;
    pv.preDora = ppd.length                          ? pct(ppdMapped, ppd.length)                 : null;
  }

  // Policy layer
  const locCov    = ks.locPolCoverage || { covered: 0, total: 0 };
  const grpCov    = ks.grpStdCoverage || { covered: 0, total: 0 };
  const locCovPct = pct(locCov.covered, locCov.total);
  const grpCovPct = pct(grpCov.covered, grpCov.total);
  const locPct    = ks.grpStdLocalisation ? pct(ks.grpStdLocalisation.localised, ks.grpStdLocalisation.total) : 0;
  const policyCol = `
    <div class="pvo-col pvo-policy">
      <div class="pvo-col-hdr"><span class="pvo-col-ico">📜</span><span class="pvo-col-name">Policy Layer — Written &amp; Approved</span></div>
      ${metricNum(locCount || '—', 'policy statements catalogued')}
      ${metricPct(locCovPct, `policy statements with an associated risk (${locCov.covered}/${locCov.total})`, qoqArrow(locCovPct, pv.locCov, false))}
      ${metricNum(grpCount || '—', 'group standards catalogued')}
      ${metricPct(grpCovPct, `standard statements with associated risks (${grpCov.covered}/${grpCov.total})`, qoqArrow(grpCovPct, pv.grpCov, false))}
      ${metricPct(locPct, 'group requirements mapped into a policy statement', qoqArrow(locPct, pv.loc, false))}
      <div class="pvo-verdict pvo-verdict-ok">Policies rewritten &amp; approved — group→local mapping still light</div>
    </div>`;

  // Operational layer — controls behind the policies & standards
  const locOp = ks.locPolOperationalisation || { total: 0, operationalised: 0 };
  const grpOp = ks.grpStdOperationalisation || { total: 0, operationalised: 0 };
  const locBackedPct = pct(locOp.operationalised, locOp.total);
  const grpBackedPct = pct(grpOp.operationalised, grpOp.total);
  // Pre-DORA controls = implemented operational-type controls (narrow disruption
  // scope, no policy/standard prefix). Aim: map them all to a policy or standard.
  const facts   = a.riskPolicyFacts || [];
  const preDora = facts.filter(f => f.controlType === 'operational' && ftIsImplemented(f));
  const preDoraMapped = preDora.filter(f => (f.matchedPolicyRows || []).length > 0).length;
  const preDoraPct    = pct(preDoraMapped, preDora.length);
  const underCount   = rp ? rp.underAssuredCount : 0;
  const ru = oc.rollup || { ok: 0, building: 0, low: 0, none: 0 };
  const opsCol = `
    <div class="pvo-col pvo-ops">
      <div class="pvo-col-hdr"><span class="pvo-col-ico">⚙️</span><span class="pvo-col-name">Operational Layer — Operationalised</span></div>
      ${metricPct(locBackedPct, `policy statements backed by implemented controls (${locOp.operationalised}/${locOp.total})`, qoqArrow(locBackedPct, pv.locBack, false))}
      ${metricPct(grpBackedPct, `group standards backed by implemented controls (${grpOp.operationalised}/${grpOp.total})`, qoqArrow(grpBackedPct, pv.grpBack, false))}
      ${metricNum(preDora.length || '—', 'pre-DORA controls in place (disruption-risk scope)')}
      ${metricPct(preDoraPct, `pre-DORA controls mapped to a policy or standard (${preDoraMapped}/${preDora.length})`, qoqArrow(preDoraPct, pv.preDora, false))}
      <div class="pvo-verdict pvo-verdict-warn">Operationalisation early — ${underCount} risk rating${underCount === 1 ? '' : 's'} under-assured; confidence ${ru.ok} OK · ${ru.building} Building · ${ru.low} Low · ${ru.none} None</div>
    </div>`;

  const notes = a.notes
    ? `<div class="exec-notes-block"><div class="exec-notes-lbl">Assessment Notes</div>${a.notes}</div>`
    : '';

  return `
    <div class="pvo-summary">
      <div class="pvo-banner">
        <div class="pvo-banner-text">
          <span class="pvo-banner-title">Policy compliance ≠ operational compliance</span>
          <span class="pvo-banner-sub"><strong>Policy Layer — Written &amp; Approved:</strong> Policies are aligned with DORA and group-standard requirements. <strong>Operational Layer — Operationalised:</strong> Are policy statements associated with controls, and are they owned and implemented?</span>
        </div>
        <button class="btn-link ratings-link ratings-link-inline no-print" style="white-space:nowrap" onclick="showMetricsModal('compliance')">ℹ Metrics</button>
      </div>
      <div class="pvo-cols">${policyCol}${opsCol}</div>
      ${notes}
    </div>`;
}

// ── Dimension card ────────────────────────────────────────────
function execDimCard(measure, prevA, currentA, plannedA) {
  function dimAvg(a) {
    const vals = CONFIG.capabilities
      .map(c => getMeasureScore(a, c.id, measure.id))
      .filter(s => s > 0);
    return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0;
  }
  const cAvg = dimAvg(currentA);
  const pAvg = dimAvg(prevA);
  const lv   = levelForScore(cAvg);
  const d    = pAvg > 0 && cAvg > 0 ? cAvg - pAvg : null;
  const badge = pAvg > 0 && cAvg > 0
    ? `${pAvg.toFixed(1)} → ${cAvg.toFixed(1)}${d !== null && d !== 0 ? (d > 0 ? ' ▲' : ' ▼') : ''}`
    : cAvg > 0 ? cAvg.toFixed(1) : '—';

  const narr1 = execNarrative(prevA, currentA, measure, 'achieved');
  const narr2 = execNarrative(currentA, plannedA, measure, 'planned');
  const narrHtml = (narr1 || narr2)
    ? `<div class="exec-narr-row">${narr1}${narr2}</div>`
    : '';

  return `
    <div class="card exec-dim-card">
      <div class="exec-card-hdr">
        <span class="measure-icon">${measure.icon}</span>
        <div style="flex:1;min-width:0">
          <h3 class="measure-card-title">${measure.name}</h3>
          <p class="measure-card-desc">${measure.description}</p>
        </div>
      </div>
      ${execBarsCombo(currentA, plannedA, measure, prevA)}
      ${narrHtml}
    </div>`;
}

// ── Merged bar chart: solid current + striped planned extension ─
function execBarsCombo(currentA, plannedA, measure, prevA) {
  // 5 tick lines at 20%, 40%, 60%, 80%, 100%
  const levelLines = [1, 2, 3, 4, 5].map(l =>
    `<div class="exec-goal-line" style="left:${l * 20}%"></div>`
  ).join('');

  // Header labels — full names, uppercase
  const levelHdrLabels = [1, 2, 3, 4, 5].map(l => {
    const ls = measure.levels ? measure.levels.find(ls => ls.level === l) : null;
    const name = ls?.name ? ls.name.toUpperCase() : String(l);
    // Last label right-anchors to avoid overflow beyond track edge
    const style = l === 5
      ? 'right:0;transform:none'
      : `left:${l * 20}%;transform:translateX(-50%)`;
    return `<span class="exec-goal-lbl" style="${style}">${name}</span>`;
  }).join('');

  const rows = CONFIG.capabilities.map(cap => {
    const curr   = getMeasureScore(currentA, cap.id, measure.id) || 0;
    const plan   = getMeasureScore(plannedA, cap.id, measure.id) || 0;
    const lvCurr = levelForScore(curr);
    const lvPlan = levelForScore(plan);
    const currW  = (curr / 5) * 100;
    const planW  = (plan / 5) * 100;
    const extW   = Math.max(0, planW - currW);
    const planColor = lvPlan ? lvPlan.color : 'var(--clr-fill-dark)';
    const at = curr > 0 && curr >= 3;

    const planExt = extW > 0
      ? `<div class="exec-bar-plan-ext" style="left:${currW}%;width:${extW}%;--plan-color:${planColor}"></div>`
      : '';

    return `
      <div class="exec-bar-row">
        <span class="exec-bar-lbl" title="${cap.name}">${shortName(cap.name)}</span>
        <div class="exec-bar-track">
          <div class="exec-bar-fill" style="width:${currW}%;background:${lvCurr ? lvCurr.color : 'var(--clr-fill-dark)'}"></div>
          ${planExt}
          ${levelLines}
        </div>
        <span class="exec-bar-sc${at ? ' exec-at-goal' : ''}">${curr > 0 ? curr : '—'}</span>
        <span class="exec-bar-tgt">${plan > 0 ? plan : '—'}</span>
      </div>`;
  }).join('');

  return `
    <div class="exec-bars">
      <div class="exec-bar-row exec-bar-hdr">
        <span class="exec-bar-lbl"></span>
        <div class="exec-bar-track exec-bar-track-hdr">
          ${levelHdrLabels}
        </div>
        <span class="exec-bar-sc" style="color:var(--text-muted);font-size:.65rem;font-weight:normal">SC</span>
        <span class="exec-bar-tgt" style="color:var(--text-muted);font-size:.65rem;font-weight:normal">TGT</span>
      </div>
      ${rows}
    </div>`;
}

// ── Narrative — grouped by level transition ───────────────────
function execNarrative(fromA, toA, measure, type) {
  const groups = {};
  CONFIG.capabilities.forEach(cap => {
    const f = getMeasureScore(fromA, cap.id, measure.id) || 0;
    const t = getMeasureScore(toA,   cap.id, measure.id) || 0;
    if (t > f && f > 0 && t > 0) {
      const key = `${f}->${t}`;
      if (!groups[key]) {
        const lvDef = (measure.levels || []).find(l => l.level === f);
        groups[key] = { f, t, caps: [], exit: lvDef ? lvDef.exit : '' };
      }
      groups[key].caps.push(cap);
    }
  });

  const keys = Object.keys(groups);
  if (!keys.length) return '';

  const title = type === 'achieved' ? 'What we achieved' : 'What we plan';
  const items = keys.sort().map(key => {
    const g = groups[key];
    const n = g.caps.length;
    const names = g.caps.map(c => shortName(c.name)).join(' · ');
    return `
      <div class="exec-narr-group">
        <div class="exec-narr-heading">
          <strong>${n} ${n === 1 ? 'capability' : 'capabilities'}</strong>
          progressed Level ${g.f} → ${g.t}
        </div>
        <div class="exec-narr-caps">${names}</div>
        ${g.exit ? `<div class="exec-narr-exit">${g.exit}</div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="exec-narr exec-narr-${type}">
      <div class="exec-narr-title">${title}</div>
      ${items}
    </div>`;
}
