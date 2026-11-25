// ══════════════════════════════════════════════════════════════════
// Framework Browser — browse the whole framework one level at a time, in
// Finder-style columns, through one of three lenses:
//   DORA Lens       pillar → article → objective → statement → control
//   Risk Lens       capability → risk → control
//   Governance Lens capability → document → statement → control
// Every item carries a status dot rolled up from the controls beneath it
// (effective · live, not yet effective · draft · gap). Gaps (an objective with
// no statement, a statement with no control, a capability with no risks or
// documents) show as red dashed items. The last column is the dark details
// box; a selected control offers "Open in …" to see it through another lens.
// Reads buildTraceabilityRows / buildBackingControlOps / buildRiskProfile, so
// it reconciles with DORA Reporting, RICA and Control Coverage.
// ══════════════════════════════════════════════════════════════════

const _fb = { a: null, M: null, lens: 'dora', path: [], focus: null };

// 0 effective · 1 live, not yet effective · 2 draft · 3 gap (worst wins).
const FB_ST = [
  { key: 'ok',    label: 'Effective' },
  { key: 'warn',  label: 'Live, not yet effective' },
  { key: 'draft', label: 'Draft' },
  { key: 'gap',   label: 'Gap' },
];
const FB_LENSES = [
  { key: 'dora', name: 'DORA Lens',       path: 'Pillar → article → objective → statement → control', levels: ['DORA pillar', 'Article', 'Objective', 'Statement', 'Control'] },
  { key: 'risk', name: 'Risk Lens',       path: 'Capability → risk → control',                         levels: ['Capability', 'Risk', 'Control'] },
  { key: 'gov',  name: 'Governance Lens', path: 'Capability → document → statement → control',         levels: ['Capability', 'Policy / group standard', 'Statement', 'Control'] },
];

function fbPlural(n, w) { return `${n} ${w}${n === 1 ? '' : 's'}`; }
function fbWorst(nodes) { const l = nodes.map(n => n.lvl).filter(v => v >= 0); return l.length ? Math.max(...l) : 3; }
function fbBand(r) { return r >= 20 ? ['High', 'gap'] : r >= 12 ? ['Moderate', 'warn'] : r > 0 ? ['Low', 'ok'] : ['Not assessed', 'muted']; }

