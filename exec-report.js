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
        <h2 class="exec-report-title">ROC Report</h2>
        <p class="exec-report-sub">${currentA.label} · ${formatDate(currentA.date)}</p>
      </div>
      <button class="btn btn-outline" onclick="window.print()">🖨 Print / Save PDF</button>
    </div>
    <div class="exec-report-top print-only" style="display:none">
      <h2 class="exec-report-title">ROC Report</h2>
      <p class="exec-report-sub">${currentA.label} · ${formatDate(currentA.date)}</p>
    </div>
    ${execComplianceSummary(currentA, prevA)}
    <div class="exec-rcsa-wrap">${renderGovernanceCard(currentA)}</div>
    <div class="exec-rcsa-wrap">${renderOwnerGapCard(currentA, prevA)}</div>
    <div class="exec-sc-grid">${RISK_THEMES.map(t => renderRiskPortfolioCard(currentA, t, prevA, { exec: true })).join('')}</div>
    ${renderExecCallouts(currentA)}
    <div class="exec-rcsa-wrap">${renderRiskMgmtSummaryCard(currentA, prevA, 'exec')}</div>
    <div class="exec-sec-div">Appendix — Operationalisation Detail</div>
    <div class="exec-rcsa-wrap">${renderMergedRiskTable(currentA)}</div>
    <div class="exec-sec-div">Appendix — Outstanding Controls by Owner</div>
    <div class="exec-rcsa-wrap">${renderControlsByOwner(currentA)}</div>
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

