// End-to-end regression for the Measurable IT Regulatory Oversight Model.
//
// Loads the two-quarter demo (via the in-app loadDemoData(), which drives the
// real import pipeline), then asserts the whole reconciliation spine and the
// headline features hold: coverage funnel, source lens, Control-3 oversight
// reframe, the three evidence pages, the traceability export columns, and the
// executive "Progress since …" comparison charts.
//
// Run:  npm test            (CI installs chromium via `npx playwright install`)
//       PW_CHROMIUM=/path/to/chrome node test/verify-demo.mjs   (explicit browser)
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

// ── Seed two quarters through the real import pipeline ──
await page.evaluate(() => loadDemoData());
await page.waitForFunction(() => {
  const d = db.assessments.find(a => a.id === 'demo');
  const q = db.assessments.find(a => a.id === 'demo-q2');
  return d && q && (d.riskPolicyFacts || []).length > 0 && (q.riskPolicyFacts || []).length > 0;
}, null, { timeout: 30000 });

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
assert(base.stmts === 13 && base.backed === 11 && base.oped === 8, 'Statements reconcile (13 total · 11 backed · 8 operationalised)');
assert(base.cTotal === 13 && base.cImpl === 9 && base.cEff === 5 && base.cBlind === 1, 'Controls reconcile (13 total · 9 live · 5 effective · 1 blind spot)');
assert(base.risks === 7 && base.assessed === 6, 'Risks reconcile (7 total · 6 assessed)');

// ── Executive report (Q2 → Q3 comparison) ──
await page.evaluate(() => {
  showExecReportModal();
  document.getElementById('exec-prev-sel').value = 'demo-q2';
  document.getElementById('exec-curr-sel').value = 'demo';
  generateExecReport();
});
await page.waitForSelector('#exec-report-content .pil-grid');

// Pillar funnels reconcile with the hero scorecard (statements / operationalised / controls).
const recon = await page.evaluate(() => {
  const a = db.assessments.find(x => x.id === 'demo');
  const pil = buildPillarSummary(a).filter(p => p.inScope && p.hasData);
  const sum = (f) => pil.reduce((s, p) => s + f(p), 0);
  const sc = buildExecScorecard(a.doraRows || [], a.policyRows || [], a.riskPolicyFacts || []);
  return { pilStmt: sum(p => p.ops.total), heroStmt: sc.control2.d, pilCtrlImpl: sum(p => p.controls.implemented), pilCtrlEff: sum(p => p.controls.effective) };
});
assert(recon.pilStmt === recon.heroStmt, `Pillar statements ${recon.pilStmt} == hero ${recon.heroStmt}`);
assert(recon.pilCtrlImpl === base.cImpl && recon.pilCtrlEff === base.cEff, 'Pillar control totals tie to backing-control ops');

// Coverage funnel (shared pillar card) nests monotonically.
const funNames = await page.$$eval('#exec-report-content .pil-grid .exfun-name', n => n.map(x => x.childNodes[0].textContent.trim()).slice(0, 4));
assert(JSON.stringify(funNames) === JSON.stringify(['Applicable', 'Documented', 'Implemented', 'Effective']), `Funnel stages → ${JSON.stringify(funNames)}`);

// Control 3 reframed to the oversight lens + blind spot surfaced.
const c3 = await page.$eval('#exec-report-content .card:has(.ex3-quad) .measure-card-title', e => e.textContent);
assert(/oversight|identifying ineffective/i.test(c3), `Control 3 reframed → "${c3}"`);
const c3desc = await page.$eval('#exec-report-content .card:has(.ex3-quad) .measure-card-desc', e => e.textContent);
assert(/current RCSA verdict/i.test(c3desc) && /owned by control owners/i.test(c3desc), 'Control 3 states oversight measure + owner-attributed outcome');