// Build the three trees from one assessment.
function fbModel(a) {
  const trace = buildTraceabilityRows(a).rows;
  const LPol = (typeof lensPolicy === 'function') ? lensPolicy(a) : (a.policyRows || []);
  const LFac = (typeof lensFacts === 'function') ? lensFacts(a) : (a.riskPolicyFacts || []);
  const caps = CONFIG.capabilities || [];
  const capName = id => caps.find(c => c.id === id)?.name || id;
  const cKey = (capId, num, name) => capId + '|' + ftNorm(num) + '|' + ftNorm(name);

  // ── Controls: status, owner, what they implement and treat ──
  const ops = new Map(buildBackingControlOps(LPol, LFac).controls.map(o => [cKey(o.capId, o.number, o.name), o]));
  const risks = buildRiskProfile(LFac);
  const riskByKey = new Map(risks.map(r => [r.capId + '|' + ftNorm(r.title), r]));
  const ctrls = new Map();
  const ctrl = (key, seed) => {
    let c = ctrls.get(key);
    if (!c) {
      const op = ops.get(key) || {};
      const p = bdCtrlParts(seed.label || ((op.number ? op.number + ' — ' : '') + (op.name || '')));
      const implemented = op.implemented != null ? op.implemented : !!seed.implemented;
      const effective = op.effective != null ? op.effective : !!seed.effective;
      c = { key, num: p.num || op.number || '', name: p.name || op.name || '', capability: seed.capability || capName(op.capId),
        owner: seed.owner || op.owner || '', desc: seed.desc || '',
        lvl: !implemented ? 2 : effective ? 0 : 1, notAssessed: implemented && op.assessed === false,
        stmts: new Map(), risks: new Map() };
      ctrls.set(key, c);
    }
    if (!c.owner && seed.owner) c.owner = seed.owner;
    if (!c.desc && seed.desc) c.desc = seed.desc;
    return c;
  };
  trace.forEach(r => {
    if (!r._cKey) return;
    const c = ctrl(r._cKey, { label: r.control, capability: r.capability, owner: r.controlOwner, desc: r.controlDescription,
      implemented: r.controlStatus === 'Implemented', effective: r.effectiveness === 'Effective' });
    if (r._sKey) c.stmts.set(r._sKey, `${r.statementRef} — ${r.statementHeader || ''}`);
  });
  (LFac || []).forEach(f => {
    const nm = (f.controlName || '').trim(), t = (f.riskTitle || '').trim();
    if (!nm || !t || ftIsClosedControl(f)) return;
    const rk = riskByKey.get(f.capId + '|' + ftNorm(t));
    if (!rk) return;
    const c = ctrl(cKey(f.capId, f.controlNumber, nm), { label: (f.controlNumber ? f.controlNumber + ' — ' : '') + nm, capability: capName(f.capId),
      owner: (f.controlOwner || '').trim(), desc: (f.controlDesc || '').trim(), implemented: ftIsImplemented(f), effective: ftIsEffective(f) });
    c.risks.set(rk.capId + '|' + ftNorm(rk.title), rk);
    (rk._ctrls || (rk._ctrls = new Set())).add(c.key);
  });

  const ctrlNode = (key, prefix) => {
    const c = ctrls.get(key);
    const rl = [...c.risks.values()].sort((x, y) => y.residual - x.residual);
    return { key: prefix + 'c:' + key, ctrl: key, title: c.name || c.num, sub: [c.num, c.owner].filter(Boolean).join(' · '), lvl: c.lvl,
      detail: { kind: 'Control', code: c.num, title: c.name, lvl: c.lvl, label: c.notAssessed ? 'Live, not yet assessed' : null,
        says: c.desc || (c.lvl === 0 ? 'Live and rated effective in the latest RCSA.' : c.lvl === 1 ? (c.notAssessed ? 'Live, but not yet assessed in the RCSA.' : 'Live, but the latest RCSA has not rated it effective.') : 'Designed but not yet live.'),
        rows: [['Control owner', c.owner], ['Capability', c.capability], ['Implements', [...c.stmts.values()]],
          ['Treats', rl.length ? rl.map(r => `${r.title} (residual ${r.residual || 'not assessed'})`) : 'No risk linked']] } };
  };
  const gap = (key, title, says) => ({ key, gap: true, title, sub: says, lvl: 3,
    detail: { kind: 'Gap', title, lvl: 3, says, rows: [] } });

  // ── Statements (from the trace), keyed by _sKey ──
  const stmts = new Map();
  trace.forEach(r => {
    if (!r._sKey) return;
    let s = stmts.get(r._sKey);
    if (!s) {
      s = { key: r._sKey, ref: r.statementRef, header: r.statementHeader, detail: r.statementDetail, owner: r.statementOwner,
        document: r.document || '(no document)', docStatus: r.docStatus, source: r.source, disposition: r.disposition,
        capability: r.capability, ctrls: new Set(), objs: new Map() };
      stmts.set(r._sKey, s);
    }
    if (r._cKey) s.ctrls.add(r._cKey);
    if (r._oKey) s.objs.set(r._oKey, `${r.objectiveId} — ${r.objective}`);
  });
  const EXC = /exempt|waiver/i;
  const stmtNode = (sk, prefix) => {
    const s = stmts.get(sk);
    const kids = s.ctrls.size ? [...s.ctrls].map(k => ctrlNode(k, prefix + sk + '>'))
      : [gap(prefix + sk + '>gap', 'No control', s.disposition === 'Implemented' ? 'Self-declared implemented, but no control tracks it.' : 'Nothing puts this statement into practice yet.')];
    const lvl = fbWorst(kids);
    return { key: prefix + 's:' + sk, title: s.header || s.ref, sub: [s.ref, s.owner].filter(Boolean).join(' · '), lvl, children: kids,
      detail: { kind: 'Policy statement', code: s.ref, title: s.header || s.ref, lvl, label: s.ctrls.size ? null : 'No control',
        says: s.detail || (s.ctrls.size ? `Put into practice by ${fbPlural(s.ctrls.size, 'control')}.` : 'No control puts this statement into practice yet.'),
        rows: [['Statement owner', s.owner], ['Document', `${s.document}${s.source ? ` (${s.source})` : ''}`],
          ['Exception', EXC.test(s.disposition) ? s.disposition : 'None'],
          ['DORA objectives', s.objs.size ? [...s.objs.values()] : 'Not mapped to a DORA objective']] } };
  };

  // ── DORA Lens ──
  const pillars = (typeof DORA_PILLARS !== 'undefined' ? DORA_PILLARS : []);
  const dora = pillars.map(p => {
    const rows = trace.filter(r => r._oKey && r._pillarId === p.id);
    if (!rows.length) return { key: 'p:' + p.id, title: p.name, sub: `Chapter ${p.chapter} · ${p.inScope ? 'no objectives loaded' : 'out of scope'}`, lvl: -1, muted: true, children: [],
      detail: { kind: 'DORA pillar', title: p.name, lvl: null, says: p.outNote || 'No DORA objectives are tracked under this pillar.', rows: [['Chapter', p.chapter]] } };
    const arts = [...new Set(rows.map(r => r.article || '(no article)'))].map(art => {
      const aRows = rows.filter(r => (r.article || '(no article)') === art);
      const objs = [...new Set(aRows.map(r => r._oKey))].map(ok => {
        const oRows = aRows.filter(r => r._oKey === ok), o = oRows[0];
        const sks = [...new Set(oRows.map(r => r._sKey).filter(Boolean))];
        const kids = sks.length ? sks.map(sk => stmtNode(sk, 'o:' + ok + '>'))
          : [gap('o:' + ok + '>gap', 'No policy statement', 'Nothing in our policies or group standards covers this objective yet.')];
        const lvl = fbWorst(kids);
        return { key: 'o:' + ok, title: o.objective || ok, sub: o.objectiveId, lvl, children: kids,
          detail: { kind: 'DORA objective', code: o.objectiveId, title: o.objective, lvl, label: sks.length ? null : 'Not documented',
            says: !sks.length ? 'No policy or group-standard statement covers this objective.' : lvl === 0 ? 'Every control beneath it is live and effective.' : 'Documented, but not every control beneath it is proven to work yet.',
            rows: [['Article', art], ['Capability', o.capability], ['Statements', sks.map(sk => `${stmts.get(sk).ref} — ${stmts.get(sk).header || ''}`)]] } };
      });
      const doc = objs.filter(o => !o.children[0].gap).length, lvl = fbWorst(objs);
      return { key: 'a:' + art, title: art, sub: `${doc} of ${fbPlural(objs.length, 'objective')} documented`, lvl, children: objs,
        detail: { kind: 'DORA article', title: art, lvl, says: `${doc} of ${fbPlural(objs.length, 'objective')} documented in a policy or group standard.`, rows: [] } };
    });
    const nObj = new Set(rows.map(r => r._oKey)).size, lvl = fbWorst(arts);
    return { key: 'p:' + p.id, title: p.name, sub: `Chapter ${p.chapter} · ${fbPlural(arts.length, 'article')}`, lvl, children: arts,
      detail: { kind: 'DORA pillar', title: p.name, lvl, says: `Chapter ${p.chapter}. ${fbPlural(nObj, 'applicable objective')} across ${fbPlural(arts.length, 'article')}.`, rows: [] } };
  });

  // Capabilities in play: those with a DORA objective, a statement or a risk
  // (the rest of the catalogue would only add empty rows).
  const inPlay = new Set(trace.map(r => r.capability).filter(Boolean));
  risks.forEach(r => inPlay.add(capName(r.capId)));
  const capsInPlay = caps.filter(c => inPlay.has(c.name));
  const DOC_ST = { approved: 'Approved', partial: 'Partially approved', draft: 'Draft' };

  // ── Risk Lens ──
  const risk = capsInPlay.map(cap => {
    const rs = risks.filter(r => r.capId === cap.id).sort((x, y) => y.residual - x.residual || x.title.localeCompare(y.title)).map(r => {
      const ck = [...(r._ctrls || [])];
      const kids = ck.length ? ck.map(k => ctrlNode(k, 'r:' + cap.id + '|' + r.title + '>')) : [gap('r:' + r.title + '>gap', 'No control', 'No live or draft control treats this risk.')];
      const b = fbBand(r.residual);
      const eff = ck.filter(k => ctrls.get(k).lvl === 0).length;
      return { key: 'r:' + cap.id + '|' + r.title, title: r.title, sub: `Residual ${r.residual || '—'} · ${b[0]}${r.owner ? ' · ' + r.owner : ''}`, lvl: fbWorst(kids), children: kids,
        detail: { kind: 'Risk', title: r.title, tone: b[1], label: `${b[0]}${r.residual ? ' · ' + r.residual : ''}`,
          says: ck.length ? `Treated by ${fbPlural(ck.length, 'control')}, ${eff} of them effective.` : 'No control treats this risk yet.',
          rows: [['Risk owner', r.owner], ['Residual score', r.residual ? String(r.residual) : 'Not assessed'], ['Capability', cap.name]] } };
    });
    const kids = rs.length ? rs : [gap('k:' + cap.id + '>gap', 'No risks recorded', 'No IT risks are linked to this capability yet.')];
    const lvl = fbWorst(kids);
    return { key: 'k:' + cap.id, title: cap.name, sub: fbPlural(rs.length, 'risk'), lvl, children: kids,
      detail: { kind: 'Capability', title: cap.name, lvl, says: rs.length ? `${fbPlural(rs.length, 'risk')} recorded against this capability.` : 'No risks recorded yet.', rows: [] } };
  });

  // ── Governance Lens ──
  const gov = capsInPlay.map(cap => {
    const sl = [...stmts.values()].filter(s => s.capability === cap.name);
    const docs = [...new Set(sl.map(s => s.document))].map(d => {
      const ds = sl.filter(s => s.document === d).sort((x, y) => String(x.ref).localeCompare(String(y.ref)));
      const kids = ds.map(s => stmtNode(s.key, 'g:'));
      const src = ds.find(s => s.source)?.source || '', st0 = ds.find(s => s.docStatus)?.docStatus || '', status = DOC_ST[ftNorm(st0)] || st0;
      const lvl = fbWorst(kids);
      return { key: 'd:' + cap.id + '|' + d, title: d, sub: [src, status].filter(Boolean).join(' · '), lvl, children: kids,
        detail: { kind: src || 'Document', title: d, lvl, says: `${fbPlural(kids.length, 'statement')} for ${cap.name}.`, rows: [['Source', src], ['Document status', status]] } };
    });
    const kids = docs.length ? docs : [gap('k:' + cap.id + '>gap', 'No policy or group standard', 'No document covers this capability yet.')];
    const lvl = fbWorst(kids);
    return { key: 'k:' + cap.id, title: cap.name, sub: fbPlural(docs.length, 'document'), lvl, children: kids,
      detail: { kind: 'Capability', title: cap.name, lvl, says: docs.length ? `Covered by ${docs.map(d => d.title).join(', ')}.` : 'No documents yet.', rows: [] } };
  });

  return { dora, risk, gov };
}

