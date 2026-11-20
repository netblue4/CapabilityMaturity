// ══════════════════════════════════════════════════════════════════
// Control Coverage report — the control-focused view (control → statements →
// DORA objectives). Shows the "compliance weight" each control carries: how
// many policy / group-standard statements it implements and how many DORA
// objectives those statements cover. One collapsible card per capability
// (same look & feel as the DORA Reporting pillar cards and the RICA report).
// Reads buildTraceabilityRows, so it reconciles with the other three views.
// ══════════════════════════════════════════════════════════════════

function ccovEffChip(status, effectiveness) {
  if (status !== 'Implemented') return '<span class="bd-chip bd-tone-muted">Draft</span>';
  return effectiveness === 'Effective'
    ? '<span class="bd-chip bd-tone-ok">Effective</span>'
    : '<span class="bd-chip bd-tone-warn">Not effective</span>';
}

function renderCtrlCoverageReport(currentA) {
  const trace = buildTraceabilityRows(currentA).rows;
  const caps = CONFIG.capabilities || [];
  const capName = id => (caps.find(c => c.id === id) || {}).name || id;

  // Aggregate the trace rows by control: the distinct statements it implements
  // and the distinct DORA objectives those statements cover.
  const byCtrl = new Map();
  trace.forEach(r => {
    if (!r._cKey || !r.control) return;              // control rows only
    let c = byCtrl.get(r._cKey);
    if (!c) { c = { key: r._cKey, name: r.control, capability: r.capability, status: r.controlStatus, eff: r.effectiveness, stmts: new Map(), objs: new Map() }; byCtrl.set(r._cKey, c); }
    if (r._sKey && r.statementRef) c.stmts.set(r._sKey, { ref: r.statementRef, header: r.statementHeader, source: r.source });
    if (r._oKey && (r.objectiveId || r.objective)) c.objs.set(r._oKey, { id: r.objectiveId || '', article: r.article || '', requirement: r.objective || '' });
  });

  // Group controls by capability; heaviest (most statements + objectives) first.
  const byCap = new Map();
  byCtrl.forEach(c => { const g = byCap.get(c.capability) || []; g.push(c); byCap.set(c.capability, g); });
  byCap.forEach(list => list.sort((a, b) => (b.stmts.size + b.objs.size) - (a.stmts.size + a.objs.size) || String(a.name).localeCompare(String(b.name))));

  // Card order: config capability name order, then any capability not in config.
  const order = caps.map(c => c.name).filter(n => byCap.has(n));
  [...byCap.keys()].forEach(n => { if (!order.includes(n)) order.push(n); });

  const esc = s => escHtml(String(s == null ? '' : s));
  const refList = (items, cls) => items.length
    ? `<span class="ccov-refs">${items.map(x => `<span class="${cls}" title="${esc(x.title)}">${esc(x.label)}</span>`).join('')}</span>`
    : '<span class="ccov-none">—</span>';

  const ctrlRow = c => {
    const stmts = [...c.stmts.values()].sort((a, b) => String(a.ref).localeCompare(String(b.ref)))
      .map(s => ({ label: s.ref, title: (s.ref + ' — ' + s.header + (s.source ? ' (' + s.source + ')' : '')) }));
    const objs = [...c.objs.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map(o => ({ label: o.id || o.article, title: ((o.id ? o.id + ' — ' : '') + (o.requirement || o.article)) }));
    return `<div class="ccov-row">
      <span class="ccov-ctrl"><span class="ccov-ctrl-name">${esc(c.name)}</span>${ccovEffChip(c.status, c.eff)}</span>
      <span class="ccov-cell"><b class="ccov-n">${c.stmts.size}</b> statement${c.stmts.size === 1 ? '' : 's'}${refList(stmts, 'ccov-ref')}</span>
      <span class="ccov-cell"><b class="ccov-n">${c.objs.size}</b> objective${c.objs.size === 1 ? '' : 's'}${refList(objs, 'ccov-obj')}</span>
    </div>`;
  };

  const cards = order.map(nm => {
    const list = byCap.get(nm);
    const sTot = new Set(), oTot = new Set();
    list.forEach(c => { c.stmts.forEach((_, k) => sTot.add(k)); c.objs.forEach((_, k) => oTot.add(k)); });
    return `<details class="bd-sec bd-pillar ccov-card">
      <summary class="bd-sec-hd ccov-summary"><h2>${esc(nm)}</h2><span>${list.length} control${list.length === 1 ? '' : 's'} · ${sTot.size} statement${sTot.size === 1 ? '' : 's'} · ${oTot.size} DORA objective${oTot.size === 1 ? '' : 's'}</span></summary>
      <div class="bd-table-wrap"><div class="ccov-table">
        <div class="ccov-head"><span>Control</span><span>Implements (policy / GS statements)</span><span>Covers (DORA objectives)</span></div>
        ${list.map(ctrlRow).join('')}
      </div></div>
    </details>`;
  }).join('');

  const app = (CONFIG && CONFIG.appTitle) || 'Measurable IT Regulatory Oversight Model';
  return `<div class="bd-summary">
    <div class="bd-top">
      <div>
        <div class="exsc-eyebrow">◈ ${esc(app)}</div>
        <h2 class="exsc-title bd-doc-title">Control Coverage</h2>
        <div class="bd-sub">${esc(currentA.label)} · ${formatDate(currentA.date)} · the compliance weight each control carries — how many statements and DORA objectives it covers (open a capability)</div>
      </div>
      <div class="bd-actions no-print">
        <button type="button" class="bd-btn" onclick="window.print()">Print / save PDF</button>
      </div>
    </div>
    ${cards || '<section class="bd-sec"><p class="bd-pillar-empty">No controls mapped to policy / group-standard statements yet.</p></section>'}
  </div>`;
}

function generateCtrlCoverageReport() {
  const currentA = db.assessments.find(a => a.id === document.getElementById('exec-curr-sel').value);
  if (!currentA) return;
  closeExecReportModal();
  if (typeof setImportLens === 'function') setImportLens('dora');
  if (typeof updateSiteSubtitle === 'function') updateSiteSubtitle();
  const runWithLens = (typeof withLens === 'function') ? withLens : (k, fn) => fn();
  const content = document.getElementById('ctrlcov-report-content');
  content.classList.add('board');
  content.innerHTML = runWithLens('dora', () => renderCtrlCoverageReport(currentA));
  showView('ctrlcov-report');
}

if (typeof window !== 'undefined') {
  window.generateCtrlCoverageReport = generateCtrlCoverageReport;
  window.renderCtrlCoverageReport = renderCtrlCoverageReport;
}
