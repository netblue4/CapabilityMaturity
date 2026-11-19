// ══════════════════════════════════════════════════════════════════
// Policy & Group Standards Attenuation report.
// One card per capability (styled like the DORA Reporting "By DORA pillar"
// cards). Each card lists the policy & group-standard statements applicable to
// that capability, the control(s) that implement them, and each control's
// effectiveness — i.e. how far each statement is "attenuated" by working
// controls. Reads buildStatementCoverage, so the figures reconcile with the
// DORA Reporting Control 2/3 evidence.
// ══════════════════════════════════════════════════════════════════

// Effectiveness chip for one control behind a statement.
function pgsaEffChip(c) {
  if (!c || c.status !== 'implemented') return '<span class="bd-chip bd-tone-muted">Draft</span>';
  return c.effective
    ? '<span class="bd-chip bd-tone-ok">Effective</span>'
    : '<span class="bd-chip bd-tone-warn">Not effective</span>';
}

function pgsaSrcChip(src) {
  const gs = /group/i.test(src || '');
  return `<span class="pgsa-src ${gs ? 'pgsa-src-gs' : 'pgsa-src-lp'}">${escHtml(src || '—')}</span>`;
}

function renderPgsaReport(currentA) {
  const cov  = buildStatementCoverage(currentA.policyRows || [], currentA.riskPolicyFacts || []);
  const caps = CONFIG.capabilities || [];
  const capNm = id => (caps.find(c => c.id === id) || {}).name || id;

  // Group statements by capability; order by the config capability order, then
  // any capId not in config (safety), skipping capabilities with no statements.
  const byCap = {};
  cov.statements.forEach(s => { (byCap[s.capId] = byCap[s.capId] || []).push(s); });
  const order = caps.map(c => c.id).filter(id => byCap[id]);
  Object.keys(byCap).forEach(id => { if (!order.includes(id)) order.push(id); });

  const stmtRow = s => {
    const ctrls = s.controls || [];
    const ctrlCell = ctrls.length
      ? ctrls.map(c => `<div class="pgsa-ctrl"><span class="pgsa-ctrl-name">${escHtml((c.number ? c.number + ' · ' : '') + c.name)}</span>${pgsaEffChip(c)}</div>`).join('')
      : (s.exception
          ? `<span class="pgsa-none pgsa-exc">Disclosed exception: ${escHtml(s.exception)}</span>`
          : `<span class="pgsa-none">No control yet</span>`);
    return `<div class="pgsa-row">
      <span class="pgsa-stmt"><b>${escHtml(s.ref || '—')}</b><small>${escHtml(s.header || '')}</small></span>
      <span class="pgsa-srccell">${pgsaSrcChip(s.source)}</span>
      <span class="pgsa-ctrls">${ctrlCell}</span>
    </div>`;
  };

  const cards = order.map(id => {
    const list = byCap[id].slice().sort((a, b) => String(a.ref).localeCompare(String(b.ref)));
    const n = list.length;
    const withCtrl = list.filter(s => s.hasControl).length;
    return `<section class="bd-sec bd-pillar pgsa-card">
      <div class="bd-sec-hd"><h2>${escHtml(capNm(id))}</h2><span>${withCtrl}/${n} statement${n === 1 ? '' : 's'} implemented by a control</span></div>
      <div class="bd-table-wrap"><div class="pgsa-table">
        <div class="pgsa-head"><span>Policy / Group Standard statement</span><span>Source</span><span>Control(s) &amp; effectiveness</span></div>
        ${list.map(stmtRow).join('')}
      </div></div>
    </section>`;
  }).join('');

  const app = (CONFIG && CONFIG.appTitle) || 'Measurable IT Regulatory Oversight Model';
  return `<div class="bd-summary">
    <div class="bd-top">
      <div>
        <div class="exsc-eyebrow">◈ ${escHtml(app)}</div>
        <h2 class="exsc-title bd-doc-title">Policy &amp; Group Standards Attenuation</h2>
        <div class="bd-sub">${escHtml(currentA.label)} · ${formatDate(currentA.date)} · how each statement is attenuated by its controls</div>
      </div>
      <div class="bd-actions no-print">
        <button type="button" class="bd-btn" onclick="window.print()">Print / save PDF</button>
      </div>
    </div>
    ${cards || '<section class="bd-sec"><p class="bd-pillar-empty">No policy or group-standard statements imported yet.</p></section>'}
  </div>`;
}

function generatePgsaReport() {
  const currentA = db.assessments.find(a => a.id === document.getElementById('exec-curr-sel').value);
  if (!currentA) return;
  closeExecReportModal();
  if (typeof setImportLens === 'function') setImportLens('dora');
  if (typeof updateSiteSubtitle === 'function') updateSiteSubtitle();
  const runWithLens = (typeof withLens === 'function') ? withLens : (k, fn) => fn();
  const content = document.getElementById('pgsa-report-content');
  content.classList.add('board');
  content.innerHTML = runWithLens('dora', () => renderPgsaReport(currentA));
  showView('pgsa-report');
}

if (typeof window !== 'undefined') {
  window.generatePgsaReport = generatePgsaReport;
  window.renderPgsaReport = renderPgsaReport;
}
