// ══════════════════════════════════════════════════════════════════
// Board report — the DORA Reporting screen as a board paper.
// Reads the same builders as the working report (scorecard metrics, capability
// summaries, backing-control ops, risk profile) and presents them as one story:
// a plain-language headline, the policy → proof stages, the three things the
// board should know, a per-capability table and the ranked residual risks.
// The working detail cards follow in a collapsible appendix.
// ══════════════════════════════════════════════════════════════════

// Status vocabulary shared by the board summary and the live trace.
const BD_RAG = {
  red:   { label: 'At risk',         cls: 'bd-tone-gap' },
  amber: { label: 'Needs attention', cls: 'bd-tone-warn' },
  green: { label: 'On track',        cls: 'bd-tone-ok' },
};

// Control names arrive as "CTRL-1001 — LocPol — Asset inventory completeness [LP-01 PS01]".
// Split out the number and drop the source tag and statement ref for display.
function bdCtrlParts(raw) {
  let name = String(raw || '').trim();
  let num = '';
  const m = name.match(/^([A-Z][A-Z0-9]*-\d+)\s*[—-]\s*/);
  if (m) { num = m[1]; name = name.slice(m[0].length); }
  name = name.replace(/^(LocPol|GrpStd)\s*[—-]\s*/, '').replace(/\s*\[[^\]]*\]\s*$/, '').trim();
  return { num, name: name || String(raw || '') };
}

// Capability summaries for every dimension value that has data, worst first.
function bdCapSummaries(currentA) {
  const dims = (typeof lensDims === 'function') ? lensDims(currentA) : [];
  const rank = { red: 0, amber: 1, green: 2 };
  return dims.map(d => buildCapabilitySummary(currentA, d.id, 'all'))
    .filter(s => s && s.hasData)
    .map(s => Object.assign(s, { capId: s.id.replace(/^cap:/, '') }))
    .sort((a, b) => (rank[a.rag] ?? 3) - (rank[b.rag] ?? 3) || a.scorecard.effective.pct - b.scorecard.effective.pct);
}

// Risks that threaten objectives of the active lens, with residual band and
// whether each dropped a band since the previous quarter (same rules as the
// Control-3 heatmap: HIGH ≥ 20 · MODERATE 12–19 · LOW < 12).
function bdRisks(currentA, prevA) {
  const LFac = a => (typeof lensFacts === 'function') ? lensFacts(a) : (a.riskPolicyFacts || []);
  const sevOf = r => r >= 20 ? 0 : r >= 12 ? 1 : 2;
  const titles = execDoraRiskTitles(currentA);
  const prevSev = {};
  if (prevA) {
    const pT = execDoraRiskTitles(prevA);
    buildRiskProfile(LFac(prevA)).filter(k => pT.has(k.title)).forEach(k => { if ((k.residual || 0) > 0) prevSev[k.title] = sevOf(k.residual); });
  }
  const capNm = id => { const c = (CONFIG.capabilities || []).find(x => x.id === id); return c ? c.name : (id || ''); };
  return buildRiskProfile(LFac(currentA)).filter(k => titles.has(k.title)).map(k => {
    const r = k.residual || 0;
    const sev = r > 0 ? sevOf(r) : 3;
    const capName = capNm(k.capId);
    const pillarId = (typeof doraPillarForCapabilityName === 'function') ? doraPillarForCapabilityName(capName) : 'riskmgmt';
    return { title: k.title, residual: r, sev, pillarId, capId: k.capId, capName, dropped: r > 0 && prevSev[k.title] != null && sev > prevSev[k.title] };
  }).sort((a, b) => a.sev - b.sev || b.residual - a.residual);
}