// Progress charts: three comparison charts, each with SVG + Export PNG, with movement.
const charts = await page.$$eval('#exec-report-content .exprog-chart', els => els.map(e => ({ name: e.getAttribute('data-name'), svg: !!e.querySelector('svg'), png: !!e.querySelector('.exprog-png') })));
assert(charts.length === 3 && charts.every(c => c.svg && c.png), 'Three progress charts, each with SVG + Export PNG');
assert(['dora-risk-coverage', 'dora-control-maturity', 'dora-residual-heatmap'].every(n => charts.some(c => c.name === n)), 'Charts: risk coverage / control maturity / residual heatmap');
const heatChips = await page.$$eval('#exec-report-content .exprog-chart[data-name="dora-residual-heatmap"] svg rect[rx="7"]', r => r.length);
assert(heatChips >= 3, `Residual heatmap renders risk chips (${heatChips})`);
const moved = await page.evaluate(() => {
  const c = execProgMetrics(db.assessments.find(x => x.id === 'demo'));
  const p = execProgMetrics(db.assessments.find(x => x.id === 'demo-q2'));
  return c.cImpl > p.cImpl && c.cEff > p.cEff;
});
assert(moved, 'Control maturity grew Q2 → Q3 (dumbbells show movement)');
const exported = await page.evaluate(() => new Promise(resolve => {
  const orig = HTMLAnchorElement.prototype.click; let got = null;
  HTMLAnchorElement.prototype.click = function () { got = this.download; };
  try { exportExecChart(document.querySelector('.exprog-chart[data-name="dora-control-maturity"] .exprog-png')); } catch (e) { resolve('throw:' + e.message); return; }
  setTimeout(() => { HTMLAnchorElement.prototype.click = orig; resolve(got); }, 700);
}));
assert(exported === 'dora-control-maturity.png', `Export PNG triggers a download (${exported})`);

