// ══════════════════════════════════════════════════════════════════
// Policy & Group Standards Attestation (RICA) report.
// Every policy & group-standard statement, grouped by capability, with the
// control(s) that implement it and each control's effectiveness — laid out
// like the DORA Reporting live view: collapsible capability sections, gap
// filters, and a details box that opens beneath the row you select. Reads
// buildStatementCoverage, so the figures reconcile with the DORA Reporting
// Control 2/3 evidence.
// ══════════════════════════════════════════════════════════════════

// View state: the assessment, the active filter, the selected item and which
// capability sections are open (unset = the filter's default).
const _pgsa = { a: null, mode: 'all', sel: null, open: {}, focus: null };
const PGSA_MODES = [
  ['all',    'Everything'],
  ['unimpl', 'Not implemented'],
  ['uneff',  'Not effective'],
];
// 0 effective · 1 live, not yet effective · 2 draft · 3 gap (same scale as the live view).
const PGSA_ST = [
  { key: 'ok',    label: 'Effective' },
  { key: 'warn',  label: 'Live, not yet effective' },
  { key: 'draft', label: 'Draft' },
  { key: 'gap',   label: 'No control' },
];

function pgsaSrcChip(src) {
  const gs = /group/i.test(src || '');
  return `<span class="pgsa-src ${gs ? 'pgsa-src-gs' : 'pgsa-src-lp'}">${escHtml(src || '—')}</span>`;
}

// One entry per distinct control behind a statement (a control is listed once
// per risk it treats), with the risks it treats.
function pgsaControls(s) {
  const by = new Map();
  (s.controls || []).forEach(c => {
    const k = (c.number || '') + '|' + c.name;
    let d = by.get(k);
    if (!d) { d = { name: c.name, number: c.number, implemented: false, effective: false, risks: new Set() }; by.set(k, d); }
    if (c.status === 'implemented') d.implemented = true;
    if (c.effective) d.effective = true;
    if (c.risk) d.risks.add(c.risk);
  });
  return [...by.values()].map(d => Object.assign(d, { level: !d.implemented ? 2 : d.effective ? 0 : 1, risks: [...d.risks] }));
}

// Statement rows for the report, grouped by capability in config order.
function pgsaModel(currentA) {
  const cov  = buildStatementCoverage(currentA.policyRows || [], currentA.riskPolicyFacts || []);
  const caps = CONFIG.capabilities || [];
  const capNm = id => (caps.find(c => c.id === id) || {}).name || id;
  const byCap = {};
  cov.statements.forEach(s => {
    const ctrls = pgsaControls(s);
    const level = ctrls.length ? Math.max(...ctrls.map(c => c.level)) : 3;
    (byCap[s.capId] = byCap[s.capId] || []).push(Object.assign({}, s, { ctrls, level }));
  });
  const order = caps.map(c => c.id).filter(id => byCap[id]);
  Object.keys(byCap).forEach(id => { if (!order.includes(id)) order.push(id); });
  return order.map(id => ({
    id, name: capNm(id),
    // Document first, then statement ref, so a document's statements sit together.
    stmts: byCap[id].slice().sort((x, y) => String(x.document).localeCompare(String(y.document)) || String(x.ref).localeCompare(String(y.ref))),
  }));
}

function renderPgsaReport(currentA) {
  _pgsa.a = currentA;
  const app = (CONFIG && CONFIG.appTitle) || 'Measurable IT Regulatory Oversight Model';
  return `<div class="bd-summary pgsa">
    <div class="bd-top">
      <div>
        <div class="exsc-eyebrow">◈ ${escHtml(app)}</div>
        <h2 class="exsc-title bd-doc-title">Policy and Group Standards Attestation (RICA)</h2>
        <div class="bd-sub">${escHtml(currentA.label)} · ${formatDate(currentA.date)} · each statement attested by the controls that implement it</div>
      </div>
      <div class="bd-actions no-print">
        <button type="button" class="bd-btn" onclick="window.print()">Print / save PDF</button>
      </div>
    </div>
    <div id="pgsa-body">${pgsaBody()}</div>
  </div>`;
}