// Board Summary — DORA-only (generateDoraForumReport pins the DORA lens). The
// "By capability" table is split into one card per DORA pillar (the authoritative
// capability→pillar rule in dora-pillars.js), and the risks are grouped under the
// pillar they threaten. Pillar order mirrors the DORA chapters the board tracks:
// Incident (III) · Third-Party (V) · Resilience Testing (IV, InfoSec) · Risk Mgmt (II).
const BD_PILLAR_ORDER = ['incident', 'thirdparty', 'testing', 'riskmgmt'];
function bdPillarDef(pid) {
  return ((typeof DORA_PILLARS !== 'undefined' && DORA_PILLARS) || []).find(p => p.id === pid) || { name: pid };
}

function renderBoardSummary(currentA, prevA) {
  const m = execScorecardMetrics(currentA, prevA);
  const LL = m.LL;
  const app = (CONFIG && CONFIG.appTitle) || 'Measurable IT Regulatory Oversight Model';
  const caps = bdCapSummaries(currentA);
  const dimLbl = (typeof lensDimLabel === 'function') ? lensDimLabel() : 'Capability';

  const cell = sc => `<span class="bd-cap-cell"><b>${sc.d ? sc.pct + '%' : '—'}</b><span class="bd-bar bd-bar-sm"><i class="${sc.pct >= 100 ? 'bd-fill-ok' : sc.pct > 0 ? '' : 'bd-fill-gap'}" style="width:${sc.pct}%"></i></span></span>`;
  const capRow = c => {
    const rag = BD_RAG[c.rag] || BD_RAG.amber;
    return `<button type="button" class="bd-cap-row" onclick="boardOpenLens('${escHtml(c.capId)}')">
      <span class="bd-cap-name">${escHtml(c.name)}<small>${escHtml(c.short || '')}</small></span>
      ${cell(c.scorecard.documented)}${cell(c.scorecard.operationalised)}${cell(c.scorecard.effective)}
      <span class="bd-chip ${rag.cls}">${rag.label}</span>
    </button>`;
  };

  // One collapsible section per DORA pillar (collapsed by default, like the RICA
  // and Control Coverage capability sections): the "By capability" table
  // filtered to that pillar's capabilities. Pillars with no in-scope capability
  // show their out-of-scope note on the header and don't expand.
  const RANK = { red: 0, amber: 1, green: 2 };
  const chev = '<svg class="bd-art-chev" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const pillarCard = pid => {
    const pdef = bdPillarDef(pid);
    const rows = caps.filter(c => (typeof doraPillarForCapabilityName === 'function') && doraPillarForCapabilityName(c.name) === pid);
    const chap = pdef.chapter ? `Chapter ${pdef.chapter}` : '';
    if (!rows.length) {
      const note = pdef.outNote || (pdef.inScope ? 'No capabilities with data in this pillar yet.' : 'Out of scope for us.');
      return `<section class="bd-art bd-pillar">
        <h2 class="bd-pillar-h"><span class="bd-art-hd bd-art-hd-static"><i class="bd-dot" aria-hidden="true"></i><span class="bd-art-title">${escHtml(pdef.name)}</span><span class="bd-art-meta">${chap ? escHtml(chap) + ' · ' : ''}${escHtml(note)}</span></span></h2>
      </section>`;
    }
    const worst = rows.reduce((w, c) => (RANK[c.rag] ?? 1) < (RANK[w] ?? 1) ? c.rag : w, 'green');
    const needs = rows.filter(c => c.rag !== 'green').length;
    const meta = `${chap ? chap + ' · ' : ''}${rows.length} capabilit${rows.length === 1 ? 'y' : 'ies'}${needs ? ` · ${needs} need${needs === 1 ? 's' : ''} attention` : ''}`;
    return `<section class="bd-art bd-pillar">
      <h2 class="bd-pillar-h"><button type="button" class="bd-art-hd" aria-expanded="false" onclick="bdTogglePillar(this)">
        <i class="bd-dot bd-dot-${worst}" aria-hidden="true"></i>
        <span class="bd-art-title">${escHtml(pdef.name)}</span>
        <span class="bd-art-meta">${escHtml(meta)}</span>${chev}
      </button></h2>
      <div class="bd-art-body" hidden>
        <div class="bd-table-wrap"><div class="bd-cap-table">
          <div class="bd-cap-head"><span>${escHtml(dimLbl)}</span><span>Documented</span><span>Implemented</span><span>Effective</span><span>Status</span></div>
          ${rows.map(capRow).join('')}
        </div></div>
      </div>
    </section>`;
  };
  const pillarCards = BD_PILLAR_ORDER.map(pillarCard).join('');

  return `
  <div class="bd-summary">
    <div class="bd-top">
      <div>
        <div class="exsc-eyebrow">◈ ${escHtml(app)}</div>
        <h2 class="exsc-title bd-doc-title">${escHtml(LL)} Operationalisation Scorecard</h2>
        <div class="bd-sub">${escHtml(currentA.label)} · ${formatDate(currentA.date)}${prevA ? ` · compared with ${escHtml(prevA.label)}` : ''}</div>
      </div>
      <div class="bd-actions no-print">
        <button type="button" class="bd-btn bd-btn-primary" onclick="boardOpenLens()">Open live view <span aria-hidden="true">→</span></button>
        <button type="button" class="bd-btn" onclick="window.print()">Print / save PDF</button>
      </div>
    </div>

    <section class="bd-sec" aria-labelledby="bd-pillars-h">
      <div class="bd-sec-hd"><h2 id="bd-pillars-h">By DORA pillar</h2><span class="no-print">Open a pillar, then select a capability to trace it in the live view</span></div>
      <div class="bd-pillars">${pillarCards}</div>
    </section>

    ${renderBoardGaps(currentA, caps)}
    ${renderBoardFixFirst(currentA)}
  </div>`;
}

