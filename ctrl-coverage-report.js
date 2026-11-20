// ══════════════════════════════════════════════════════════════════
// Control Coverage report — the control-focused view (control → statements →
// DORA objectives), laid out like the DORA Reporting live view. Each control
// sits on one row beside the policy / group-standard statements it implements
// and the DORA objectives those statements cover, all written out, so a
// reviewer can see at a glance whether the mapping makes sense. Sense-check
// flags mark controls tied to no DORA objective, and unproven controls that
// carry several objectives. Selecting any item opens a details box beneath
// its row, including everything else that covers the same statement or
// objective. Reads buildTraceabilityRows, so it reconciles with the other views.
// ══════════════════════════════════════════════════════════════════

// View state: the assessment, the active filter, the selected item and which
// capability sections are open (unset = the filter's default).
const _ccov = { a: null, mode: 'all', sel: null, open: {}, focus: null };
const CCOV_MODES = [
  ['all',   'Everything'],
  ['uneff', 'Not effective'],
  ['noobj', 'No DORA objective'],
];
// 0 effective · 1 live, not yet effective · 2 draft (same scale as the live view).
const CCOV_ST = [
  { key: 'ok',    label: 'Effective' },
  { key: 'warn',  label: 'Live, not yet effective' },
  { key: 'draft', label: 'Draft' },
];

// Controls with the statements and objectives they reach, grouped by capability,
// plus reverse indexes (statement / objective → controls) for the details box.
function ccovModel(currentA) {
  const trace = buildTraceabilityRows(currentA).rows;
  const caps = CONFIG.capabilities || [];
  const byCtrl = new Map(), stmtCtrls = new Map(), objCtrls = new Map();
  trace.forEach(r => {
    if (!r._cKey || !r.control) return;              // control rows only
    let c = byCtrl.get(r._cKey);
    if (!c) {
      const p = bdCtrlParts(r.control);
      c = { key: r._cKey, num: p.num, label: p.name, capability: r.capability,
        desc: r.controlDescription || '', owner: r.controlOwner || '', provenance: r.provenance || '',
        level: r.controlStatus !== 'Implemented' ? 2 : r.effectiveness === 'Effective' ? 0 : 1,
        stmts: new Map(), objs: new Map() };
      byCtrl.set(r._cKey, c);
    }
    if (r._sKey && r.statementRef) {
      c.stmts.set(r._sKey, { key: r._sKey, ref: r.statementRef, header: r.statementHeader, detail: r.statementDetail,
        document: r.document, source: r.source, owner: r.statementOwner });
      (stmtCtrls.get(r._sKey) || stmtCtrls.set(r._sKey, new Set()).get(r._sKey)).add(r._cKey);
    }
    if (r._oKey && (r.objectiveId || r.objective)) {
      c.objs.set(r._oKey, { key: r._oKey, id: r.objectiveId || '', article: r.article || '', requirement: r.objective || '' });
      (objCtrls.get(r._oKey) || objCtrls.set(r._oKey, new Set()).get(r._oKey)).add(r._cKey);
    }
  });
  const ctrls = [...byCtrl.values()].map(c => Object.assign(c, {
    stmtList: [...c.stmts.values()].sort((x, y) => String(x.ref).localeCompare(String(y.ref))),
    objList: [...c.objs.values()].sort((x, y) => String(x.id).localeCompare(String(y.id))),
  }));
  // Sense-check flags.
  ctrls.forEach(c => {
    c.flags = [];
    if (!c.objs.size) c.flags.push({ tone: 'gap', text: 'No DORA objective' });
    if (c.level > 0 && c.objs.size >= 2) c.flags.push({ tone: 'warn', text: `Carries ${c.objs.size} objectives, not yet proven` });
  });
  const byCap = new Map();
  ctrls.forEach(c => { (byCap.get(c.capability) || byCap.set(c.capability, []).get(c.capability)).push(c); });
  // Heaviest (most objectives, then statements) first within a capability.
  byCap.forEach(list => list.sort((a, b) => b.objs.size - a.objs.size || b.stmts.size - a.stmts.size || String(a.num || a.label).localeCompare(String(b.num || b.label))));
  const order = caps.map(c => c.name).filter(n => byCap.has(n));
  [...byCap.keys()].forEach(n => { if (!order.includes(n)) order.push(n); });
  return { ctrls, byCtrl, stmtCtrls, objCtrls, caps: order.map(name => ({ name, ctrls: byCap.get(name) })) };
}

