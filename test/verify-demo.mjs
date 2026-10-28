// End-to-end regression for the Measurable IT Regulatory Oversight Model.
//
// Loads the two-quarter demo (via the in-app loadDemoData(), which drives the
// real import pipeline), then asserts the architecture holds:
//  · the shared reconciliation spine (DORA) still reconciles;
//  · each lens (DORA / MiCA / NIST CSF) is a fully separate module — its own
//    SOA + policy (grouped by Capability / Service / Category) + mapping + facts;
//  · the New/Edit screen is the three lens import groups + shared Risk Data;
//  · the main dashboard has no control cards (moved into the reports);
//  · DORA Reporting embeds the Control 1/2/3 evidence; MiCA / NIST / ROC render.
//
// Run:  npm test            (CI installs chromium via `npx playwright install`)
//       PW_CHROMIUM=/path/to/chrome node test/verify-demo.mjs
// A static server must be serving the repo root on $BASE (default :8137).

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8137/index.html';
let fails = 0;
const assert = (c, m) => { console.log((c ? '✓ ' : '✗ FAIL: ') + m); if (!c) fails++; };

const launchOpts = { headless: true };
if (process.env.PW_CHROMIUM) launchOpts.executablePath = process.env.PW_CHROMIUM;
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage();
page.on('pageerror', e => { console.log('PAGE ERROR:', e.message); fails++; });
page.on('dialog', d => { console.log('DIALOG:', d.message()); d.dismiss().catch(() => {}); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof db !== 'undefined' && typeof loadDemoData === 'function' && (CONFIG.capabilities || []).length > 0);

// ── Seed two quarters (all three lenses) through the real import pipeline ──
await page.evaluate(() => loadDemoData());
await page.waitForFunction(() => {
  const d = db.assessments.find(a => a.id === 'demo');
  const q = db.assessments.find(a => a.id === 'demo-q2');
  return d && q && (d.riskPolicyFacts || []).length > 0 && (d.micaPolicyRows || []).length > 0 && (d.nistPolicyRows || []).length > 0;
}, null, { timeout: 60000 });

// ── Reconciliation spine (DORA, the shared control framework) ──
const base = await page.evaluate(() => {
  const a = db.assessments.find(x => x.id === 'demo');
  const sops = buildStatementOps(a.policyRows || [], a.riskPolicyFacts || []);
  const bops = buildBackingControlOps(a.policyRows || [], a.riskPolicyFacts || []);
  const prof = buildRiskProfile(a.riskPolicyFacts || []);
  return {
    stmts: sops.all.total, backed: sops.all.backed, oped: sops.all.operationalised,
    cTotal: bops.total, cImpl: bops.implemented, cEff: bops.liveEffective, cBlind: bops.blindSpots.length,
    risks: prof.length, assessed: prof.filter(k => (k.residual || 0) > 0).length,
  };
});
console.log('  demo:', JSON.stringify(base));
assert(base.stmts === 13 && base.backed === 11 && base.oped === 8, 'DORA statements reconcile (13 · 11 backed · 8 operationalised)');
assert(base.cTotal === 13 && base.cImpl === 9 && base.cEff === 5 && base.cBlind === 1, 'DORA controls reconcile (13 · 9 live · 5 effective · 1 blind spot)');
assert(base.risks === 7 && base.assessed === 6, 'Risks reconcile (7 · 6 assessed)');

// ── Per-lens separation: each lens has its own SOA / policy / mapping / facts ──
const lensData = await page.evaluate(() => {
  const a = db.assessments.find(x => x.id === 'demo');
  const F = FRAMEWORKS;
  const d = {};
  ['dora', 'mica', 'nist'].forEach(k => {
    const f = F[k];
    d[k] = {
      rows: (a[f.rowsKey] || []).length, soa: (a[f.soaKey] || []).length,
      pol: (a[f.policyKey] || []).length, facts: (a[f.factsKey] || []).length,
      dim: f.dimLabel, groups: (f.groupsKey ? (a[f.groupsKey] || []) : []).map(g => g.name),
    };
  });
  return d;
});
assert(lensData.dora.rows > 0 && lensData.dora.soa > 0 && lensData.dora.pol === 13, `DORA module: ${lensData.dora.rows} obj · ${lensData.dora.soa} SOA · ${lensData.dora.pol} policy`);
assert(lensData.mica.rows > 0 && lensData.mica.soa > 0 && lensData.mica.pol > 0 && lensData.mica.facts > 0, `MiCA module: ${lensData.mica.rows} obj · ${lensData.mica.soa} SOA · ${lensData.mica.pol} policy · ${lensData.mica.facts} facts`);
assert(lensData.nist.rows > 0 && lensData.nist.soa > 0 && lensData.nist.pol > 0 && lensData.nist.facts > 0, `NIST module: ${lensData.nist.rows} obj · ${lensData.nist.soa} SOA · ${lensData.nist.pol} policy · ${lensData.nist.facts} facts`);
assert(lensData.dora.dim === 'Capability' && lensData.mica.dim === 'Service' && lensData.nist.dim === 'Category', 'Lens dimensions: Capability / Service / Category');

// ── SOA: an article that only appears with RTS rows still gets its own
// article-level entry, honouring "Article Applicable" (regression: Article 9
// was never emitted, so marking it applicable did nothing). ──
const soaArt = await page.evaluate(() => {
  const mk = (artApp) => ([
    { DisplayOrder: '1', DORA_Chapter: 'Chapter II', DORA_Section: 'section II', DORA_Article_Index: 'article 9', DORA_Title: 'Protection and prevention', 'Article Applicable': artApp, RTS_Article_Index: 'RTS 4', RTS_Article_Title: 'ICT asset mgmt', 'RTS Applicable': 'Y' },
    { DisplayOrder: '2', DORA_Chapter: 'Chapter II', DORA_Section: 'section II', DORA_Article_Index: 'article 9', DORA_Title: 'Protection and prevention', 'Article Applicable': artApp, RTS_Article_Index: 'RTS 6', RTS_Article_Title: 'Encryption', 'RTS Applicable': 'N' },
  ]);
  const entN = buildSoaEntries(mk('N')).find(e => e.idx === 'ARTICLE9');
  const entY = buildSoaEntries(mk('Y')).find(e => e.idx === 'ARTICLE9');
  const hasRts = buildSoaEntries(mk('Y')).some(e => e.idx === 'RTS4');
  return { emitted: !!entN, nApplicable: entN && entN.applicable, yApplicable: entY && entY.applicable, hasRts };
});
assert(soaArt.emitted, 'SOA: an article with only RTS rows still emits an article-level entry');
assert(soaArt.nApplicable === false && soaArt.yApplicable === true, 'SOA: the article entry follows "Article Applicable" (N→out of scope, Y→applicable)');
assert(soaArt.hasRts, 'SOA: RTS rows still emit their own RTS entries alongside the article');
assert(lensData.mica.groups.some(g => /trading platform|custody/i.test(g)), `MiCA policy grouped by Service (${lensData.mica.groups.join(', ')})`);
assert(lensData.nist.groups.some(g => /^ID\.|^PR\.|^GV\.|^RS\.|^DE\./.test(g)), `NIST policy grouped by Category (${lensData.nist.groups.join(', ')})`);
// The MiCA facts differ from DORA facts (MiCA has its own statements incl. MP-xx).
const micaRefs = await page.evaluate(() => {
  const a = db.assessments.find(x => x.id === 'demo');
  return (a.micaPolicyRows || []).some(r => /^MP-/.test(r.statementRef));
});
assert(micaRefs, 'MiCA policy carries MiCA-specific statements (MP-xx) alongside shared refs');

// ── New/Edit Assessment screen: three lens groups + shared Risk Data ──
await page.evaluate(() => openAssessmentForm(null));
await page.waitForSelector('#capability-fields .lens-import-grid');
const newedit = await page.evaluate(() => ({
  groups: document.querySelectorAll('#capability-fields .lens-import-group').length,
  shared: !!document.querySelector('#capability-fields .lens-import-shared'),
  btns: [...document.querySelectorAll('#capability-fields button')].map(b => b.textContent.trim()),
  legacy: document.querySelectorAll('#capability-fields .cap-card, #capability-fields .measure-block').length,
}));
assert(newedit.groups === 3 && newedit.shared, 'New/Edit: three lens import groups + shared Risk Data');
assert(['Import DORA SOA', 'Import MiCA Policy Data', 'Import NIST CSF Mapping', 'Import Risk Data'].every(t => newedit.btns.some(b => b.includes(t))), 'New/Edit: per-lens SOA/Policy/Mapping + Risk Data buttons present');
assert(newedit.legacy === 0, 'New/Edit: legacy capability / maturity cards removed');

// ── Main dashboard: no control cards, no Capability Lens; keeps Planning + History ──
await page.evaluate(() => showView('dashboard'));
await page.waitForSelector('#dashboard-content');
const dash = await page.evaluate(() => ({
  controlCards: !!document.getElementById('dora-card-row') || !!document.getElementById('sources-card-row') || !!document.getElementById('riskmgmt-card-row'),
  lensSwitch: !!document.getElementById('lens-switch-bar'),
  caplens: !!document.querySelector('#dashboard-content .caplens-card'),
  planning: !!document.querySelector('#planning-card-row'),
  history: !!document.querySelector('.history-card'),
}));
assert(!dash.controlCards, 'Dashboard: Control 1/2/3 cards removed');
assert(!dash.lensSwitch, 'Dashboard: on-screen lens switch bar removed');
assert(!dash.caplens, 'Dashboard: Capability Lens moved to DORA Reporting');
assert(dash.planning && dash.history, 'Dashboard keeps Planning + Assessment History');
// Planning table: Risk Owner after Risk, Control Owner after Control Name.
const planCols = await page.evaluate(() => {
  const heads = [...(document.querySelector('.plan-table')?.querySelectorAll('thead th') || [])].map(h => h.textContent.trim());
  return { riskOwnerAfterRisk: heads[heads.indexOf('Risk') + 1] === 'Risk Owner', ctrlOwnerAfterName: heads[heads.indexOf('Control Name') + 1] === 'Control Owner' };
});
assert(planCols.riskOwnerAfterRisk && planCols.ctrlOwnerAfterName, 'Planning table: Risk Owner after Risk, Control Owner after Control Name');

// ── Report buttons renamed / added ──
const btns = await page.$$eval('.header-actions button', b => b.map(x => x.textContent.trim()));
assert(btns.some(b => b.includes('DORA Reporting')), 'Button: DORA Reporting');
assert(btns.some(b => b.includes('MiCA Reporting')), 'Button: MiCA Reporting');
assert(btns.some(b => b.includes('NIST CSF Reporting')), 'Button: NIST CSF Reporting');
assert(btns.some(b => b.includes('Risk Oversight Committee Reporting')), 'Button: Risk Oversight Committee Reporting');
assert(!btns.some(b => /Evidence/.test(b)), 'Button: Evidence removed');

// ── DORA Reporting: embeds the Control 1/2/3 evidence screens ──
await page.evaluate(() => {
  showReportModal('dora');
  document.getElementById('exec-prev-sel').value = 'demo-q2';
  document.getElementById('exec-curr-sel').value = 'demo';
  generateReport();
});
await page.waitForSelector('#exec-report-content .measure-card');
const doraRep = await page.evaluate(() => ({
  embeds: document.querySelectorAll('#exec-report-content .ev-embed-title').length,
  soa: !!document.querySelector('#exec-report-content .ev-soa-tbl'),
  trace: !!document.querySelector('#exec-report-content .trace-tbl'),
  pillGrid: !!document.querySelector('#exec-report-content .pil-grid'),
  caplens: !!document.querySelector('#exec-report-content .caplens-card'),
  heatmap: !!document.querySelector('#exec-report-content [data-name="dora-c3-heatmap"] .rrh'),
  heatLegend: !!document.querySelector('#exec-report-content .rrh-legend-note'),
  heatNotAssessed: [...document.querySelectorAll('#exec-report-content [data-name="dora-c3-heatmap"] .rrh-band')].some(b => /NOT ASSESSED/.test(b.textContent)),
  copyBtns: document.querySelectorAll('#exec-report-content .act-copy').length,
  ownCollapsed: !!document.querySelector('#exec-report-content .own-table') && !!(document.querySelector('#exec-report-content .own-table') || {}).closest?.('.act-block'),
}));
assert(doraRep.embeds >= 3, `DORA Reporting embeds Control 1/2/3 evidence (${doraRep.embeds} evidence heads)`);
assert(doraRep.soa, 'DORA Reporting Control 1 evidence carries the SOA');
assert(doraRep.trace, 'DORA Reporting still carries the traceability export');
// The traceability table keeps its original grain — no risk columns / Prompts here.
const traceClean = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('#exec-report-content .trace-tbl thead th')].map(t => t.textContent.trim());
  return { noRiskCols: !heads.includes('Risk name') && !heads.includes('Risk description'),
           noPrompts: !document.querySelector('#exec-report-content button[onclick="openPromptsModal()"]') };
});
assert(traceClean.noRiskCols && traceClean.noPrompts, 'Traceability table: no risk columns / Prompts (moved to the ROC extract)');

