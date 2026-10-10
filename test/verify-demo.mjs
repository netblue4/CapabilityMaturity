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

// ── DORA Forum report (Q2 → Q3 comparison) ──
await page.evaluate(() => {
  showReportModal('dora');
  document.getElementById('exec-prev-sel').value = 'demo-q2';
  document.getElementById('exec-curr-sel').value = 'demo';
  generateDoraForumReport();
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

// DORA Forum carries the traceability table (moved from the main screen) and NO progress charts.
await page.waitForSelector('#exec-report-content .trace-tbl');
assert((await page.$$('#exec-report-content .exprog-chart')).length === 0, 'DORA Forum report has no progress charts (moved to ROC)');
const dfTrace = await page.$$eval('#exec-report-content .trace-tbl thead th', th => th.map(t => t.textContent.trim()));
assert(dfTrace.includes('Accountability') && dfTrace.includes('Control owner'), `DORA Forum traceability present (${dfTrace.length} cols)`);
// Control 1/2/3 tables are inside collapsed blocks for readability.
const collapsed = await page.$$eval('#exec-report-content .act-block.collapsed .act-hdr', e => e.length);
assert(collapsed >= 3, `Control 1/2/3 tables collapsed (${collapsed} blocks)`);

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

// DORA Forum traceability columns: Accountability after Statement detail, Control owner after Control description.
const tr = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('#exec-report-content .trace-tbl thead th')].map(t => t.textContent.trim());
  const sd = heads.indexOf('Statement detail'), ac = heads.indexOf('Accountability');
  const cd = heads.indexOf('Control description'), co = heads.indexOf('Control owner');
  const trs = [...document.querySelectorAll('#exec-report-content .trace-tbl tbody tr')];
  const nonEmpty = i => trs.filter(t => (t.children[i]?.innerText || '').trim()).length;
  return { ac, sd, co, cd, acData: ac >= 0 ? nonEmpty(ac) : 0, coData: co >= 0 ? nonEmpty(co) : 0 };
});
assert(tr.ac === tr.sd + 1 && tr.acData > 0, 'Traceability: Accountability after Statement detail, populated');
assert(tr.co === tr.cd + 1 && tr.coData > 0, 'Traceability: Control owner after Control description, populated');

// ── ROC report (Q2 → Q3): progress charts over the FULL register + full extract ──
await page.evaluate(() => {
  closeEvidenceModal && closeEvidenceModal();
  showReportModal('roc');
  document.getElementById('exec-prev-sel').value = 'demo-q2';
  document.getElementById('exec-curr-sel').value = 'demo';
  generateRocReport();
});
await page.waitForSelector('#roc-report-content .exprog-section');
const charts = await page.$$eval('#roc-report-content .exprog-chart', els => els.map(e => ({ name: e.getAttribute('data-name'), svg: !!e.querySelector('svg'), rrh: !!e.querySelector('.rrh'), png: !!e.querySelector('.exprog-png') })));
assert(charts.length === 3, 'ROC: three progress charts render');
// The two dumbbell charts are SVG; the residual heatmap is now HTML lanes (.rrh).
assert(charts.filter(c => c.svg).length === 2, 'ROC: risk-coverage + control-maturity render an SVG');
assert(charts.some(c => c.name === 'dora-residual-heatmap' && c.rrh), 'ROC: residual heatmap renders HTML lanes');
assert(charts.every(c => !c.png), 'ROC: Export PNG buttons removed');
assert(['dora-risk-coverage', 'dora-control-maturity', 'dora-residual-heatmap'].every(n => charts.some(c => c.name === n)), 'ROC charts: risk coverage / control maturity / residual heatmap');
const heatChips = await page.$$eval('#roc-report-content .exprog-chart[data-name="dora-residual-heatmap"] .rrh-chip', r => r.length);
assert(heatChips >= 3, `ROC residual heatmap chips (${heatChips})`);
const moved = await page.evaluate(() => {
  const c = execProgMetrics(db.assessments.find(x => x.id === 'demo'));
  const p = execProgMetrics(db.assessments.find(x => x.id === 'demo-q2'));
  return c.cImpl > p.cImpl && c.cEff > p.cEff;
});
assert(moved, 'ROC control maturity grew Q2 → Q3');
const cmText = await page.$eval('#roc-report-content .exprog-chart[data-name="dora-control-maturity"] svg', s => s.textContent);
assert(/Not assessed/.test(cmText), 'Control maturity has a "Not assessed" (blind-spot) bar');
// The heatmap renders HTML lanes (HIGH/MODERATE/LOW/NOT ASSESSED) so full risk
// names show without truncation and the font never upscales on a wide card.
const heatLanes = await page.$$eval('#roc-report-content .exprog-chart[data-name="dora-residual-heatmap"] .rrh-band', bs => bs.map(b => b.textContent.trim()));
assert(heatLanes.includes('NOT ASSESSED'), `ROC heatmap has a NOT ASSESSED lane (${heatLanes.join(', ')})`);
const heatFullNames = await page.$$eval('#roc-report-content .exprog-chart[data-name="dora-residual-heatmap"] .rrh-chip', cs => cs.every(c => !/…/.test(c.textContent)));
assert(heatFullNames, 'ROC heatmap chips show full risk names (no "…" truncation)');
// Progress cards count the FULL register (ties to the full extract), not DORA-mapped only.
const regTie = await page.evaluate(() => {
  const a = db.assessments.find(x => x.id === 'demo');
  const m = execProgMetrics(a);
  const facts = (a.riskPolicyFacts || []).filter(f => !ftIsClosedControl(f) && (f.controlName || '').trim());
  const keys = new Set(facts.map(f => f.capId + '|' + ftNorm(f.controlNumber) + '|' + ftNorm(f.controlName)));
  return { cardTotal: m.cDraft + m.cImpl, distinct: keys.size };
});
assert(regTie.cardTotal === regTie.distinct, `ROC control total ${regTie.cardTotal} == full-register distinct controls ${regTie.distinct}`);
// ROC report carries the full extract table underneath.
await page.waitForSelector('#roc-report-content .rcx-tbl');
const rcx = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('#roc-report-content .rcx-tbl thead th')].map(t => t.textContent.trim());
  const rows = document.querySelectorAll('#roc-report-content .rcx-tbl tbody tr').length;
  const a = db.assessments.find(x => x.id === 'demo');
  const facts = (a.riskPolicyFacts || []).filter(f => !ftIsClosedControl(f) && (f.controlName || '').trim()).length;
  return { heads, rows, facts };
});
assert(rcx.rows === rcx.facts, `ROC full extract: one row per non-closed control fact (${rcx.rows} == ${rcx.facts})`);
assert(['Risk', 'Risk owner', 'Control No. & Name', 'DORA statement ref(s)'].every(h => rcx.heads.includes(h)),
  `ROC full extract columns → ${JSON.stringify(rcx.heads)}`);

