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
    <div class="exec-report-top no-print" style="justify-content:flex-end">
      <button class="btn btn-outline" onclick="window.print()">🖨 Print / Save PDF</button>
    </div>
    ${renderExecScorecard(currentA, prevA)}
    <div class="exec-rcsa-wrap">${renderExecCoverageMatrix(currentA)}</div>
    <div class="exec-rcsa-wrap">${renderExecControl2(currentA, prevA)}</div>
    <div class="exec-rcsa-wrap">${renderExecControl3(currentA, prevA)}</div>
    <div class="exec-rcsa-wrap">${renderExecAttention(currentA)}</div>
  `;
  showView('exec-report');
}

// ── Hero scorecard band (Control 1 / 2 / 3 at a glance) ───────────
// Reads buildExecScorecard for the current and previous assessment; RAG colour
// by percentage, QoQ delta arrows against the previous assessment.
function execScColor(pct) {
  return pct >= 80 ? 'var(--clr-success)' : pct >= 50 ? 'var(--clr-warning)' : 'var(--clr-danger)';
}
function execScDelta(cur, prev) {
  if (prev == null) return '';
  const d = cur - prev;
  if (d === 0) return '<span class="exsc-flat">■ no change</span>';
  const up = d > 0;
  return `<span class="exsc-${up ? 'up' : 'dn'}">${up ? '▲' : '▼'} ${up ? '+' : ''}${d}%</span>`;
}
function execScGauge(pct, n, d) {
  const col = execScColor(pct);
  const C = 2 * Math.PI * 52;
  const dash = Math.max(0, Math.min(100, pct)) / 100 * C;
  return `<div class="exsc-ring">
    <svg viewBox="0 0 132 132" width="118" height="118">
      <circle class="exsc-track" cx="66" cy="66" r="52"></circle>
      <circle class="exsc-arc" cx="66" cy="66" r="52" stroke="${col}" stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}"></circle>
    </svg>
    <div class="exsc-ctr"><div class="exsc-pct" style="color:${col}">${pct}%</div><div class="exsc-frac">${n} / ${d}</div></div>
  </div>`;
}
// Stacked donut for the Control-2 hero split: of a source's statements, how many
// are implemented (green), draft-only (amber), or have no control (grey).
function execStackDonut(green, amber, grey, opts) {
  opts = opts || {};
  const segs = [
    { v: green, c: 'var(--clr-success)' },
    { v: amber, c: 'var(--clr-warning)' },
    { v: grey,  c: 'color-mix(in srgb, var(--text) 16%, transparent)' },
  ];
  const total = green + amber + grey, R = 46, C = 2 * Math.PI * R, SW = 12;
  let start = 0;
  const arcs = total
    ? segs.filter(s => s.v > 0).map(s => {
        const len = s.v / total * C, off = -start; start += len;
        return `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${s.c}" stroke-width="${SW}" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 60 60)"></circle>`;
      }).join('')
    : `<circle cx="60" cy="60" r="${R}" fill="none" stroke="color-mix(in srgb, var(--text) 16%, transparent)" stroke-width="${SW}"></circle>`;
  return `<div class="exsc-c2-one">
    <div class="exsc-c2-ring">
      <svg viewBox="0 0 120 120" width="106" height="106" class="exsc-c2-svg">${arcs}</svg>
      <div class="exsc-c2-ctr"><div class="exsc-c2-tot">${total}</div><div class="exsc-c2-totlbl">${opts.centreLbl || 'statements'}</div></div>
    </div>
    ${opts.label ? `<div class="exsc-c2-lbl">${opts.label}</div>` : ''}
    <div class="exsc-c2-sub">${opts.caption || ''}</div>
  </div>`;
}
function renderExecScorecard(currentA, prevA) {
  const cur  = buildExecScorecard(currentA.doraRows || [], currentA.policyRows || [], currentA.riskPolicyFacts || []);
  const prev = prevA ? buildExecScorecard(prevA.doraRows || [], prevA.policyRows || [], prevA.riskPolicyFacts || []) : null;
  const sops = buildStatementOps(currentA.policyRows || [], currentA.riskPolicyFacts || []);
  const c2 = src => ({ impl: src.operationalised, draft: src.backed - src.operationalised, none: src.total - src.backed });
  const c2p = c2(sops.policy), c2g = c2(sops.groupStandard);
  const bops = buildBackingControlOps(currentA.policyRows || [], currentA.riskPolicyFacts || []);
  const c3 = {
    eff: bops.controls.filter(c => c.liveEffective).length,
    implNotEff: bops.controls.filter(c => c.implemented && !c.effective).length,
    draft: bops.controls.filter(c => !c.implemented).length,
  };
  const c3ImplCtrl = c3.eff + c3.implNotEff;   // controls that are implemented (effective or not)
  const art = buildDoraArticleCoverage(currentA.doraRows || [], currentA.policyRows || [], currentA.riskPolicyFacts || []);
  const objOped    = art.totals.byImplemented;                        // objectives with an implemented control
  const objWaiting = art.totals.byBacked - art.totals.byImplemented;  // objectives backed only by draft controls
  const app  = (CONFIG && CONFIG.appTitle) || 'Measurable IT Regulatory Oversight Model';

  const gauge = (key, tag, name, desc, sub) => {
    const c = cur[key], p = prev ? prev[key] : null;
    return `<div class="exsc-gauge">
      <div class="exsc-gtag">${tag}</div>
      <div class="exsc-gname">${name}</div>
      ${execScGauge(c.pct, c.n, c.d)}
      <div class="exsc-qoq">${execScDelta(c.pct, p ? p.pct : null)}</div>
      ${sub ? `<div class="exsc-bridge">${sub}</div>` : ''}
      <div class="exsc-gdesc">${desc}</div>
    </div>`;
  };

  const subVs = prevA ? ` &nbsp;·&nbsp; vs ${escHtml(prevA.label)}` : '';

  return `
  <div class="exsc">
    <div class="exsc-hdr">
      <div>
        <div class="exsc-eyebrow">◈ ${escHtml(app)}</div>
        <h2 class="exsc-title">DORA Operationalisation Scorecard</h2>
        <div class="exsc-sub">${escHtml(currentA.label)} · ${formatDate(currentA.date)}${subVs}</div>
      </div>
      <div class="exsc-composite">
        <div class="exsc-big" style="color:${execScColor(cur.composite.pct)}">${cur.composite.pct}%</div>
        <div class="exsc-big-lbl">DORA objectives fully operationalised</div>
        <div class="exsc-qoq">${execScDelta(cur.composite.pct, prev ? prev.composite.pct : null)}</div>
      </div>
    </div>
    <div class="exsc-row">
      ${gauge('control1', 'Control 1 · Coverage', 'Applicable DORA objectives covered', `${cur.control1.n} of ${cur.control1.d} DORA objectives covered by ${sops.policy.total} policy and ${sops.groupStandard.total} group standard statements`)}
      <div class="exsc-gauge exsc-gauge-c2">
        <div class="exsc-gtag">Control 2 · Operationalisation</div>
        <div class="exsc-gname">Policy &amp; Group Standard statements operationalised by controls</div>
        <div class="exsc-c2-donuts">${execStackDonut(c2p.impl, c2p.draft, c2p.none, { label: 'Policy', caption: `<span class="exsc-c2-imp">${c2p.impl} impl</span> · <span class="exsc-c2-drf">${c2p.draft} draft</span> · <span class="exsc-c2-non">${c2p.none} none</span>` })}${execStackDonut(c2g.impl, c2g.draft, c2g.none, { label: 'Group Standard', caption: `<span class="exsc-c2-imp">${c2g.impl} impl</span> · <span class="exsc-c2-drf">${c2g.draft} draft</span> · <span class="exsc-c2-non">${c2g.none} none</span>` })}</div>
        <div class="exsc-gdesc">${sops.all.operationalised} of ${sops.all.total} statements operationalised by ${bops.total} controls (${sops.policy.total} policy · ${sops.groupStandard.total} group standard).</div>
        <div class="exsc-c2-legend"><span class="exsc-c2-imp">■ Implemented</span> <span class="exsc-c2-drf">■ Draft</span> <span class="exsc-c2-non">■ No control</span></div>
      </div>
      <div class="exsc-gauge exsc-gauge-c3">
        <div class="exsc-gtag">Control 3 · Effectiveness</div>
        <div class="exsc-gname">Control efficacy in treating risk</div>
        <div class="exsc-c2-donuts">${execStackDonut(c3.eff, c3.implNotEff, c3.draft, { centreLbl: 'controls', caption: `<span class="exsc-c2-imp">${c3.eff} effective</span> · <span class="exsc-c2-drf">${c3.implNotEff} to improve</span> · <span class="exsc-c2-non">${c3.draft} draft</span>` })}</div>
        <div class="exsc-gdesc">${c3.eff} of ${c3ImplCtrl} implemented controls are rated effective in the RCSA${c3.implNotEff ? `; ${c3.implNotEff} still to improve` : ''}. ${c3.draft} draft control${c3.draft === 1 ? '' : 's'} not yet operational.</div>
        <div class="exsc-c2-legend"><span class="exsc-c2-imp">■ Effective</span> <span class="exsc-c2-drf">■ Implemented, not effective</span> <span class="exsc-c2-non">■ Draft</span></div>
      </div>
    </div>
  </div>`;
}

// ── Control 1 — coverage by DORA article (spec rows 2–5) ──
// One row per article: capability + a single stacked coverage bar over the
// article's whole obligation universe (covered via policy · via group standard
// only · uncovered). Reads buildDoraArticleCoverage. Sortable.
let _exmRows = [], _exmSort = { col: null, dir: 1 };
const EXM_FIELD = {
  article:    r => r.article || '',
  capability: r => r.capability || '',
  covered:    r => r.total ? r.covered / r.total : -1,
};
function exmSortRows() {
  if (!_exmSort.col) return _exmRows;
  const f = EXM_FIELD[_exmSort.col] || EXM_FIELD.article, dir = _exmSort.dir;
  return _exmRows.slice().sort((a, b) => {
    const va = f(a), vb = f(b);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir || a.article.localeCompare(b.article);
    return String(va).localeCompare(String(vb)) * dir;
  });
}
// One stacked bar over the article's whole obligation universe: the covered
// share is split into "via a policy" (includes any also under a group standard)
// and "via a group standard only"; the grey remainder is uncovered. So the
// segments always sum to the total — no double counting across separate bars.
function exmStackBar(a) {
  const total = a.total || 0, policy = a.byPolicy || 0;
  const groupOnly = Math.max(0, a.covered - policy);
  const both = Math.max(0, a.byPolicy + a.byGroupStandard - a.covered);   // policy ∩ group std
  const pctP = total ? 100 * policy / total : 0;
  const pctG = total ? 100 * groupOnly / total : 0;
  const polTip = `Covered by a policy: ${policy}${both > 0 ? ` (of which ${both} also under a group standard)` : ''}`;
  const grpTip = `Covered by a group standard only: ${groupOnly}`;
  const uncov = total - a.covered;
  return `<div class="exm-bar" title="${a.covered}/${total} obligations covered · ${uncov} uncovered">
    <span class="exm-bar-num">${a.covered}<span class="exm-den">/${total}</span></span>
    <span class="exm-track exm-stack">
      <i class="exm-seg-pol" style="width:${pctP}%" title="${polTip}"></i>
      <i class="exm-seg-grp" style="width:${pctG}%" title="${grpTip}"></i>
    </span>
  </div>`;
}
function exmHead() {
  const arrow = c => _exmSort.col === c ? `<span class="mrt-arrow">${_exmSort.dir === 1 ? '▲' : '▼'}</span>` : '';
  const th = (k, l) => `<th class="mrt-sort" onclick="sortExecMatrix('${k}')">${l}${arrow(k)}</th>`;
  const covLbl  = 'Coverage — <span class="exm-th-pol">policy</span> · <span class="exm-th-grp">group std</span> · <span class="exm-th-uncov">uncovered</span>';
  return `<tr>${th('article', 'DORA Article/RTS')}${th('capability', 'Capability')}${th('covered', covLbl)}</tr>`;
}
function exmBody(rows) {
  return rows.map(a => `<tr>
    <td class="exm-art">${escHtml(a.article)}</td>
    <td class="exm-cap">${escHtml(a.capability) || '<span class="src-zero">—</span>'}</td>
    <td>${exmStackBar(a)}</td>
  </tr>`).join('');
}
function sortExecMatrix(col) {
  if (_exmSort.col === col) _exmSort.dir *= -1; else _exmSort = { col, dir: 1 };
  const tb = document.getElementById('exm-tbody'), th = document.getElementById('exm-thead');
  if (tb) tb.innerHTML = exmBody(exmSortRows());
  if (th) th.innerHTML = exmHead();
}
function renderExecCoverageMatrix(currentA) {
  const cov = buildDoraArticleCoverage(currentA.doraRows || [], currentA.policyRows || [], currentA.riskPolicyFacts || []);
  const head = desc => `<div class="measure-card-header">
      <span class="measure-icon">⚖️</span>
      <div style="flex:1"><div class="exsc-eyebrow">Control 1</div><h3 class="measure-card-title">Applicable DORA articles/RTS objectives covered by Policies and Group Standards</h3><p class="measure-card-desc">${desc}</p></div>
    </div>`;
  if (!cov.articles.length) {
    return `<div class="card measure-card">${head('No DORA mapping uploaded for this assessment.')}</div>`;
  }
  const fully   = cov.articles.filter(a => a.covered === a.total).length;
  const uncov   = cov.articles.filter(a => a.covered === 0).length;
  const partial = cov.articles.length - fully - uncov;
  const t = cov.totals;
  const desc = `${cov.articles.length} applicable DORA articles/RTS &middot; <b>${fully}</b> fully covered &middot; ${partial} partial &middot; <b class="${uncov ? 'dora-gap-num' : ''}">${uncov}</b> uncovered &middot; ${t.covered}/${t.total} DORA Objectives (${t.total ? Math.round(100 * t.covered / t.total) : 0}%). One bar per article spans all its objectives, split by how each covered one is owned.`;
  _exmRows = cov.articles;
  _exmSort = { col: null, dir: 1 };
  const legend = `<div class="exm-legend">
    <span class="exm-leg"><i class="exm-seg-pol"></i> Covered via policy</span>
    <span class="exm-leg"><i class="exm-seg-grp"></i> Covered via group standard only</span>
    <span class="exm-leg"><i class="exm-leg-uncov"></i> Uncovered</span>
  </div>`;
  return `<div class="card measure-card">
    ${head(desc)}
    ${legend}
    <div class="rcsa-table-wrap">
      <table class="exm-tbl">
        <thead id="exm-thead">${exmHead()}</thead>
        <tbody id="exm-tbody">${exmBody(exmSortRows())}</tbody>
      </table>
    </div>
  </div>`;
}

// ── Act 2 · Control 2 — statements backed & operationalised ───────
// Aggregate operationalisation (rows 8–9), per-document disposition +
// control-status detail (rows 12–16, 19–21), and the two compliance-hygiene
// callouts (rows 13, 14). Reads buildStatementOps + buildExecDocDetail.
function ex2AggBar(label, o, prevO) {
  const pct = o.total ? Math.round(100 * o.operationalised / o.total) : 0;
  const prevPct = prevO && prevO.total ? Math.round(100 * prevO.operationalised / prevO.total) : null;
  return `<div class="ex2-agg-item">
    <div class="ex2-agg-top"><span class="ex2-agg-lbl">${label}</span><span class="ex2-agg-val"><b>${o.operationalised}</b>/<span class="exm-den">${o.total}</span> &middot; ${pct}% ${execScDelta(pct, prevPct)}</span></div>
    <div class="ex2-agg-track"><i style="width:${pct}%;background:${execScColor(pct)}"></i></div>
  </div>`;
}
// The two Control-2 document tables (Group Standards / Policies). Both share a
// fixed colgroup so corresponding columns line up under each other, and each is
// independently sortable. A Document-status badge mirrors the main-screen card.
let _ex2Data = { gs: [], pol: [] }, _ex2Sort = { gs: { col: null, dir: 1 }, pol: { col: null, dir: 1 } };
const EX2_STATUS_RANK = { approved: 0, partial: 1, draft: 2 };
const EX2_FIELD = {
  document:       r => r.document || '',
  capName:        r => r.capName || '',
  total:          r => r.total || 0,
  status:         r => EX2_STATUS_RANK[r.status] ?? 9,
  operationalised: r => r.total ? r.operationalised / r.total : -1,
  ctrlDraft:      r => r.ctrlDraft || 0,
  ctrlImpl:       r => r.ctrlImpl || 0,
};
function ex2SortRows(which) {
  const st = _ex2Sort[which], rows = _ex2Data[which];
  if (!st.col) return rows;
  const f = EX2_FIELD[st.col] || EX2_FIELD.document, dir = st.dir;
  return rows.slice().sort((a, b) => {
    const va = f(a), vb = f(b);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir || a.document.localeCompare(b.document);
    return String(va).localeCompare(String(vb)) * dir || a.document.localeCompare(b.document);
  });
}
const EX2_COLGROUP = `<colgroup><col style="width:22%"><col style="width:16%"><col style="width:9%"><col style="width:12%"><col style="width:17%"><col style="width:12%"><col style="width:12%"></colgroup>`;
function ex2StatusBadge(r) {
  const map = { approved: ['gov-approved', 'Approved'], draft: ['gov-draft', 'Draft'], partial: ['gov-partial', 'Partial'] };
  const [cls, txt] = map[r.status] || map.draft;
  return `<span class="gov-badge ${cls}" title="${r.approved} approved &middot; ${r.draft} draft (of ${r.total})">${txt}</span>`;
}
function ex2Head(which) {
  const st = _ex2Sort[which];
  const arrow = c => st.col === c ? `<span class="mrt-arrow">${st.dir === 1 ? '▲' : '▼'}</span>` : '';
  const th = (k, l, cls) => `<th class="mrt-sort${cls ? ' ' + cls : ''}" onclick="sortExec2('${which}','${k}')">${l}${arrow(k)}</th>`;
  return `<tr>${th('document', 'Document')}${th('capName', 'Capability')}${th('total', 'Statements', 'ex2-num-h')}${th('status', 'Document status')}${th('operationalised', 'Control backed statements', 'rp-num')}${th('ctrlDraft', 'Draft', 'rp-num')}${th('ctrlImpl', 'Implemented', 'rp-num')}</tr>`;
}
function ex2Body(rows) {
  return rows.map(d => {
    const totCtrl = d.ctrlDraft + d.ctrlImpl;   // a control is either draft or implemented
    return `<tr>
    <td class="exm-art">${escHtml(d.document)}</td>
    <td class="exm-cap">${escHtml(d.capName)}</td>
    <td class="ex2-num">${d.total}</td>
    <td class="ex2-status">${ex2StatusBadge(d)}</td>
    <td class="rp-num">${rpFrac(d.operationalised, d.total)}</td>
    <td class="rp-num">${rpFrac(d.ctrlDraft, totCtrl)}</td>
    <td class="rp-num">${rpFrac(d.ctrlImpl, totCtrl, true)}</td>
  </tr>`;
  }).join('');
}
function ex2DocTable(which) {
  const rows = _ex2Data[which];
  if (!rows.length) return '<p class="policy-no-data" style="margin:.3rem 0">None uploaded.</p>';
  return `<table class="exm-tbl ex2-tbl ex2-tbl-fixed">
    ${EX2_COLGROUP}
    <thead id="ex2-thead-${which}">${ex2Head(which)}</thead>
    <tbody id="ex2-tbody-${which}">${ex2Body(ex2SortRows(which))}</tbody></table>`;
}
function sortExec2(which, col) {
  const st = _ex2Sort[which];
  if (st.col === col) st.dir *= -1; else { st.col = col; st.dir = 1; }
  const tb = document.getElementById('ex2-tbody-' + which), th = document.getElementById('ex2-thead-' + which);
  if (tb) tb.innerHTML = ex2Body(ex2SortRows(which));
  if (th) th.innerHTML = ex2Head(which);
}
function renderExecControl2(currentA, prevA) {
  const ops     = buildStatementOps(currentA.policyRows || [], currentA.riskPolicyFacts || []);
  const prevOps = prevA ? buildStatementOps(prevA.policyRows || [], prevA.riskPolicyFacts || []) : null;
  const doc     = buildExecDocDetail(currentA.policyRows || [], currentA.riskPolicyFacts || []);
  const head = desc => `<div class="measure-card-header">
      <span class="measure-icon">🗂️</span>
      <div style="flex:1"><div class="exsc-eyebrow">Control 2</div><h3 class="measure-card-title">Policy & Group Standard statement operationalised by controls</h3><p class="measure-card-desc">${desc}</p></div>
    </div>`;
  if (!doc.rows.length) return `<div class="card measure-card">${head('No policy data uploaded for this assessment.')}</div>`;

  const inv   = doc.rows.reduce((s, d) => s + d.invisibleWork, 0);
  const stale = doc.rows.reduce((s, d) => s + d.staleWaiver, 0);
  const invDrill   = doc.rows.filter(d => d.invisibleWork > 0).map(d => `${escHtml(d.document)} (${d.invisibleWork})`).join(', ');
  const staleDrill = doc.rows.filter(d => d.staleWaiver > 0).map(d => `${escHtml(d.document)} (${d.staleWaiver})`).join(', ');
  const flag = (n, cls, title, body) => `<div class="ex2-flag ${n ? cls : 'ex2-flag-ok'}">
      <div class="ex2-flag-n">${n}</div>
      <div class="ex2-flag-body"><div class="ex2-flag-t">${title}</div><div class="ex2-flag-d">${body}</div></div>
    </div>`;

  const desc = `<b>${ops.all.operationalised}</b>/${ops.all.total} statements operationalised with a control (Draft or Implemented)(${ops.operationalisedPct.all}%).`;

  _ex2Data = { gs: doc.groupStandard, pol: doc.policy };
  _ex2Sort = { gs: { col: null, dir: 1 }, pol: { col: null, dir: 1 } };

  return `<div class="card measure-card">
    ${head(desc)}
    <div class="ex2-agg">
      ${ex2AggBar('Policy statements operationalised', ops.policy, prevOps ? prevOps.policy : null)}
      ${ex2AggBar('Group-standard statements operationalised', ops.groupStandard, prevOps ? prevOps.groupStandard : null)}
    </div>
    <div class="ex2-flags">
      ${flag(inv, 'ex2-flag-warn', 'Invisible work', `Statements self-declared implemented or part-implemented with no control tracking them.${inv ? ' — ' + invDrill : ' None — good.'}`)}
      ${flag(stale, 'ex2-flag-bad', 'Stale / incorrect waivers', `Statements carrying a waiver that already have a live control — the waiver should be lifted.${stale ? ' — ' + staleDrill : ' None — good.'}`)}
    </div>
    <div class="ex2-section">Group Standards — approval &amp; operationalisation</div>
    <div class="rcsa-table-wrap">${ex2DocTable('gs')}</div>
    <div class="ex2-section">Policies — approval &amp; operationalisation</div>
    <div class="rcsa-table-wrap">${ex2DocTable('pol')}</div>
  </div>`;
}

// ── Act 3 · Control 3 — controls operationalised & live (risk view) ──
// The residual-vs-effectiveness quadrant + a risk-assurance summary table
// (spec row 24). Reads buildRiskProfile + buildBackingControlOps.
// Zone of a risk from residual (x) × control effectiveness (y), per the
// exec-defined grid. Effectiveness = share of the risk's controls rated
// effective. Not-assessed risks (no residual) have no zone.
//   eff ≥ 50 : residual <20 green, ≥20 amber
//   eff < 50 : residual <12 green, 12–20 amber, ≥20 red (danger)
function ex3Zone(k) {
  if (k.band === 'na' || !k.residual) return { key: 'na', label: 'n/a', col: 'var(--text-muted)' };
  const e = k.active ? 100 * k.effective / k.active : 0, r = k.residual;
  const key = e >= 50 ? (r >= 20 ? 'amber' : 'green') : (r >= 20 ? 'red' : (r >= 12 ? 'amber' : 'green'));
  const col = key === 'red' ? 'var(--clr-danger)' : key === 'amber' ? 'var(--clr-warning)' : 'var(--clr-success)';
  return { key, label: key.charAt(0).toUpperCase() + key.slice(1), col };
}
function execQuadrant(risks) {
  const assessed = risks.filter(k => k.band !== 'na' && k.residual > 0);
  const notAssessed = risks.length - assessed.length;
  const W = 760, H = 300, mL = 46, mR = 16, mT = 14, mB = 34;
  const pL = mL, pR = W - mR, pT = mT, pB = H - mB, pW = pR - pL, pH = pB - pT, RMAX = 38;
  const xs = r => pL + Math.min(r, RMAX) / RMAX * pW;
  const ys = e => pT + (1 - Math.max(0, Math.min(100, e)) / 100) * pH;
  const rect = (r0, r1, e0, e1, col, pct) => `<rect x="${xs(r0).toFixed(1)}" y="${ys(e1).toFixed(1)}" width="${(xs(r1) - xs(r0)).toFixed(1)}" height="${(ys(e0) - ys(e1)).toFixed(1)}" fill="color-mix(in srgb, ${col} ${pct}%, transparent)"></rect>`;
  const zones =
    rect(0, 20, 50, 100, 'var(--clr-success)', 12) +   // top-left  green
    rect(20, 38, 50, 100, 'var(--clr-warning)', 12) +  // top-right amber
    rect(0, 12, 0, 50, 'var(--clr-success)', 12) +     // bottom-left green
    rect(12, 20, 0, 50, 'var(--clr-warning)', 12) +    // bottom-mid amber
    rect(20, 38, 0, 50, 'var(--clr-danger)', 14);      // bottom-right red (danger)
  const grid = [12, 20].map(v => `<line x1="${xs(v).toFixed(1)}" y1="${pT}" x2="${xs(v).toFixed(1)}" y2="${pB}" class="ex3-grid"></line>`).join('') +
    `<line x1="${pL}" y1="${ys(50).toFixed(1)}" x2="${pR}" y2="${ys(50).toFixed(1)}" class="ex3-grid"></line>`;
  const axes = `<line x1="${pL}" y1="${pB}" x2="${pR}" y2="${pB}" class="ex3-axis"></line><line x1="${pL}" y1="${pT}" x2="${pL}" y2="${pB}" class="ex3-axis"></line>`;
  const bubbles = assessed.map(k => {
    const eff = k.active ? Math.round(100 * k.effective / k.active) : 0;
    const r = Math.min(9, 4 + (k.active || 1));
    return `<circle cx="${xs(k.residual).toFixed(1)}" cy="${ys(eff).toFixed(1)}" r="${r}" fill="${ex3Zone(k).col}" fill-opacity="0.9" stroke="var(--bg2)" stroke-width="1.5"><title>${escHtml(k.title)} — residual ${k.residual}, ${eff}% effective</title></circle>`;
  }).join('');
  const xlabels = [0, 12, 20, 38].map(v => `<text x="${xs(v).toFixed(1)}" y="${pB + 16}" class="ex3-tick" text-anchor="middle">${v}</text>`).join('');
  const ylabels = [0, 50, 100].map(v => `<text x="${pL - 6}" y="${(ys(v) + 3).toFixed(1)}" class="ex3-tick" text-anchor="end">${v}%</text>`).join('');
  const titles = `<text x="${((pL + pR) / 2).toFixed(0)}" y="${H - 2}" class="ex3-axt" text-anchor="middle">Residual risk →</text>` +
    `<text x="11" y="${((pT + pB) / 2).toFixed(0)}" class="ex3-axt" text-anchor="middle" transform="rotate(-90 11 ${((pT + pB) / 2).toFixed(0)})">Control effectiveness →</text>`;
  const dzLabel = `<text x="${pR - 6}" y="${pB - 6}" class="ex3-dz" text-anchor="end">DANGER ZONE</text>`;
  return `<div class="ex3-quad-wrap">
    <svg viewBox="0 0 ${W} ${H}" class="ex3-quad" preserveAspectRatio="xMidYMid meet">${zones}${grid}${axes}${bubbles}${xlabels}${ylabels}${titles}${dzLabel}</svg>
    ${notAssessed ? `<div class="ex3-quad-note">${notAssessed} risk(s) not yet assessed (no residual) — excluded from the plot.</div>` : ''}
  </div>`;
}
// ── Sortable risk-assurance table (with Zone column) ──
let _ex3Rows = [], _ex3Sort = { col: null, dir: 1 };
const EX3_CONF_RANK = { na: 0, low: 1, med: 2, high: 3 };
const EX3_ZONE_RANK = { na: 0, green: 1, amber: 2, red: 3 };
const EX3_FIELD = {
  capName: k => k._capName || '', title: k => k.title || '', residual: k => k.residual || 0,
  implemented: k => k.active ? k.implemented / k.active : -1,
  tested: k => k.active ? k.tested / k.active : -1,
  effective: k => k.active ? k.effective / k.active : -1,
  conf: k => EX3_CONF_RANK[k.conf] ?? 0,
  zone: k => EX3_ZONE_RANK[ex3Zone(k).key],
};
function ex3SortRows() {
  if (!_ex3Sort.col) return _ex3Rows;
  const f = EX3_FIELD[_ex3Sort.col] || EX3_FIELD.residual, dir = _ex3Sort.dir;
  return _ex3Rows.slice().sort((a, b) => {
    const va = f(a), vb = f(b);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir || (a._capName || '').localeCompare(b._capName || '') || a.title.localeCompare(b.title);
    return String(va).localeCompare(String(vb)) * dir || a.title.localeCompare(b.title);
  });
}
function ex3Head() {
  const arrow = c => _ex3Sort.col === c ? `<span class="mrt-arrow">${_ex3Sort.dir === 1 ? '▲' : '▼'}</span>` : '';
  const th = (k, l, cls) => `<th class="mrt-sort${cls ? ' ' + cls : ''}" onclick="sortExec3('${k}')">${l}${arrow(k)}</th>`;
  return `<tr>${th('capName', 'Capability')}${th('title', 'Risk')}${th('residual', 'Residual', 'rp-num')}${th('implemented', 'Implemented', 'rp-num')}${th('tested', 'Tested', 'rp-num')}${th('effective', 'Effective', 'rp-num')}${th('conf', 'Confidence', 'rp-num')}${th('zone', 'Zone')}</tr>`;
}
function ex3Body(rows) {
  return rows.map(k => {
    const z = ex3Zone(k);
    return `<tr class="rp-row${k.isAct ? ' rp-act' : (k.elevated ? ' rp-elev' : '')}">
      <td class="rr-cap" title="${escHtml(k._capName)}">${escHtml(shortName(k._capName))}</td>
      <td><div class="rp-title">${escHtml(k.title)}</div></td>
      <td class="rp-num">${rpResCell(k)}</td>
      <td class="rp-num">${rpFrac(k.implemented, k.active)}</td>
      <td class="rp-num">${rpFrac(k.tested, k.active)}</td>
      <td class="rp-num">${rpFrac(k.effective, k.active, true)}</td>
      <td class="rp-num">${rpConfCell(k)}</td>
      <td><span class="ex3-zchip ex3-z-${z.key}">${z.label}</span></td>
    </tr>`;
  }).join('');
}
function sortExec3(col) {
  if (_ex3Sort.col === col) _ex3Sort.dir *= -1; else _ex3Sort = { col, dir: (col === 'capName' || col === 'title') ? 1 : -1 };
  const tb = document.getElementById('ex3-tbody'), th = document.getElementById('ex3-thead');
  if (tb) tb.innerHTML = ex3Body(ex3SortRows());
  if (th) th.innerHTML = ex3Head();
}
function ex3RiskTable(risks) {
  _ex3Rows = risks;
  _ex3Sort = { col: null, dir: 1 };
  return `<table class="rp-table rr-table">
    <thead id="ex3-thead">${ex3Head()}</thead>
    <tbody id="ex3-tbody">${ex3Body(ex3SortRows())}</tbody></table>`;
}
function renderExecControl3(currentA, prevA) {
  const facts   = currentA.riskPolicyFacts || [];
  const capName = id => (CONFIG.capabilities || []).find(c => c.id === id)?.name || id;
  const risks   = buildRiskProfile(facts);
  risks.forEach(k => { k._capName = capName(k.capId); });
  const ops     = buildBackingControlOps(currentA.policyRows || [], facts);
  const prevOps = prevA ? buildBackingControlOps(prevA.policyRows || [], prevA.riskPolicyFacts || []) : null;
  const head = desc => `<div class="measure-card-header">
      <span class="measure-icon">🎯</span>
      <div style="flex:1"><div class="exsc-eyebrow">Control 3</div><h3 class="measure-card-title">Control efficacy in treating risk</h3><p class="measure-card-desc">${desc}</p></div>
    </div>`;
  if (!risks.length) return `<div class="card measure-card">${head('No risk data uploaded for this assessment.')}</div>`;
  const danger = risks.filter(k => ex3Zone(k).key === 'red').length;
  const desc = `<b>${ops.liveEffective}</b>/${ops.total} backing controls live &amp; effective (${ops.pct}% ${execScDelta(ops.pct, prevOps ? prevOps.pct : null)}). Risks plotted by residual severity vs how effective their controls are — the red zone is high residual with weak controls${danger ? ` (<b class="dora-gap-num">${danger}</b> there)` : ''}.`;
  return `<div class="card measure-card">
    ${head(desc)}
    ${execQuadrant(risks)}
    <div class="rcsa-table-wrap">${ex3RiskTable(risks)}</div>
  </div>`;
}

// ── Close · What needs attention — the path to 100% ──────────────
// One prioritised list consolidating the gaps across all three controls plus
// the two hygiene anomalies, so the report ends on the closable work.
function renderExecAttention(currentA) {
  const doraRows = currentA.doraRows || [], policyRows = currentA.policyRows || [], facts = currentA.riskPolicyFacts || [];
  const model = buildDoraObligations(doraRows, policyRows, facts);
  const cov   = buildStatementCoverage(policyRows, facts);
  const ops   = buildBackingControlOps(policyRows, facts);
  const doc   = buildExecDocDetail(policyRows, facts);
  const cut = (arr, n = 6) => arr.slice(0, n).join(' · ') + (arr.length > n ? ` <span class="exa-more">+${arr.length - n} more</span>` : '');
  const ctrlLbl = c => (c.number ? c.number + ' — ' : '') + c.name;

  const uncovObl = model.obligations.filter(o => !o.covered);
  const stale    = doc.rows.filter(d => d.staleWaiver > 0);
  const noCtrl   = cov.uncovered;
  const invis    = doc.rows.filter(d => d.invisibleWork > 0);
  const gapCtrl  = ops.gap;

  const items = [
    { sev: 'high', cat: 'Uncovered DORA objecctives', n: uncovObl.length,
      action: 'No owned policy or group-standard statement — a Gate-1 compliance gap.',
      list: uncovObl.map(o => `${escHtml(o.obligationId)}${o.capability ? ' · ' + escHtml(o.capability) : ''}`) },
    { sev: 'high', cat: 'Stale / incorrect waivers', n: stale.reduce((s, d) => s + d.staleWaiver, 0),
      action: 'Waived statements that already have a live control — reclassify the waiver.',
      list: stale.map(d => `${escHtml(d.document)} (${d.staleWaiver})`) },
    { sev: 'med', cat: 'Statements with no control', n: noCtrl.length,
      action: 'Owned statements not backed by any control — assign or build one.',
      list: noCtrl.map(s => `${escHtml(s.ref)} · ${escHtml(shortName(s.capName))}`) },
    { sev: 'med', cat: 'Invisible work', n: invis.reduce((s, d) => s + d.invisibleWork, 0),
      action: 'Implemented / part-implemented statements with no control tracking them — add a control for evidence.',
      list: invis.map(d => `${escHtml(d.document)} (${d.invisibleWork})`) },
    { sev: 'med', cat: 'Controls not yet live & effective', n: gapCtrl.length,
      action: 'Backing controls drafted or not yet effective — operationalise them.',
      list: gapCtrl.map(c => `${escHtml(ctrlLbl(c))} <span class="exa-tag">${c.implemented ? 'not effective' : 'not live'}</span>`) },
  ].filter(it => it.n > 0);

  const total = items.reduce((s, it) => s + it.n, 0);
  const head = desc => `<div class="measure-card-header">
      <span class="measure-icon">✅</span>
      <div style="flex:1"><div class="exsc-eyebrow">Close · Path to 100%</div><h3 class="measure-card-title">What needs attention</h3><p class="measure-card-desc">${desc}</p></div>
    </div>`;
  if (!items.length) {
    return `<div class="card measure-card">${head('Nothing outstanding across the three controls.')}<p class="exa-done">✓ Every obligation is covered, every statement is backed, and every backing control is live &amp; effective.</p></div>`;
  }
  const rows = items.map(it => `<div class="exa-item exa-${it.sev}">
    <div class="exa-body">
      <div class="exa-top"><span class="exa-cat">${it.cat}</span><span class="exa-n">${it.n}</span></div>
      <div class="exa-action">${it.action}</div>
      <div class="exa-drill">${cut(it.list)}</div>
    </div>
  </div>`).join('');
  return `<div class="card measure-card">
    ${head(`<b>${total}</b> item${total === 1 ? '' : 's'} to close, in priority order.`)}
    <div class="exa-list">${rows}</div>
  </div>`;
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
    `<div class="rtmf-lg"><i style="background:${it.color}"></i><b>${it.value}</b> <span>${escHtml(it.label)} (${it.pct}%)${it.trend || ''}</span></div>`).join('')}</div>`;
}
function rtmfUnit(donut, legend) {
  return `<div class="rtmf-unit">${donut}<div>${legend}</div></div>`;
}
// ── IT Risk & Control Framework — all risks, with q-o-q trend arrows ──
const EXEC_CONF_SCORE = { high: 3, med: 2, low: 1, na: 0 };
const EXEC_BAND_WORD = { extreme: 'Extreme', significant: 'Significant', moderate: 'Moderate', low: 'Low', na: 'Not assessed' };
const EXEC_CONF_WORD = { high: 'High', med: 'Medium', low: 'Low', na: 'n/a' };
let _erRows = [];
let _erPrevMap = {};
let _erSort = { col: null, dir: 1 };
const ER_FIELD = {
  capName:     r => r._capName || '',
  title:       r => r.title || '',
  residual:    r => r.residual || 0,
  controls:    r => r.active || 0,
  implemented: r => r.active ? r.implemented / r.active : -1,
  tested:      r => r.active ? r.tested / r.active : -1,
  effective:   r => r.active ? r.effective / r.active : -1,
  conf:        r => EXEC_CONF_SCORE[r.conf] ?? 0,
};
function erSortRows() {
  if (!_erSort.col) return _erRows;   // default: buildRiskProfile's worst-first order
  const f = ER_FIELD[_erSort.col] || ER_FIELD.title;
  const dir = _erSort.dir;
  return _erRows.slice().sort((a, b) => {
    const va = f(a), vb = f(b);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir || (a.title || '').localeCompare(b.title || '');
    return String(va).localeCompare(String(vb)) * dir || (a.title || '').localeCompare(b.title || '');
  });
}
function erHead() {
  const arrow = c => _erSort.col === c ? `<span class="mrt-arrow">${_erSort.dir === 1 ? '▲' : '▼'}</span>` : '';
  const th = (k, label, cls) => `<th class="mrt-sort${cls ? ' ' + cls : ''}" onclick="sortExecRisk('${k}')">${label}${arrow(k)}</th>`;
  return `<tr>
    ${th('capName', 'Capability')}
    ${th('title', 'Risk')}
    ${th('residual', 'Residual', 'rp-num')}
    ${th('controls', 'Controls', 'rp-num')}
    ${th('implemented', 'Implemented', 'rp-num')}
    ${th('tested', 'Tested', 'rp-num')}
    ${th('effective', 'Effective', 'rp-num')}
    ${th('conf', 'Confidence', 'rp-num')}
  </tr>`;
}
function erBody(rows) {
  return rows.map(k => {
    const pv = _erPrevMap[ftNorm(k.title)];
    const cls = 'rp-row' + (k.isAct ? ' rp-act' : (k.elevated ? ' rp-elev' : ''));
    const owner = (k.owner || '').trim();
    const tr = (val, pval, dir) => pv ? qoqTrend(val, pval, dir) : '';
    return `<tr class="${cls}">
      <td class="rr-cap" title="${escHtml(k._capName)}">${escHtml(shortName(k._capName))}</td>
      <td><div class="rp-title">${escHtml(k.title)}</div>${owner ? `<div class="rp-owner">Risk owner &middot; ${escHtml(owner)}</div>` : ''}</td>
      <td class="rp-num">${rpResCell(k)}${pv ? qoqTrend(k.residual, pv.residual, 'downGood', EXEC_BAND_WORD[pv.band] || pv.residual) : ''}</td>
      <td class="rp-num"><b>${k.active}</b>${tr(k.active, pv && pv.active, 'upGood')}</td>
      <td class="rp-num">${rpFrac(k.implemented, k.active)}${tr(k.implemented, pv && pv.implemented, 'upGood')}</td>
      <td class="rp-num">${rpFrac(k.tested, k.active)}${tr(k.tested, pv && pv.tested, 'upGood')}</td>
      <td class="rp-num">${rpFrac(k.effective, k.active, true)}${tr(k.effective, pv && pv.effective, 'upGood')}</td>
      <td class="rp-num">${rpConfCell(k)}${pv ? qoqTrend(EXEC_CONF_SCORE[k.conf], EXEC_CONF_SCORE[pv.conf], 'upGood', EXEC_CONF_WORD[pv.conf] || pv.conf) : ''}</td>
    </tr>`;
  }).join('');
}
function sortExecRisk(col) {
  if (_erSort.col === col) _erSort.dir *= -1;
  else _erSort = { col, dir: (col === 'title' || col === 'capName') ? 1 : -1 };
  const tb = document.getElementById('er-tbody');
  const th = document.getElementById('er-thead');
  if (tb) tb.innerHTML = erBody(erSortRows());
  if (th) th.innerHTML = erHead();
}
function renderExecRiskCard(current, prev) {
  const capName = id => (CONFIG.capabilities || []).find(c => c.id === id)?.name || id;
  const risks = buildRiskProfile(current.riskPolicyFacts || []);
  risks.forEach(k => { k._capName = capName(k.capId); });
  _erPrevMap = {};
  if (prev) buildRiskProfile(prev.riskPolicyFacts || []).forEach(k => { _erPrevMap[ftNorm(k.title)] = k; });
  const title = 'IT Risk &amp; Control Framework';
  const desc = 'Every ICT risk, the controls behind it and its assurance — with how each metric moved since last quarter (▲/▼).';
  const elevOn = window._rpElevated !== false;
  const header = `
    <div class="measure-card-header">
      <span class="measure-icon">🛡️</span>
      <div style="flex:1"><h3 class="measure-card-title">${title}</h3><p class="measure-card-desc">${desc}</p></div>
      ${risks.length ? rpElevToggle() : ''}
    </div>`;
  if (!risks.length) {
    return `<div class="card measure-card">${header}<p class="policy-no-data" style="margin:.5rem 0">No risk data uploaded yet.</p></div>`;
  }
  _erRows = risks;
  _erSort = { col: null, dir: 1 };
  return `
    <div class="card measure-card rp-card${elevOn ? ' rp-elevated' : ''}">
      ${header}
      <div class="rcsa-table-wrap">
        <table class="rp-table">
          <thead id="er-thead">${erHead()}</thead>
          <tbody id="er-tbody">${erBody(erSortRows())}</tbody>
        </table>
      </div>
    </div>`;
}

