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
    const pillarId = (typeof doraPillarForCapabilityName === 'function') ? doraPillarForCapabilityName(capNm(k.capId)) : 'riskmgmt';
    return { title: k.title, residual: r, sev, pillarId, dropped: r > 0 && prevSev[k.title] != null && sev > prevSev[k.title] };
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
  const risks = bdRisks(currentA, prevA);
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

  // One card per DORA pillar: the "By capability" table filtered to that pillar's
  // capabilities. Pillars with no in-scope capability (e.g. Resilience Testing)
  // render their out-of-scope note instead of a table.
  const pillarCard = pid => {
    const pdef = bdPillarDef(pid);
    const rows = caps.filter(c => (typeof doraPillarForCapabilityName === 'function') && doraPillarForCapabilityName(c.name) === pid);
    const chap = pdef.chapter ? `Chapter ${pdef.chapter}` : '';
    if (!rows.length) {
      const note = pdef.outNote || (pdef.inScope ? 'No capabilities with data in this pillar yet.' : 'Out of scope for us.');
      return `<section class="bd-sec bd-pillar">
        <div class="bd-sec-hd"><h2>${escHtml(pdef.name)}</h2><span>${escHtml(chap)}</span></div>
        <p class="bd-pillar-empty">${escHtml(note)}</p>
      </section>`;
    }
    return `<section class="bd-sec bd-pillar">
      <div class="bd-sec-hd"><h2>${escHtml(pdef.name)}</h2><span class="no-print">${chap ? escHtml(chap) + ' · ' : ''}select a row to trace it in the live view</span></div>
      <div class="bd-table-wrap"><div class="bd-cap-table">
        <div class="bd-cap-head"><span>${escHtml(dimLbl)}</span><span>Documented</span><span>Implemented</span><span>Effective</span><span>Status</span></div>
        ${rows.map(capRow).join('')}
      </div></div>
    </section>`;
  };
  const pillarCards = BD_PILLAR_ORDER.map(pillarCard).join('');

  // Risks grouped under the DORA pillar they threaten (the risk's owning
  // capability → pillar). Only pillars with ≥1 threatening risk are shown.
  const BAND = [['High', 'bd-tone-gap'], ['Moderate', 'bd-tone-warn'], ['Low', 'bd-tone-ok'], ['Not assessed', 'bd-tone-muted']];
  const riskRow = r => `<div class="bd-risk-row">
      <span class="bd-risk-name">${escHtml(r.title)}${r.dropped ? ' <small>▼ down a band</small>' : r.sev === 3 ? ' <small>no current RCSA rating</small>' : ''}</span>
      <span class="bd-risk-score"><span class="bd-bar"><i class="${BAND[r.sev][1]}" style="width:${Math.min(100, r.residual / 25 * 100)}%"></i></span><b>${r.sev === 3 ? '—' : r.residual}</b></span>
      <span class="bd-chip ${BAND[r.sev][1]}">${BAND[r.sev][0]}</span>
    </div>`;
  const seenPillars = BD_PILLAR_ORDER.slice();
  risks.forEach(r => { if (!seenPillars.includes(r.pillarId)) seenPillars.push(r.pillarId); });
  const riskGroups = seenPillars.map(pid => {
    const rs = risks.filter(r => r.pillarId === pid);
    if (!rs.length) return '';
    return `<div class="bd-risk-group">
      <h3 class="bd-risk-pillar">${escHtml(bdPillarDef(pid).name)}<span class="bd-risk-pillar-n">${rs.length} risk${rs.length === 1 ? '' : 's'}</span></h3>
      <div class="bd-risks">${rs.map(riskRow).join('')}</div>
    </div>`;
  }).join('');

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
      <div class="bd-sec-hd"><h2 id="bd-pillars-h">By DORA pillar</h2><span>Each pillar's capabilities, Documented → Implemented → Effective</span></div>
    </section>
    ${pillarCards}

    ${risks.length ? `<section class="bd-sec" aria-labelledby="bd-risks-h">
      <div class="bd-sec-hd"><h2 id="bd-risks-h">Risks threatening ${escHtml(LL)} objectives</h2><span>Grouped by DORA pillar · residual after controls · High ≥ 20 · Moderate 12–19 · Low &lt; 12</span></div>
      ${riskGroups}
    </section>` : ''}
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
});
window.addEventListener('afterprint', () => {
  document.querySelectorAll('.bd-appx').forEach(d => { d.open = d.dataset.wasOpen === '1'; });
});

// Jump to the live view, optionally switching it to one capability first.
function boardOpenLens(capId) {
  if (capId && typeof updateCapabilityLens === 'function') updateCapabilityLens(capId);
  const el = document.getElementById('board-live-view');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