// ══════════════════════════════════════════════════════════════════
// Regulatory-lens modules (DORA / MiCA / NIST CSF)
// ══════════════════════════════════════════════════════════════════
// The demo seeds all three lenses into each assessment, sharing one control
// framework. Verify the switch re-scopes the main screen and that DORA is intact.
await page.evaluate(() => showView('dashboard'));
const lensData = await page.evaluate(() => {
  const a = db.assessments.find(x => x.id === 'demo');
  return { mica: (a.micaRows || []).length, micaSoa: (a.micaSoa || []).length,
           nist: (a.nistRows || []).length, nistSoa: (a.nistSoa || []).length,
           dora: (a.doraRows || []).length };
});
assert(lensData.mica > 0 && lensData.micaSoa > 0, `MiCA module seeded (${lensData.mica} objectives, ${lensData.micaSoa} SOA)`);
assert(lensData.nist > 0 && lensData.nistSoa > 0, `NIST module seeded (${lensData.nist} objectives, ${lensData.nistSoa} SOA)`);

// Read the Control-1 card under each lens.
async function lensCard(lens) {
  await page.evaluate(k => setActiveLens(k), lens);
  await page.waitForTimeout(80);
  return await page.evaluate(() => {
    const el = document.querySelector('#dora-card-row .measure-card');
    const b = document.querySelector('#dora-card-row .dora-uncov-block');
    if (b) b.classList.remove('collapsed');
    return {
      title: el ? (el.querySelector('.measure-card-title') || {}).textContent || '' : '',
      desc: el ? (el.querySelector('.measure-card-desc') || {}).textContent || '' : '',
      pills: [...new Set([...document.querySelectorAll('#dora-card-row .pil-tag')].map(x => x.textContent))],
    };
  });
}
const Ld = await lensCard('dora');
assert(/DORA/.test(Ld.title) && /DORA objectives/.test(Ld.desc), 'DORA lens: Control-1 titled for DORA');
const Lm = await lensCard('mica');
assert(/MiCA/.test(Lm.title) && /MiCA objectives/.test(Lm.desc), 'MiCA lens: Control-1 re-titled for MiCA');
assert(Lm.pills.some(p => /Client Assets|Prudential|Conduct|Market Integrity/.test(p)), `MiCA lens: pillar tags are MiCA domains (${Lm.pills.join(', ')})`);
assert(!Lm.pills.some(p => /Risk Management|Third-Party Risk/.test(p)), 'MiCA lens: no DORA pillar labels leak in');
const Ln = await lensCard('nist');
assert(/NIST/.test(Ln.title), 'NIST lens: Control-1 re-titled for NIST CSF');
assert(Ln.pills.some(p => /Govern|Recover|Protect|Identify/.test(p)), `NIST lens: pillar tags are NIST functions (${Ln.pills.join(', ')})`);

// Switching back to DORA restores the exact DORA view (byte-for-byte).
const Ld2 = await lensCard('dora');
assert(Ld2.title === Ld.title && Ld2.desc === Ld.desc, 'Switching back to DORA restores the DORA Control-1 card');

console.log(fails === 0 ? '\n=== ALL CHECKS PASSED ===' : `\n=== ${fails} FAILED ===`);
await browser.close();
process.exit(fails ? 1 : 0);
