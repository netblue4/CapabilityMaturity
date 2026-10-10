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
assert(!doraRep.pillGrid, 'DORA Reporting: DORA Pillar cards removed');
assert(doraRep.caplens, 'DORA Reporting: Capability Lens card moved in');
assert(doraRep.heatmap && doraRep.heatNotAssessed, 'DORA Reporting Control 3: residual risk heatmap (with NOT ASSESSED lane)');
assert(doraRep.heatLegend, 'DORA Reporting Control 3: heatmap legend explains risks threaten DORA objectives');
assert(doraRep.copyBtns >= 4, `DORA Reporting: Copy-for-Excel on each detail block (${doraRep.copyBtns})`);
assert(doraRep.ownCollapsed, 'DORA Reporting: ownership detail table is collapsible');

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

console.log(fails === 0 ? '\n=== ALL CHECKS PASSED ===' : `\n=== ${fails} FAILED ===`);
await browser.close();
process.exit(fails ? 1 : 0);