function renderCtrlCoverageReport(currentA) {
  _ccov.a = currentA;
  const app = (CONFIG && CONFIG.appTitle) || 'Measurable IT Regulatory Oversight Model';
  return `<div class="bd-summary ccov">
    <div class="bd-top">
      <div>
        <div class="exsc-eyebrow">◈ ${escHtml(app)}</div>
        <h2 class="exsc-title bd-doc-title">Control Coverage</h2>
        <div class="bd-sub">${escHtml(currentA.label)} · ${formatDate(currentA.date)} · each control beside the statements it implements and the DORA objectives they cover</div>
      </div>
      <div class="bd-actions no-print">
        <button type="button" class="bd-btn" onclick="window.print()">Print / save PDF</button>
      </div>
    </div>
    <div id="ccov-body">${ccovBody()}</div>
  </div>`;
}

function ccovRefresh() {
  const body = document.getElementById('ccov-body');
  if (!body || !_ccov.a) return;
  body.innerHTML = ccovBody();
  const keep = _ccov.focus && body.querySelector(`[data-key="${_ccov.focus}"]`);
  if (keep) keep.focus({ preventScroll: true });
  _ccov.focus = null;
}
function ccovSetMode(mode) { _ccov.mode = mode; _ccov.sel = null; _ccov.open = {}; ccovRefresh(); }
function ccovSelect(key) { _ccov.sel = _ccov.sel === key ? null : key; _ccov.focus = key; ccovRefresh(); }
function ccovToggleCap(i) {
  const open = _ccov.open[i] !== undefined ? _ccov.open[i] : _ccov.mode !== 'all';
  _ccov.open[i] = !open;
  _ccov.focus = 'cap' + i;
  ccovRefresh();
}