// Path of node keys from the root to the given control, in a lens tree.
function fbFindCtrl(nodes, ck, trail) {
  for (const n of nodes || []) {
    if (n.ctrl === ck) return trail.concat(n.key);
    const f = fbFindCtrl(n.children, ck, trail.concat(n.key));
    if (f) return f;
  }
  return null;
}

function fbBody() {
  const L = FB_LENSES.find(l => l.key === _fb.lens);
  const tree = _fb.M[_fb.lens];
  const columns = [], crumbs = [];
  let list = tree, sel = null;
  for (let d = 0; list && list.length; d++) {
    const s = list.find(n => n.key === _fb.path[d]);
    columns.push({ d, label: L.levels[d] || '', nodes: list, selKey: s && s.key });
    if (!s) break;
    sel = s;
    crumbs.push(/^(RTS|ART|[A-Z]{2,}-)/.test((s.sub || '').split(' · ')[0]) ? s.sub.split(' · ')[0] : s.title);
    list = s.children;
  }

  const tabs = FB_LENSES.map(l => `<button type="button" role="tab" class="fb-tab" aria-selected="${l.key === _fb.lens}" onclick="fbSetLens('${l.key}')">
      <span class="fb-tab-name">${l.name}</span><span class="fb-tab-path">${l.path}</span></button>`).join('');

  const cols = columns.map(col => {
    const real = col.nodes.filter(n => !n.gap).length;
    const items = col.nodes.map((n, i) => {
      const on = n.key === col.selKey;
      const dot = n.lvl >= 0 ? `bd-dot-${FB_ST[n.lvl].key}` : '';
      return `<button type="button" class="fb-node${on ? ' is-sel' : ''}${n.gap ? ' is-gap' : ''}${n.muted ? ' is-muted' : ''}" data-key="${escHtml(n.key)}" aria-pressed="${on}" onclick="fbPick(${col.d}, ${i})">
        <i class="bd-dot ${dot}" aria-hidden="true"></i>
        <span class="fb-node-txt"><span class="fb-node-title">${escHtml(n.title)}</span>${n.sub ? `<span class="fb-node-sub">${escHtml(n.sub)}</span>` : ''}</span>
        ${n.children && n.children.length ? '<span class="fb-node-more" aria-hidden="true">›</span>' : ''}
      </button>`;
    }).join('');
    return `<section class="fb-col" aria-label="${escHtml(col.label)}">
      <div class="fb-col-hd"><h3>${escHtml(col.label)}</h3><span>${real}</span></div>
      <div class="fb-col-list">${items}</div>
    </section>`;
  }).join('');

  let detail;
  if (sel) {
    const D = sel.detail;
    const chip = D.label || D.lvl != null ? `<span class="bd-chip bd-tone-${D.tone || (D.lvl != null ? FB_ST[D.lvl].key : 'muted')}">${escHtml(D.label || FB_ST[D.lvl].label)}</span>` : '';
    const rows = (D.rows || []).filter(r => r[1] && (!Array.isArray(r[1]) || r[1].length)).map(([k, v]) =>
      `<div><dt>${escHtml(k)}</dt><dd>${Array.isArray(v) ? `<ul class="fb-dl-list">${v.map(x => `<li>${escHtml(x)}</li>`).join('')}</ul>` : escHtml(v)}</dd></div>`).join('');
    const pivots = sel.ctrl ? `<div class="fb-pivots"><span>See this control in another lens</span>
      ${FB_LENSES.filter(l => l.key !== _fb.lens).map(l => `<button type="button" class="fb-pivot" onclick="fbPivot('${l.key}')">Open in ${l.name} <span aria-hidden="true">→</span></button>`).join('')}</div>` : '';
    detail = `<span class="bd-detail-kind">${escHtml(D.kind)}${D.code ? ` · <span class="bd-detail-code">${escHtml(D.code)}</span>` : ''}</span>
      <h3 class="bd-detail-title">${escHtml(D.title || '')}</h3>${chip}
      ${D.says ? `<p class="bd-detail-says">${escHtml(D.says)}</p>` : ''}
      ${rows ? `<dl class="fb-dl">${rows}</dl>` : ''}${pivots}`;
  } else {
    detail = `<h3 class="bd-detail-title">Select anything to see its detail</h3>
      <p class="bd-detail-says">Each click opens the next level in a new column. Owners, status and what the item connects to appear here.</p>`;
  }

  return `<div class="fb-tabs" role="tablist" aria-label="Lens">${tabs}</div>
    <div class="fb-bar">
      <nav class="fb-crumbs" aria-label="Path"><b>${L.name}</b>${crumbs.map(c => `<span aria-hidden="true">›</span><span>${escHtml(c)}</span>`).join('')}</nav>
      <div class="bd-legend">
        <span><i class="bd-dot bd-dot-ok" aria-hidden="true"></i>Effective</span>
        <span><i class="bd-dot bd-dot-warn" aria-hidden="true"></i>Live, not yet effective</span>
        <span><i class="bd-dot bd-dot-draft" aria-hidden="true"></i>Draft</span>
        <span><i class="bd-dot bd-dot-gap" aria-hidden="true"></i>Gap</span>
      </div>
    </div>
    <div class="fb-cols">${cols}<aside class="fb-detail" aria-label="Details" aria-live="polite">${detail}</aside></div>`;
}