// ── Gaps for the next review cycle (are our policies / group standards aligned
// with DORA?) ── Per capability: the applicable DORA objectives our policy does
// not document, those our group standard does not document (each noting whether
// the other source covers it — an objective counts as documented if either
// does), and our statements that map to no DORA objective.
function renderBoardGaps(currentA, caps) {
  const chev = '<svg class="bd-art-chev" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const objsOf = tree => tree.filter(a => !a.noArt).flatMap(a => a.objectives.map(o => Object.assign({ article: a.article }, o)));
  const isCov = o => o.covered === 'Yes' && o.statements.length > 0;
  const sections = caps.map(c => {
    const all = buildCapabilityTree(currentA, c.capId, 'all');
    const objs = objsOf(all);
    if (!objs.length && !all.some(a => a.noArt)) return '';
    const covBy = src => new Set(objsOf(buildCapabilityTree(currentA, c.capId, src)).filter(isCov).map(o => o.id));
    const pol = covBy('policy'), grp = covBy('group');
    const stmts = all.flatMap(a => a.objectives.flatMap(o => o.statements));
    const docs = new Map();
    stmts.forEach(s => { if (!docs.has(s.document)) docs.set(s.document, s.source); });
    const hasSrc = label => [...docs.values()].includes(label);
    const unmapped = all.filter(a => a.noArt).flatMap(a => a.objectives.flatMap(o => o.statements));
    const polGap = objs.filter(o => !pol.has(o.id)), grpGap = objs.filter(o => !grp.has(o.id));
    const nowhere = objs.filter(o => !pol.has(o.id) && !grp.has(o.id)).length;
    const objLi = (o, other, otherName) => `<li class="bd-gap-li">
        <span class="bd-code">${escHtml(o.id || '')}</span>
        <span class="bd-gap-li-text">${escHtml(o.text || '')}<small>${escHtml(o.article)}</small></span>
        ${other.has(o.id) ? `<span class="bd-chip bd-tone-muted">${escHtml(otherName)} covers it</span>` : '<span class="bd-chip bd-tone-gap">Not documented anywhere</span>'}
      </li>`;
    const list = (label, srcLabel, gaps, other, otherName) => `<div class="bd-gap-col">
        <h4>Not in our ${escHtml(label)}</h4>
        ${!hasSrc(srcLabel) ? `<p class="bd-gap-none">No ${escHtml(label)} for this capability — none of its ${objs.length} objective${objs.length === 1 ? ' is' : 's are'} documented in one.</p>`
          : gaps.length ? `<ul class="bd-gap-list">${gaps.map(o => objLi(o, other, otherName)).join('')}</ul>`
          : `<p class="bd-gap-none bd-gap-ok">Every applicable objective is documented.</p>`}
      </div>`;
    const meta = [
      hasSrc('Local Policy') ? `Policy misses ${polGap.length}` : 'No policy',
      hasSrc('Group Standard') ? `Group standard misses ${grpGap.length}` : 'No group standard',
      `${unmapped.length} statement${unmapped.length === 1 ? '' : 's'} not mapped to DORA`,
    ].join(' · ');
    const tone = nowhere ? 'gap' : (polGap.length || grpGap.length || unmapped.length) ? 'warn' : 'ok';
    return `<section class="bd-art bd-fold bd-gapcap">
      <h3 class="bd-pillar-h"><button type="button" class="bd-art-hd" aria-expanded="false" onclick="bdTogglePillar(this)">
        <i class="bd-dot bd-dot-${tone}" aria-hidden="true"></i>
        <span class="bd-art-title">${escHtml(c.name)}</span>
        <span class="bd-art-meta">${escHtml(meta)}</span>${chev}
      </button></h3>
      <div class="bd-art-body" hidden>
        <p class="bd-gap-docs">${docs.size ? [...docs].map(([d, src]) => `${escHtml(d)} <span class="bd-gap-src">(${escHtml(src)})</span>`).join(' · ') : 'No documents mapped yet.'}</p>
        <div class="bd-gap-cols">
          ${list('policy', 'Local Policy', polGap, grp, 'Group standard')}
          ${list('group standard', 'Group Standard', grpGap, pol, 'Policy')}
        </div>
        <div class="bd-gap-col">
          <h4>Our statements not mapped to a DORA objective</h4>
          ${unmapped.length ? `<ul class="bd-gap-list">${unmapped.map(s => `<li class="bd-gap-li"><span class="bd-code">${escHtml(s.ref || '')}</span><span class="bd-gap-li-text">${escHtml(s.header || '')}<small>${escHtml(s.document || '')}</small></span><span class="bd-chip bd-tone-muted">${escHtml(s.source || '')}</span></li>`).join('')}</ul>`
            : '<p class="bd-gap-none bd-gap-ok">Every statement maps to a DORA objective.</p>'}
        </div>
      </div>
    </section>`;
  }).filter(Boolean);
  if (!sections.length) return '';
  return `<section class="bd-sec" aria-labelledby="bd-gaps-h">
    <div class="bd-sec-hd"><h2 id="bd-gaps-h">Gaps for the next review cycle</h2><span>DORA objectives our policies and group standards don't document, and our statements DORA doesn't ask for</span></div>
    <div class="bd-pillars">${sections.join('')}</div>
  </section>`;
}

