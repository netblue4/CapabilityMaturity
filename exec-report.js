// ── Executive Report ──────────────────────────────────────────

function showExecReportModal() {
  if (db.assessments.length < 2) {
    alert('You need at least 2 assessments to generate a report.');
    return;
  }
  const opts = db.assessments.map(a =>
    `<option value="${a.id}">${a.label} · ${formatDate(a.date)}</option>`
  ).join('');
  ['exec-prev-sel', 'exec-curr-sel'].forEach(id => {
    document.getElementById(id).innerHTML = opts;
  });
  const n = db.assessments.length;
  document.getElementById('exec-prev-sel').value = db.assessments[Math.max(0, n - 2)].id;
  document.getElementById('exec-curr-sel').value = db.assessments[n - 1].id;
  document.getElementById('exec-report-modal').style.display = 'flex';
}

function closeExecReportModal() {
  document.getElementById('exec-report-modal').style.display = 'none';
}

// ── The operationalisation story — four sequential steps ──────────
// Each step signposts a card (or set of cards) with the exec question it
// answers. Same wording as the story summary, shown as a top stepper + banners.
const EXEC_STORY = [
  { name: 'ICT Governance',              q: 'Have we formally identified and approved what we must do to manage IT risk?' },
  { name: 'IT Risk &amp; Control Framework', q: "What goes wrong if we don't follow our policies — and what controls treat it?" },
  { name: 'DORA &amp; Group fit-for-purpose', q: 'How fast are we replacing the old pre-DORA base with fit-for-purpose DORA controls?' },
];

function execStepper() {
  return `<div class="exec-stepper">${EXEC_STORY.map((s, i) =>
    `<span class="exec-stepper-item"><span class="exec-step-num">${i + 1}</span>${s.name}</span>` +
    (i < EXEC_STORY.length - 1 ? '<span class="exec-stepper-arrow">→</span>' : '')
  ).join('')}</div>`;
}

function execStep(n) {
  const s = EXEC_STORY[n - 1];
  return `<div class="exec-step">
    <span class="exec-step-num">${n}</span>
    <div class="exec-step-txt">
      <span class="exec-step-name">Step ${n} · ${s.name}</span>
      <span class="exec-step-q">${s.q}</span>
    </div>
  </div>`;
}