// ── "Map a new DORA article" authoring popup on the DORA traceability card ──
const am = await page.evaluate(() => {
  const btn = !!document.querySelector('#exec-report-content button[onclick="openArticleMapModal()"]');
  openArticleMapModal();
  const docs = [...document.querySelectorAll('#am-docs .am-doc-cb')].map(c => c.value);
  const types = [...document.querySelectorAll('#am-docs .am-doc-type')].map(t => t.textContent.trim());
  // no article/doc selected → nudge message
  generateArticleMapPrompt();
  const empty = document.getElementById('am-prompt').value;
  // fill + generate
  document.getElementById('am-article').value = 'Article 10 — Detection\n2(a) detect anomalous activities; 2(b) identify single points of failure.';
  const cbs = [...document.querySelectorAll('#am-docs .am-doc-cb')]; cbs[0].checked = true; if (cbs[1]) cbs[1].checked = true;
  generateArticleMapPrompt();
  const prompt = document.getElementById('am-prompt').value;
  closeArticleMapModal();
  return { btn, docCount: docs.length, types, empty, prompt, picked: [cbs[0].value, cbs[1] && cbs[1].value] };
});
assert(am.btn, 'DORA traceability: "Map a new article" button present');
assert(am.docCount > 0 && am.types.some(t => /Group Standard|Local Policy/.test(t)), `Map-article: documents listed from policy data, grouped (${am.docCount})`);
assert(/paste the DORA article/i.test(am.empty), 'Map-article: nudges when the article box is empty');
assert(/TASK\b/.test(am.prompt) && /Article 10 — Detection/.test(am.prompt) && /STATEMENTS EXTRACT/.test(am.prompt), 'Map-article: prompt embeds the article + the selected statements extract');
assert(am.prompt.includes('DORA Article\tParagraph Reference\tDigital Resilience Objective\tStatement Ref\tStatement Header\tDocument\tCapability'),
  'Map-article: OUTPUT is the exact 7 Import DORA Mapping columns (tab-separated)');