// ── Ownership of the unimplemented gap ────────────────────────────
// A ranked bar list: of the controls not yet implemented, which accountable
// team (policy owner) owns them. Bar length = that team's share of the whole
// gap; the sub-line shows their footprint (gap / owned) and progress. When a
// previous assessment is supplied, each row carries quarter-over-quarter arrows
// for the outstanding count (▼ = fewer = good) and % done (▲ = more = good),
// recomputed live from the previous quarter's stored facts. Teams that cleared
// their whole backlog since last quarter stay visible as a win.
function renderOwnerGapCard(assessment, prev) {
  const g  = buildOwnerGapRollup(assessment.riskPolicyFacts || []);
  const pg = prev ? buildOwnerGapRollup(prev.riskPolicyFacts || []) : null;
  if (!g.totalControls) return '';

  const hdr = body => `
    <div class="card measure-card owg-card">
      <div class="measure-card-header">
        <span class="measure-icon">🧭</span>
        <div style="flex:1">
          <h3 class="measure-card-title">ICT Governance — Roles &amp; Responsibilities</h3>
          <p class="measure-card-desc"><b>${g.gapCount}</b> of ${g.totalControls} controls are not yet implemented (<b>${g.gapPct}%</b>). Each bar is that team's share of the whole gap; the sub-line shows their not-implemented / owned count and how much of their book is done${pg ? ', with movement since last quarter (▼ outstanding = good, ▲ done = good)' : ''}. <b>Accountable owner</b> comes from the policy statement, not the control operator.</p>
        </div>
      </div>
      ${body}
    </div>`;

  // Teams that had a backlog last quarter but have none now — kept as a win.
  const cleared = pg
    ? Object.values(pg.byOwner)
        .filter(p => p.gap > 0 && !(g.byOwner[p.owner] && g.byOwner[p.owner].gap > 0))
        .map(p => ({ ...(g.byOwner[p.owner] || { owner: p.owner, gap: 0, ownedTotal: 0, implRate: null, shareOfGap: 0 }), _cleared: true }))
        .sort((a, b) => a.owner.localeCompare(b.owner))
    : [];

  if (!g.gapCount && !cleared.length) return hdr('');

  const row = r => {
    const p = pg && pg.byOwner[r.owner];
    const cntArrow  = p ? qoqArrow(r.gap, p.gap, true) : '';
    const doneArrow = (p && r.implRate != null && p.implRate != null) ? qoqArrow(r.implRate, p.implRate, false) : '';
    const done = r.implRate != null ? `${r.implRate}% done${doneArrow}` : '—';
    const tag  = r._cleared ? ' <span class="owg-cleared">✓ cleared</span>' : '';
    return `
      <div class="owg-row${r._cleared ? ' owg-row-cleared' : ''}">
        <span class="owg-name" title="${r.owner}">${r.owner}${tag}</span>
        <span class="owg-bar"><i style="width:${Math.max(r._cleared ? 0 : 2, r.shareOfGap)}%"></i></span>
        <span class="owg-fig"><b>${r.shareOfGap}%</b><span class="owg-sub">${r.gap}${cntArrow} of ${r.ownedTotal} · ${done}</span></span>
      </div>`;
  };

  return hdr(`<div class="owg-list">${g.rows.map(row).join('')}${cleared.map(row).join('')}</div>`);
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
const MRT_FIELD = { capability: r => r.capName, theme: r => r.themeName, document: r => r.document || '', risk: r => r.riskTitle || '', owner: r => r.owner || '' };

function mrtHead() {
  const arrow = c => _mergedSort.col === c ? `<span class="mrt-arrow">${_mergedSort.dir === 1 ? '▲' : '▼'}</span>` : '';
  const sTh = (k, label) => `<th class="mrt-sort" onclick="sortMergedTable('${k}')">${label}${arrow(k)}</th>`;
  return `<tr>
    ${sTh('capability', 'Capability')}${sTh('theme', 'Theme')}${sTh('document', 'Document')}${sTh('risk', 'Risk')}${sTh('owner', 'Accountable Owner')}
    <th>Residual Risk</th>
    <th>Ctrl Impl<span class="opcov-th-sub">impl / controls</span></th>
    <th>Ctrl Assessed<span class="opcov-th-sub">assessed / controls</span></th>
    <th class="opcov-chip-cell">Confidence</th>
  </tr>`;
}

// Static header (no sort handlers / arrows) for the standalone print/PDF export.
function mrtHeadPrint() {
  return `<tr>
    <th>Capability</th><th>Theme</th><th>Document</th><th>Risk</th><th>Accountable Owner</th>
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
      <td class="mrt-owner">${r.owner || '<span class="mrt-dash">—</span>'}</td>
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

// ── Standalone appendix export (Print → PDF) ──────────────────
// Opens an appendix block alone in a clean landscape, light-theme print view —
// table headers repeat on every page, rows never split across a page break,
// colour chips preserved. Shared by the detail table and the controls-by-owner
// list so both paste cleanly into slides.
function execPrintWindow(title, subtitle, bodyHtml) {
  const cssHref = new URL('style.css', location.href).href;
  const doc = `<!doctype html>
<html data-theme="light">
<head>
<meta charset="utf-8">
<title>${title}</title>
<link rel="stylesheet" href="${cssHref}">
<style>
  html, body { background:#fff; margin:0; }
  .mrt-print-page { padding: 10px 14px; }
  .mrt-print-head { margin: 0 0 8px; }
  .mrt-print-head h1 { font-size: 15px; margin: 0 0 2px; }
  .mrt-print-head p  { font-size: 11px; color:#555; margin: 0; }
  .mrt-print-page table { width:100%; border-collapse:collapse; }
  .mrt-print-hint { font-size:11px; color:#888; margin:8px 0 0; }
  @media print {
    @page { size: 33.87cm 19.05cm; margin: 0.7cm; }   /* PowerPoint widescreen 13.33in x 7.5in */
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    /* neutralise the app stylesheet's own print-hide rules in this window */
    body *, html { visibility: visible !important; }
    .mrt-print-hint { display: none !important; }
    .mrt-print-page thead { display: table-header-group; } /* repeat header on every page */
    .mrt-print-page tr { break-inside: avoid; page-break-inside: avoid; } /* never split a row */
    .cbo-head { break-after: avoid; }                      /* keep owner heading with its rows */
  }
</style>
</head>
<body>
  <div class="mrt-print-page">
    <div class="mrt-print-head">
      <h1>${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
    </div>
    ${bodyHtml}
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
  if (!w) { alert('Please allow pop-ups for this site to export.'); return; }
  w.document.open();
  w.document.write(doc);
  w.document.close();
}

// Detail table export — reads the live tbody so it respects the current sort.
function printMergedRiskTable() {
  const tb = document.getElementById('merged-risk-tbody');
  if (!tb) return;
  const meta    = _mergedMeta || {};
  const nsCount = _mergedRows.filter(r => r.notStarted).length;
  const nsNote  = nsCount
    ? `<p class="mrt-note">${nsCount} registered ${nsCount === 1 ? 'document has' : 'documents have'} no operationalised controls yet — shown as <span class="mrt-nostart">not started</span>.</p>`
    : '';
  const body = `
    <table class="opcov-table merged-risk-table">
      <thead>${mrtHeadPrint()}</thead>
      <tbody>${tb.innerHTML}</tbody>
    </table>
    ${nsNote}
    ${renderOpCoverageLegend()}`;
  execPrintWindow('Operationalisation Detail — All Risks', [meta.label, meta.date].filter(Boolean).join(' · '), body);
}

// ── Appendix — Outstanding Controls by Accountable Owner ──────────
// Every not-yet-implemented control grouped under the team accountable for it
// (from the policy statement's OWNER). "Unassigned" = controls with no policy
// link. Sorted biggest backlog first, Unassigned last.
let _cboAssessment = null;

function buildControlsByOwnerGroups(assessment) {
  const facts = (assessment.riskPolicyFacts || [])
    .filter(f => !ftNorm(f.riskStatus).includes('closed') && !ftIsImplemented(f));
  const capName = id => (CONFIG.capabilities.find(c => c.id === id)?.name) || id;
  const ownerOf = f => {
    if ((f.policyOwner || '').trim()) return f.policyOwner.trim();
    const c = {};
    (f.matchedPolicyRows || []).forEach(p => { const o = (p.owner || '').trim(); if (o) c[o] = (c[o] || 0) + 1; });
    let b = '', n = 0; for (const k in c) if (c[k] > n) { n = c[k]; b = k; }
    return b;
  };
  const groups = {};
  facts.forEach(f => {
    const owner = ownerOf(f) || 'Unassigned';
    (groups[owner] = groups[owner] || []).push({
      cap: capName(f.capId),
      doc: ((f.matchedPolicyRows && f.matchedPolicyRows[0] && f.matchedPolicyRows[0].document) || '').trim() || '—',
      control: f.controlName || '(unnamed control)',
    });
  });
  return Object.entries(groups)
    .map(([owner, items]) => ({ owner, items: items.sort((a, b) => a.cap.localeCompare(b.cap) || a.control.localeCompare(b.control)) }))
    .sort((a, b) =>
      (a.owner === 'Unassigned' ? 1 : 0) - (b.owner === 'Unassigned' ? 1 : 0) ||
      b.items.length - a.items.length ||
      a.owner.localeCompare(b.owner));
}

function controlsByOwnerBody(assessment) {
  const groups = buildControlsByOwnerGroups(assessment);
  if (!groups.length) return '<p class="mrt-note">Every in-scope control is implemented — nothing outstanding.</p>';
  return groups.map(g => `
    <div class="cbo-group">
      <div class="cbo-head"><span class="cbo-owner">${g.owner}</span><span class="cbo-count">${g.items.length} not implemented</span></div>
      <table class="opcov-table cbo-table">
        <thead><tr><th>Capability</th><th>Document</th><th>Control</th></tr></thead>
        <tbody>${g.items.map(it =>
          `<tr><td class="cbo-cap">${it.cap}</td><td class="cbo-doc">${it.doc}</td><td class="cbo-ctrl">${it.control}</td></tr>`).join('')}</tbody>
      </table>
    </div>`).join('');
}

function renderControlsByOwner(assessment) {
  _cboAssessment = assessment;
  return `
    <div class="card measure-card cbo-card">
      <div class="measure-card-header">
        <span class="measure-icon">🗂️</span>
        <div style="flex:1">
          <h3 class="measure-card-title">Outstanding Controls by Accountable Owner</h3>
          <p class="measure-card-desc">Every not-yet-implemented control, grouped under the team accountable for it (from the policy statement owner). <b>Unassigned</b> = controls with no policy-statement link.</p>
        </div>
        <button class="btn btn-outline no-print" style="align-self:flex-start;white-space:nowrap" onclick="printControlsByOwner()">🖨 Export (PDF)</button>
      </div>
      ${controlsByOwnerBody(assessment)}
    </div>`;
}

function printControlsByOwner() {
  const a = _cboAssessment;
  if (!a) return;
  const sub = [a.label, formatDate(a.date)].filter(Boolean).join(' · ');
  execPrintWindow('Outstanding Controls by Accountable Owner', sub, controlsByOwnerBody(a));
}

// ── Appendix — Metric Definitions ─────────────────────────────
// The same content shown in the ℹ Metrics / ℹ Confidence popups, rendered
// inline as natural-size, full-width tables. The definitions are identical
// across all three risk themes, so they're printed once here — a clean
// appendix slide the user copies straight into PowerPoint.
function renderMetricsAppendix() {
  const conf = confidenceInfo();
  return `
    <div class="card measure-card metrics-def-card">
      <h3 class="measure-card-title">${conf.title}</h3>
      ${metricsInfoBody(conf, ["Rating", "How it's calculated", "What it means"])}
    </div>`;
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
  // Percentage metric, read as a sentence: [value%] [explanation]. [impact%] [impact].
  // The impact clause carries its own percentage (so it never reads "the other 0%")
  // and is dropped entirely when that percentage is 0.
  const metricPct = (p, explanation, impact = '', arrow = '') => {
    const w = Math.max(0, Math.min(100, p));
    const lbl = `${explanation}${impact ? `. <span class="pvo-impact">${impact}</span>` : ''}`;
    return `<div class="pvo-metric"><span class="pvo-val pvo-val-pct">${p}%${arrow}</span><span class="pvo-lbl">${lbl}</span><span class="pvo-meter"><i style="width:${w}%"></i></span></div>`;
  };
  const compl = p => 100 - p;   // impact percentage = the complement of the value

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
    const ppLoc = (prev.policyRows || []).filter(r => isLocPolType(r.type));
    pv.locAppr  = ppLoc.length ? pct(ppLoc.filter(r => (r.status || '').toLowerCase().includes('approv')).length, ppLoc.length) : null;
  }

  // Policy layer
  const locCov    = ks.locPolCoverage || { covered: 0, total: 0 };
  const grpCov    = ks.grpStdCoverage || { covered: 0, total: 0 };
  const locCovPct = pct(locCov.covered, locCov.total);
  const grpCovPct = pct(grpCov.covered, grpCov.total);
  const locPct    = ks.grpStdLocalisation ? pct(ks.grpStdLocalisation.localised, ks.grpStdLocalisation.total) : 0;
  const locPolRows = polRows.filter(r => isLocPolType(r.type));
  const locApproved = locPolRows.filter(r => (r.status || '').toLowerCase().includes('approv')).length;
  const locApprPct  = pct(locApproved, locPolRows.length);
  const policyCol = `
    <div class="pvo-col pvo-policy">
      <div class="pvo-col-hdr"><span class="pvo-col-ico">📜</span><span class="pvo-col-name">ICT Governance &amp; Risk Control Framework</span></div>
      ${metricNum(locCount || '—', 'Policy statements we\'ve formally written and catalogued')}
      ${metricPct(locCovPct, `of our policy statements are tracked as risks (${locCov.covered}/${locCov.total})`, compl(locCovPct) ? `${compl(locCovPct)}% are blind spots we don't yet monitor` : '', qoqArrow(locCovPct, pv.locCov, false))}
      ${metricPct(locApprPct, `of our policy statements have been approved (${locApproved}/${locPolRows.length})`, compl(locApprPct) ? `${compl(locApprPct)}% are not yet aligned with DORA and Group` : '', qoqArrow(locApprPct, pv.locAppr, false))}
      ${metricNum(grpCount || '—', 'Group standards we\'re required to meet, catalogued')}
      ${metricPct(grpCovPct, `of our group standard requirements are tracked as risks (${grpCov.covered}/${grpCov.total})`, compl(grpCovPct) ? `${compl(grpCovPct)}% remain unmonitored` : '', qoqArrow(grpCovPct, pv.grpCov, false))}
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
      <div class="pvo-col-hdr"><span class="pvo-col-ico">⚙️</span><span class="pvo-col-name">Operational Compliance</span></div>
      ${metricPct(locBackedPct, `of our policy statements are linked to an implemented control (${locOp.operationalised}/${locOp.total})`, compl(locBackedPct) ? `${compl(locBackedPct)}% we can't prove we comply with` : '', qoqArrow(locBackedPct, pv.locBack, false))}
      ${metricPct(grpBackedPct, `of our group standards are linked to an implemented control (${grpOp.operationalised}/${grpOp.total})`, compl(grpBackedPct) ? `${compl(grpBackedPct)}% we can't prove we comply with` : '', qoqArrow(grpBackedPct, pv.grpBack, false))}
      ${metricNum(preDora.length || '—', 'Existing pre-DORA controls already running (older disruption-risk scope)')}
      ${metricPct(preDoraPct, `of existing pre-DORA controls are tied to a policy or standard (${preDoraMapped}/${preDora.length})`, compl(preDoraPct) ? `${compl(preDoraPct)}% have no stated reason we run them` : '', qoqArrow(preDoraPct, pv.preDora, false))}
    </div>`;

  const notes = a.notes
    ? `<div class="exec-notes-block"><div class="exec-notes-lbl">Assessment Notes</div>${a.notes}</div>`
    : '';

  return `
    <div class="pvo-summary">
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