// ── Fix first (are documented objectives implemented by controls that work?) ──
// Every control that isn't yet effective and backs a DORA objective or treats a
// risk that threatens one, ranked by the highest residual risk it is meant to
// reduce, then by how many DORA objectives depend on it.
function renderBoardFixFirst(currentA) {
  const LPol = (typeof lensPolicy === 'function') ? lensPolicy(currentA) : (currentA.policyRows || []);
  const LFac = (typeof lensFacts === 'function') ? lensFacts(currentA) : (currentA.riskPolicyFacts || []);
  const ops = buildBackingControlOps(LPol, LFac);
  const residual = new Map(buildRiskProfile(LFac).map(k => [k.title, k.residual || 0]));
  const doraRisks = execDoraRiskTitles(currentA);
  const objsByCtrl = new Map();
  buildTraceabilityRows(currentA).rows.forEach(r => {
    if (!r._cKey || !r._oKey) return;
    (objsByCtrl.get(r._cKey) || objsByCtrl.set(r._cKey, new Map()).get(r._cKey)).set(r._oKey, r.objective || r.article || '');
  });
  const band = r => r >= 20 ? ['High', 'gap'] : r >= 12 ? ['Moderate', 'warn'] : r > 0 ? ['Low', 'ok'] : ['Not assessed', 'muted'];
  const items = ops.controls.filter(c => !c.liveEffective).map(c => {
    const objs = objsByCtrl.get(c.capId + '|' + ftNorm(c.number) + '|' + ftNorm(c.name)) || new Map();
    const risks = [...(c.risks || [])].map(t => ({ title: t, residual: residual.get(t) || 0 })).sort((a, b) => b.residual - a.residual);
    const top = risks.length ? risks[0].residual : 0;
    return Object.assign({}, c, { objs, risks, top, label: bdCtrlParts(c.number ? `${c.number} — ${c.name}` : c.name) });
  }).filter(c => c.objs.size || c.risks.some(r => doraRisks.has(r.title)))
    .sort((a, b) => b.top - a.top || b.objs.size - a.objs.size || String(a.label.num).localeCompare(String(b.label.num)));
  if (!items.length) return '';
  const rows = items.map((c, i) => {
    const st = c.implemented ? ['Live, not yet effective', 'warn'] : ['Draft', 'draft'];
    return `<div class="bd-fix-row">
      <span class="bd-fix-rank">${i + 1}</span>
      <span class="bd-fix-ctrl"><span class="bd-code">${escHtml(c.label.num || c.number || '')}</span><b>${escHtml(c.label.name)}</b><span class="bd-chip bd-tone-${st[1]}">${st[0]}</span><small>${escHtml(c.capName || '')}${c.owner ? ' · ' + escHtml(c.owner) : ''}</small></span>
      <span class="bd-fix-risks">${c.risks.length ? c.risks.map(r => { const b = band(r.residual); return `<span class="bd-fix-risk"><span>${escHtml(r.title)}</span><b>${r.residual || '—'}</b><span class="bd-chip bd-tone-${b[1]}">${b[0]}</span></span>`; }).join('') : '<span class="bd-gap-none">No risk linked</span>'}</span>
      <span class="bd-fix-objs"><span><b>${c.objs.size}</b> DORA objective${c.objs.size === 1 ? '' : 's'}</span>${c.objs.size ? `<small>${[...c.objs.keys()].map(escHtml).join(' · ')}</small>` : ''}</span>
    </div>`;
  }).join('');
  return `<section class="bd-sec" aria-labelledby="bd-fix-h">
    <div class="bd-sec-hd"><h2 id="bd-fix-h">Fix first</h2><span>Controls not yet effective, ranked by the residual risk they should reduce, then the DORA objectives that depend on them</span></div>
    <div class="bd-table-wrap"><div class="bd-fix-table">
      <div class="bd-fix-head"><span>#</span><span>Control</span><span>Risks it treats (residual)</span><span>Protects</span></div>
      ${rows}
    </div></div>
  </section>`;
}

