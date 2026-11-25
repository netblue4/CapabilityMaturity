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
// Planning table: Risk Owner after Risk, Control Owner after Control Name, Statement Detail after Statement Header.
const planCols = await page.evaluate(() => {
  const heads = [...(document.querySelector('.plan-table')?.querySelectorAll('thead th') || [])].map(h => h.textContent.trim());
  return {
    riskOwnerAfterRisk: heads[heads.indexOf('Risk') + 1] === 'Risk Owner',
    ctrlOwnerAfterName: heads[heads.indexOf('Control Name') + 1] === 'Control Owner',
    detailAfterHeader: heads[heads.indexOf('Statement Header') + 1] === 'Statement Detail',
  };
});
assert(planCols.riskOwnerAfterRisk && planCols.ctrlOwnerAfterName, 'Planning table: Risk Owner after Risk, Control Owner after Control Name');
assert(planCols.detailAfterHeader, 'Planning table: Statement Detail column after Statement Header');

// ── CBI evidence-pack generator ──
const cbiBtn = await page.$$eval('.header-actions button', b => b.map(x => x.textContent.trim()).find(t => /CBI evidence-pack/.test(t)) || '');
assert(cbiBtn === '', 'CBI: header button removed (generator now launched from the hidden Prompt Console)');
const cbi = await page.evaluate(() => {
  const d = window.CBI_SECTION4;
  showCbiView();
  const viewActive = document.getElementById('view-cbi').classList.contains('active');
  const cats = [...document.querySelectorAll('#cbi-category option')].length;
  const asmtCount = [...document.querySelectorAll('#cbi-assessment option')].length;
  // Information Security (4.3) — RTS-labelled objectives.
  const csel = document.getElementById('cbi-category'); csel.value = String([...csel.options].findIndex(o => o.textContent.startsWith('4.3'))); setCbiCategory();
  const qCount = document.querySelectorAll('#cbi-questions .cbi-q').length;
  // focus first question -> tree populates with articles + objective checkboxes
  const ref = document.querySelector('#cbi-questions .cbi-q-cb').value;
  cbiFocusQuestion(ref);
  const treeArts = document.querySelectorAll('#cbi-maptree .cbi-art').length;
  const naRow = !!document.querySelector('#cbi-maptree .cbi-na');
  // manual map: expand first article, tick first objective -> persists to db.cbiMapping
  document.querySelector('#cbi-maptree .cbi-art-hd').click();
  const objCb = document.querySelector('#cbi-maptree .cbi-obj input'); objCb.checked = true; objCb.dispatchEvent(new Event('change'));
  const persisted = (db.cbiMapping[ref] || {}).objectives || [];
  const chipShown = !!document.querySelector(`#cbi-questions .cbi-q .cbi-chip`);
  // Suggest pre-fills another question
  const refs = [...document.querySelectorAll('#cbi-questions .cbi-q-cb')].map(c => c.value);
  cbiSuggestQuestion(refs[1]);
  const suggestedN = ((db.cbiMapping[refs[1]] || {}).objectives || []).length;
  // N/A toggle
  cbiFocusQuestion(refs[2]); cbiToggleNA();
  const naState = (db.cbiMapping[refs[2]] || {}).na === true;
  // generate for the manually-mapped question only
  document.querySelectorAll('#cbi-questions .cbi-q-cb').forEach(c => { c.checked = false; });
  document.querySelector(`#cbi-questions .cbi-q-cb[value="${ref}"]`).checked = true;
  generateCbiPrompt();
  const prompt = document.getElementById('cbi-prompt').value;
  return {
    totalQ: d.categories.reduce((n, c) => n + c.questions.length, 0), cats, asmtCount, viewActive,
    qCount, treeArts, naRow, persistedN: persisted.length, chipShown, suggestedN, naState, prompt,
  };
});
assert(cbi.cats === 7 && cbi.totalQ === 87, `CBI: questionnaire loaded (7 categories, ${cbi.totalQ} questions)`);
assert(cbi.viewActive, 'CBI: opens as a full-page view');
assert(cbi.asmtCount >= 2 && cbi.qCount > 0, `CBI: assessment selector + question list populated (${cbi.asmtCount} assmts, ${cbi.qCount} questions)`);
assert(cbi.treeArts > 0 && cbi.naRow, `CBI: DORA mapping tree renders (${cbi.treeArts} articles) with an "Article/RTS not applicable" option`);
assert(cbi.persistedN >= 1 && cbi.chipShown, 'CBI: ticking an objective maps it (persisted to db.cbiMapping, shown as a chip)');
assert(cbi.suggestedN >= 1, `CBI: Suggest pre-fills a best-guess mapping (${cbi.suggestedN} objectives)`);
assert(cbi.naState, 'CBI: a question can be marked Not applicable');
assert(/Mapped to DORA objective/.test(cbi.prompt), 'CBI: prompt pulls evidence for exactly the mapped objective(s)');
assert(/CBI MATURITY CRITERIA/.test(cbi.prompt) && /Best controls in place/.test(cbi.prompt), 'CBI: prompt embeds the maturity 1–4 criteria');
assert(/CBI Ref\\tQuestion\\tDORA Article\(s\)\\tSuggested Maturity/.test(cbi.prompt) && !/\{\{CBI_QUESTIONS\}\}/.test(cbi.prompt), 'CBI: prompt has the 6-column Excel output table, placeholder filled');
const cbiMat = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#cbi-maturity-ref .cbi-mat-tbl tbody tr')];
  const hdrs = [...document.querySelectorAll('#cbi-maturity-ref .cbi-mat-tbl th')].map(t => t.textContent.trim());
  return { rows: rows.length, hasApproachCol: hdrs.some(h => /our approach/i.test(h)), hasSignal: rows.some(r => /Implemented AND Effective|Documented = Implemented/.test(r.textContent)) };
});
assert(cbiMat.rows === 4 && cbiMat.hasApproachCol, 'CBI: maturity reference table shows the 4 CBI levels with a "how we determine it" column');
assert(cbiMat.hasSignal, 'CBI: maturity column maps CBI levels to our Documented/Implemented/Effective signals');

// ── Hidden Prompt Console (4 clicks on the unlabelled header hotspot) ──
const pc = await page.evaluate(() => {
  showView('dashboard');
  const hotspot = document.getElementById('btn-prompt-hotspot');
  const hasHotspot = !!hotspot;
  // a single click must NOT open it
  hotspot.click();
  const openedEarly = document.getElementById('view-prompts').classList.contains('active');
  // 3 more → opens (4 total)
  hotspot.click(); hotspot.click(); hotspot.click();
  const opened = document.getElementById('view-prompts').classList.contains('active');
  const launchers = [...document.querySelectorAll('#pc-index .pc-open')].map(b => b.getAttribute('onclick'));
  const asmts = [...document.querySelectorAll('#pc-assessment option')].length;
  // launch Operationalise from the console: sets context + opens the popup
  window._amA = null;
  pcOperationalise();
  const opReady = document.getElementById('ctrl-desc-modal').style.display === 'flex' && !!window._amA;
  closeCtrlDescModal();
  return { hasHotspot, openedEarly, opened, launchers, asmts, opReady };
});
assert(pc.hasHotspot, 'Prompt Console: unlabelled header hotspot present');
assert(!pc.openedEarly && pc.opened, 'Prompt Console: opens on 4 hotspot clicks, not fewer');
assert(pc.asmts >= 2, `Prompt Console: assessment selector populated (${pc.asmts})`);
assert(['pcRiskPrompts()', 'pcMapArticle()', 'pcLinkControls()', 'pcOperationalise()', 'pcAttest()', 'pcCbi()'].every(x => pc.launchers.includes(x)), 'Prompt Console: indexes all prompt launchers (risk, map, link, operationalise, attestation, CBI)');
assert(pc.opReady, 'Prompt Console: a launcher sets the shared context and opens its popup');