function pgsaRefresh() {
  const body = document.getElementById('pgsa-body');
  if (!body || !_pgsa.a) return;
  body.innerHTML = pgsaBody();
  const keep = _pgsa.focus && body.querySelector(`[data-key="${_pgsa.focus}"]`);
  if (keep) keep.focus({ preventScroll: true });
  _pgsa.focus = null;
}
function pgsaSetMode(mode) { _pgsa.mode = mode; _pgsa.sel = null; _pgsa.open = {}; pgsaRefresh(); }
function pgsaSelect(key) { _pgsa.sel = _pgsa.sel === key ? null : key; _pgsa.focus = key; pgsaRefresh(); }
function pgsaToggleCap(i) {
  const open = _pgsa.open[i] !== undefined ? _pgsa.open[i] : _pgsa.mode !== 'all';
  _pgsa.open[i] = !open;
  _pgsa.focus = 'cap' + i;
  pgsaRefresh();
}

function pgsaBody() {
  const caps = pgsaModel(_pgsa.a);
  const all = caps.flatMap(c => c.stmts);
  const total = all.length;
  // Implemented = linked to a control or carrying a disclosed exception (Control 2).
  const implemented = all.filter(s => s.ctrls.length || s.exception).length;
  const effective = all.filter(s => s.level === 0).length;
  const notImpl = s => !s.ctrls.length && !s.exception;
  const notEff = c => c.level > 0;
  const counts = { unimpl: all.filter(notImpl).length, uneff: all.reduce((n, s) => n + s.ctrls.filter(notEff).length, 0) };
  const pct = (n, d) => d ? Math.round(100 * n / d) + '%' : '—';

  if (!total) return '<section class="bd-sec"><p class="bd-pillar-empty">No policy or group-standard statements imported yet.</p></section>';

  const headline = effective === total
    ? `All ${total} statements are backed by effective controls.`
    : `${implemented} of ${total} statements are implemented — but only ${effective} are backed by controls proven to work.`;

  const mode = _pgsa.mode, sel = _pgsa.sel;
  const on = k => k === sel ? ' is-sel' : '';
  const pick = k => `data-key="${k}" onclick="pgsaSelect('${k}')" aria-pressed="${k === sel}"`;
  const chip = lvl => `<span class="bd-chip bd-tone-${PGSA_ST[lvl].key}">${PGSA_ST[lvl].label}</span>`;
  const chev = '<svg class="bd-art-chev" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const detailBox = (kind, code, title, lvl, labelOverride, says, rows) => `<div class="bd-detail pgsa-detail" role="region" aria-label="Details">
      <div class="bd-detail-main">
        <span class="bd-detail-kind">${kind}${code ? ` · <span class="bd-detail-code">${escHtml(code)}</span>` : ''}</span>
        <h4 class="bd-detail-title">${escHtml(title)}</h4>
        <span class="bd-chip bd-tone-${PGSA_ST[lvl].key}">${labelOverride || PGSA_ST[lvl].label}</span>
        <p class="bd-detail-says">${escHtml(says)}</p>
      </div>
      <dl>${rows.filter(r => r[1]).map(([k, v]) => `<div><dt>${escHtml(k)}</dt><dd>${escHtml(v)}</dd></div>`).join('')}</dl>
      <button type="button" class="bd-detail-close" onclick="pgsaSelect('${sel}')" aria-label="Close details">×</button>
    </div>`;

  const sections = caps.map((cap, ci) => {
    // What the filter keeps of each statement: its controls, or null to drop it.
    const kept = cap.stmts.map((s, si) => {
      if (mode === 'unimpl') return notImpl(s) ? { s, si, ctrls: [] } : null;
      if (mode === 'uneff') { const c = s.ctrls.filter(notEff); return c.length ? { s, si, ctrls: c } : null; }
      return { s, si, ctrls: s.ctrls };
    }).filter(Boolean);
    if (!kept.length) return '';
    const open = _pgsa.open[ci] !== undefined ? _pgsa.open[ci] : mode !== 'all';
    const n = cap.stmts.length;
    const withCtrl = cap.stmts.filter(s => s.ctrls.length).length;
    const needs = cap.stmts.filter(s => s.level > 0).length;
    const worst = Math.max(...cap.stmts.map(s => (s.exception && !s.ctrls.length) ? 0 : s.level));
    const meta = mode === 'all'
      ? `${withCtrl}/${n} statement${n === 1 ? '' : 's'} implemented by a control${needs ? ` · ${needs} need${needs === 1 ? 's' : ''} attention` : ''}`
      : `${kept.length} matching statement${kept.length === 1 ? '' : 's'}`;

    let lastDoc = null;
    const rows = !open ? '' : kept.map(({ s, si, ctrls }) => {
      const sKey = `c${ci}-s${si}`;
      let detail = '';
      const gapNote = s.exception ? `No control — exception disclosed (${s.exception}).` : 'No control puts this statement into practice yet.';
      if (sel === sKey) detail = detailBox('Policy statement', s.ref, s.header || s.ref, s.ctrls.length ? s.level : 3, s.ctrls.length ? '' : (s.exception ? 'Exception disclosed' : ''),
        s.ctrls.length ? `Implemented by ${s.ctrls.length} control${s.ctrls.length > 1 ? 's' : ''}${s.level === 0 ? ', all live and rated effective.' : '; not all are yet proven to work.'}` : gapNote,
        [['Document', s.document], ['Source', s.source], ['Statement owner', s.owner], ['Exception', s.exception || 'None'], ['Capability', cap.name]]);
      const ctrlHtml = s.ctrls.length
        ? ctrls.map(c => {
          const ki = s.ctrls.indexOf(c);
          const kKey = `${sKey}-k${ki}`;
          const p = bdCtrlParts(c.number && !/^[A-Z][A-Z0-9]*-\d+/.test(c.name) ? `${c.number} — ${c.name}` : c.name);
          if (sel === kKey) detail = detailBox('Control', p.num || c.number, p.name, c.level, '',
            c.level === 0 ? 'Live and rated effective in the latest RCSA.' : c.level === 1 ? 'Live, but the latest RCSA has not rated it effective.' : 'Designed but not yet live.',
            [['Implements statement', `${s.ref} — ${s.header || ''}`], ['Document', s.document], ['Treats risk' + (c.risks.length > 1 ? 's' : ''), c.risks.join(', ')]]);
          return `<button type="button" class="bd-ctrl pgsa-ctrl bd-ctrl-${PGSA_ST[c.level].key}${on(kKey)}" ${pick(kKey)}><span class="bd-ctrl-top"><span class="bd-code">${escHtml(p.num || c.number || '')}</span>${chip(c.level)}</span><span class="bd-ctrl-name">${escHtml(p.name)}</span></button>`;
        }).join('')
        : `<button type="button" class="bd-gap${s.exception ? ' bd-gap-exc' : ''}${on(sKey)}" ${pick(sKey)}><b>${s.exception ? 'Exception disclosed' : 'No control'}</b><span>${escHtml(gapNote)}</span></button>`;
      const newDoc = s.document !== lastDoc;
      lastDoc = s.document;
      return `<div class="pgsa-row${newDoc ? ' pgsa-newdoc' : ''}${detail ? ' has-detail' : ''}">
        <span class="pgsa-doc">${newDoc ? escHtml(s.document || '—') : `<span class="sr-only">${escHtml(s.document || '')}</span>`}</span>
        <button type="button" class="bd-stmt pgsa-stmt${on(sKey)}" ${pick(sKey)}><span class="bd-code">${escHtml(s.ref || '—')}</span><span class="bd-stmt-head">${escHtml(s.header || '')}</span>${s.owner ? `<span class="bd-stmt-doc">Owner: ${escHtml(s.owner)}</span>` : ''}</button>
        <span class="pgsa-srccell">${pgsaSrcChip(s.source)}</span>
        <div class="pgsa-ctrls bd-ctrls">${ctrlHtml}</div>
      </div>${detail}`;
    }).join('');

    return `<section class="bd-art pgsa-card${open ? ' is-open' : ''}">
      <button type="button" class="bd-art-hd" data-key="cap${ci}" aria-expanded="${open}" onclick="pgsaToggleCap(${ci})">
        <i class="bd-dot bd-dot-${PGSA_ST[worst].key}" aria-hidden="true"></i>
        <span class="bd-art-title">${escHtml(cap.name)}</span>
        <span class="bd-art-meta">${meta}</span>${chev}
      </button>
      ${open ? `<div class="bd-art-body"><div class="pgsa-head"><span>Document</span><span>Policy / Group Standard statement</span><span>Source</span><span>Control(s) &amp; effectiveness</span></div>${rows}</div>` : ''}
    </section>`;
  }).join('');

  const EMPTY = {
    unimpl: 'Every statement is implemented by a control or carries a disclosed exception.',
    uneff: 'Every control behind these statements is live and rated effective.',
  };
  return `
    <section class="bd-hero pgsa-hero" aria-labelledby="pgsa-headline">
      <h1 class="bd-headline pgsa-headline" id="pgsa-headline">${escHtml(headline)}</h1>
    </section>
    <div class="bd-minis pgsa-minis">
      <div class="bd-mini"><span class="exsum-lbl">Statements</span><b>${total}</b><span class="exsum-frac">policy &amp; group standard</span></div>
      <div class="bd-mini"><span class="exsum-lbl">Implemented</span><b>${pct(implemented, total)}</b><span class="exsum-frac">${implemented} of ${total} with a control or exception</span></div>
      <div class="bd-mini"><span class="exsum-lbl">Effective</span><b>${pct(effective, total)}</b><span class="exsum-frac">${effective} of ${total} backed by effective controls</span></div>
    </div>
    <div class="bd-lens-bar">
      <div class="bd-seg" role="group" aria-label="Show">
        ${PGSA_MODES.map(([v, l]) => `<button type="button" aria-pressed="${v === mode}" onclick="pgsaSetMode('${v}')">${l}${v === 'all' ? '' : ` <span class="bd-seg-n">${counts[v]}</span>`}</button>`).join('')}
      </div>
      <div class="bd-legend">
        <span><i class="bd-dot bd-dot-ok" aria-hidden="true"></i>Effective</span>
        <span><i class="bd-dot bd-dot-warn" aria-hidden="true"></i>Live, not yet effective</span>
        <span><i class="bd-dot bd-dot-draft" aria-hidden="true"></i>Draft</span>
        <span><i class="bd-dot bd-dot-gap" aria-hidden="true"></i>No control</span>
      </div>
    </div>
    <div class="bd-trace pgsa-trace">${sections || `<div class="bd-empty">${EMPTY[mode]}</div>`}</div>`;
}

function generatePgsaReport() {
  const currentA = db.assessments.find(a => a.id === document.getElementById('exec-curr-sel').value);
  if (!currentA) return;
  closeExecReportModal();
  if (typeof setImportLens === 'function') setImportLens('dora');
  if (typeof updateSiteSubtitle === 'function') updateSiteSubtitle();
  _pgsa.mode = 'all'; _pgsa.sel = null; _pgsa.open = {};
  const runWithLens = (typeof withLens === 'function') ? withLens : (k, fn) => fn();
  const content = document.getElementById('pgsa-report-content');
  content.classList.add('board');
  content.innerHTML = runWithLens('dora', () => renderPgsaReport(currentA));
  showView('pgsa-report');
}

if (typeof window !== 'undefined') {
  window.generatePgsaReport = generatePgsaReport;
  window.renderPgsaReport = renderPgsaReport;
}