function fbRefresh() {
  const body = document.getElementById('fb-body');
  if (!body || !_fb.M) return;
  const scroller = body.querySelector('.fb-cols');
  const tops = [...body.querySelectorAll('.fb-col-list')].map(el => el.scrollTop);
  body.innerHTML = fbBody();
  body.querySelectorAll('.fb-col-list').forEach((el, i) => { if (tops[i] != null) el.scrollTop = tops[i]; });
  const cols = body.querySelector('.fb-cols');
  if (cols) cols.scrollLeft = scroller ? Math.max(scroller.scrollLeft, cols.scrollWidth - cols.clientWidth) : 0;
  if (_fb.focus) {
    const el = [...body.querySelectorAll('.fb-node')].find(n => n.dataset.key === _fb.focus);
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    _fb.focus = null;
  }
}
function fbSetLens(key) { _fb.lens = key; _fb.path = []; fbRefresh(); }
function fbPick(depth, i) {
  let list = _fb.M[_fb.lens];
  for (let d = 0; d < depth; d++) list = (list.find(n => n.key === _fb.path[d]) || {}).children || [];
  const n = list[i];
  if (!n) return;
  _fb.path = _fb.path.slice(0, depth).concat(n.key);
  _fb.focus = n.key;
  fbRefresh();
}
function fbPivot(lens) {
  let list = _fb.M[_fb.lens], ck = null;
  for (const k of _fb.path) { const n = (list || []).find(x => x.key === k); if (!n) break; ck = n.ctrl || ck; list = n.children; }
  if (!ck) return;
  _fb.lens = lens;
  _fb.path = fbFindCtrl(_fb.M[lens], ck, []) || [];
  _fb.focus = _fb.path[_fb.path.length - 1] || null;
  fbRefresh();
}
function fbSetAssessment(id) {
  const a = db.assessments.find(x => x.id === id);
  if (!a) return;
  openFrameworkBrowser(a.id, true);
}