function ccovBody() {
  const M = ccovModel(_ccov.a);
  if (!M.ctrls.length) return '<section class="bd-sec"><p class="bd-pillar-empty">No controls mapped to policy / group-standard statements yet.</p></section>';

  const total = M.ctrls.length;
  const effective = M.ctrls.filter(c => c.level === 0).length;
  const stmtN = M.stmtCtrls.size, objN = M.objCtrls.size;
  // An objective "rests on unproven controls" when none of its controls is effective.
  const unprovenObjs = [...M.objCtrls.values()].filter(set => [...set].every(k => M.byCtrl.get(k).level > 0)).length;
  const counts = { uneff: M.ctrls.filter(c => c.level > 0).length, noobj: M.ctrls.filter(c => !c.objs.size).length };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const headline = `${plural(total, 'control')} implement ${plural(stmtN, 'statement')} and cover ${plural(objN, 'DORA objective')}.`
    + (unprovenObjs ? ` ${unprovenObjs === 1 ? 'One objective rests' : `${unprovenObjs} objectives rest`} only on controls not yet proven to work.` : '');

  const mode = _ccov.mode, sel = _ccov.sel;
  const on = k => k === sel ? ' is-sel' : '';
  const pick = k => `data-key="${k}" onclick="ccovSelect('${k}')" aria-pressed="${k === sel}"`;
  const chip = lvl => `<span class="bd-chip bd-tone-${CCOV_ST[lvl].key}">${CCOV_ST[lvl].label}</span>`;
  const chev = '<svg class="bd-art-chev" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ctrlLine = k => { const c = M.byCtrl.get(k); return `${c.num ? c.num + ' — ' : ''}${c.label} (${CCOV_ST[c.level].label.toLowerCase()})`; };
  const detailBox = (kind, code, title, lvl, says, rows) => `<div class="bd-detail ccov-detail" role="region" aria-label="Details">
      <div class="bd-detail-main">
        <span class="bd-detail-kind">${kind}${code ? ` · <span class="bd-detail-code">${escHtml(code)}</span>` : ''}</span>
        <h4 class="bd-detail-title">${escHtml(title)}</h4>
        ${lvl != null ? `<span class="bd-chip bd-tone-${CCOV_ST[lvl].key}">${CCOV_ST[lvl].label}</span>` : ''}
        ${says ? `<p class="bd-detail-says">${escHtml(says)}</p>` : ''}
      </div>
      <dl>${rows.filter(r => r[1]).map(([k, v]) => `<div><dt>${escHtml(k)}</dt><dd>${Array.isArray(v) ? `<ul class="ccov-dl-list">${v.map(x => `<li>${escHtml(x)}</li>`).join('')}</ul>` : escHtml(v)}</dd></div>`).join('')}</dl>
      <button type="button" class="bd-detail-close" onclick="ccovSelect('${sel}')" aria-label="Close details">×</button>
    </div>`;

  const sections = M.caps.map((cap, ci) => {
    const kept = cap.ctrls.map((c, ki) => ({ c, ki })).filter(({ c }) =>
      mode === 'uneff' ? c.level > 0 : mode === 'noobj' ? !c.objs.size : true);
    if (!kept.length) return '';
    const open = _ccov.open[ci] !== undefined ? _ccov.open[ci] : mode !== 'all';
    const sTot = new Set(), oTot = new Set();
    cap.ctrls.forEach(c => { c.stmts.forEach((_, k) => sTot.add(k)); c.objs.forEach((_, k) => oTot.add(k)); });
    const flagged = cap.ctrls.filter(c => c.level > 0 || c.flags.length).length;
    const worst = Math.max(...cap.ctrls.map(c => c.level));
    const meta = mode === 'all'
      ? `${plural(cap.ctrls.length, 'control')} · ${plural(sTot.size, 'statement')} · ${plural(oTot.size, 'DORA objective')}${flagged ? ` · ${flagged} need${flagged === 1 ? 's' : ''} attention` : ''}`
      : `${plural(kept.length, 'matching control')}`;

    const rows = !open ? '' : kept.map(({ c, ki }) => {
      const kKey = `c${ci}-k${ki}`;
      let detail = '';
      if (sel === kKey) detail = detailBox('Control', c.num, c.label, c.level,
        c.desc || (c.level === 0 ? 'Live and rated effective in the latest RCSA.' : c.level === 1 ? 'Live, but the latest RCSA has not rated it effective.' : 'Designed but not yet live.'),
        [['Control owner', c.owner], ['Origin', c.provenance],
          ['Implements', c.stmtList.map(s => `${s.ref} — ${s.header || ''}`)],
          ['Covers', c.objList.length ? c.objList.map(o => `${o.id} — ${o.requirement || o.article}`) : 'No DORA objective — its statements are not mapped to one'],
          ['Sense check', c.flags.map(f => f.text).join(' · ')]]);
      const stmts = c.stmtList.map((s, j) => {
        const key = `${kKey}-s${j}`;
        if (sel === key) {
          const others = [...(M.stmtCtrls.get(s.key) || [])];
          detail = detailBox('Policy statement', s.ref, s.header || s.ref, null, s.detail || '',
            [['Document', s.document], ['Source', s.source], ['Statement owner', s.owner],
              [others.length > 1 ? `Implemented by ${others.length} controls` : 'Implemented by', others.map(ctrlLine)]]);
        }
        return `<button type="button" class="ccov-item ccov-ref${on(key)}" ${pick(key)}><span class="bd-code">${escHtml(s.ref)}</span><span class="ccov-item-text">${escHtml(s.header || '')}</span>${s.source ? `<span class="ccov-item-sub">${escHtml(s.source)}</span>` : ''}</button>`;
      }).join('');
      const objs = c.objList.length ? c.objList.map((o, j) => {
        const key = `${kKey}-o${j}`;
        if (sel === key) {
          const others = [...(M.objCtrls.get(o.key) || [])];
          const proven = others.some(k => M.byCtrl.get(k).level === 0);
          detail = detailBox('DORA objective', o.id, o.requirement || o.article, null,
            proven ? 'At least one control covering this objective is live and rated effective.' : 'No control covering this objective is yet proven to work.',
            [['Article', o.article], [others.length > 1 ? `Covered by ${others.length} controls` : 'Covered by', others.map(ctrlLine)]]);
        }
        return `<button type="button" class="ccov-item ccov-obj${on(key)}" ${pick(key)}><span class="bd-code">${escHtml(o.id || '')}</span><span class="ccov-item-text">${escHtml(o.requirement || o.article)}</span><span class="ccov-item-sub">${escHtml(o.article)}</span></button>`;
      }).join('')
        : `<button type="button" class="bd-gap ccov-gap${on(kKey)}" ${pick(kKey)}><b>No DORA objective</b><span>The statements this control implements are not mapped to a DORA objective.</span></button>`;
      return `<div class="ccov-row${detail ? ' has-detail' : ''}">
        <button type="button" class="bd-ctrl ccov-ctrl bd-ctrl-${CCOV_ST[c.level].key}${on(kKey)}" ${pick(kKey)}>
          <span class="bd-ctrl-top"><span class="bd-code">${escHtml(c.num || '')}</span>${chip(c.level)}</span>
          <span class="bd-ctrl-name">${escHtml(c.label)}</span>
          ${c.desc ? `<span class="ccov-desc">${escHtml(c.desc)}</span>` : ''}
          <span class="ccov-weight">${plural(c.stmts.size, 'statement')} · ${plural(c.objs.size, 'objective')}</span>
          ${c.flags.length ? `<span class="ccov-flags">${c.flags.map(f => `<span class="bd-chip bd-tone-${f.tone}">${escHtml(f.text)}</span>`).join('')}</span>` : ''}
        </button>
        <div class="ccov-stack">${stmts}</div>
        <div class="ccov-stack">${objs}</div>
      </div>${detail}`;
    }).join('');

    return `<section class="bd-art ccov-card${open ? ' is-open' : ''}">
      <button type="button" class="bd-art-hd ccov-summary" data-key="cap${ci}" aria-expanded="${open}" onclick="ccovToggleCap(${ci})">
        <i class="bd-dot bd-dot-${CCOV_ST[worst].key}" aria-hidden="true"></i>
        <span class="bd-art-title">${escHtml(cap.name)}</span>
        <span class="bd-art-meta">${meta}</span>${chev}
      </button>
      ${open ? `<div class="bd-art-body"><div class="ccov-head"><span>Control</span><span>Implements (policy / GS statements)</span><span>Covers (DORA objectives)</span></div>${rows}</div>` : ''}
    </section>`;
  }).join('');

  const EMPTY = {
    uneff: 'Every control here is live and rated effective.',
    noobj: 'Every control reaches at least one DORA objective.',
  };
  return `
    <section class="bd-hero ccov-hero" aria-labelledby="ccov-headline">
      <h1 class="bd-headline ccov-headline" id="ccov-headline">${escHtml(headline)}</h1>
    </section>
    <div class="bd-minis ccov-minis">
      <div class="bd-mini"><span class="exsum-lbl">Controls</span><b>${total}</b><span class="exsum-frac">${effective} live and effective</span></div>
      <div class="bd-mini"><span class="exsum-lbl">Statements implemented</span><b>${stmtN}</b><span class="exsum-frac">policy &amp; group standard</span></div>
      <div class="bd-mini"><span class="exsum-lbl">DORA objectives covered</span><b>${objN}</b><span class="exsum-frac">${unprovenObjs ? `${unprovenObjs} on unproven controls only` : 'each has a proven control'}</span></div>
    </div>
    <div class="bd-lens-bar">
      <div class="bd-seg" role="group" aria-label="Show">
        ${CCOV_MODES.map(([v, l]) => `<button type="button" aria-pressed="${v === mode}" onclick="ccovSetMode('${v}')">${l}${v === 'all' ? '' : ` <span class="bd-seg-n">${counts[v]}</span>`}</button>`).join('')}
      </div>
      <div class="bd-legend">
        <span><i class="bd-dot bd-dot-ok" aria-hidden="true"></i>Effective</span>
        <span><i class="bd-dot bd-dot-warn" aria-hidden="true"></i>Live, not yet effective</span>
        <span><i class="bd-dot bd-dot-draft" aria-hidden="true"></i>Draft</span>
      </div>
    </div>
    <div class="bd-trace ccov-trace">${sections || `<div class="bd-empty">${EMPTY[mode]}</div>`}</div>`;
}

function generateCtrlCoverageReport() {
  const currentA = db.assessments.find(a => a.id === document.getElementById('exec-curr-sel').value);
  if (!currentA) return;
  closeExecReportModal();
  if (typeof setImportLens === 'function') setImportLens('dora');
  if (typeof updateSiteSubtitle === 'function') updateSiteSubtitle();
  _ccov.mode = 'all'; _ccov.sel = null; _ccov.open = {};
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
