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

// "▲ 16 pts" / "▼ 3 pts" / "No change" against the previous quarter.
function bdDelta(cur, prev) {
  if (prev == null) return '';
  const d = cur - prev;
  if (d === 0) return '<span class="bd-delta bd-delta-flat">No change</span>';
  return `<span class="bd-delta ${d > 0 ? 'bd-delta-up' : 'bd-delta-dn'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)} pts</span>`;
}

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

// "A", "A and B", "A, B and C" (+ "and N more" past `max`).
function bdList(items, max) {
  max = max || 3;
  const shown = items.slice(0, max), rest = items.length - shown.length;
  if (rest > 0) return shown.join(', ') + ` and ${rest} more`;
  return shown.length > 1 ? shown.slice(0, -1).join(', ') + ' and ' + shown[shown.length - 1] : (shown[0] || '');
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
  return buildRiskProfile(LFac(currentA)).filter(k => titles.has(k.title)).map(k => {
    const r = k.residual || 0;
    const sev = r > 0 ? sevOf(r) : 3;
    return { title: k.title, residual: r, sev, dropped: r > 0 && prevSev[k.title] != null && sev > prevSev[k.title] };
  }).sort((a, b) => a.sev - b.sev || b.residual - a.residual);
}

// The three things the board should know, generated from the data.
function bdKnow(currentA, caps, risks, bops) {
  const items = [];
  const weakest = caps[0];
  if (weakest && weakest.rag !== 'green') {
    const g = weakest.gaps || {};
    const parts = [];
    const unc = g.uncovered || [];
    if (unc.length) parts.push(unc.length === 1
      ? `${unc[0].article || unc[0].requirement} has no policy statement`
      : `${unc.length} objectives have no policy statement`);
    const noCtrl = (g.toBuild || 0) + (g.invisibleWork || 0);
    if (noCtrl) parts.push(`${noCtrl} statement${noCtrl > 1 ? 's have' : ' has'} no control`);
    if (g.notEffective) parts.push(`${g.notEffective} live control${g.notEffective > 1 ? 's are' : ' is'} not yet effective`);
    const reds = caps.filter(c => c.rag === 'red').length;
    items.push({
      tone: weakest.rag === 'red' ? 'gap' : 'warn',
      title: `${weakest.name.replace(/^ICT /, '')} is the weakest area`,
      text: (parts.length ? bdList(parts) + '.' : 'It has the lowest scores this quarter.')
        + (weakest.rag === 'red' && reds === 1 ? ' It is the only capability rated at risk.' : ''),
    });
  }
  const high = risks.filter(r => r.sev === 0);
  if (high.length) items.push({
    tone: 'gap',
    title: high.length === 1 ? 'One risk remains high after controls' : `${high.length} risks remain high after controls`,
    text: `${bdList(high.map(r => `${r.title} (${r.residual})`))} ${high.length === 1 ? 'scores' : 'score'} in the high band after existing controls.`,
  });
  const notYet = bops.controls.filter(c => c.implemented && !c.effective);
  if (notYet.length) items.push({
    tone: 'warn',
    title: `${notYet.length} live control${notYet.length > 1 ? 's are' : ' is'} not yet proven`,
    text: `${bdList(notYet.map(c => bdCtrlParts(c.name).name), 4)} ${notYet.length > 1 ? 'are' : 'is'} live but not rated effective.`,
  });
  return items.slice(0, 3);
}

