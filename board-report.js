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
  </div>`;
}

// Open / close a pillar section in place (its table is already rendered).
function bdTogglePillar(btn) {
  const sec = btn.closest('.bd-pillar');
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
  document.querySelectorAll('.bd-pillar .bd-art-body').forEach(b => { b.dataset.wasHidden = b.hidden ? '1' : ''; b.hidden = false; });
});
window.addEventListener('afterprint', () => {
  document.querySelectorAll('.bd-appx').forEach(d => { d.open = d.dataset.wasOpen === '1'; });
  document.querySelectorAll('.bd-pillar .bd-art-body').forEach(b => { b.hidden = b.dataset.wasHidden === '1'; });
});

// Jump to the live view, optionally switching it to one capability first.
function boardOpenLens(capId) {
  if (capId && typeof updateCapabilityLens === 'function') updateCapabilityLens(capId);
  const el = document.getElementById('board-live-view');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