// Open / close a collapsible board section in place (its content is already rendered).
function bdTogglePillar(btn) {
  const sec = btn.closest('.bd-art');
  const body = sec && sec.querySelector('.bd-art-body');
  if (!body) return;
  const open = body.hidden;
  body.hidden = !open;
  sec.classList.toggle('is-open', open);
  btn.setAttribute('aria-expanded', String(open));
}

// Risks that threaten DORA objectives, grouped under the DORA pillar they
// threaten (the risk's owning capability → pillar). Shown in the Appendix.
function renderBoardRisks(currentA, prevA) {
  const LL = (typeof lensLabel === 'function') ? lensLabel() : 'DORA';
  const risks = bdRisks(currentA, prevA);
  if (!risks.length) return '';
  const BAND = [['High', 'bd-tone-gap'], ['Moderate', 'bd-tone-warn'], ['Low', 'bd-tone-ok'], ['Not assessed', 'bd-tone-muted']];
  const riskHead = `<div class="bd-risk-head"><span>Capability</span><span>Risk</span><span>Residual</span><span>Band</span></div>`;
  const riskRow = r => `<div class="bd-risk-row">
      <span class="bd-risk-cap">${escHtml(r.capName || '—')}</span>
      <span class="bd-risk-name">${escHtml(r.title)}${r.dropped ? ' <small>▼ down a band</small>' : r.sev === 3 ? ' <small>no current RCSA rating</small>' : ''}</span>
      <span class="bd-risk-score"><span class="bd-bar"><i class="${BAND[r.sev][1]}" style="width:${Math.min(100, r.residual / 25 * 100)}%"></i></span><b>${r.sev === 3 ? '—' : r.residual}</b></span>
      <span class="bd-chip ${BAND[r.sev][1]}">${BAND[r.sev][0]}</span>
    </div>`;
  const seenPillars = BD_PILLAR_ORDER.slice();
  risks.forEach(r => { if (!seenPillars.includes(r.pillarId)) seenPillars.push(r.pillarId); });
  const riskGroups = seenPillars.map(pid => {
    // Within a pillar, group the risks by the capability they impact (cluster
    // same-capability risks together), then by severity / residual.
    const rs = risks.filter(r => r.pillarId === pid).slice()
      .sort((a, b) => String(a.capName).localeCompare(String(b.capName)) || a.sev - b.sev || b.residual - a.residual);
    if (!rs.length) return '';
    return `<div class="bd-risk-group">
      <h3 class="bd-risk-pillar">${escHtml(bdPillarDef(pid).name)}<span class="bd-risk-pillar-n">${rs.length} risk${rs.length === 1 ? '' : 's'}</span></h3>
      <div class="bd-risks">${riskHead}${rs.map(riskRow).join('')}</div>
    </div>`;
  }).join('');
  return `<div class="card measure-card bd-risks-card">
    <p class="bd-risks-note">Risks that threaten ${escHtml(LL)} objectives, grouped by DORA pillar · residual after controls · High ≥ 20 · Moderate 12–19 · Low &lt; 12</p>
    ${riskGroups}
  </div>`;
}