function openFrameworkBrowser(assessmentId, keepLens) {
  if (!db.assessments.length) { alert('You need at least one assessment to browse the framework.'); return; }
  const a = db.assessments.find(x => x.id === assessmentId) || db.assessments[db.assessments.length - 1];
  if (typeof setImportLens === 'function') setImportLens('dora');
  if (typeof updateSiteSubtitle === 'function') updateSiteSubtitle();
  const runWithLens = (typeof withLens === 'function') ? withLens : (k, fn) => fn();
  _fb.a = a;
  _fb.M = runWithLens('dora', () => fbModel(a));
  if (!keepLens) _fb.lens = 'dora';
  _fb.path = [];
  const app = (CONFIG && CONFIG.appTitle) || 'Measurable IT Regulatory Oversight Model';
  const opts = db.assessments.map(x => `<option value="${x.id}"${x.id === a.id ? ' selected' : ''}>${escHtml(x.label)} · ${formatDate(x.date)}</option>`).join('');
  const content = document.getElementById('fb-content');
  content.classList.add('board');
  content.innerHTML = `<div class="fb">
    <div class="bd-top">
      <div>
        <div class="exsc-eyebrow">◈ ${escHtml(app)}</div>
        <h2 class="exsc-title bd-doc-title">Framework Browser</h2>
        <div class="bd-sub">Pick a lens, then click through the framework one level at a time.</div>
      </div>
      <label class="fb-asmt no-print"><span>Assessment</span><select onchange="fbSetAssessment(this.value)">${opts}</select></label>
    </div>
    <div id="fb-body"></div>
  </div>`;
  showView('framework-browser');
  fbRefresh();
}

if (typeof window !== 'undefined') {
  window.openFrameworkBrowser = openFrameworkBrowser;
  window.fbModel = fbModel;
}
