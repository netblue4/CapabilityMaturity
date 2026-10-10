// ── One-click demo loader ─────────────────────────────────────────
// Seeds TWO assessments — Q2 2026 (less mature) and Q3 2026 — by driving the
// real import pipeline (the exact functions the upload wizards call), so the
// seeded demo is identical to a manual import and the executive report's
// "Progress since …" charts show real movement out of the box.
//
// It fetches the sample CSVs from docs/sample-data and feeds them into the
// hidden file inputs, then runs each wizard's process/save step. Because it uses
// the production pipeline, it is also what the end-to-end test uses to set up.
(function () {
  const BASE = 'docs/sample-data/';

  // Wait for a wizard section to become VISIBLE. The sections toggle display, and
  // are reset to the upload step at the start of each import — so visibility is a
  // reliable "this step is ready now" signal, unlike element existence (which can
  // match stale nodes left over from a previous import).
  function waitVisible(id, ms) {
    ms = ms || 10000;
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function poll() {
        const el = document.getElementById(id);
        if (el && el.offsetParent !== null) return resolve();
        if (Date.now() - t0 > ms) return reject(new Error('demo-seed timeout waiting for ' + id));
        setTimeout(poll, 25);
      })();
    });
  }
  async function feed(inputId, file) {
    const res = await fetch(BASE + file);
    if (!res.ok) throw new Error('could not fetch ' + file + ' (' + res.status + ')');
    const text = await res.text();
    const f = new File([text], file, { type: 'text/csv' });
    const dt = new DataTransfer(); dt.items.add(f);
    const el = document.getElementById(inputId);
    el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  // Import an objective→statement mapping into the CURRENT lens's slot.
  async function importMapping(id, file) {
    openAssessmentForm(id); showView('dora-import'); initDoraImport();
    await feed('dora-file-input', file);
    await waitVisible('dora-review'); saveDoraImport();
  }
  // Import policy statements into the CURRENT lens's slot (groups auto-map for
  // MiCA/NIST; DORA maps onto CONFIG capabilities).
  async function importPolicy(id, file) {
    openAssessmentForm(id); showView('policy-import'); initPolicyImport();
    await feed('pi-file-input', file);
    await waitVisible('pi-mapping'); processPolicyImport();
    await waitVisible('pi-review'); savePolicyImport();
  }
  // Import a Statement of Applicability into the CURRENT lens's slot.
  async function importSoa(id, file) {
    openAssessmentForm(id); showView('dora-soa-import'); initDoraSoaImport();
    await feed('dora-soa-file-input', file);
    await waitVisible('dora-soa-review'); saveDoraSoaImport();
  }

  // Import all sources into one assessment, via the real wizards. The policy
  // statements, risks and controls (the single control framework) are shared;
  // DORA, MiCA and NIST are added as separate regulatory-lens modules — each is
  // just another SOA + objective mapping written to its own slot.
  async function importAssessment(id, label, date, riskFile) {
    db.assessments = db.assessments.filter(a => a.id !== id);
    db.assessments.push({ id: id, label: label, date: date });
    // ── DORA lens ── SOA + policy (by Capability) + mapping
    if (typeof activeLens !== 'undefined') activeLens = 'dora';
    await importPolicy(id, 'demo-policy.csv');
    await importMapping(id, 'demo-dora.csv');
    await importSoa(id, 'demo-soa.csv');
    // ── MiCA lens ── SOA + policy (by Service) + mapping
    if (typeof activeLens !== 'undefined') {
      activeLens = 'mica';
      await importPolicy(id, 'mica-policy.csv');
      await importMapping(id, 'mica.csv');
      await importSoa(id, 'mica-soa.csv');
      // ── NIST CSF lens ── SOA + policy (by Category) + mapping
      activeLens = 'nist';
      await importPolicy(id, 'nist-policy.csv');
      await importMapping(id, 'nist.csv');
      await importSoa(id, 'nist-soa.csv');
      activeLens = 'dora';
    }
    // ── Shared control framework ── risk & control (RCSA). Rebuilds per-lens facts.
    openAssessmentForm(id); showView('riskonnect-import'); initRiskonnectImport();
    await feed('rk-file-input', riskFile);
    await waitVisible('rk-mapping'); processRkImport();
    await waitVisible('rk-review');
    document.getElementById('rk-assessment-sel').value = id; saveRkImport();
  }

  async function loadDemoData() {
    const btn = document.getElementById('btn-load-demo');
    const orig = btn ? btn.textContent : '';
    const userLens = (typeof activeLens !== 'undefined') ? activeLens : 'dora';
    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Loading demo…'; }
      await importAssessment('demo-q2', 'Q2 2026', '2026-06-30', 'demo-risk-q2.csv');
      await importAssessment('demo', 'Q3 2026', '2026-09-30', 'demo-risk.csv');
      db.assessments.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
      // Restore whatever lens the user was on before seeding.
      if (typeof activeLens !== 'undefined') activeLens = userLens;
      if (typeof updateLensSwitchUI === 'function') updateLensSwitchUI();
      showView('dashboard');
    } catch (e) {
      console.error(e);
      alert('Could not load the demo data: ' + e.message);
    } finally {
      if (typeof activeLens !== 'undefined') activeLens = userLens;
      if (typeof updateLensSwitchUI === 'function') updateLensSwitchUI();
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  }

  window.loadDemoData = loadDemoData;
})();