// ── "How to write a control" guide popup (ℹ on the Operationalise card) ──
const guide = await page.evaluate(async () => {
  showPromptConsole();
  const hasInfo = !!document.querySelector('#pc-index .pc-info');
  await new Promise(res => {
    showControlGuideModal();
    const t = setInterval(() => { if (document.querySelector('.ctrl-guide')) { clearInterval(t); res(); } }, 50);
    setTimeout(() => { clearInterval(t); res(); }, 4000);
  });
  const g = document.querySelector('.ctrl-guide');
  const html = g ? g.innerHTML : '';
  const shown = document.getElementById('ratings-modal').style.display === 'flex';
  const wide = !!document.querySelector('#ratings-modal .modal-box.modal-wide');
  closeRatingsModal();
  return { hasInfo, shown, wide,
    hasLine: /Control is linked to following Policy &amp; Group Standard statements/.test(html),
    hasField: /Linked Policy &amp; Group Standard statements/.test(html) };
});
assert(guide.hasInfo, 'Prompt Console: Operationalise card carries the ℹ Guide button');
assert(guide.shown && guide.wide, 'Control guide: popup opens wide from the console');
assert(guide.hasLine, 'Control guide: renders the guide incl. the exact "Control is linked to following…" line');
assert(guide.hasField, 'Control guide: linked-statements is its own field in the guide');