function generateExecReport() {
  const prevA    = db.assessments.find(a => a.id === document.getElementById('exec-prev-sel').value);
  const currentA = db.assessments.find(a => a.id === document.getElementById('exec-curr-sel').value);
  if (!prevA || !currentA) return;
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
    ${execStep(1)}
    <div class="exec-rcsa-wrap">${renderRtmFunnel(currentA)}</div>
    ${execStep(2)}
    ${RISK_THEMES.map(t => `<div class="exec-rcsa-wrap">${renderFrameworkCard(currentA, t)}</div>`).join('')}
    ${execStep(3)}
    <div class="exec-rcsa-wrap">${renderDoraTransition(currentA, prevA)}</div>
    <div class="exec-sec-div">Supporting Detail</div>
    <div class="exec-rcsa-wrap">${renderRtmOwnerCard(currentA)}</div>
    <div class="exec-rcsa-wrap">${renderRiskMgmtSummaryCard(currentA, prevA, 'exec')}</div>
  `;
  showView('exec-report');
}

// ── Risk-Treatment Operationalisation — 4-layer card (top of Step 1) ──
// Colours for document-type slices (extends as new source types appear).
const RTMF_TYPE_COLORS = [
  'var(--accent)', 'var(--accent2)',
  'color-mix(in srgb, var(--accent) 55%, var(--clr-success))',
  'color-mix(in srgb, var(--accent) 55%, var(--clr-warning))',
];
// Donut SVG built at render time (innerHTML-injected script wouldn't run).
function rtmfDonut(segs, big, small) {
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  const R = 40, C = 2 * Math.PI * R, SW = 15;
  let acc = 0;
  const arcs = segs.map(s => {
    const len = s.value / total * C;
    const c = `<circle cx="50" cy="50" r="${R}" fill="none" stroke-width="${SW}" style="stroke:${s.color}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 50 50)"></circle>`;
    acc += len; return c;
  }).join('');
  return `<svg viewBox="0 0 100 100" class="rtmf-donut" aria-hidden="true">
    <circle cx="50" cy="50" r="${R}" fill="none" stroke-width="${SW}" style="stroke:var(--track)"></circle>
    ${arcs}
    <text x="50" y="48" text-anchor="middle" class="rtmf-donut-big">${big}</text>
    <text x="50" y="62" text-anchor="middle" class="rtmf-donut-small">${small}</text>
  </svg>`;
}
function rtmfLegend(items) {
  return `<div class="rtmf-legend">${items.map(it =>
    `<div class="rtmf-lg"><i style="background:${it.color}"></i><b>${it.value}</b> <span>${escHtml(it.label)} (${it.pct}%)</span></div>`).join('')}</div>`;
}
function rtmfUnit(donut, legend) {
  return `<div class="rtmf-unit">${donut}<div>${legend}</div></div>`;
}
let _rtmFunnelData = null;
function renderRtmFunnel(assessment) {
  const f = buildRtmFunnel(assessment.policyRows || [], assessment.riskPolicyFacts || []);
  _rtmFunnelData = f;
  const header = `
    <div class="measure-card-header">
      <span class="measure-icon">🎯</span>
      <div style="flex:1">
        <h3 class="measure-card-title">Risk-Treatment Operationalisation</h3>
        <p class="measure-card-desc">From the obligations we're required to meet, through operationalising them, to the controls we run.</p>
      </div>
    </div>`;
  if (!f.total) {
    return `<div class="card measure-card">${header}<p class="policy-no-data" style="margin:.5rem 0">No policy data uploaded yet.</p></div>`;
  }
  const pOf = (n, d) => d ? Math.round(100 * n / d) : 0;
  const cBuild = 'var(--clr-success)';
  const cReuse = 'color-mix(in srgb, var(--clr-success) 48%, var(--accent))';
  const cDraft = 'var(--clr-warning)';
  const cUnc   = 'color-mix(in srgb, var(--clr-danger) 55%, var(--bg3))';

  // Layer 1 — sources
  const srcBlocks = f.sources.map(s =>
    `<div class="rtmf-src"><div class="rtmf-src-name">${escHtml(s.name)}</div><div class="rtmf-src-val">${s.count}</div></div>`).join('');

  // Layer 2 — RTM composition by document type
  const typeSegs = f.sources.map((s, i) => ({ value: s.count, color: RTMF_TYPE_COLORS[i % RTMF_TYPE_COLORS.length] }));
  const typeLegend = f.sources.map((s, i) => ({ value: s.count, label: s.name, pct: pOf(s.count, f.total), color: RTMF_TYPE_COLORS[i % RTMF_TYPE_COLORS.length] }));

  // Layer 3 — analysis
  const opedDonut = rtmfDonut([{ value: f.built, color: cBuild }, { value: f.reused, color: cReuse }], f.evidenced, 'live');
  const opedLegend = rtmfLegend([
    { value: f.built,  label: 'Built new',        pct: pOf(f.built, f.evidenced),  color: cBuild },
    { value: f.reused, label: 'Reused pre-DORA',  pct: pOf(f.reused, f.evidenced), color: cReuse },
  ]);
  const cWaive = 'color-mix(in srgb, var(--text-muted) 55%, var(--track))';
  const inprocDonut = rtmfDonut([
    { value: f.decisionNeeded, color: cUnc },
    { value: f.inBuild, color: cDraft },
    { value: f.waived, color: cWaive },
  ], f.inProcess, 'to decide');
  const inprocLegend = rtmfLegend([
    { value: f.decisionNeeded, label: 'Decision needed — invisible work',   pct: pOf(f.decisionNeeded, f.inProcess), color: cUnc },
    { value: f.inBuild,        label: 'In build — control drafted',          pct: pOf(f.inBuild, f.inProcess),        color: cDraft },
    { value: f.waived,         label: 'Waived / exempted (E/WT/WP)',         pct: pOf(f.waived, f.inProcess),         color: cWaive },
  ]);

  // Layer 4 — control framework (control axis)
  const ctrlDonut = rtmfDonut([{ value: f.ctrlMapped, color: 'var(--clr-success)' }, { value: f.ctrlUnmapped, color: 'var(--clr-danger)' }], f.ctrlTotal, 'controls');
  const ctrlLegend = rtmfLegend([
    { value: f.ctrlMapped,   label: 'Mapped to a RTM', pct: pOf(f.ctrlMapped, f.ctrlTotal),   color: 'var(--clr-success)' },
    { value: f.ctrlUnmapped, label: 'Not mapped to RTM - No reason for running', pct: pOf(f.ctrlUnmapped, f.ctrlTotal), color: 'var(--clr-danger)' },
  ]);

  return `
    <div class="card measure-card">
      ${header}

      <div class="rtmf-layer">
        <div class="rtmf-eyebrow"><span class="rtmf-num">1</span><span class="rtmf-lname">Sources</span><span class="rtmf-lsub">document types in the policy upload</span></div>
        <div class="rtmf-sources">${srcBlocks}</div>
      </div>
      <div class="rtmf-arrow">↓</div>

      <div class="rtmf-layer rtmf-rtm">
        <div class="rtmf-eyebrow"><span class="rtmf-num">2</span><span class="rtmf-lname">Risk-Treatment Measures (RTM)</span><span class="rtmf-lsub">our sources detail the RTM's we use to treat IT risk</span><button class="btn-link rtmf-detail no-print" onclick="showFunnelDetail('rtm')">ℹ Detail</button></div>
        <div class="rtmf-units">${rtmfUnit(rtmfDonut(typeSegs, f.total, 'measures'), rtmfLegend(typeLegend))}</div>
      </div>
      <div class="rtmf-arrow">↓</div>

      <div class="rtmf-layer">
        <div class="rtmf-eyebrow"><span class="rtmf-num">3</span><span class="rtmf-lname">Planning &mdash; Risk-Treatment Measures to Controls</span><span class="rtmf-lsub">operationalised, or awaiting a decision: build, waive or exempt</span><button class="btn-link rtmf-detail no-print" onclick="showFunnelDetail('planning')">ℹ Detail</button></div>
        <div class="rtmf-units">
          ${rtmfUnit(opedDonut, opedLegend)}
          <div class="rtmf-unit-sep"></div>
          ${rtmfUnit(inprocDonut, inprocLegend)}
        </div>
        <div class="rtmf-cap">RTM's operationalised ${f.evidenced} &nbsp;+&nbsp; in process ${f.inProcess} &nbsp;=&nbsp; ${f.total} measures &nbsp;&middot;&nbsp; <b>${f.decisionNeeded}</b> awaiting a decision</div>
      </div>
      <div class="rtmf-arrow">↓</div>

      <div class="rtmf-layer rtmf-framework">
        <div class="rtmf-eyebrow"><span class="rtmf-num">4</span><span class="rtmf-lname">ICT Risk &amp; Control Framework</span><span class="rtmf-axis-tag">implemented control operationalising RTM's</span><button class="btn-link rtmf-detail no-print" onclick="showFunnelDetail('framework')">ℹ Detail</button></div>
        <div class="rtmf-units">${rtmfUnit(ctrlDonut, ctrlLegend)}</div>
        <div class="rtmf-cap">${f.ctrlTotal} implemented controls we run</div>
      </div>
    </div>`;
}

// ── Funnel "Detail" popups — how to reconcile each layer with the
//    main-screen Planning table (copied to Excel) ────────────────────
function showFunnelDetail(layer) {
  const f = _rtmFunnelData;
  if (!f) return;
  const dedupRtm = 'Then <b>Remove Duplicates</b> on <b>Capability + Statement Ref</b>.';
  const item = (val, name, def, filter) => `
    <div class="fdet-item">
      <div class="fdet-hd"><span class="fdet-val">${val}</span><span class="fdet-name">${name}</span></div>
      <div class="fdet-def">${def}</div>
      <div class="fdet-filter"><span class="fdet-flabel">Filter</span> ${filter}</div>
    </div>`;
  let title, intro, items;
  if (layer === 'rtm') {
    const lp = f.sources.find(s => s.name === 'Local Policy');
    const gs = f.sources.find(s => s.name === 'Group Standards');
    title = 'Layer 2 · Risk-Treatment Measures — how to reconcile';
    intro = 'Every number here counts <b>distinct RTMs</b> (policy statements). In the copied Planning table each RTM can span several rows, so always de-duplicate.';
    items =
      item(f.total, 'Measures (RTMs)', 'Every distinct risk-treatment measure in the policy upload.', `Keep rows where <b>Statement Ref</b> is not blank. ${dedupRtm}`) +
      (lp ? item(lp.count, 'Local Policy', 'RTMs whose source document is a local policy.', `<b>RTM Source = Local Policy</b>. ${dedupRtm}`) : '') +
      (gs ? item(gs.count, 'Group Standards', 'RTMs whose source document is a group standard.', `<b>RTM Source = Group Standard</b>. ${dedupRtm}`) : '');
  } else if (layer === 'planning') {
    title = 'Layer 3 · Planning — how to reconcile';
    intro = 'Every number here counts <b>distinct RTMs</b>. The left donut uses <b>Planning Status</b>; the right (in-process) donut is split by <b>decision</b> using the <b>Exception</b> column. Filter, then de-duplicate on Capability + Statement Ref.';
    items =
      item(f.evidenced, 'LIVE (operationalised)', 'RTMs with at least one implemented control.', `<b>Planning Status = Built new</b> OR <b>Reused pre-DORA</b>. ${dedupRtm}`) +
      item(f.built, 'Built new', 'RTM operationalised by a new DORA control.', `<b>Planning Status = Built new</b>. ${dedupRtm}`) +
      item(f.reused, 'Reused pre-DORA', 'RTM operationalised by an existing pre-DORA control.', `<b>Planning Status = Reused pre-DORA</b>. ${dedupRtm}`) +
      item(f.inProcess, 'IN PROCESS', 'RTMs not yet operationalised — the decision queue below.', `<b>Planning Status = Drafted</b> OR <b>Uncovered</b>. ${dedupRtm}`) +
      item(f.decisionNeeded, 'Decision needed', 'No control and no exception — invisible work awaiting a call (build / accept / add to policy).', `<b>Planning Status = Uncovered</b> AND <b>Exception</b> is blank. ${dedupRtm}`) +
      item(f.inBuild, 'In build', 'A control is drafted — decision taken, build in progress.', `<b>Planning Status = Drafted</b>. ${dedupRtm}`) +
      item(f.waived, 'Waived / exempted', 'No control, but an exception has been filed (E / WT / WP).', `<b>Planning Status = Uncovered</b> AND <b>Exception</b> is <b>E</b>, <b>WT</b> or <b>WP</b>. ${dedupRtm}`);
  } else {
    title = 'Layer 4 · ICT Risk & Control Framework — how to reconcile';
    intro = 'These count <b>implemented controls</b>, not RTMs. A control can appear on several rows, so de-duplicate on <b>Control Name</b> (not Statement Ref).';
    items =
      item(f.ctrlTotal, 'Implemented controls we run', 'Every implemented control, whether or not it maps to an RTM.', 'Filter <b>Control Status = Implemented</b>. Then <b>Remove Duplicates</b> on <b>Control Name</b>.') +
      item(f.ctrlMapped, 'Mapped to a RTM', 'Implemented controls that operationalise at least one RTM.', 'Filter <b>Control Status = Implemented</b> AND <b>Statement Ref</b> not blank. Then <b>Remove Duplicates</b> on <b>Control Name</b>.') +
      item(f.ctrlUnmapped, 'Not mapped to RTM', 'Implemented controls with no RTM behind them (Planning Status = Pre-DORA (unmapped)).', 'Filter <b>Control Status = Implemented</b> AND <b>Statement Ref</b> is blank. Then <b>Remove Duplicates</b> on <b>Control Name</b>.') +
      '<p class="fdet-note">Note: control counts de-duplicate on Control Name — if two different controls share a name the total can differ by that overlap.</p>';
  }
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `<p class="fdet-intro">${intro}</p>${items}`;
  const m = document.getElementById('ratings-modal');
  const box = m.querySelector('.modal-box');
  if (box) box.classList.add('modal-wide');
  m.style.display = 'flex';
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

// ── Ownership — workload & implementation progress ────────────────
// One bar per accountable team (policy owner). Bar LENGTH = that team's
// workload (controls they own, scaled to the heaviest-loaded team), so the
// split is visible — IT typically carries the most. The GREEN fill = what
// they've implemented, so it reads as a progress bar toward done. With a
// previous assessment each row shows a ▲ for progress since last quarter
// (up = good). Sorted by workload, heaviest first.
function renderOwnerGapCard(assessment, prev) {
  const g  = buildOwnerGapRollup(assessment.riskPolicyFacts || []);
  const pg = prev ? buildOwnerGapRollup(prev.riskPolicyFacts || []) : null;
  if (!g.totalControls) return '';

  const teams = Object.values(g.byOwner)
    .filter(o => o.ownedTotal > 0)
    .sort((a, b) => b.ownedTotal - a.ownedTotal || a.owner.localeCompare(b.owner));
  const maxOwned  = teams.reduce((m, o) => Math.max(m, o.ownedTotal), 0) || 1;
  const totalImpl = g.totalControls - g.gapCount;
  const donePct   = g.totalControls ? Math.round(100 * totalImpl / g.totalControls) : 0;

  const row = o => {
    const p     = pg && pg.byOwner[o.owner];
    const arrow = (p && o.implRate != null && p.implRate != null) ? qoqArrow(o.implRate, p.implRate, false) : '';
    const wl    = Math.max(3, Math.round(100 * o.ownedTotal / maxOwned));
    return `
      <div class="owg-row">
        <span class="owg-name" title="${o.owner}">${o.owner}</span>
        <span class="owg-track"><span class="owg-bar" style="width:${wl}%"><i style="width:${o.implRate || 0}%"></i></span></span>
        <span class="owg-fig"><b>${o.implRate}%</b><span class="owg-sub">${o.ownedImpl}/${o.ownedTotal} done${arrow}</span></span>
      </div>`;
  };

  return `
    <div class="card measure-card owg-card">
      <div class="measure-card-header">
        <span class="measure-icon">🧭</span>
        <div style="flex:1">
          <h3 class="measure-card-title">Own &amp; Implement Controls</h3>
          <p class="measure-card-desc"><b>${totalImpl}</b> of ${g.totalControls} controls implemented (<b>${donePct}%</b>) across ${teams.length} accountable teams. Each bar's length is that team's workload — the controls they own — and the green fill is what they've implemented${pg ? ', with the ▲ showing progress since last quarter' : ''}. Closing the gap is a business-wide effort. <b>Accountable owner</b> comes from the policy statement, not the control operator.</p>
        </div>
      </div>
      <div class="owg-list">${teams.map(row).join('')}</div>
    </div>`;
}

// ── RTM Ownership — accountability by owning team (exec report) ────
// Groups controls by the RTM owner (from the policy upload). A control backing
// several teams' RTMs counts under each (option a); the totals row counts each
// control once. Sorting is a live-screen aid — the print captures whatever
// order is applied.
let _rtmoRows = [];
let _rtmoTotals = null;
let _rtmoSort = { col: 'controls', dir: -1 };
const RTMO_FIELD = {
  owner:       r => r.owner || '',
  rtms:        r => r.rtms,
  controls:    r => r.controls,
  implemented: r => r.implemented,
  assessed:    r => r.assessed,
};
function rtmoSortRows() {
  const f = RTMO_FIELD[_rtmoSort.col] || RTMO_FIELD.controls;
  const dir = _rtmoSort.dir;
  return _rtmoRows.slice().sort((a, b) => {
    // Unassigned always sinks to the bottom, regardless of sort.
    if ((a.owner === 'Unassigned') !== (b.owner === 'Unassigned')) return a.owner === 'Unassigned' ? 1 : -1;
    const va = f(a), vb = f(b);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir || a.owner.localeCompare(b.owner);
    return String(va).localeCompare(String(vb)) * dir;
  });
}
function rtmoHead() {
  const arrow = c => _rtmoSort.col === c ? `<span class="mrt-arrow">${_rtmoSort.dir === 1 ? '▲' : '▼'}</span>` : '';
  const th = (k, label, cls) => `<th class="mrt-sort${cls ? ' ' + cls : ''}" onclick="sortRtmOwnerTable('${k}')">${label}${arrow(k)}</th>`;
  return `<tr>
    ${th('owner', 'Owner / Team')}
    ${th('rtms', 'RTMs owned', 'rto-num')}
    ${th('controls', 'Controls linked', 'rto-num')}
    ${th('implemented', 'Implemented', 'rto-bar-th')}
    ${th('assessed', 'Assessed', 'rto-bar-th')}
  </tr>`;
}
function rtmoBarCell(n, d) {
  if (!d) return `<td class="rto-bar-td"><span class="mrt-dash">—</span></td>`;
  const pct = Math.round(100 * n / d);
  return `<td class="rto-bar-td"><div class="rto-cell">
    <span class="rto-fig"><b>${n}</b>/${d}</span>
    <span class="rto-track"><i style="width:${pct}%"></i></span>
    <span class="rto-pct">${pct}%</span>
  </div></td>`;
}
function rtmoBody(rows) {
  const body = rows.map(r => `<tr>
    <td class="rto-owner" title="${escHtml(r.owner)}">${escHtml(r.owner)}</td>
    <td class="rto-num">${r.rtms}</td>
    <td class="rto-num">${r.controls}</td>
    ${rtmoBarCell(r.implemented, r.controls)}
    ${rtmoBarCell(r.assessed, r.controls)}
  </tr>`).join('');
  const t = _rtmoTotals || { rtms: 0, controls: 0, implemented: 0, assessed: 0 };
  const tpct = (n, d) => d ? Math.round(100 * n / d) + '%' : '—';
  const totalRow = `<tr class="rto-total">
    <td>All owners <span class="rto-total-sub">controls counted once</span></td>
    <td class="rto-num">${t.rtms}</td>
    <td class="rto-num">${t.controls}</td>
    <td class="rto-bar-td"><b>${t.implemented}</b>/${t.controls} · ${tpct(t.implemented, t.controls)}</td>
    <td class="rto-bar-td"><b>${t.assessed}</b>/${t.controls} · ${tpct(t.assessed, t.controls)}</td>
  </tr>`;
  return body + totalRow;
}
function sortRtmOwnerTable(col) {
  if (_rtmoSort.col === col) _rtmoSort.dir *= -1;
  else _rtmoSort = { col, dir: col === 'owner' ? 1 : -1 };
  const tb = document.getElementById('rto-tbody');
  const th = document.getElementById('rto-thead');
  if (tb) tb.innerHTML = rtmoBody(rtmoSortRows());
  if (th) th.innerHTML = rtmoHead();
}
function renderRtmOwnerCard(assessment) {
  const { rows, totals } = buildRtmOwnerRows(assessment.policyRows || [], assessment.riskPolicyFacts || []);
  if (!rows.length) return '';
  _rtmoRows = rows;
  _rtmoTotals = totals;
  _rtmoSort = { col: 'controls', dir: -1 };
  return `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">👥</span>
        <div style="flex:1">
          <h3 class="measure-card-title">RTM Ownership</h3>
          <p class="measure-card-desc">Every risk-treatment measure has an owner in the policy upload. Per owning team: the RTMs they own, the controls operationalising them, and how many of those controls are implemented and assessed. A control backing several teams' RTMs counts under each, so the rows sum to more than the de-duplicated total (see All owners). Click a heading to sort.</p>
        </div>
      </div>
      <div class="rcsa-table-wrap">
        <table class="opcov-table rto-table">
          <thead id="rto-thead">${rtmoHead()}</thead>
          <tbody id="rto-tbody">${rtmoBody(rtmoSortRows())}</tbody>
        </table>
      </div>
    </div>`;
}

// ── The DORA Transition — two hero gauges (old vs new) ────────────
// Left: share of open risks now under DORA. Right: share of implemented
// controls now under DORA. DORA = locPol/grpStd prefix (theme-card rule).
function doraRing(pct) {
  const has = pct != null;
  const p = has ? Math.max(0, Math.min(100, pct)) : 0;
  const r = 52, c = 2 * Math.PI * r, off = c * (1 - p / 100);
  return `<svg class="dora-ring" width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
    <circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--clr-fill-dark)" stroke-width="13"/>
    <circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--accent)" stroke-width="13" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 66 66)"/>
    <text x="66" y="62" text-anchor="middle" font-size="30" font-weight="700" fill="var(--text)">${has ? p + '%' : '—'}</text>
    <text x="66" y="84" text-anchor="middle" font-size="10.5" letter-spacing=".05em" fill="var(--text-muted)">DORA</text>
  </svg>`;
}

function renderDoraTransition(assessment, prev) {
  const t = buildDoraTransition(assessment.riskPolicyFacts || [], prev ? (prev.riskPolicyFacts || []) : null);
  if (!(t.ctrlDora + t.ctrlPre) && !(t.riskDora + t.riskPre)) return '';
  const gauge = (pct, dora, pre, prevPct, title) => `
    <div class="dora-gauge">
      ${doraRing(pct)}
      <div class="dora-gauge-title">${title}${(prevPct != null && pct != null) ? qoqArrow(pct, prevPct, false) : ''}</div>
      <div class="dora-gauge-sub"><b>${dora}</b> DORA · ${pre} pre-DORA</div>
    </div>`;
  return `
    <div class="card measure-card dora-card">
      <div class="measure-card-header">
        <span class="measure-icon">🔄</span>
        <div style="flex:1">
          <h3 class="measure-card-title">pre-DORA to DORA-fit-for-purpose Transition</h3>
          <p class="measure-card-desc">${t.ctrlPct == null ? '—' : t.ctrlPct + '%'} of implemented controls and ${t.riskPct == null ? '—' : t.riskPct + '%'} of open risks are now DORA-aligned, replacing the pre-DORA operational base${prev ? ' — arrows show the shift since last quarter' : ''}.</p>
        </div>
      </div>
      <div class="dora-grid">
        ${gauge(t.riskPct, t.riskDora, t.riskPre, t.prev ? t.prev.riskPct : null, 'Open risks under DORA')}
        ${gauge(t.ctrlPct, t.ctrlDora, t.ctrlPre, t.prev ? t.prev.ctrlPct : null, 'Implemented controls under DORA')}
      </div>
    </div>`;
}

// ── Appendix — Operationalisation Detail (merged single table) ──
// The three themed coverage tables collapsed into one sortable table: one row
// per risk × theme × document, plus "not started" rows for registered
// policies/standards with no controls yet. Sorting is a live-screen aid —
// the print/screenshot captures whatever order is currently applied.
let _mergedRows = [];
let _mergedSort = { col: null, dir: 1 };
let _mergedMeta = {};

const MRT_BAND = { extreme: ['sev-extreme', 'Extreme'], significant: ['sev-significant', 'Significant'], moderate: ['sev-moderate', 'Moderate'], low: ['sev-low', 'Low'] };
const MRT_FIELD = { capability: r => r.capName, theme: r => r.themeName, document: r => r.document || '', risk: r => r.riskTitle || '' };

function mrtHead() {
  const arrow = c => _mergedSort.col === c ? `<span class="mrt-arrow">${_mergedSort.dir === 1 ? '▲' : '▼'}</span>` : '';
  const sTh = (k, label) => `<th class="mrt-sort" onclick="sortMergedTable('${k}')">${label}${arrow(k)}</th>`;
  return `<tr>
    ${sTh('capability', 'Capability')}${sTh('theme', 'Theme')}${sTh('document', 'Document')}${sTh('risk', 'Risk')}
    <th>Residual Risk</th>
    <th>Ctrl Owned<span class="opcov-th-sub">owned / controls</span></th>
    <th>Ctrl Impl<span class="opcov-th-sub">impl / controls</span></th>
    <th>Ctrl Assessed<span class="opcov-th-sub">assessed / controls</span></th>
  </tr>`;
}

// Static header (no sort handlers / arrows) for the standalone print/PDF export.
function mrtHeadPrint() {
  return `<tr>
    <th>Capability</th><th>Theme</th><th>Document</th><th>Risk</th>
    <th>Residual Risk</th>
    <th>Ctrl Owned<span class="opcov-th-sub">owned / controls</span></th>
    <th>Ctrl Impl<span class="opcov-th-sub">impl / controls</span></th>
    <th>Ctrl Assessed<span class="opcov-th-sub">assessed / controls</span></th>
  </tr>`;
}

function mrtBody(rows) {
  const cell = o => o.d > 0 ? `${o.n}/${o.d}` : '<span class="mrt-dash">—</span>';
  const residual = r => {
    if (!r.assessed) return r.open ? 'Open · not assessed' : r.draft ? 'Draft' : '<span class="mrt-dash">—</span>';
    const b = MRT_BAND[r.residualBand];
    return b ? `<span class="sev-chip ${b[0]}">${b[1]}</span>` : `<span class="sev-chip sev-low">${r.residual}</span>`;
  };
  return rows.map(r => {
    return `<tr class="${r.notStarted ? 'mrt-ns' : ''}">
      <td class="mrt-cap">${r.capName}</td>
      <td class="mrt-theme">${r.themeName}</td>
      <td class="mrt-doc">${r.document || '<span class="mrt-dash">—</span>'}</td>
      <td class="mrt-risk">${r.notStarted ? 'not started' : r.riskTitle}</td>
      <td>${residual(r)}</td>
      <td>${cell(r.owned)}</td>
      <td>${cell(r.implemented)}</td>
      <td>${cell(r.ctrlAssessed)}</td>
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
          <p class="measure-card-desc">Every risk × theme in one view: residual rating, and how many of its controls are owned, implemented and assessed. Click <b>Capability</b>, <b>Theme</b>, <b>Document</b> or <b>Risk</b> to sort.</p>
        </div>
      </div>
      <div class="rcsa-table-wrap">
        <table class="opcov-table merged-risk-table">
          <thead id="merged-risk-thead">${mrtHead()}</thead>
          <tbody id="merged-risk-tbody">${mrtBody(_mergedRows)}</tbody>
        </table>
      </div>
      ${nsNote}
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
    ${nsNote}`;
  execPrintWindow('Operationalisation Detail — All Risks', [meta.label, meta.date].filter(Boolean).join(' · '), body);
}

// ── Appendix — Controls by Accountable Owner (sortable) ──────────
// Every control (implemented and not), its accountable owner (from the policy
// statement OWNER) and implementation status. Click a header to sort.
// "Unassigned" = controls with no policy-statement link.
let _cboRows = [];
let _cboSort = { col: 'owner', dir: 1 };

const CBO_FIELD = {
  owner:       r => r.owner,
  capability:  r => r.cap,
  document:    r => r.doc,
  control:     r => r.control,
  implemented: r => (r.impl ? 1 : 0),
};

function buildControlsByOwnerRows(assessment) {
  const facts = (assessment.riskPolicyFacts || [])
    .filter(f => !ftIsClosedControl(f));
  const capName = id => (CONFIG.capabilities.find(c => c.id === id)?.name) || id;
  const ownerOf = f => {
    if ((f.policyOwner || '').trim()) return f.policyOwner.trim();
    const c = {};
    (f.matchedPolicyRows || []).forEach(p => { const o = (p.owner || '').trim(); if (o) c[o] = (c[o] || 0) + 1; });
    let b = '', n = 0; for (const k in c) if (c[k] > n) { n = c[k]; b = k; }
    return b;
  };
  return facts.map(f => ({
    owner: ownerOf(f) || 'Unassigned',
    cap: capName(f.capId),
    doc: ((f.matchedPolicyRows && f.matchedPolicyRows[0] && f.matchedPolicyRows[0].document) || '').trim() || '—',
    control: f.controlName || '(unnamed control)',
    impl: ftIsImplemented(f),
  }));
}

function cboHead() {
  const arrow = c => _cboSort.col === c ? `<span class="mrt-arrow">${_cboSort.dir === 1 ? '▲' : '▼'}</span>` : '';
  const th = (k, label) => `<th class="mrt-sort" onclick="sortControlsByOwner('${k}')">${label}${arrow(k)}</th>`;
  return `<tr>${th('owner', 'Accountable Owner')}${th('capability', 'Capability')}${th('document', 'Document')}${th('control', 'Control')}${th('implemented', 'Implemented')}</tr>`;
}

function cboBody(rows) {
  return rows.map(r => `<tr>
    <td class="cbo-owner">${r.owner}</td>
    <td class="cbo-cap">${r.cap}</td>
    <td class="cbo-doc">${r.doc}</td>
    <td class="cbo-ctrl">${r.control}</td>
    <td class="cbo-impl-cell">${r.impl
      ? '<span class="cbo-impl cbo-impl-yes">Yes</span>'
      : '<span class="cbo-impl cbo-impl-no">No</span>'}</td>
  </tr>`).join('');
}

function sortControlsByOwner(col) {
  if (_cboSort.col === col) _cboSort.dir *= -1;
  else _cboSort = { col, dir: 1 };
  const f = CBO_FIELD[col];
  const dir = _cboSort.dir;
  const sorted = _cboRows.slice().sort((a, b) => {
    const av = f(a), bv = f(b);
    return (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))) * dir
      || a.owner.localeCompare(b.owner) || a.control.localeCompare(b.control);
  });
  const tb = document.getElementById('cbo-tbody');
  const th = document.getElementById('cbo-thead');
  if (tb) tb.innerHTML = cboBody(sorted);
  if (th) th.innerHTML = cboHead();
}

function renderControlsByOwner(assessment) {
  _cboRows = buildControlsByOwnerRows(assessment);
  _cboSort = { col: 'owner', dir: 1 };
  const total = _cboRows.length;
  if (!total) {
    return `
      <div class="card measure-card cbo-card">
        <div class="measure-card-header">
          <span class="measure-icon">🗂️</span>
          <div style="flex:1">
            <h3 class="measure-card-title">Controls by Accountable Owner</h3>
            <p class="measure-card-desc">No controls have been imported yet.</p>
          </div>
        </div>
      </div>`;
  }
  const implemented = _cboRows.filter(r => r.impl).length;
  const pct = Math.round(100 * implemented / total);
  const sorted = _cboRows.slice().sort((a, b) => a.owner.localeCompare(b.owner) || a.cap.localeCompare(b.cap) || a.control.localeCompare(b.control));
  return `
    <div class="card measure-card cbo-card">
      <div class="measure-card-header">
        <span class="measure-icon">🗂️</span>
        <div style="flex:1">
          <h3 class="measure-card-title">Controls by Accountable Owner</h3>
          <p class="measure-card-desc"><b>${implemented}</b> of ${total} controls implemented (<b>${pct}%</b>), with the team accountable for each (from the policy statement owner). <b>Unassigned</b> = controls with no policy-statement link. Click a column header to sort.</p>
        </div>
      </div>
      <div class="rcsa-table-wrap">
        <table class="opcov-table cbo-table">
          <thead id="cbo-thead">${cboHead()}</thead>
          <tbody id="cbo-tbody">${cboBody(sorted)}</tbody>
        </table>
      </div>
    </div>`;
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
  const metricNum = (val, lbl, arrow = '') => `<div class="pvo-metric"><span class="pvo-val">${val}${arrow}</span><span class="pvo-lbl">${lbl}</span></div>`;
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
    const ppd = pf.filter(f => f.controlType === 'operational' && ftIsImplemented(f) && !ftIsClosedControl(f));
    const ppdMapped = ppd.filter(f => (f.matchedPolicyRows || []).length > 0).length;
    pv.locCov  = g(pk.locPolCoverage).total          ? pct(g(pk.locPolCoverage).covered,          g(pk.locPolCoverage).total)          : null;
    pv.grpCov  = g(pk.grpStdCoverage).total          ? pct(g(pk.grpStdCoverage).covered,          g(pk.grpStdCoverage).total)          : null;
    pv.loc     = pk.grpStdLocalisation               ? pct(pk.grpStdLocalisation.localised,       pk.grpStdLocalisation.total)         : null;
    pv.locBack = g(pk.locPolOperationalisation).total ? pct(g(pk.locPolOperationalisation).operationalised, g(pk.locPolOperationalisation).total) : null;
    pv.grpBack = g(pk.grpStdOperationalisation).total ? pct(g(pk.grpStdOperationalisation).operationalised, g(pk.grpStdOperationalisation).total) : null;
    pv.preDora = ppd.length                          ? pct(ppdMapped, ppd.length)                 : null;
    pv.preDoraCount = ppd.length;
    pv.preDoraUnlinked = ppd.length - ppdMapped;
    const ppRows = prev.policyRows || [];
    pv.locCount = ppRows.filter(r => isLocPolType(r.type)).length;
    pv.grpCount = ppRows.filter(r => isGrpStdType(r.type)).length;
  }

  // Policy layer
  const locCov    = ks.locPolCoverage || { covered: 0, total: 0 };
  const grpCov    = ks.grpStdCoverage || { covered: 0, total: 0 };
  const locCovPct = pct(locCov.covered, locCov.total);
  const grpCovPct = pct(grpCov.covered, grpCov.total);
  const locPct    = ks.grpStdLocalisation ? pct(ks.grpStdLocalisation.localised, ks.grpStdLocalisation.total) : 0;
  // Pre-DORA controls = implemented operational-type controls (narrow disruption
  // scope, no policy/standard prefix), excluding closed controls. The headline is
  // the gap — how many are NOT yet linked to a policy or standard; reducing it is
  // progress. Computed here so the governance column can show the count.
  const facts   = a.riskPolicyFacts || [];
  const preDora = facts.filter(f => f.controlType === 'operational' && ftIsImplemented(f) && !ftIsClosedControl(f));
  const preDoraMapped = preDora.filter(f => (f.matchedPolicyRows || []).length > 0).length;
  const preDoraUnlinked = preDora.length - preDoraMapped;   // the gap: legacy controls with no policy/standard home
  const preDoraPct    = pct(preDoraMapped, preDora.length);
  const policyCol = `
    <div class="pvo-col pvo-policy">
      <div class="pvo-col-hdr"><span class="pvo-col-ico">📜</span><span class="pvo-col-name">ICT Governance / Risk &amp; Control Framework</span></div>
      ${metricNum(locCount || '—', 'Policy statements we\'ve formally written and catalogued', qoqArrow(locCount, pv.locCount, false))}
      ${metricPct(locCovPct, `of our policy statements are tracked as risks (${locCov.covered}/${locCov.total})`, compl(locCovPct) ? `${compl(locCovPct)}% are blind spots we don't yet monitor` : '', qoqArrow(locCovPct, pv.locCov, false))}
      ${metricNum(grpCount || '—', 'Group standards we\'re required to meet, catalogued', qoqArrow(grpCount, pv.grpCount, false))}
      ${metricPct(grpCovPct, `of our group standard requirements are tracked as risks (${grpCov.covered}/${grpCov.total})`, compl(grpCovPct) ? `${compl(grpCovPct)}% remain unmonitored` : '', qoqArrow(grpCovPct, pv.grpCov, false))}
      ${metricNum(preDora.length === 0 ? '—' : preDoraUnlinked, 'Implemented pre-DORA controls (older disruption-risk scope) not linked to a policy or standard', qoqArrow(preDoraUnlinked, pv.preDoraUnlinked, true))}
    </div>`;

  // Operational layer — controls behind the policies & standards
  const locOp = ks.locPolOperationalisation || { total: 0, operationalised: 0 };
  const grpOp = ks.grpStdOperationalisation || { total: 0, operationalised: 0 };
  const locBackedPct = pct(locOp.operationalised, locOp.total);
  const grpBackedPct = pct(grpOp.operationalised, grpOp.total);
  const underCount   = rp ? rp.underAssuredCount : 0;
  const ru = oc.rollup || { ok: 0, building: 0, low: 0, none: 0 };
  const opsCol = `
    <div class="pvo-col pvo-ops">
      <div class="pvo-col-hdr"><span class="pvo-col-ico">⚙️</span><span class="pvo-col-name">Operational Compliance</span></div>
      ${metricPct(locBackedPct, `of our policy statements are linked to an implemented control (${locOp.operationalised}/${locOp.total})`, compl(locBackedPct) ? `${compl(locBackedPct)}% we can't prove we comply with` : '', qoqArrow(locBackedPct, pv.locBack, false))}
      ${metricPct(grpBackedPct, `of our group standards are linked to an implemented control (${grpOp.operationalised}/${grpOp.total})`, compl(grpBackedPct) ? `${compl(grpBackedPct)}% we can't prove we comply with` : '', qoqArrow(grpBackedPct, pv.grpBack, false))}
      ${metricPct(preDoraPct, `of implemented pre-DORA controls are tied to a policy or standard (${preDoraMapped}/${preDora.length})`, compl(preDoraPct) ? `${compl(preDoraPct)}% have no stated reason we run them` : '', qoqArrow(preDoraPct, pv.preDora, false))}
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