assert(/blank on a coverage-gap row|LEFT BLANK/.test(am.prompt) && /NEVER invent statement refs/.test(am.prompt), 'Map-article: rules include gap-as-blank-ref and no-invented-refs');
assert(am.picked[0] && am.prompt.includes(am.picked[0]), 'Map-article: selected document appears in the statements extract');
// Gated to DORA — not on the MiCA traceability.
await page.evaluate(() => { showReportModal('mica'); document.getElementById('exec-prev-sel').value = 'demo-q2'; document.getElementById('exec-curr-sel').value = 'demo'; generateReport(); });
await page.waitForSelector('#mica-report-content .trace-tbl');
const micaMapBtn = await page.evaluate(() => !!document.querySelector('#mica-report-content button[onclick="openArticleMapModal()"]'));
assert(!micaMapBtn, 'Map-article: button is DORA-only (absent on MiCA traceability)');
const micaLinkBtn = await page.evaluate(() => !!document.querySelector('#mica-report-content button[onclick="openLinkCtrlModal()"]'));
assert(!micaLinkBtn, 'Link-controls: button is DORA-only (absent on MiCA traceability)');
// restore DORA report for the remaining DORA-report assertions
await page.evaluate(() => { showReportModal('dora'); document.getElementById('exec-prev-sel').value = 'demo-q2'; document.getElementById('exec-curr-sel').value = 'demo'; generateReport(); });
await page.waitForSelector('#exec-report-content .trace-tbl');