// ── Attestation prompt: pick one statement → statement + implementing controls (with effectiveness) ──
const att = await page.evaluate(async () => {
  const a = db.assessments.find(x => x.id === 'demo');
  setPromptContext(a, 'dora');
  openAttestModal();
  await new Promise(res => { const t = setInterval(() => { if (typeof _attText !== 'undefined' && _attText) { clearInterval(t); res(); } }, 50); setTimeout(() => { clearInterval(t); res(); }, 4000); });
  const radios = [...document.querySelectorAll('#att-stmts .att-stmt-rb')];
  const withCtrl = radios.find(rb => /\([1-9]\d* control/.test(rb.closest('label')?.textContent || '')) || radios[0];
  if (withCtrl) withCtrl.checked = true;
  const PRIOR = 'LAST-YEAR-ATTESTATION-MARKER: baseline configs attested as met in 2024.';
  const pb = document.getElementById('att-prior'); if (pb) pb.value = PRIOR;
  generateAttestPrompt();
  const out = document.getElementById('att-prompt').value;
  closeAttestModal();
  return {
    radios: radios.length,
    method: /Decompose the statement into KEY PHRASES/.test(out),
    verdicts: /MET \| PARTIALLY MET \| NOT MET/.test(out),
    stmt: /## STATEMENT TO ATTEST/.test(out),
    ctrls: /## IMPLEMENTING CONTROLS/.test(out),
    eff: /Status: .* · Effectiveness:/.test(out),
    evidence: /## SUPPORTING EVIDENCE/.test(out) && /Procedures \/ supporting documents/.test(out) && /Reports, notes, minutes/.test(out) && /Trainings/.test(out) && /Evidence:/.test(out),
    freq: /· Frequency:/.test(out),
    prior: /USING LAST YEAR'S ATTESTATION/.test(out) && /## LAST YEAR'S ATTESTATION/.test(out) && /LAST-YEAR-ATTESTATION-MARKER/.test(out),
    filled: !/\{\{ATTEST_DATA\}\}/.test(out),
  };
});
assert(att.radios > 0, `Attestation: statement picker populated (${att.radios})`);
assert(att.method && att.verdicts, 'Attestation: prompt carries the key-phrase method + Met/Partially/Not-met verdicts');
assert(att.stmt && att.ctrls && att.eff && att.freq, 'Attestation: appends the selected statement + its controls with status, effectiveness & frequency');
assert(att.evidence, 'Attestation: prompt requires supporting evidence (procedures/reports/trainings/systems) with a per-bullet Evidence line');
assert(att.prior, 'Attestation: pasted prior-year attestation is carried into the prompt (reuse & update method present)');
assert(att.filled, 'Attestation: {{ATTEST_DATA}} placeholder is filled, not left literal');

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
  boardHero: !!document.querySelector('#exec-report-content .bd-hero') || !!document.querySelector('#exec-report-content .bd-stages'),
  boardPillars: [...document.querySelectorAll('#exec-report-content .bd-pillar .bd-art-title')].map(h => h.textContent.trim()),
  boardPillarsCollapsed: [...document.querySelectorAll('#exec-report-content .bd-pillar .bd-art-body')].every(b => b.hidden && b.offsetHeight === 0),
  boardRisksInAppendix: !!document.querySelector('#exec-report-content .bd-appx .bd-risk-group') && !document.querySelector('#exec-report-content .bd-summary .bd-risk-group'),
  lensNoPills: !document.querySelector('#exec-report-content .caplens-card .bd-pill'),
  boardTestingRow: (() => {
    const t = [...document.querySelectorAll('#exec-report-content .bd-pillar')].find(c => /Digital Operational Resilience Testing/.test(c.querySelector('.bd-art-title')?.textContent || ''));
    return !!t && !!t.querySelector('.bd-cap-row');
  })(),
  boardRiskPillars: [...document.querySelectorAll('#exec-report-content .bd-risk-pillar')].map(h => h.textContent.trim()),
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
assert(!am.btn, 'DORA traceability: "Map a new article" button removed from the card (moved to Prompt Console)');
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
await page.waitForSelector('#exec-report-content .trace-tbl', { state: 'attached' });  // folded into the board appendix

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
assert(!lc.btn, 'DORA traceability: "Link controls" button removed from the card (moved to Prompt Console)');
assert(lc.riskCount > 0 && lc.riskGroups.length > 0, `Link-controls: risks listed (all from Riskonnect), grouped by capability (${lc.riskCount})`);
assert(lc.docCount > 0, `Link-controls: policy/GS documents listed (${lc.docCount})`);
assert(/Select at least one risk/i.test(lc.nudge), 'Link-controls: nudges when nothing is selected');
assert(/STATEMENTS \(policy/.test(lc.prompt) && /CONTROLS \(risk-treatment/.test(lc.prompt) && /DORA Objective\(s\) covered/.test(lc.prompt), 'Link-controls: prompt embeds the statements (+ their DORA objectives) and the controls');
assert(lc.prompt.includes('DORA object\tDORA objective text\tStatement ref\tStatement header\tControl name\tControl objective\tControl description'),
  'Link-controls: OUTPUT is the exact 7 columns requested (tab-separated)');
assert(/map .* controls .* to .* statements .* by INTENT/i.test(lc.prompt.replace(/\n/g, ' ')), 'Link-controls: task asks to map controls to statements by intent');

// ── "Operationalise controls" popup on the DORA traceability card ──
const cd = await page.evaluate(() => {
  const btn = document.querySelector('#exec-report-content button[onclick="openCtrlDescModal()"]');
  openCtrlDescModal();
  const docDets = [...document.querySelectorAll('#cd-docs .cd-doc-det')];
  const types = [...document.querySelectorAll('#cd-docs .am-doc-type')].map(t => t.textContent.trim());
  const ctrlCbs = [...document.querySelectorAll('#cd-docs .cd-ctrl-cb')];
  generateCtrlDescPrompt();                       // nothing picked → nudge
  const nudge = document.getElementById('cd-prompt').value;
  // Pick a single control (keeps the prompt short for the LLM).
  ctrlCbs[0].checked = true;
  generateCtrlDescPrompt();
  const prompt = document.getElementById('cd-prompt').value;
  const ctrlBlocks = (prompt.match(/### CONTROL:/g) || []).length;
  closeCtrlDescModal();
  return { btnText: btn ? btn.textContent.trim() : '', docCount: docDets.length, types, ctrlCount: ctrlCbs.length, nudge, prompt, ctrlBlocks };
});
assert(!cd.btnText, 'DORA traceability: "Operationalise controls" button removed from the card (moved to Prompt Console)');
assert(cd.docCount > 0 && cd.types.some(t => /Group Standard|Local Policy/.test(t)), `Operationalise: policy/GS documents listed, expandable & grouped (${cd.docCount})`);
assert(cd.ctrlCount > 0, `Operationalise: controls listed under the policies/standards, selectable (${cd.ctrlCount})`);
assert(/tick one or two controls/i.test(cd.nudge), 'Operationalise: nudges to pick one or two controls when none selected');
assert(cd.ctrlBlocks === 1, `Operationalise: only the selected control is appended (1 block, got ${cd.ctrlBlocks})`);
assert(/THE HOUSE STANDARD/.test(cd.prompt) && /A control is a specific assurance activity/.test(cd.prompt), 'Operationalise: house standard — control is an assurance activity, not the process');
assert(/DOCUMENT A — THE CONTROL/.test(cd.prompt) && /DOCUMENT B — THE CSA TEST/.test(cd.prompt), 'Operationalise: two documents (the control + the separate CSA test)');
assert(/Control Name:/.test(cd.prompt) && /Control Steps:/.test(cd.prompt) && /Control Evidence:/.test(cd.prompt) && /Control Evidence location:/.test(cd.prompt), 'Operationalise: control doc has Name, Control Steps, Evidence + location');
assert(/Save evidence of the .* as "<Evidence Name>/.test(cd.prompt) && /NAMED evidence/.test(cd.prompt), 'Operationalise: each evidence-producing step saves a NAMED artefact');
assert(/Evidence is generated by the control, obtained by the test/.test(cd.prompt), 'Operationalise: evidence generated by the control, obtained by the test');
assert(/Obtain the evidence/.test(cd.prompt) && /Check compliance/.test(cd.prompt) && /\[verifies: /.test(cd.prompt), 'Operationalise: CSA test = Obtain named evidence → Check compliance (with [verifies:] tags)');
assert(/\[@snake_case_description\]/.test(cd.prompt) && /Never invent/.test(cd.prompt), 'Operationalise: placeholder convention [@…] for unknowns, never invented');
assert(/READINESS GATE \(soft/.test(cd.prompt) && /Clearly marked for a fresh OWNER\?/.test(cd.prompt) && /Clearly marked for a fresh TESTER\?/.test(cd.prompt), 'Operationalise: soft readiness gate (clearly marked for owner/tester)');
assert(/control type/.test(cd.prompt) && /Dashboard Monitoring/.test(cd.prompt) && /Reconciliation/.test(cd.prompt), 'Operationalise: Control Name carries the control type (4-eye, reconciliation, dashboard monitoring…)');
assert(/split by performer \/ tool \/ frequency|Split by performer \/ tool \/ frequency/.test(cd.prompt), 'Operationalise: splits broad controls into granular ones');
assert(/gate IS the control/.test(cd.prompt) && /Pair it with a Detective review control/.test(cd.prompt), 'Operationalise: automated preventive = gate is the control + a Detective review');
assert(/Corrective control/.test(cd.prompt) && /remediated within SLA and closed/.test(cd.prompt), 'Operationalise: corrective control = verify remediation within SLA and closed');
assert(/Control Type:/.test(cd.prompt) && /Preventive \(a gate\/approval that blocks\)/.test(cd.prompt) && /Nature:/.test(cd.prompt), 'Operationalise: Control Type + Nature classification');
assert(/Control Cost \(supplementary/.test(cd.prompt), 'Operationalise: Control Cost kept as supplementary (not part of the standard record)');
assert(/Automated control \| 1 \| 1/.test(cd.prompt) && /25% of samples/.test(cd.prompt), 'Operationalise: CSA test carries the RCSA sample-size table + rating methodology');
assert(/WORKED EXAMPLE/.test(cd.prompt) && /Daily P1\/P2 incident dashboard review/.test(cd.prompt) && /Dashboard Monitoring/.test(cd.prompt), 'Operationalise: worked example (incident dashboard-monitoring review control) present');
assert(/WORKED EXAMPLE 2 — a REAL before → after/.test(cd.prompt) && /BEFORE — the control as the owner wrote it/.test(cd.prompt) && /AFTER — the two documents/.test(cd.prompt) && /WHAT CHANGED/.test(cd.prompt), 'Operationalise: real before→after worked example (effectiveness-oversight control) with the transformation spelled out');
assert(/SUMMARY TABLE/.test(cd.prompt) && /Control No \| Control Name \| Type \| Nature \| Key\? \| Owner \| Frequency \| Evidence location \| CSA Test Method \| CT Sample Size \| Objective/.test(cd.prompt), 'Operationalise: summary table incl. Evidence location + CSA Test Method');
assert(/WHAT IT MUST ASSURE \(from the statements\)/.test(cd.prompt) && /COVERAGE CHECK/.test(cd.prompt), 'Operationalise: derivation trace walks statements → coverage check');
assert(/HOW THIS PROMPT WORKS — two steps/.test(cd.prompt) && /STEP 1 — Reason & propose/.test(cd.prompt) && /STEP 2 — Build/.test(cd.prompt), 'Operationalise: runs as a two-step dialogue (reason & propose, then build)');
assert(/PROPOSED CONTROL SET/.test(cd.prompt) && /STOP and ask/.test(cd.prompt), 'Operationalise: Step 1 proposes the control set, then stops for confirmation');
assert(/THE DERIVATION/.test(cd.prompt) && /Separate the process from the control/.test(cd.prompt), 'Operationalise: explainable derivation separates process from the control');
assert(/named evidence artefact/i.test(cd.prompt) && /name is the join key/i.test(cd.prompt), 'Operationalise: named evidence is the join key (step → evidence → test)');
assert(/Test Sample Size/.test(cd.prompt) && /Standard size; Automated = 1/.test(cd.prompt), 'Operationalise: CSA test sampling from the tables (automated = 1)');
assert(/Key control\?/.test(cd.prompt) && /secondary\/compensating/.test(cd.prompt), 'Operationalise: key vs non-key (secondary/compensating) classification');
assert(/### CONTROL:/.test(cd.prompt) && /Statements this control is mapped to/.test(cd.prompt), 'Operationalise: appends the selected control with its statements (placeholder replaced)');
assert(/Current Control Owner:/.test(cd.prompt) && /Current Control Frequency:/.test(cd.prompt), 'Operationalise: data block feeds the control owner + frequency');
assert(!/\{\{CTRL_DESC_DATA\}\}/.test(cd.prompt), 'Operationalise: {{CTRL_DESC_DATA}} placeholder is filled, not left literal');
const cdMicaBtn = await page.evaluate(() => { showReportModal('mica'); document.getElementById('exec-prev-sel').value = 'demo-q2'; document.getElementById('exec-curr-sel').value = 'demo'; generateReport(); return !!document.querySelector('#mica-report-content button[onclick="openCtrlDescModal()"]'); });
assert(!cdMicaBtn, 'Operationalise: button is DORA-only (absent on MiCA traceability)');
// restore DORA report for the remaining DORA-report assertions
await page.evaluate(() => { showReportModal('dora'); document.getElementById('exec-prev-sel').value = 'demo-q2'; document.getElementById('exec-curr-sel').value = 'demo'; generateReport(); });
await page.waitForSelector('#exec-report-content .trace-tbl', { state: 'attached' });  // folded into the board appendix

assert(!doraRep.boardHero, 'DORA Reporting board summary: hero / stages / "what the board should know" removed (starts at the pillar cards)');
assert(doraRep.boardPillars.length === 4
  && doraRep.boardPillars[0].startsWith('ICT Incident Management')
  && /Third-Party/.test(doraRep.boardPillars[1])
  && /Resilience Testing/.test(doraRep.boardPillars[2])
  && doraRep.boardPillars[3] === 'ICT Risk Management',
  `DORA Reporting: four DORA-pillar cards in order (${doraRep.boardPillars.join(' · ')})`);
assert(doraRep.boardTestingRow, 'DORA Reporting: Resilience Testing pillar is in scope with a capability row (testing objectives mapped)');
assert(doraRep.boardPillarsCollapsed, 'DORA Reporting: each By DORA pillar section is collapsed by default');
assert(doraRep.boardRisksInAppendix, 'DORA Reporting: Risks threatening DORA objectives sits in the Appendix');
assert(doraRep.lensNoPills, 'DORA Reporting: live view has no capability buttons (picked from By DORA pillar)');
const gapsFix = await page.evaluate(() => {
  const root = document.getElementById('exec-report-content');
  const tp = [...root.querySelectorAll('.bd-gapcap')].find(g => /Third-Party/.test(g.querySelector('.bd-art-title')?.textContent || ''));
  const inc = [...root.querySelectorAll('.bd-gapcap')].find(g => /ICT Incident/.test(g.querySelector('.bd-art-title')?.textContent || ''));
  const fixRows = [...root.querySelectorAll('.bd-fix-row')];
  const tops = fixRows.map(r => Math.max(0, ...[...r.querySelectorAll('.bd-fix-risk b')].map(b => +b.textContent || 0)));
  return {
    collapsed: [...root.querySelectorAll('.bd-gapcap .bd-art-body')].every(b => b.hidden),
    tpPolicyGap: !!tp && /ART-29-1/.test(tp.querySelector('.bd-gap-col')?.textContent || ''),
    incCross: !!inc && /Group standard covers it/.test(inc.textContent) && /Policy covers it/.test(inc.textContent),
    fixFirst: fixRows[0]?.querySelector('.bd-fix-ctrl .bd-code')?.textContent.trim(),
    fixSorted: tops.every((t, i) => i === 0 || tops[i - 1] >= t),
    fixHasObj: fixRows.every(r => r.querySelector('.bd-fix-objs')),
    inAppendix: !!root.querySelector('.bd-appx .bd-gapcap') && !!root.querySelector('.bd-appx .bd-fix-row')
      && !root.querySelector('.bd-summary .bd-gapcap') && !root.querySelector('.bd-summary .bd-fix-row'),
    appxOrder: [...root.querySelectorAll('.bd-appx > summary')].map(x => x.textContent.trim()),
  };
});
assert(gapsFix.collapsed && gapsFix.tpPolicyGap, 'DORA Reporting gaps: per-capability (collapsed); Third-Party policy gap lists ART-29-1');
assert(gapsFix.incCross, 'DORA Reporting gaps: notes when the other source covers an objective (Incident: policy ↔ group standard)');
assert(gapsFix.fixFirst === 'CTRL-1007' && gapsFix.fixSorted && gapsFix.fixHasObj, `DORA Reporting Fix first: ranked by residual risk (first ${gapsFix.fixFirst})`);
assert(gapsFix.inAppendix && gapsFix.appxOrder.join(' | ').startsWith('Documented | Gaps for the next review cycle | Implemented | Effective | Fix first'), `DORA Reporting: Gaps and Fix first sit in the Appendix (${gapsFix.appxOrder.join(' | ')})`);
assert(doraRep.boardRiskPillars.some(p => /Incident/.test(p)) && doraRep.boardRiskPillars.some(p => /Risk Management/.test(p)), `DORA Reporting: risks grouped under their DORA pillar (${doraRep.boardRiskPillars.join(' · ')})`);
assert(doraRep.caplens, 'DORA Reporting: Capability Lens card moved in');
assert(doraRep.heatmap && doraRep.heatNotAssessed, 'DORA Reporting Control 3: residual risk heatmap (with NOT ASSESSED lane)');
assert(doraRep.heatLegend, 'DORA Reporting Control 3: heatmap legend explains risks threaten DORA objectives');
assert(doraRep.copyBtns >= 4, `DORA Reporting: Copy-for-Excel on each detail block (${doraRep.copyBtns})`);
assert(doraRep.ownCollapsed, 'DORA Reporting: ownership detail table is collapsible');

// ── Risks section: Capability column + grouped by capability within each pillar ──
const riskCaps = await page.evaluate(() => {
  const g = [...document.querySelectorAll('#exec-report-content .bd-risk-group')].find(x => /ICT Risk Management/.test(x.querySelector('.bd-risk-pillar')?.textContent || ''));
  return { head: !!g?.querySelector('.bd-risk-head'), caps: [...(g?.querySelectorAll('.bd-risk-cap') || [])].map(c => c.textContent.trim()) };
});
assert(riskCaps.head && riskCaps.caps.length >= 2, 'DORA Reporting risks: Capability column present on the risk rows');
assert(riskCaps.caps.every((c, i, a) => i === 0 || a[i - 1].localeCompare(c) <= 0), `DORA Reporting risks: grouped by capability (${riskCaps.caps.join(', ')})`);

// ── New report: Policy and Group Standards Attenuation (capability cards) ──
const pgsaBtn = await page.evaluate(() => !!document.querySelector('#view-dashboard button[onclick="showReportModal(\'pgsa\')"]'));
assert(pgsaBtn, 'Dashboard: "Policy and Group Standards Attestation (RICA)" report button present');
const pgsa = await page.evaluate(() => {
  showReportModal('pgsa'); document.getElementById('exec-curr-sel').value = 'demo'; generateReport();
  const root = document.getElementById('pgsa-report-content');
  const cards = [...root.querySelectorAll('.pgsa-card')];
  const collapsed = cards.length > 0 && cards.every(c => c.querySelector('.bd-art-hd')?.getAttribute('aria-expanded') === 'false' && !c.querySelector('.pgsa-row'));
  pgsaToggleCap(0);   // open the first capability to inspect its rows
  const first = root.querySelector('.pgsa-card');
  // Selecting a control opens the details box directly beneath its row.
  first.querySelector('.pgsa-ctrl')?.click();
  const det = root.querySelector('.pgsa-detail');
  return {
    view: document.getElementById('view-pgsa-report').classList.contains('active'),
    cards: cards.length,
    collapsed,
    headers: [...first.querySelectorAll('.pgsa-head span')].map(s => s.textContent.trim()),
    hasEff: !!root.querySelector('.pgsa-ctrl .bd-chip'),
    hasSrc: !!root.querySelector('.pgsa-src'),
    detailUnderRow: !!det && det.previousElementSibling?.classList.contains('has-detail'),
    filters: [...root.querySelectorAll('.bd-seg button')].map(b => b.firstChild.textContent.trim()),
  };
});
assert(pgsa.view && pgsa.cards >= 3, `Attestation (RICA) report: one card per capability (${pgsa.cards})`);
assert(pgsa.collapsed, 'Attestation (RICA) report: each capability card is collapsed by default (details, click to open)');
assert(pgsa.headers.join(' | ') === 'Document | Policy / Group Standard statement | Source | Control(s) & effectiveness', `Attestation (RICA) report: Document is the first column (${pgsa.headers.join(' | ')})`);
assert(pgsa.hasSrc && pgsa.hasEff, 'Attestation (RICA) report: statements show their source + each control\'s effectiveness');
assert(pgsa.detailUnderRow, 'Attestation (RICA) report: selecting a control opens the details box beneath its row');
assert(pgsa.filters.join(',') === 'Everything,Not implemented,Not effective', `Attestation (RICA) report: gap filters (${pgsa.filters.join(', ')})`);
const pgsaSum = await page.evaluate(() => {
  showReportModal('pgsa'); document.getElementById('exec-curr-sel').value = 'demo'; generateReport();
  const root = document.getElementById('pgsa-report-content');
  const sumRows = root.querySelectorAll('.pgsa-sum-row').length;
  const cards = root.querySelectorAll('.pgsa-card').length;
  const sumBeforeCards = !!root.querySelector('.pgsa-sum') && (root.querySelector('.pgsa-sum').compareDocumentPosition(root.querySelector('.pgsa-card')) & Node.DOCUMENT_POSITION_FOLLOWING) > 0;
  const docsShown = [...root.querySelectorAll('.pgsa-sum-row')].every(r => r.querySelector('.pgsa-doc-name'));
  // Selecting a summary row opens that capability's section beneath.
  root.querySelectorAll('.pgsa-sum-row')[1].click();
  const opened = root.querySelectorAll('.pgsa-card')[1].classList.contains('is-open');
  // Source filter: Group Standard only.
  pgsaSetSource('group');
  const gsOnly = [...root.querySelectorAll('.pgsa-sum .pgsa-src')].every(c => c.classList.contains('pgsa-src-gs')) && root.querySelectorAll('.pgsa-sum-row').length > 0;
  const tabs = [...document.querySelectorAll('.pgsa-src-tabs .cls-tab')].map(b => b.textContent.trim() + (b.classList.contains('cls-tab-on') ? '*' : ''));
  pgsaSetSource('all');
  return { sumRows, cards, sumBeforeCards, docsShown, opened, gsOnly, tabs };
});
assert(pgsaSum.sumRows === pgsaSum.cards && pgsaSum.sumBeforeCards, `Attestation (RICA) report: per-capability summary above the capability sections (${pgsaSum.sumRows} rows)`);
assert(pgsaSum.docsShown, 'Attestation (RICA) report: summary lists each capability\'s policies & group standards');
assert(pgsaSum.opened, 'Attestation (RICA) report: selecting a summary row opens that capability below');
assert(pgsaSum.gsOnly && pgsaSum.tabs.join(',') === 'Both,Policy,Group Standard*', `Attestation (RICA) report: source filter (${pgsaSum.tabs.join(', ')})`);

// ── New report: Control Coverage (control → statements → DORA objectives) ──
const ccovBtn = await page.evaluate(() => !!document.querySelector('#view-dashboard button[onclick="showReportModal(\'ctrlcov\')"]'));
assert(ccovBtn, 'Dashboard: "Control Coverage" report button present');
const ccov = await page.evaluate(() => {
  showReportModal('ctrlcov'); document.getElementById('exec-curr-sel').value = 'demo'; generateReport();
  const root = document.getElementById('ctrlcov-report-content');
  const cards = [...root.querySelectorAll('.ccov-card')];
  const collapsed = cards.length > 0 && cards.every(c => c.querySelector('.bd-art-hd')?.getAttribute('aria-expanded') === 'false' && !c.querySelector('.ccov-row'));
  const weight = root.querySelector('.ccov-card .bd-art-meta')?.textContent || '';
  ccovToggleCap(0);   // open the first capability to inspect its rows
  const first = root.querySelector('.ccov-card');
  const stmt = first.querySelector('.ccov-ref .ccov-item-text')?.textContent.trim() || '';
  const obj = first.querySelector('.ccov-obj .ccov-item-text')?.textContent.trim() || '';
  // Selecting an objective opens the details box beneath its row, listing every control that covers it.
  first.querySelector('.ccov-obj')?.click();
  const det = root.querySelector('.ccov-detail');
  return {
    view: document.getElementById('view-ctrlcov-report').classList.contains('active'),
    cards: cards.length,
    collapsed,
    headers: [...first.querySelectorAll('.ccov-head span')].map(s => s.textContent.trim()),
    hasStmtRef: !!root.querySelector('.ccov-ref'),
    hasObjRef: !!root.querySelector('.ccov-obj'),
    hasEff: !!root.querySelector('.ccov-ctrl .bd-chip'),
    hasWeight: /control.*·.*statement.*·.*DORA objective/.test(weight),
    textShown: stmt.length > 3 && obj.length > 3,
    detailUnderRow: !!det && det.previousElementSibling?.classList.contains('has-detail') && /Covered by/.test(det.textContent),
    filters: [...root.querySelectorAll('.bd-seg button')].map(b => b.firstChild.textContent.trim()),
  };
});
assert(ccov.view && ccov.cards >= 3, `Control Coverage: one card per capability (${ccov.cards})`);
assert(ccov.headers.join(' | ') === 'Control | Implements (policy / GS statements) | Covers (DORA objectives) | Treats (risks)', `Control Coverage: control → statements → DORA → risks columns (${ccov.headers.join(' | ')})`);
assert(ccov.hasStmtRef && ccov.hasObjRef && ccov.hasEff, 'Control Coverage: each control lists its statements + DORA objectives with an effectiveness chip');
assert(ccov.hasWeight, 'Control Coverage: capability summary shows the compliance weight (controls · statements · objectives)');
assert(ccov.collapsed, 'Control Coverage: each capability is collapsed by default');
assert(ccov.textShown, 'Control Coverage: statements and objectives are written out, not just refs');
assert(ccov.detailUnderRow, 'Control Coverage: selecting an objective opens the details box beneath its row, listing the controls that cover it');
assert(ccov.filters.join(',') === 'Everything,Not effective,No DORA objective', `Control Coverage: filters (${ccov.filters.join(', ')})`);
const ccovKey = await page.evaluate(() => {
  showReportModal('ctrlcov'); document.getElementById('exec-curr-sel').value = 'demo'; generateReport();
  const root = document.getElementById('ctrlcov-report-content');
  const rows = [...root.querySelectorAll('.ccov-key-row')];
  const weights = rows.map(r => [...r.querySelectorAll('.ccov-key-w b')].slice(0, 3).reduce((n, b) => n + (+b.textContent || 0), 0));
  const firstNum = rows[0]?.querySelector('.bd-code')?.textContent.trim();
  rows[0]?.click();   // opens the control's capability and selects it
  const det = root.querySelector('.ccov-detail');
  return {
    rows: rows.length, sorted: weights.every((w, i) => i === 0 || weights[i - 1] >= w),
    profile: !!det && /Implements/.test(det.textContent) && /Covers/.test(det.textContent) && /Treats/.test(det.textContent) && det.textContent.includes(firstNum),
    risksShown: !!root.querySelector('.ccov-card.is-open .ccov-risk'),
  };
});
assert(ccovKey.rows > 0 && ccovKey.sorted, `Control Coverage: Key controls ranked by weight (${ccovKey.rows} rows)`);
assert(ccovKey.profile && ccovKey.risksShown, 'Control Coverage: selecting a key control opens its full profile (statements, objectives, risks)');

// Capability-lens drill-down headers aligned with the scorecard (Documented / Implemented / Effective)
// restore the DORA report for the assertions that follow
await page.evaluate(() => { showReportModal('dora'); document.getElementById('exec-prev-sel').value = 'demo-q2'; document.getElementById('exec-curr-sel').value = 'demo'; generateReport(); });
await page.waitForSelector('#exec-report-content .bd-summary');
const traceHdr = await page.evaluate(() => {
  const art = document.querySelector('#exec-report-content .caplens-card .bd-art-hd'); if (art) art.click();
  const head = document.querySelector('#exec-report-content .caplens-card .bd-trace-head');
  return head ? [...head.querySelectorAll('span')].map(s => s.textContent.trim()) : [];
});
assert(traceHdr.join(' | ') === 'DORA objective | Documented | Implemented / Effective', `Capability-lens drill-down headers aligned with the scorecard (${traceHdr.join(' | ')})`);

// ── Control 2 reframe: coverage & ownership (linked-or-excepted), not live-only.
// A draft-only control no longer fails Control 2; the figure reconciles with the
// unchanged evidence detail (Backed / Exception columns). Demo: 11 backed + 0
// excepted = 11/13; the 2 gaps have no control and no exception. ──
const c2 = await page.evaluate(() => {
  const root = document.getElementById('exec-report-content');
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
    eyebrow, title: card?.querySelector('.measure-card-title')?.textContent.trim(),
    descReframe: /assured separately \(Control 3\)/.test(desc) && /no control and no disclosed exception/.test(desc),
    detailUnchanged: evHeads.includes('Backed by control') && evHeads.includes('Status') && evHeads.includes('Exception'),
    stmtOwnerAfterHeader: evHeads[evHeads.indexOf('Statement header') + 1] === 'Statement owner',
    backedYes, evRowCount: evRows.length,
  };
});
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

// ── Capability lens (live view) mini-scorecard: three cells (Documented / Operationalised /
// Effective) above the funnel, scoped to the selected capability, reconciling
// with that capability's own coverage/ops/controls figures. ──
const capSc = await page.evaluate(() => {
  const card = document.querySelector('#exec-report-content .caplens-card');
  const sc = card?.querySelector('.caplens-scorecard');
  const labels = [...(sc?.querySelectorAll('.exsum-lbl') || [])].map(l => l.textContent.trim());
  // scorecard must come before the funnel in the DOM
  const scBeforeFunnel = sc && card.querySelector('.bd-trace') && (sc.compareDocumentPosition(card.querySelector('.bd-trace')) & Node.DOCUMENT_POSITION_FOLLOWING);
  // reconcile against the builder for the selected capability
  activeLens = 'dora';
  const a = db.assessments.find(x => x.id === 'demo');
  const capId = _capLensCapId;
  const s = buildCapabilitySummary(a, capId, 'all');
  const sameLook = s.scorecard.documented.n === s.coverage.covered && s.scorecard.documented.d === s.coverage.total
    && s.scorecard.effective.n === s.controls.effective && s.scorecard.effective.d === s.controls.implemented
    && s.scorecard.operationalised.d === s.ops.total && s.scorecard.operationalised.n >= s.ops.operationalised;
  return { cells: (sc?.querySelectorAll('.exsum-cell') || []).length, labels, scBeforeFunnel: !!scBeforeFunnel, sameLook };
});
assert(capSc.cells === 3 && capSc.labels.join(',') === 'Documented,Implemented,Effective', `Capability lens: 3-cell mini scorecard (${capSc.labels.join(', ')})`);
assert(capSc.scBeforeFunnel, 'Capability lens: mini scorecard sits above the trace');
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
assert(/Live view — trace a service to its MiCA objectives/.test(micaRep.titles), 'MiCA Reporting: Service lens card (not Capability)');
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
    caplens: /Live view — trace a category to its NIST CSF objectives/.test(titles),
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

// Risk coverage card: High / Moderate / Low severity rows; Control maturity: "All controls" first row.
const newRows = await page.evaluate(() => {
  const rc = document.querySelector('#roc-report-content [data-name="dora-risk-coverage"]')?.innerHTML || '';
  const cm = document.querySelector('#roc-report-content [data-name="dora-control-maturity"]')?.innerHTML || '';
  return {
    rcHigh: rc.indexOf('>High<'), rcMod: rc.indexOf('>Moderate<'), rcLow: rc.indexOf('>Low<'), rcAssessed: rc.indexOf('>Assessed<'),
    cmAll: cm.indexOf('>All controls<'), cmDraft: cm.indexOf('>Draft<'),
  };
});
assert(newRows.rcHigh > -1 && newRows.rcMod > -1 && newRows.rcLow > -1, 'Risk coverage card: High / Moderate / Low rows present');
assert(newRows.rcAssessed > -1 && newRows.rcAssessed < newRows.rcHigh && newRows.rcHigh < newRows.rcMod && newRows.rcMod < newRows.rcLow, 'Risk coverage card: High → Moderate → Low ordered under Assessed');
assert(newRows.cmAll > -1 && newRows.cmDraft > -1 && newRows.cmAll < newRows.cmDraft, 'Control maturity card: "All controls" is the first row (above Draft)');

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
assert(!rcx.promptsBtn, 'Risk & control extract: ✨ Prompts button removed from the card (moved to Prompt Console)');

const promptsOut = await page.evaluate(() => {
  openPromptsModal();
  const risks = [...document.getElementById('prompt-risk-sel').options].map(o => o.value).filter(Boolean);
  const pick = risks.includes('Delayed incident response') ? 'Delayed incident response' : risks[0];
  document.getElementById('prompt-risk-sel').value = pick;
  updatePromptView();
  const out = {};
  ['validate', 'coverage', 'reduce'].forEach(k => { setPromptKind(k); out[k] = document.getElementById('prompt-text').value; });
  const tabs = [...document.querySelectorAll('#prompt-kind-tabs .prompt-kind-tab')].map(t => t.textContent.trim());
  // all-risks (no DORA filter): a non-objective-backed control's risk still lists
  const allRisks = _promptRiskList([], [{ capId: 'z', controlName: 'C', controlNumber: '1', riskTitle: 'Standalone non-DORA risk', designAssess: 'Green', opAssess: 'Green' }]).map(r => r.title);
  closePromptsModal();
  return { risks, pick, out, tabs, allRisks };
});
assert(promptsOut.risks.length >= 5, `Prompts: risk dropdown lists all risks from the upload (${promptsOut.risks.length})`);
assert(promptsOut.allRisks.includes('Standalone non-DORA risk'), 'Prompts: risk list is not filtered to DORA-linked risks (shows all uploaded)');
assert(promptsOut.tabs.length === 5 && /Rewrite to CSA standard/.test(promptsOut.tabs[3]) && /Risk rationale & tier/.test(promptsOut.tabs[4]), 'Prompts: options 4 (CSA) and 5 (Risk rationale & tier) present');
// Option 4 — CSA prompt (docs/csa-rewrite-prompt.md) with the selected risk's
// controls appended automatically (no paste), incl. the Control Frequency column.
const csaOut = await page.evaluate(async () => {
  openPromptsModal();
  document.getElementById('prompt-risk-sel').value = 'Delayed incident response'; updatePromptView();
  setPromptKind('csa');
  for (let i = 0; i < 40 && !/CONTROLS TO PROCESS/.test(document.getElementById('prompt-text').value); i++) { await new Promise(r => setTimeout(r, 50)); updatePromptView(); }
  const v = document.getElementById('prompt-text').value; closePromptsModal(); return v;
});
assert(/to the CSA standard/.test(csaOut) && /CONTROLS TO PROCESS/.test(csaOut) && !/<paste control rows here>/.test(csaOut) && !/{{CSA_CONTROLS}}/.test(csaOut),
  'Prompts: option 4 loads the CSA prompt and auto-appends controls (no paste placeholder)');
assert(/\| Control No \| Control Name \| Control Status \| Control Frequency \| Control Description \| Control Owner \|/.test(csaOut) && /\| (Quarterly|Monthly|Annually) \|/.test(csaOut),
  'Prompts: option 4 appends the selected risk\'s controls incl. the Control Frequency column');
// Option 5 — risk-rationale prompt with the selected risk's data appended (not pasted).
const ratOut = await page.evaluate(async () => {
  openPromptsModal();
  document.getElementById('prompt-risk-sel').value = 'Delayed incident response'; updatePromptView();
  setPromptKind('rating');
  for (let i = 0; i < 40 && !/Tier Descriptions/.test(document.getElementById('prompt-text').value); i++) { await new Promise(r => setTimeout(r, 50)); updatePromptView(); }
  const v = document.getElementById('prompt-text').value; closePromptsModal(); return v;
});
assert(/Risk Rationale & Tier Selection/.test(ratOut) && /£20/.test(ratOut) && /Own Funds/.test(ratOut), 'Prompts: option 5 loads the full risk-rationale prompt (tier descriptions)');
assert(!/<<--\["Risk you need to assess"\]-->>/.test(ratOut) && /Risk: Delayed incident response/.test(ratOut) && /\| Description \| Inherent Risk Score \| Control: Control Name \| Control Effectiveness Score \| Residual Risk Score \|/.test(ratOut),
  'Prompts: option 5 appends the selected risk\'s data (placeholder replaced, not pasted)');
assert(/NOTE ON RATINGS/.test(ratOut), 'Prompts: option 5 notes the composite-score → Likelihood/Impact mapping');
assert(/RISK NAME: Delayed incident response/.test(promptsOut.out.validate) && /RISK DESCRIPTION: ICT-related incidents/.test(promptsOut.out.validate) && /TRACEABILITY EXTRACT/.test(promptsOut.out.validate), 'Prompts: embeds the selected risk (name + description) + DORA extract');
assert(/TASK — VALIDATE THE RISK/.test(promptsOut.out.validate) && /VALID —/.test(promptsOut.out.validate) && /NEEDS REVISION/.test(promptsOut.out.validate), 'Prompts: Validate-the-risk prompt');
assert(/TASK — CONTROL COVERAGE/.test(promptsOut.out.coverage) && /\| Statement ref \| Control name \| Control objective \| Control description \|/.test(promptsOut.out.coverage), 'Prompts: Control-coverage prompt + output table spec');
assert(/TASK — REDUCE NUMBER OF CONTROLS/.test(promptsOut.out.reduce) && /\| Controls to merge \| Control name \| Control objective \| Control description \|/.test(promptsOut.out.reduce), 'Prompts: Reduce-controls prompt + output table spec');

// ── Framework Browser: three lenses, Finder-style columns, pivots ──
const fbBtn = await page.evaluate(() => !!document.querySelector('#view-dashboard #btn-framework-browser'));
assert(fbBtn, 'Dashboard: "Framework Browser" button present in the top button row');
const fb = await page.evaluate(() => {
  showView('dashboard'); openFrameworkBrowser('demo');
  const q = s => [...document.querySelectorAll(s)];
  const col = i => q('.fb-col')[i];
  const nodes = i => [...col(i).querySelectorAll('.fb-node')];
  const click = (i, txt) => { const n = nodes(i).find(b => b.textContent.includes(txt)); if (n) n.click(); return !!n; };
  const out = {};
  out.view = document.getElementById('view-framework-browser').classList.contains('active');
  out.tabs = q('.fb-tab .fb-tab-name').map(e => e.textContent);
  out.pillars = nodes(0).length;
  out.outOfScope = nodes(0).some(b => b.classList.contains('is-muted') && /out of scope/.test(b.textContent));
  out.noDetailYet = /Select anything/.test(document.querySelector('.fb-detail').textContent);
  out.colsAtStart = q('.fb-col').map(c => c.querySelector('h3').textContent);
  out.emptyHint = /Select a DORA pillar/.test(col(1).textContent);
  click(0, 'ICT Risk Management');
  out.riskCapsCol = nodes(1).map(b => b.querySelector('.fb-node-title').textContent);
  click(1, 'Asset & Configuration'); out.capArts = nodes(2).map(b => b.querySelector('.fb-node-title').textContent);
  click(2, 'RTS 4'); click(3, 'RTS-4-2-4');
  out.objGap = nodes(4).length === 1 && nodes(4)[0].classList.contains('is-gap') && /No policy or group standard/.test(nodes(4)[0].textContent)
    && /Select a policy \/ group standard/.test(col(5).textContent) && q('.fb-col').length === 7;
  click(3, 'RTS-4-2-2'); out.docCol = nodes(4).map(b => b.textContent.replace(/\s+/g, ' ').trim()).join(' | ');
  click(4, 'Asset Management Policy'); click(5, 'LP-01 PS02'); click(6, 'CTRL-1003');
  out.cols = q('.fb-col').length;
  out.crumbs = document.querySelector('.fb-crumbs').innerText.replace(/\s*›\s*/g, ' › ').replace(/\s+/g, ' ').trim();
  const det = document.querySelector('.fb-detail').textContent;
  out.ctrlDetail = /CTRL-1003/.test(det) && /Control Owner 3/.test(det) && /Asset data integrity gaps/.test(det) && /Draft/.test(det);
  out.pivots = q('.fb-pivot').map(b => b.textContent.trim());
  q('.fb-pivot').find(b => /Risk Lens/.test(b.textContent)).click();
  out.riskTab = document.querySelector('.fb-tab[aria-selected="true"]').textContent.includes('Risk Lens');
  out.riskPath = document.querySelector('.fb-crumbs').innerText.replace(/\s*›\s*/g, ' › ').replace(/\s+/g, ' ').trim();
  out.riskSel = (document.querySelector('.fb-col:last-of-type .fb-node.is-sel') || {}).textContent || '';
  q('.fb-pivot').find(b => /Governance Lens/.test(b.textContent)).click();
  out.govPath = document.querySelector('.fb-crumbs').innerText.replace(/\s*›\s*/g, ' › ').replace(/\s+/g, ' ').trim();
  // Risk Lens: capabilities in play only; risks sorted by residual; testing has a gap.
  fbSetLens('risk');
  out.riskCaps = nodes(0).map(b => b.querySelector('.fb-node-title').textContent);
  click(0, 'Access Control');
  out.risksSub = nodes(1).map(b => b.querySelector('.fb-node-sub').textContent);
  click(0, 'Resilience Testing');
  out.testingGap = nodes(1).length === 1 && nodes(1)[0].classList.contains('is-gap') && /No risks recorded/.test(nodes(1)[0].textContent);
  // Governance Lens: document status + a statement with no control.
  fbSetLens('gov'); click(0, 'Third-Party');
  out.govDoc = nodes(1).map(b => b.textContent.replace(/\s+/g, ' ').trim()).join(' | ');
  click(1, 'Third-Party Policy'); click(2, 'LP-04 PS02');
  out.stmtGap = nodes(3).length === 1 && /Self-declared implemented, but no control/.test(nodes(3)[0].textContent);
  return out;
});
assert(fb.view && fb.tabs.join(',') === 'DORA Lens,Risk Lens,Governance Lens', `Framework Browser: opens with three lenses (${fb.tabs.join(', ')})`);
assert(fb.pillars === 5 && fb.outOfScope && fb.noDetailYet, `Framework Browser: DORA Lens lists 5 pillars, Information-Sharing out of scope (${fb.pillars})`);
assert(fb.colsAtStart.join(',') === 'DORA pillar,Capability,Article,Objective,Policy / group standard,Statement,Control' && fb.emptyHint, `Framework Browser: every DORA column is on screen from the start (${fb.colsAtStart.join(', ')})`);
assert(fb.riskCapsCol.join(' | ') === 'ICT Asset & Configuration Management | ICT Change Management | ICT Vulnerability Management | ICT Access Control Management' && fb.capArts.join(' | ') === 'RTS 4 — ICT asset management policy',
  `Framework Browser: DORA Lens groups a pillar's articles by capability (${fb.riskCapsCol.join(' | ')} → ${fb.capArts.join(' | ')})`);
assert(fb.objGap, 'Framework Browser: an undocumented objective (RTS-4-2-4) shows a "No policy or group standard" gap, columns stay put');
assert(/Local ICT Asset Management Policy.*Local Policy · Approved/.test(fb.docCol), `Framework Browser: DORA Lens lists the document an objective is documented in (${fb.docCol})`);
assert(fb.cols === 7 && /RTS-4-2-2 › Local ICT Asset Management Policy › LP-01 PS02 › CTRL-1003$/.test(fb.crumbs), `Framework Browser: pillar → capability → article → objective → document → statement → control columns + path (${fb.crumbs})`);
assert(fb.ctrlDetail, 'Framework Browser: control details show owner, status and the risk it treats');
assert(fb.pivots.length === 2, `Framework Browser: a control offers "Open in" the other two lenses (${fb.pivots.join(', ')})`);
assert(fb.riskTab && /Asset data integrity gaps › CTRL-1003$/.test(fb.riskPath) && /Asset ownership assignment/.test(fb.riskSel), `Framework Browser: pivot to Risk Lens selects the same control (${fb.riskPath})`);
assert(/Local ICT Asset Management Policy › LP-01 PS02 › CTRL-1003$/.test(fb.govPath), `Framework Browser: pivot to Governance Lens selects the same control (${fb.govPath})`);
assert(fb.riskCaps.length === 7 && fb.riskCaps.includes('Digital Operational Resilience Testing'), `Framework Browser: Risk Lens lists the capabilities in play (${fb.riskCaps.length})`);
assert(fb.risksSub.length === 1 && /Residual 20 · High · Risk Owner D/.test(fb.risksSub[0]), `Framework Browser: risks show residual, band and owner (${fb.risksSub.join(' | ')})`);
assert(fb.testingGap, 'Framework Browser: a capability with no risks shows a "No risks recorded" gap');
assert(/Local ICT Third-Party Policy.*Local Policy · Partially approved/.test(fb.govDoc), `Framework Browser: Governance Lens shows document source and status (${fb.govDoc})`);
assert(fb.stmtGap, 'Framework Browser: a self-declared statement with no control shows as a gap');

// ── Capability lens: funnel APPLICABLE must equal the drill-down's distinct
// objective count when a statement is filed under a capability. Regression for
// the funnel undercounting because it leaned on the GLOBAL firstObj flag. ──
const capLensConsistency = await page.evaluate(() => {
  if (typeof activeLens !== 'undefined') activeLens = 'dora';
  const pol = (capId) => [{ capId, statementRef: 'IM-01.PS01', statementHeader: 'Incident response', statementDetail: 'Respond', type: 'locPol', document: 'ICT Incident Management Policy', owner: 'CISO', exception: '' }];
  const doraRows = [{ obligationId: 'ART-99-1', article: 'Article 99', requirement: 'Handle incidents', capability: 'ICT Incident Management', statementRef: 'IM-01.PS01', group: '' }];
  const mkFact = (capId) => ({ capId, controlName: 'C-IM-1', controlNumber: 'C1', controlType: 'locPol', controlOwner: 'Ops', riskTitle: 'Incident risk', controlDesc: 'x', designAssess: 'Green', opAssess: 'Green', residualScore: 5, inherentScore: 20, status: 'Implemented', matchedPolicyRows: [{ capId, statementRef: 'IM-01.PS01', document: 'ICT Incident Management Policy', owner: 'CISO' }] });
  const a = { id: 'synthetic', label: 'S', date: '2026-01-01', doraRows, policyRows: pol('incident_mgmt'), riskPolicyFacts: [mkFact('incident_mgmt')] };
  const treeObjs = (t) => { const o = new Set(); t.forEach(art => art.objectives.forEach(x => { if (x.id) o.add(x.id); })); return o.size; };
  const check = (capId) => ({ applicable: buildCapabilitySummary(a, capId, 'all').funnel.applicable, tree: treeObjs(buildCapabilityTree(a, capId, 'all')) });
  return { incident: check('incident_mgmt') };
});
assert(capLensConsistency.incident.applicable === capLensConsistency.incident.tree && capLensConsistency.incident.tree === 1,
  `Capability lens: funnel APPLICABLE equals the drill-down tree (funnel ${capLensConsistency.incident.applicable} = tree ${capLensConsistency.incident.tree})`);

// ── Objective-level applicability (DORA mapping): a not-applicable objective is
// excluded from the Applicable count and from the traceability (cascades to every view). ──
const applic = await page.evaluate(() => {
  if (typeof activeLens !== 'undefined') activeLens = 'dora';
  const a = db.assessments.find(x => x.id === 'demo');
  const rows = a.doraRows || [];
  const base = buildDoraObligations(rows, a.policyRows || [], a.riskPolicyFacts || []);
  const target = base.obligations.find(o => o.covered && o.applicable !== false) || base.obligations[0];
  const tid = target.obligationId;
  const mutated = rows.map(r => r.obligationId === tid ? Object.assign({}, r, { applicable: false }) : r);
  const after = buildDoraObligations(mutated, a.policyRows || [], a.riskPolicyFacts || []);
  const a2 = Object.assign({}, a, { doraRows: mutated });
  const afterTrace = new Set(buildTraceabilityRows(a2).rows.map(r => r._oKey).filter(Boolean));
  return {
    hasColumn: rows.some(r => 'applicable' in r),
    baseTotal: base.totalObligations, afterTotal: after.totalObligations, notApplicable: after.notApplicable,
    targetExcluded: !afterTrace.has(tid),
    btn: !!document.querySelector('#view-dora-import button[onclick="downloadDoraMappingCsv()"]'),
    fn: typeof window.downloadDoraMappingCsv === 'function',
  };
});
assert(applic.hasColumn, 'DORA mapping: Applicable column is parsed (rows carry the flag)');
assert(applic.afterTotal === applic.baseTotal - 1 && applic.notApplicable === 1, `Objective applicability: marking one objective N drops it from the Applicable count (${applic.baseTotal} → ${applic.afterTotal}, n/a ${applic.notApplicable})`);
assert(applic.targetExcluded, 'Objective applicability: a not-applicable objective is excluded from the traceability (cascades to every report)');
assert(applic.btn && applic.fn, 'DORA mapping: "Download current mapping (CSV)" button + function present');

// ── SOA: new upload shape (matches the on-screen table) + "download SOA" CSV round-trip ──
const soa = await page.evaluate(async () => {
  if (typeof activeLens !== 'undefined') activeLens = 'dora';
  const a = db.assessments.find(x => x.id === 'demo');
  openAssessmentForm(a.id); showView('dora-soa-import'); initDoraSoaImport();
  const orig = (typeof lensSoa === 'function') ? lensSoa(a) : (a.doraSoa || []);
  const btn = !!document.querySelector('#view-dora-soa-import button[onclick="downloadDoraSoaCsv()"]');
  const fn = typeof window.downloadDoraSoaCsv === 'function';
  // capture the download blob
  let captured = null; const oc = URL.createObjectURL; URL.createObjectURL = b => { captured = b; return 'blob:x'; };
  downloadDoraSoaCsv();
  URL.createObjectURL = oc;
  const text = captured ? await captured.text() : '';
  // quote-aware CSV parse (refs contain commas, so they are quoted by the writer)
  const parseCsv = (s) => {
    s = String(s).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const grid = []; let row = [], cur = '', inQ = false;
    for (let i = 0; i < s.length; i++) { const ch = s[i];
      if (inQ) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
      else if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); grid.push(row); row = []; cur = ''; }
      else cur += ch; }
    if (cur !== '' || row.length) { row.push(cur); grid.push(row); }
    return grid.filter(r => !(r.length === 1 && r[0] === ''));
  };
  const grid = parseCsv(text);
  const header = (grid[0] || []).join(',');
  const cols = grid[0] || [];
  const rows = grid.slice(1).map(v => { const o = {}; cols.forEach((c, i) => { o[c] = (v[i] || ''); }); return o; });
  const reparsed = buildSoaEntries(rows);
  const appCount = es => es.filter(e => e.applicable).length;
  return {
    btn, fn, header,
    origLen: orig.length, reLen: reparsed.length,
    origApp: appCount(orig), reApp: appCount(reparsed),
    idxMatch: reparsed.length > 0 && reparsed.every(e => orig.some(o => o.idx === e.idx)),
  };
});
assert(soa.btn && soa.fn, 'DORA SOA: "Download current SOA (CSV)" button + function present');
assert(soa.header === 'DORA Article / RTS,Chapter,Applicable,Coverage,Reference', `DORA SOA download: columns match the on-screen table (${soa.header})`);
assert(soa.reLen === soa.origLen && soa.reApp === soa.origApp && soa.idxMatch, `DORA SOA: download → re-upload round-trips in the new shape (${soa.origLen} items, ${soa.origApp} applicable)`);

console.log(fails === 0 ? '\n=== ALL CHECKS PASSED ===' : `\n=== ${fails} FAILED ===`);
await browser.close();
process.exit(fails ? 1 : 0);