// ── Evidence pages ──
const exec = await page.evaluate(() => {
  const a = db.assessments.find(x => x.id === 'demo');
  const sops = buildStatementOps(a.policyRows || [], a.riskPolicyFacts || []);
  const bops = buildBackingControlOps(a.policyRows || [], a.riskPolicyFacts || []);
  return { total: sops.all.total, backed: sops.all.backed, oped: sops.all.operationalised, cTotal: bops.total, cImpl: bops.implemented, cEff: bops.liveEffective };
});
const firstEvTable = '#evidence-content table.ev-tbl:not(.ev-reg-tbl)';
// Control 1 — Accountable column after Statement header + SOA display
await page.evaluate(() => { showEvidenceModal(); document.getElementById('evidence-sel').value = 'demo'; generateEvidence(1); });
await page.waitForSelector('#evidence-content .ev-soa-tbl');
const c1 = await page.evaluate((sel) => {
  const heads = [...document.querySelectorAll(sel + ' thead th')].map(t => t.textContent.trim());
  const ai = heads.indexOf('Accountable'), hi = heads.indexOf('Statement header');
  const soaApp = document.querySelectorAll('#evidence-content .ev-soa-tbl tbody tr.soa-row-app').length;
  const covered = [...document.querySelectorAll(sel + ' tbody tr')].find(tr => tr.children[4] && tr.children[4].textContent.trim() === 'Covered');
  return { ai, hi, soaApp, owner: covered ? covered.children[ai].textContent.trim() : '' };
}, firstEvTable);
assert(c1.ai === c1.hi + 1 && c1.owner && c1.owner !== '—', `Control 1 Accountable column after Statement header (${c1.owner})`);
assert(c1.soaApp === 39, `Control 1 SOA shows 39 applicable items (${c1.soaApp})`);
// Control 2 — statement→control matrix with Control owner
await page.evaluate(() => { showEvidenceModal(); document.getElementById('evidence-sel').value = 'demo'; generateEvidence(2); });
await page.waitForSelector(firstEvTable);
const c2 = await page.evaluate((sel) => {
  const heads = [...document.querySelectorAll(sel + ' thead th')].map(t => t.textContent.trim());
  const bi = heads.indexOf('Backed by control'), si = heads.indexOf('Status');
  const trs = [...document.querySelectorAll(sel + ' tbody tr')]; const cell = (t, i) => t.children[i].textContent.trim();
  return { rows: trs.length, backed: trs.filter(t => cell(t, bi) === 'Yes').length, oped: trs.filter(t => cell(t, bi) === 'Yes' && cell(t, si) === 'Implemented').length, hasOwner: heads.includes('Control owner') };
}, firstEvTable);
assert(c2.rows === exec.total && c2.backed === exec.backed && c2.oped === exec.oped, `Control 2 reconciles (${c2.rows}/${c2.backed}/${c2.oped})`);
assert(c2.hasOwner, 'Control 2 has a Control owner column');
// Control 3 — RCSA effectiveness view (control×risk) + findings register
await page.evaluate(() => { showEvidenceModal(); document.getElementById('evidence-sel').value = 'demo'; generateEvidence(3); });
await page.waitForSelector(firstEvTable);
const c3e = await page.evaluate((sel) => {
  const heads = [...document.querySelectorAll(sel + ' thead th')].map(t => t.textContent.trim());
  const si = heads.indexOf('Status'), ei = heads.indexOf('Effectiveness');
  const trs = [...document.querySelectorAll(sel + ' tbody tr')]; const cell = (t, i) => t.children[i].textContent.trim();
  return {
    heads, rows: trs.length,
    impl: trs.filter(t => cell(t, si) === 'Implemented').length,
    eff: trs.filter(t => cell(t, si) === 'Implemented' && cell(t, ei) === 'Effective').length,
    notAssessed: trs.filter(t => cell(t, ei) === 'Not assessed').length,
    reg: document.querySelector('#evidence-content table.ev-reg-tbl tbody')?.children.length || 0,
  };
}, firstEvTable);
assert(c3e.rows === exec.cTotal && c3e.impl === exec.cImpl && c3e.eff === exec.cEff, `Control 3 reconciles (${c3e.rows}/${c3e.impl}/${c3e.eff})`);
assert(['ICT Risk', 'Design', 'Operating', 'Inherent → Residual', 'Control owner', 'Last assessed'].every(h => c3e.heads.includes(h)), `Control 3 carries RCSA columns → ${JSON.stringify(c3e.heads)}`);
assert(c3e.notAssessed === 1 && c3e.reg >= 1, `Control 3 blind spot + findings register (${c3e.notAssessed} not-assessed, ${c3e.reg} register rows)`);

// ── Main-screen traceability export: Accountability + Control owner columns ──
await page.evaluate(() => { closeEvidenceModal && closeEvidenceModal(); showView('dashboard'); });
await page.waitForSelector('.trace-tbl');
const tr = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.trace-tbl thead th')].map(t => t.textContent.trim());
  const sd = heads.indexOf('Statement detail'), ac = heads.indexOf('Accountability');
  const cd = heads.indexOf('Control description'), co = heads.indexOf('Control owner');
  const trs = [...document.querySelectorAll('.trace-tbl tbody tr')];
  const nonEmpty = i => trs.filter(t => (t.children[i]?.innerText || '').trim()).length;
  return { ac, sd, co, cd, acData: ac >= 0 ? nonEmpty(ac) : 0, coData: co >= 0 ? nonEmpty(co) : 0 };
});
assert(tr.ac === tr.sd + 1 && tr.acData > 0, 'Traceability: Accountability after Statement detail, populated');
assert(tr.co === tr.cd + 1 && tr.coData > 0, 'Traceability: Control owner after Control description, populated');

console.log(fails === 0 ? '\n=== ALL CHECKS PASSED ===' : `\n=== ${fails} FAILED ===`);
await browser.close();
process.exit(fails ? 1 : 0);