// ── "Link statements to controls" popup on the DORA traceability card ──
const lc = await page.evaluate(() => {
  const btn = !!document.querySelector('#exec-report-content button[onclick="openLinkCtrlModal()"]');
  openLinkCtrlModal();
  const risks = [...document.querySelectorAll('#lc-risks .lc-risk-cb')].map(c => c.value);
  const riskGroups = [...document.querySelectorAll('#lc-risks .am-doc-type')].map(t => t.textContent.trim());
  const docs = [...document.querySelectorAll('#lc-docs .lc-doc-cb')].map(c => c.value);
  generateLinkCtrlPrompt();                       // nothing picked → nudge
  const nudge = document.getElementById('lc-prompt').value;
  const rcb = [...document.querySelectorAll('#lc-risks .lc-risk-cb')]; rcb[0].checked = true; if (rcb[1]) rcb[1].checked = true;
  const dcb = [...document.querySelectorAll('#lc-docs .lc-doc-cb')]; dcb[0].checked = true; if (dcb[1]) dcb[1].checked = true;
  generateLinkCtrlPrompt();
  const prompt = document.getElementById('lc-prompt').value;
  closeLinkCtrlModal();
  return { btn, riskCount: risks.length, riskGroups, docCount: docs.length, nudge, prompt, pickedDoc: dcb[0].value };
});
assert(lc.btn, 'DORA traceability: "Link controls" button present');
assert(lc.riskCount > 0 && lc.riskGroups.length > 0, `Link-controls: risks listed (all from Riskonnect), grouped by capability (${lc.riskCount})`);
assert(lc.docCount > 0, `Link-controls: policy/GS documents listed (${lc.docCount})`);
assert(/Select at least one risk/i.test(lc.nudge), 'Link-controls: nudges when nothing is selected');
assert(/STATEMENTS \(policy/.test(lc.prompt) && /CONTROLS \(risk-treatment/.test(lc.prompt) && /DORA Objective\(s\) covered/.test(lc.prompt), 'Link-controls: prompt embeds the statements (+ their DORA objectives) and the controls');
assert(lc.prompt.includes('DORA object\tDORA objective text\tStatement ref\tStatement header\tControl name\tControl objective\tControl description'),
  'Link-controls: OUTPUT is the exact 7 columns requested (tab-separated)');
assert(/map .* controls .* to .* statements .* by INTENT/i.test(lc.prompt.replace(/\n/g, ' ')), 'Link-controls: task asks to map controls to statements by intent');
assert(!doraRep.pillGrid, 'DORA Reporting: DORA Pillar cards removed');
assert(doraRep.caplens, 'DORA Reporting: Capability Lens card moved in');
assert(doraRep.heatmap && doraRep.heatNotAssessed, 'DORA Reporting Control 3: residual risk heatmap (with NOT ASSESSED lane)');
assert(doraRep.heatLegend, 'DORA Reporting Control 3: heatmap legend explains risks threaten DORA objectives');
assert(doraRep.copyBtns >= 4, `DORA Reporting: Copy-for-Excel on each detail block (${doraRep.copyBtns})`);
assert(doraRep.ownCollapsed, 'DORA Reporting: ownership detail table is collapsible');

// ── Control 2 reframe: coverage & ownership (linked-or-excepted), not live-only.
// A draft-only control no longer fails Control 2; the figure reconciles with the
// unchanged evidence detail (Backed / Exception columns). Demo: 11 backed + 0
// excepted = 11/13; the 2 gaps have no control and no exception. ──
const c2 = await page.evaluate(() => {
  const root = document.getElementById('exec-report-content');
  // Scorecard middle metric
  const cells = [...root.querySelectorAll('.exsum-cell')].map(c => ({
    lbl: c.querySelector('.exsum-lbl')?.textContent.trim(),
    frac: c.querySelector('.exsum-frac')?.textContent.trim(),
  }));
  const op = cells.find(c => c.lbl === 'Implemented');
  // Control 2 card
  const card = [...root.querySelectorAll('.measure-card')].find(c => /operationalised by risk-treatment-controls/i.test(c.querySelector('.measure-card-title')?.textContent || ''));
  const eyebrow = card?.querySelector('.exsc-eyebrow')?.textContent.trim();
  const desc = card?.querySelector('.measure-card-desc')?.textContent || '';
  // Evidence detail (unchanged): count "Backed by control = Yes" rows + Exception column present
  const evHeads = [...(card?.querySelectorAll('.ev-tbl thead th') || [])].map(t => t.textContent.trim());
  const backedIdx = evHeads.indexOf('Backed by control');
  const evRows = [...(card?.querySelectorAll('.ev-tbl tbody tr') || [])];
  const backedYes = evRows.filter(tr => (tr.children[backedIdx]?.textContent || '').trim() === 'Yes').length;
  return {
    opLabel: !!op, opFrac: op?.frac,
    eyebrow, title: card?.querySelector('.measure-card-title')?.textContent.trim(),
    descReframe: /assured separately \(Control 3\)/.test(desc) && /no control and no disclosed exception/.test(desc),
    detailUnchanged: evHeads.includes('Backed by control') && evHeads.includes('Status') && evHeads.includes('Exception'),
    stmtOwnerAfterHeader: evHeads[evHeads.indexOf('Statement header') + 1] === 'Statement owner',
    backedYes, evRowCount: evRows.length,
  };
});
assert(c2.opLabel && /^11 \/ 13/.test(c2.opFrac), `Scorecard: middle metric labelled Implemented, 11/13 (${c2.opFrac})`);
assert(c2.eyebrow === 'Implemented' && /risk-treatment-controls/.test(c2.title), 'Control 2 card: Implemented eyebrow + reframed title');
assert(c2.descReframe, 'Control 2 card: desc states implementation assured separately + the no-control/no-exception gap');
assert(c2.detailUnchanged, 'Control 2 detail table unchanged (Backed / Status / Exception columns intact)');
assert(c2.stmtOwnerAfterHeader, 'Control 2 detail: Statement owner column added after Statement header');
assert(c2.backedYes === 11 && c2.evRowCount === 13, `Control 2: card figure reconciles with detail (11 backed of 13 in the table)`);

// A statement with a disclosed exception (no control) counts toward Operationalised.
const c2exc = await page.evaluate(() => {
  activeLens = 'dora';
  const a = db.assessments.find(x => x.id === 'demo');
  const base = buildStatementCoverage(a.policyRows, a.riskPolicyFacts);
  const n = c => c.backed + c.statements.filter(s => !s.hasControl && s.exception).length;
  // Clone the policy rows and give one uncovered statement a temporary waiver.
  const gapKey = base.uncovered[0].key;
  const pol = a.policyRows.map(p => (p.capId + '||' + ftNorm(p.statementRef)) === gapKey ? { ...p, exception: 'WT' } : { ...p });
  const after = buildStatementCoverage(pol, a.riskPolicyFacts);
  return { before: n(base), after: n(after) };
});
assert(c2exc.after === c2exc.before + 1, `Control 2: a disclosed exception on an uncovered statement counts toward Operationalised (${c2exc.before} → ${c2exc.after})`);

// ── Capability lens mini-scorecard: three cells (Documented / Operationalised /
// Effective) above the funnel, scoped to the selected capability, reconciling
// with that capability's own coverage/ops/controls figures. ──
const capSc = await page.evaluate(() => {
  const card = document.querySelector('#exec-report-content .caplens-card');
  const sc = card?.querySelector('.caplens-scorecard');
  const labels = [...(sc?.querySelectorAll('.exsum-lbl') || [])].map(l => l.textContent.trim());
  // scorecard must come before the funnel in the DOM
  const scBeforeFunnel = sc && card.querySelector('.exfun') && (sc.compareDocumentPosition(card.querySelector('.exfun')) & Node.DOCUMENT_POSITION_FOLLOWING);
  // reconcile against the builder for the selected capability
  activeLens = 'dora';
  const a = db.assessments.find(x => x.id === 'demo');
  const capId = document.getElementById('caplens-sel').value;
  const s = buildCapabilitySummary(a, capId, 'all');
  const sameLook = s.scorecard.documented.n === s.coverage.covered && s.scorecard.documented.d === s.coverage.total
    && s.scorecard.effective.n === s.controls.effective && s.scorecard.effective.d === s.controls.implemented
    && s.scorecard.operationalised.d === s.ops.total && s.scorecard.operationalised.n >= s.ops.operationalised;
  return { cells: (sc?.querySelectorAll('.exsum-cell') || []).length, labels, scBeforeFunnel: !!scBeforeFunnel, sameLook };
});
assert(capSc.cells === 3 && capSc.labels.join(',') === 'Documented,Implemented,Effective', `Capability lens: 3-cell mini scorecard (${capSc.labels.join(', ')})`);
assert(capSc.scBeforeFunnel, 'Capability lens: mini scorecard sits above the Applicable funnel');
assert(capSc.sameLook, 'Capability lens: scorecard figures reconcile with the capability coverage/ops/controls');

// Control 3 heatmap is filtered to risks that threaten DORA objectives (fewer
// than the full register in general; here all 7 are DORA-linked in the demo).
const doraHeat = await page.evaluate(() => document.querySelectorAll('#exec-report-content [data-name="dora-c3-heatmap"] .rrh-chip').length);
assert(doraHeat > 0, `DORA Control-3 heatmap lists DORA-objective risks (${doraHeat} chips)`);

// ── MiCA Reporting: the full DORA treatment, scoped entirely to MiCA data ──
// Same cards as the DORA screen (scorecard, Service lens, Control 1/2/3 evidence,
// residual heatmap filtered to MiCA objectives + legend, Copy buttons, collapsible
// ownership, traceability) with MiCA labels and NO DORA wording leaking in.
await page.evaluate(() => {
  showReportModal('mica');
  document.getElementById('exec-prev-sel').value = 'demo-q2';
  document.getElementById('exec-curr-sel').value = 'demo';
  generateReport();
});
await page.waitForSelector('#mica-report-content .measure-card');
const micaRep = await page.evaluate(() => {
  const root = document.getElementById('mica-report-content');
  const titles = [...root.querySelectorAll('.measure-card-title, .exsc-title')].map(t => t.textContent);
  const heads = [...root.querySelectorAll('th')].map(t => t.textContent.trim());
  return {
    titles: titles.join(' | '),
    scorecard: !!root.querySelector('.exsc-title'),
    caplens: !!root.querySelector('.caplens-card'),
    embeds: root.querySelectorAll('.ev-embed-title').length,
    soa: !!root.querySelector('.ev-soa-tbl'),
    heatmap: !!root.querySelector('[data-name="dora-c3-heatmap"] .rrh'),
    heatNA: [...root.querySelectorAll('[data-name="dora-c3-heatmap"] .rrh-band')].some(b => /NOT ASSESSED/.test(b.textContent)),
    heatLegend: (root.querySelector('.rrh-legend-note') || {}).textContent || '',
    copyBtns: root.querySelectorAll('.act-copy').length,
    ownCollapsed: !!(root.querySelector('.own-table') && root.querySelector('.own-table').closest('.act-block')),
    trace: !!root.querySelector('.trace-tbl'),
    heads,
    anyDoraPillar: heads.includes('DORA Pillar'),
    anyCapability: heads.includes('Capability'),
    hasServiceHead: heads.includes('Service'),
    hasDomainHead: heads.includes('MiCA domain'),
    bodyText: root.textContent,
  };
});
assert(/MiCA/.test(micaRep.titles), `MiCA Reporting titled for MiCA`);
assert(micaRep.scorecard && /MiCA Operationalisation Scorecard/.test(micaRep.titles), 'MiCA Reporting: scorecard present and MiCA-titled');
assert(/Service lens — relate a service to its MiCA objectives/.test(micaRep.titles), 'MiCA Reporting: Service lens card (not Capability)');
assert(/Applicable MiCA articles objectives/.test(micaRep.titles), 'MiCA Reporting Control 1 reads MiCA articles');
assert(micaRep.embeds >= 3, `MiCA Reporting embeds Control 1/2/3 evidence (${micaRep.embeds})`);
assert(micaRep.soa, 'MiCA Reporting Control 1 evidence carries the MiCA SOA');
assert(micaRep.heatmap && micaRep.heatNA, 'MiCA Reporting Control 3: residual heatmap with NOT ASSESSED lane');
assert(/threaten MiCA objectives/.test(micaRep.heatLegend), 'MiCA Reporting Control 3: heatmap legend names MiCA objectives');
assert(micaRep.copyBtns >= 4, `MiCA Reporting: Copy-for-Excel on each detail block (${micaRep.copyBtns})`);
assert(micaRep.ownCollapsed, 'MiCA Reporting: ownership detail table is collapsible');
assert(micaRep.trace, 'MiCA Reporting: carries the MiCA traceability export');
assert(micaRep.hasServiceHead && !micaRep.anyCapability, 'MiCA Reporting: tables use Service, not Capability');
assert(micaRep.hasDomainHead && !micaRep.anyDoraPillar, 'MiCA Reporting: tables use MiCA domain, not DORA Pillar');
assert(!/threaten DORA objectives/.test(micaRep.bodyText) && !/DORA Operationalisation Scorecard/.test(micaRep.bodyText), 'MiCA Reporting: no DORA wording leaks in');

// ── NIST CSF Reporting: the full treatment with NIST labels ──
await page.evaluate(() => {
  showReportModal('nist');
  document.getElementById('exec-prev-sel').value = 'demo-q2';
  document.getElementById('exec-curr-sel').value = 'demo';
  generateReport();
});
await page.waitForSelector('#nist-report-content .measure-card');
const nistRep = await page.evaluate(() => {
  const root = document.getElementById('nist-report-content');
  const titles = [...root.querySelectorAll('.measure-card-title, .exsc-title')].map(t => t.textContent).join(' | ');
  const heads = [...root.querySelectorAll('th')].map(t => t.textContent.trim());
  return {
    titles,
    scorecard: /NIST CSF Operationalisation Scorecard/.test(titles),
    caplens: /Category lens — relate a category to its NIST CSF objectives/.test(titles),
    c1: /Applicable NIST CSF subcategories objectives/.test(titles),
    embeds: root.querySelectorAll('.ev-embed-title').length,
    heatLegend: (root.querySelector('.rrh-legend-note') || {}).textContent || '',
    hasCategoryHead: heads.includes('Category'),
    hasFunctionHead: heads.includes('NIST Function'),
    anyDoraPillar: heads.includes('DORA Pillar'),
    trace: !!root.querySelector('.trace-tbl'),
  };
});
assert(/NIST/.test(nistRep.titles), `NIST CSF Reporting titled for NIST`);
assert(nistRep.scorecard, 'NIST Reporting: scorecard NIST-titled');
assert(nistRep.caplens, 'NIST Reporting: Category lens card');
assert(nistRep.c1, 'NIST Reporting Control 1 reads NIST subcategories');
assert(nistRep.embeds >= 3, `NIST Reporting embeds Control 1/2/3 evidence (${nistRep.embeds})`);
assert(/threaten NIST CSF objectives/.test(nistRep.heatLegend), 'NIST Reporting Control 3: heatmap legend names NIST objectives');
assert(nistRep.hasCategoryHead && nistRep.hasFunctionHead && !nistRep.anyDoraPillar, 'NIST Reporting: tables use Category / NIST Function, not DORA Pillar');
assert(nistRep.trace, 'NIST Reporting: carries the NIST traceability export');

// ── Risk Oversight Committee Reporting (lens-independent full register) ──
await page.evaluate(() => {
  showReportModal('roc');
  document.getElementById('exec-prev-sel').value = 'demo-q2';
  document.getElementById('exec-curr-sel').value = 'demo';
  generateReport();
});
await page.waitForSelector('#roc-report-content .exprog-section');
const roc = await page.evaluate(() => ({
  charts: document.querySelectorAll('#roc-report-content .exprog-chart').length,
  extract: document.querySelectorAll('#roc-report-content .rcx-tbl tbody tr').length,
}));
assert(roc.charts === 3, `ROC Reporting: three progress charts (${roc.charts})`);
assert(roc.extract === 13, `ROC Reporting: full extract one row per control (${roc.extract})`);

// Control maturity card: Effective now listed above Not assessed.
const cmOrder = await page.evaluate(() => {
  const svg = document.querySelector('#roc-report-content [data-name="dora-control-maturity"]')?.innerHTML || '';
  return { eff: svg.indexOf('>Effective<'), na: svg.indexOf('>Not assessed<') };
});
assert(cmOrder.eff > -1 && cmOrder.na > -1 && cmOrder.eff < cmOrder.na, 'Control maturity card: Effective listed above Not assessed');

// ── Risk control-action list: compact per-risk action table, under the heatmap,
// above the full extract. Numbers only (collapsed), sortable, with ▼/▲/● movement
// on Residual/Draft/Not-assessed and a plain number for Total controls. ──
const ral = await page.evaluate(() => {
  const root = document.getElementById('roc-report-content');
  const tbl = root.querySelector('.ral-tbl');
  const heads = [...(tbl?.querySelectorAll('thead th') || [])].map(t => t.textContent.replace(/[▲▼]/g, '').trim());
  const rows = [...(tbl?.querySelectorAll('tbody tr.ral-row') || [])];
  const details = [...(tbl?.querySelectorAll('tbody tr.ral-detail') || [])];
  // position: after the residual heatmap, before the full extract
  const heatmap = root.querySelector('[data-name="dora-risk-residual"], [data-name="dora-c3-heatmap"], .rrh') || root.querySelector('.exprog-chart:last-of-type');
  const rcx = root.querySelector('.rcx-tbl');
  const afterHeat = heatmap && (heatmap.compareDocumentPosition(tbl) & Node.DOCUMENT_POSITION_FOLLOWING);
  const beforeExtract = rcx && (tbl.compareDocumentPosition(rcx) & Node.DOCUMENT_POSITION_FOLLOWING);
  // find the "Delayed incident response" row and read its cells
  const findRow = name => rows.find(r => (r.querySelector('.ral-risk-t')?.textContent || '').trim() === name);
  const cellsOf = r => [...r.children].map(td => td.textContent.replace(/\s+/g, ' ').trim());
  const delayed = findRow('Delayed incident response');
  const sortable = !!tbl?.querySelector("thead th[onclick^='sortRiskActionList']");
  // Columns: Capability(0) Risk(1) Action(2) Owner(3) Residual(4) Draft(5) Implemented(6) Tested(7) Effective(8) NotAssessed(9) Defensibility(10)
  const actionBadges = rows.map(r => r.children[2].querySelector('.ral-badge')?.className || '');
  const defBadges = rows.map(r => r.children[10].querySelector('.ral-badge')?.textContent.trim() || '');
  const maturityHasMovement = rows[0] && [6, 7, 8].every(i => rows[0].children[i].querySelector('.ral-good,.ral-bad,.ral-dot'));
  const delayedNaIsBad = delayed && !!delayed.children[9].querySelector('.ral-bad');   // not-assessed rose → red
  const capCol = rows.map(r => r.children[0].textContent.trim());
  return {
    present: !!tbl, heads, rowCount: rows.length, detailCount: details.length,
    allDetailsHidden: details.every(d => d.hidden),
    afterHeat: !!afterHeat, beforeExtract: !!beforeExtract, sortable,
    anyGreen: actionBadges.some(c => /ral-b-green/.test(c)), anyAmber: actionBadges.some(c => /ral-b-amber/.test(c)),
    allHaveAction: actionBadges.every(Boolean), allHaveDef: defBadges.every(d => /% tested|n\/a/.test(d)),
    maturityHasMovement, delayedNaIsBad, capPopulated: capCol.every(Boolean),
    delayedCells: delayed ? cellsOf(delayed) : null,
  };
});
assert(ral.present && ral.heads.join(',') === 'Capability,Risk,Action,Risk owner,Residual,Draft,Implemented,Tested,Effective,Not assessed,Defensibility', `Risk action list: columns (${ral.heads.join(', ')})`);
assert(ral.capPopulated, 'Risk action list: Capability first column populated for every risk');
assert(ral.rowCount === 7, `Risk action list: one row per risk (${ral.rowCount})`);
assert(ral.afterHeat && ral.beforeExtract, 'Risk action list: located under the residual heatmap, above the full extract');
assert(ral.allDetailsHidden && ral.detailCount === 7, 'Risk action list: control-name detail collapsed by default (numbers-only)');
assert(ral.sortable, 'Risk action list: columns are sortable');
assert(ral.allHaveAction && ral.anyAmber, 'Risk action list: Action badge on every row (amber Action present)');
assert(ral.allHaveDef, 'Risk action list: Defensibility badge (% tested) on every row');
// Badge logic: green when all effective, red when no controls, and the defensibility bands.
const badgeLogic = await page.evaluate(() => ({
  green: ralActionBadge({ total: 3, draft: 0, notAssessed: 0, tested: 3, effective: 3 }),
  action: ralActionBadge({ total: 3, draft: 1, notAssessed: 1, tested: 1, effective: 1 }),
  none: ralActionBadge({ total: 0, draft: 0, notAssessed: 0, tested: 0, effective: 0 }),
  defGreen: ralDefBadge({ total: 10, tested: 9 }),   // 90%
  defAmber: ralDefBadge({ total: 10, tested: 6 }),   // 60%
  defRed: ralDefBadge({ total: 10, tested: 3 }),     // 30%
}));
assert(/ral-b-green/.test(badgeLogic.green) && /ral-b-amber/.test(badgeLogic.action) && /ral-b-red/.test(badgeLogic.none),
  'Risk action list: Action badge — green=all effective, amber=outstanding, red=no controls');
assert(/ral-b-green/.test(badgeLogic.defGreen) && /ral-b-amber/.test(badgeLogic.defAmber) && /ral-b-red/.test(badgeLogic.defRed),
  'Risk action list: Defensibility bands — ≥80 green, 50–79 amber, <50 red');
assert(ral.maturityHasMovement, 'Risk action list: Implemented/Tested/Effective carry movement marks');
assert(ral.delayedNaIsBad, 'Risk action list: a risen Not-assessed shows red (worsened), not green');
// Delayed incident response: residual 14 ▼2, draft 0 ▼1, not-assessed 1 ▲1
assert(ral.delayedCells && /14 ▼ 2/.test(ral.delayedCells[4]) && /0 ▼ 1/.test(ral.delayedCells[5]) && /1 ▲ 1/.test(ral.delayedCells[9]),
  `Risk action list: movement marks (Delayed incident response → ${JSON.stringify(ral.delayedCells)})`);

// Expanding a risk reveals its draft / not-assessed control names.
const ralExpand = await page.evaluate(() => {
  const row = [...document.querySelectorAll('#roc-report-content .ral-tbl tbody tr.ral-row')].find(r => (r.querySelector('.ral-risk-t')?.textContent || '').trim() === 'Delayed incident response');
  toggleRalRow(row);
  const d = row.nextElementSibling;
  return { shown: !d.hidden, text: d.textContent.replace(/\s+/g, ' ').trim() };
});
assert(ralExpand.shown && /control owners to test/i.test(ralExpand.text) && /CTRL-1013/.test(ralExpand.text), 'Risk action list: expanding a risk shows the control names to action');

// ── Risk & control (full extract): Risk description column + the AI Prompts
// popup (per risk), fed from the Riskonnect import. ──
const rcx = await page.evaluate(() => {
  const root = document.getElementById('roc-report-content');
  const heads = [...root.querySelectorAll('.rcx-tbl thead th')].map(t => t.textContent.trim());
  const descCells = [...root.querySelectorAll('.rcx-tbl tbody tr')].map(tr => tr.children[2]?.textContent.trim()).filter(Boolean);
  return {
    hasRiskDesc: heads.includes('Risk description'),
    promptsBtn: !!root.querySelector('button[onclick="openPromptsModal()"]'),
    descsPopulated: descCells.some(d => /incident|asset|provider|access|change|patch|config|vulnerab/i.test(d)),
  };
});
assert(rcx.hasRiskDesc, 'Risk & control extract: Risk description column present');
assert(rcx.descsPopulated, 'Risk & control extract: risk descriptions flow through from the import');
assert(rcx.promptsBtn, 'Risk & control extract: ✨ Prompts button present');

const promptsOut = await page.evaluate(() => {
  openPromptsModal();
  const risks = [...document.getElementById('prompt-risk-sel').options].map(o => o.value).filter(Boolean);
  const pick = risks.includes('Delayed incident response') ? 'Delayed incident response' : risks[0];
  document.getElementById('prompt-risk-sel').value = pick;
  updatePromptView();
  const out = {};
  ['validate', 'coverage', 'reduce'].forEach(k => { setPromptKind(k); out[k] = document.getElementById('prompt-text').value; });
  closePromptsModal();
  return { risks, pick, out };
});
assert(promptsOut.risks.length >= 5, `Prompts: risk dropdown lists the threatening risks (${promptsOut.risks.length})`);
assert(/RISK NAME: Delayed incident response/.test(promptsOut.out.validate) && /RISK DESCRIPTION: ICT-related incidents/.test(promptsOut.out.validate) && /TRACEABILITY EXTRACT/.test(promptsOut.out.validate), 'Prompts: embeds the selected risk (name + description) + DORA extract');
assert(/TASK — VALIDATE THE RISK/.test(promptsOut.out.validate) && /VALID —/.test(promptsOut.out.validate) && /NEEDS REVISION/.test(promptsOut.out.validate), 'Prompts: Validate-the-risk prompt');
assert(/TASK — CONTROL COVERAGE/.test(promptsOut.out.coverage) && /\| Statement ref \| Control name \| Control objective \| Control description \|/.test(promptsOut.out.coverage), 'Prompts: Control-coverage prompt + output table spec');
assert(/TASK — REDUCE NUMBER OF CONTROLS/.test(promptsOut.out.reduce) && /\| Controls to merge \| Control name \| Control objective \| Control description \|/.test(promptsOut.out.reduce), 'Prompts: Reduce-controls prompt + output table spec');

// ── Capability lens: funnel APPLICABLE must equal the drill-down's distinct
// objective count, even when a statement is filed under several capabilities
// (shared incident / major-incident policy). Regression for the funnel
// undercounting because it leaned on the GLOBAL firstObj flag. ──
const capLensConsistency = await page.evaluate(() => {
  if (typeof activeLens !== 'undefined') activeLens = 'dora';
  const pol = (capId) => [{ capId, statementRef: 'IM-01.PS01', statementHeader: 'Incident response', statementDetail: 'Respond', type: 'locPol', document: 'ICT Incident Management Policy', owner: 'CISO', exception: '' }];
  const doraRows = [{ obligationId: 'ART-99-1', article: 'Article 99', requirement: 'Handle major incidents', capability: 'ICT Major Incident Management', statementRef: 'IM-01.PS01', group: '' }];
  const mkFact = (capId) => ({ capId, controlName: 'C-IM-1', controlNumber: 'C1', controlType: 'locPol', controlOwner: 'Ops', riskTitle: 'Incident risk', controlDesc: 'x', designAssess: 'Green', opAssess: 'Green', residualScore: 5, inherentScore: 20, status: 'Implemented', matchedPolicyRows: [{ capId, statementRef: 'IM-01.PS01', document: 'ICT Incident Management Policy', owner: 'CISO' }] });
  const a = { id: 'synthetic', label: 'S', date: '2026-01-01', doraRows, policyRows: [...pol('incident_mgmt'), ...pol('major_incident_mgmt')], riskPolicyFacts: [mkFact('incident_mgmt'), mkFact('major_incident_mgmt')] };
  const treeObjs = (t) => { const o = new Set(); t.forEach(art => art.objectives.forEach(x => { if (x.id) o.add(x.id); })); return o.size; };
  const check = (capId) => ({ applicable: buildCapabilitySummary(a, capId, 'all').funnel.applicable, tree: treeObjs(buildCapabilityTree(a, capId, 'all')) });
  return { major: check('major_incident_mgmt'), incident: check('incident_mgmt') };
});
assert(capLensConsistency.major.applicable === capLensConsistency.major.tree && capLensConsistency.major.tree === 1,
  `Capability lens: shared objective counts under Major Incident (funnel ${capLensConsistency.major.applicable} = tree ${capLensConsistency.major.tree})`);
assert(capLensConsistency.incident.applicable === capLensConsistency.incident.tree && capLensConsistency.incident.tree === 1,
  `Capability lens: shared objective counts under Incident (funnel ${capLensConsistency.incident.applicable} = tree ${capLensConsistency.incident.tree})`);

console.log(fails === 0 ? '\n=== ALL CHECKS PASSED ===' : `\n=== ${fails} FAILED ===`);
await browser.close();
process.exit(fails ? 1 : 0);