let _rtmFunnelData = null;
let _rtmMaturityData = null;
function renderRtmFunnel(assessment, prev) {
  const f = buildRtmFunnel(assessment.policyRows || [], assessment.riskPolicyFacts || []);
  const pf = prev ? buildRtmFunnel(prev.policyRows || [], prev.riskPolicyFacts || []) : null;
  const pmat = prev ? buildRtmMaturity(prev.policyRows || [], prev.riskPolicyFacts || []) : null;
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
  const prevSrc = name => pf ? (pf.sources.find(s => s.name === name) || {}).count : null;
  const typeSegs = f.sources.map((s, i) => ({ value: s.count, color: RTMF_TYPE_COLORS[i % RTMF_TYPE_COLORS.length] }));
  const typeLegend = f.sources.map((s, i) => ({ value: s.count, label: s.name, pct: pOf(s.count, f.total), color: RTMF_TYPE_COLORS[i % RTMF_TYPE_COLORS.length], trend: qoqTrend(s.count, prevSrc(s.name), 'neutral') }));

  // Layer 3 — RTM maturity (5 states) split by source
  const cWaive = 'color-mix(in srgb, var(--text-muted) 55%, var(--track))';
  const MAT_COLORS = { treated: cBuild, incomplete: cReuse, proposed: cDraft, notTreated: cWaive, notPerformed: cUnc };
  const mat = buildRtmMaturity(assessment.policyRows || [], assessment.riskPolicyFacts || []);
  _rtmMaturityData = mat;
  const matDonut = rtmfDonut(mat.states.map(s => ({ value: mat.total[s.key], color: MAT_COLORS[s.key] })), mat.total.total, 'RTMs');
  // Only "treated" going up is good; every other (un-treated) state going up is bad.
  const MAT_DIR = { treated: 'upGood', incomplete: 'downGood', proposed: 'downGood', notTreated: 'downGood', notPerformed: 'downGood' };
  const matTrend = (src, key) => pmat ? qoqTrend(mat.bySource[src][key] || 0, pmat.bySource[src][key] || 0, MAT_DIR[key]) : '';
  const matRow = s => `<tr>
    <td class="rtmf-mstate"><span class="rtmf-mhd"><i class="rtmf-sw" style="background:${MAT_COLORS[s.key]}"></i><span class="rtmf-ml">${escHtml(s.label)}</span></span><span class="rtmf-mmean">${escHtml(s.meaning)}</span></td>
    <td class="rtmf-mc">${mat.bySource['Local Policy'][s.key] || 0}${matTrend('Local Policy', s.key)}</td>
    <td class="rtmf-mc">${mat.bySource['Group Standards'][s.key] || 0}${matTrend('Group Standards', s.key)}</td>
  </tr>`;
  const matTable = `<table class="rtmf-mtable">
    <thead><tr><th></th><th class="rtmf-mc">Local Policy</th><th class="rtmf-mc">Group Std</th></tr></thead>
    <tbody>${mat.states.map(matRow).join('')}</tbody>
    <tfoot><tr><td class="rtmf-mstate rtmf-mtot">Total</td><td class="rtmf-mc">${mat.bySource['Local Policy'].total}</td><td class="rtmf-mc">${mat.bySource['Group Standards'].total}</td></tr></tfoot>
  </table>`;

  // Layer 4 — control framework (control axis)
  const ctrlDonut = rtmfDonut([{ value: f.ctrlMapped, color: 'var(--clr-success)' }, { value: f.ctrlUnmapped, color: 'var(--clr-danger)' }], f.ctrlTotal, 'controls');
  const ctrlLegend = rtmfLegend([
    { value: f.ctrlMapped,   label: 'Mapped to a RTM', pct: pOf(f.ctrlMapped, f.ctrlTotal),   color: 'var(--clr-success)', trend: qoqTrend(f.ctrlMapped, pf && pf.ctrlMapped, 'upGood') },
    { value: f.ctrlUnmapped, label: 'Not mapped to RTM - No reason for running', pct: pOf(f.ctrlUnmapped, f.ctrlTotal), color: 'var(--clr-danger)', trend: qoqTrend(f.ctrlUnmapped, pf && pf.ctrlUnmapped, 'downGood') },
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
        <div class="rtmf-eyebrow"><span class="rtmf-num">3</span><span class="rtmf-lname">Planning &mdash; Risk-Treatment Measures to Controls</span><span class="rtmf-lsub">RTM maturity: how well each risk-treatment measure is treated</span><button class="btn-link rtmf-detail no-print" onclick="showFunnelDetail('planning')">ℹ Detail</button></div>
        <div class="rtmf-units rtmf-matunits">
          <div class="rtmf-matdonut">${matDonut}</div>
          <div class="rtmf-matwrap">${matTable}</div>
        </div>
        <div class="rtmf-cap"><b>${mat.total.treated}</b>${pmat ? qoqTrend(mat.total.treated, pmat.total.treated, 'upGood') : ''} of ${mat.total.total} RTM's treated &mdash; consistent &amp; repeatable &nbsp;&middot;&nbsp; <b>${mat.total.notPerformed}</b>${pmat ? qoqTrend(mat.total.notPerformed, pmat.total.notPerformed, 'downGood') : ''} performed ad hoc (invisible / key-person)</div>
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
    const m = _rtmMaturityData || { total: {} };
    const t = m.total;
    title = 'Layer 3 · RTM maturity — how to reconcile';
    intro = 'Each RTM is placed in one of five maturity states, combining <b>Planning Status</b> (the control) with the <b>Exception</b> column. Filter, then de-duplicate on Capability + Statement Ref; split by <b>RTM Source</b> for the Local Policy / Group Standards columns.';
    items =
      item(t.treated || 0, 'Treated', 'Control implemented and no exception — consistent, repeatable.', `<b>Planning Status = Built new</b> OR <b>Reused pre-DORA</b>, AND <b>Exception</b> is blank. ${dedupRtm}`) +
      item(t.incomplete || 0, 'Incomplete / suspended', 'A control exists (drafted or implemented) but an exception is open — WT: incomplete/fixing; E/WP: suspended.', `<b>Planning Status = Built new</b>, <b>Reused pre-DORA</b> or <b>Drafted</b>, AND <b>Exception</b> is <b>E</b>, <b>WT</b> or <b>WP</b>. ${dedupRtm}`) +
      item(t.proposed || 0, 'Proposed', 'Control drafted, no exception — reactive, unstructured, key-person dependent.', `<b>Planning Status = Drafted</b> AND <b>Exception</b> is blank. ${dedupRtm}`) +
      item(t.notTreated || 0, 'Not treated', 'No control, but an exception is filed — accepted / waived (E/WT/WP).', `<b>Planning Status = Uncovered</b> AND <b>Exception</b> is <b>E</b>, <b>WT</b> or <b>WP</b>. ${dedupRtm}`) +
      item(t.notPerformed || 0, 'Performed ad hoc', 'No control and no exception — not performed or done ad hoc, key-person dependent.', `<b>Planning Status = Uncovered</b> AND <b>Exception</b> is blank. ${dedupRtm}`);
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