function renderBoardSummary(currentA, prevA) {
  const m = execScorecardMetrics(currentA, prevA);
  const LL = m.LL;
  const app = (CONFIG && CONFIG.appTitle) || 'Measurable IT Regulatory Oversight Model';
  const doc = m.documented.pct, imp = m.operationalised.pct, eff = m.effective.pct;
  const caps = bdCapSummaries(currentA);
  const risks = bdRisks(currentA, prevA);
  const know = bdKnow(currentA, caps, risks, m.bops);
  const dimLbl = (typeof lensDimLabel === 'function') ? lensDimLabel() : 'Capability';

  // Headline + lead, in plain language.
  const headline = doc - eff >= 20
    ? `${LL} is ${doc}% written down — but only ${eff}% is proven to work.`
    : `${LL} is ${doc}% written down and ${eff}% proven to work.`;
  const moved = (word, cur, prev) => prev == null ? '' : cur > prev ? `${word} rose ${cur - prev} points` : cur < prev ? `${word} fell ${prev - cur} points` : `${word} held steady`;
  const moves = [moved('Implementation', imp, m.pOp), moved('proven effectiveness', eff, m.pEff)].filter(Boolean);
  const liveNotYet = m.bops.controls.filter(c => c.implemented && !c.effective).length;
  const lead = `Our policies now cover ${m.documented.n} of ${m.documented.d} applicable ${escHtml(LL)} objectives.`
    + (moves.length ? ` ${moves.join(' and ')} this quarter.` : '')
    + (liveNotYet ? ' The remaining gap is controls that are live but not yet shown to work.' : '');

  const stage = (n, label, metric, unit, desc, prev, key) => `
    <div class="exsum-cell bd-stage${key ? ' bd-stage-key' : ''}">
      <div class="bd-stage-top"><span class="exsum-lbl">${label}</span><span class="bd-stage-n">${n}</span>${bdDelta(metric.pct, prev)}</div>
      <div class="bd-stage-pct">${metric.d ? metric.pct + '%' : '—'}</div>
      <div class="bd-bar"><i style="width:${metric.pct}%"></i></div>
      <div class="exsum-frac">${metric.n} / ${metric.d} ${unit}</div>
      <div class="bd-stage-desc">${desc}</div>
    </div>`;

  const cell = sc => `<span class="bd-cap-cell"><b>${sc.d ? sc.pct + '%' : '—'}</b><span class="bd-bar bd-bar-sm"><i class="${sc.pct >= 100 ? 'bd-fill-ok' : sc.pct > 0 ? '' : 'bd-fill-gap'}" style="width:${sc.pct}%"></i></span></span>`;
  const capRows = caps.map(c => {
    const rag = BD_RAG[c.rag] || BD_RAG.amber;
    return `<button type="button" class="bd-cap-row" onclick="boardOpenLens('${escHtml(c.capId)}')">
      <span class="bd-cap-name">${escHtml(c.name)}<small>${escHtml(c.short || '')}</small></span>
      ${cell(c.scorecard.documented)}${cell(c.scorecard.operationalised)}${cell(c.scorecard.effective)}
      <span class="bd-chip ${rag.cls}">${rag.label}</span>
    </button>`;
  }).join('');

  const BAND = [['High', 'bd-tone-gap'], ['Moderate', 'bd-tone-warn'], ['Low', 'bd-tone-ok'], ['Not assessed', 'bd-tone-muted']];
  const riskRows = risks.map(r => `<div class="bd-risk-row">
      <span class="bd-risk-name">${escHtml(r.title)}${r.dropped ? ' <small>▼ down a band</small>' : r.sev === 3 ? ' <small>no current RCSA rating</small>' : ''}</span>
      <span class="bd-risk-score"><span class="bd-bar"><i class="${BAND[r.sev][1]}" style="width:${Math.min(100, r.residual / 25 * 100)}%"></i></span><b>${r.sev === 3 ? '—' : r.residual}</b></span>
      <span class="bd-chip ${BAND[r.sev][1]}">${BAND[r.sev][0]}</span>
    </div>`).join('');

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

    <section class="bd-hero" aria-labelledby="bd-headline">
      <p class="bd-kicker">Board summary</p>
      <h1 class="bd-headline" id="bd-headline">${escHtml(headline)}</h1>
      <p class="bd-lead">${lead}</p>
    </section>

    <section class="bd-sec" aria-labelledby="bd-stages-h">
      <div class="bd-sec-hd"><h2 id="bd-stages-h">From policy to proof</h2><span>Each stage is measured on what passed the stage before it</span></div>
      <div class="bd-stages">
        ${stage(1, 'Documented', m.documented, 'objectives', `Applicable ${escHtml(LL)} objectives covered by an owned policy or group-standard statement.`, m.pDoc)}
        ${stage(2, 'Implemented', m.operationalised, 'statements', 'Statements linked to a risk-treatment control, or carrying a disclosed exception.', m.pOp)}
        ${stage(3, 'Effective', m.effective, 'live controls', 'Implemented controls rated effective in the RCSA. This is the number the board should watch.', m.pEff, true)}
      </div>
    </section>

    ${know.length ? `<section class="bd-sec" aria-labelledby="bd-know-h">
      <h2 id="bd-know-h">What the board should know</h2>
      <ol class="bd-know">${know.map(k => `<li class="bd-know-item bd-know-${k.tone}"><h3>${escHtml(k.title)}</h3><p>${escHtml(k.text)}</p></li>`).join('')}</ol>
    </section>` : ''}

    ${caps.length ? `<section class="bd-sec" aria-labelledby="bd-caps-h">
      <div class="bd-sec-hd"><h2 id="bd-caps-h">By ${escHtml(dimLbl.toLowerCase())}</h2><span class="no-print">Select a row to trace it in the live view</span></div>
      <div class="bd-table-wrap"><div class="bd-cap-table">
        <div class="bd-cap-head"><span>${escHtml(dimLbl)}</span><span>Documented</span><span>Implemented</span><span>Effective</span><span>Status</span></div>
        ${capRows}
      </div></div>
    </section>` : ''}

    ${risks.length ? `<section class="bd-sec" aria-labelledby="bd-risks-h">
      <div class="bd-sec-hd"><h2 id="bd-risks-h">Risks threatening ${escHtml(LL)} objectives</h2><span>Residual score after controls · High ≥ 20 · Moderate 12–19 · Low &lt; 12</span></div>
      <div class="bd-risks">${riskRows}</div>
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