// The working detail cards, each folded under a heading. Opened for printing so
// the PDF still carries the full evidence.
function renderBoardAppendix(sections) {
  return `<section class="bd-appx-wrap" aria-labelledby="bd-appx-h">
    <h2 id="bd-appx-h" class="bd-appx-title">Appendix</h2>
    ${sections.filter(([, html]) => html).map(([title, html]) => `<details class="bd-appx"><summary>${escHtml(title)}</summary><div class="exec-rcsa-wrap">${html}</div></details>`).join('')}
  </section>`;
}
window.addEventListener('beforeprint', () => {
  document.querySelectorAll('.bd-appx').forEach(d => { d.dataset.wasOpen = d.open ? '1' : ''; d.open = true; });
  document.querySelectorAll('.bd-pillar .bd-art-body, .bd-fold .bd-art-body').forEach(b => { b.dataset.wasHidden = b.hidden ? '1' : ''; b.hidden = false; });
});
window.addEventListener('afterprint', () => {
  document.querySelectorAll('.bd-appx').forEach(d => { d.open = d.dataset.wasOpen === '1'; });
  document.querySelectorAll('.bd-pillar .bd-art-body, .bd-fold .bd-art-body').forEach(b => { b.hidden = b.dataset.wasHidden === '1'; });
});

// Jump to the live view, optionally switching it to one capability first.
function boardOpenLens(capId) {
  if (capId && typeof updateCapabilityLens === 'function') updateCapabilityLens(capId);
  const el = document.getElementById('board-live-view');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
