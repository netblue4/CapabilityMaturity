// ── Evidence pages (Control 1 / 2 / 3) ────────────────────────────
//
// Three self-contained, print-ready pages — one per Riskonnect control — that
// evidence the regulatory-oversight methodology end to end:
//   Control 1 — Regulatory SOA: DORA obligations backed by an owned statement (completeness / Gate 1)
//   Control 2 — those statements are backed by a control, and owned
//   Control 3 — those controls are operationalised (live/effective), with exceptions
// All three read the single buildDoraObligations model, so their figures
// reconcile with the dashboard card and with each other. Each renders into the
// #view-evidence view; the user prints or saves it as PDF (window.print()).

(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function capName(id) { return (CONFIG.capabilities || []).find(c => c.id === id)?.name || id; }
  function appName()   { return (CONFIG && CONFIG.appTitle) || 'Measurable IT Regulatory Oversight Model'; }

  // ── Chooser modal ────────────────────────────────────────────────
  function showEvidenceModal() {
    if (!db.assessments.length) { alert('No assessments yet — create one and import your data first.'); return; }
    const opts = db.assessments.map(a => `<option value="${a.id}">${esc(a.label)} · ${formatDate(a.date)}</option>`).join('');
    const sel = document.getElementById('evidence-sel');
    sel.innerHTML = opts;
    sel.value = db.assessments[db.assessments.length - 1].id;
    document.getElementById('evidence-modal').style.display = 'flex';
  }
  function closeEvidenceModal() { document.getElementById('evidence-modal').style.display = 'none'; }

  function generateEvidence(control) {
    const a = db.assessments.find(x => x.id === document.getElementById('evidence-sel').value);
    if (!a) return;
    closeEvidenceModal();
    const model = buildDoraObligations(a.doraRows || [], a.policyRows || [], a.riskPolicyFacts || []);
    const meta  = { label: a.label, date: formatDate(a.date) };
    const html = control === 1 ? evidenceControl1(model, meta)
               : control === 2 ? evidenceControl2(model, meta)
               :                  evidenceControl3(model, meta);
    document.getElementById('evidence-content').innerHTML = html;
    showView('evidence');
    window.scrollTo(0, 0);
  }

  // ── Shared page chrome ───────────────────────────────────────────
  function pageHead(controlName, subtitle, meta, stat) {
    const title = `${esc(appName())} — ${esc(controlName)}`;
    const sub   = `${esc(meta.label)} · ${esc(meta.date)}${subtitle ? ' · ' + subtitle : ''}`;
    return `
      <div class="ev-top no-print">
        <div><h2 class="ev-title">${title}</h2><p class="ev-sub">${sub}</p></div>
        <button class="btn btn-outline" onclick="window.print()">🖨 Print / Save PDF</button>
      </div>
      <div class="ev-top print-only" style="display:none">
        <h2 class="ev-title">${title}</h2><p class="ev-sub">${sub}</p>
      </div>
      <div class="ev-stat">${stat}</div>`;
  }
  function statPill(n, d, label, warnWhenShort) {
    const pct = d > 0 ? Math.round(100 * n / d) : 0;
    const warn = warnWhenShort && n < d ? ' ev-pill-warn' : '';
    return `<span class="ev-pill${warn}"><b>${n}</b>/<span class="ev-pill-d">${d}</span> <span class="ev-pill-lbl">${label}</span> <span class="ev-pill-pct">${pct}%</span></span>`;
  }

  // Deduped mapped statements across covered obligations (Control 2 & 3 unit).
  function collectStatements(model) {
    const byKey = {};
    model.obligations.forEach(o => {
      o.mappedRefs.forEach(m => {
        const k = m.capId + '||' + (m.ref || '').toLowerCase();
        if (!byKey[k]) byKey[k] = Object.assign({}, m, { obligations: new Set() });
        byKey[k].obligations.add(o.obligationId);
      });
    });
    return Object.values(byKey)
      .map(s => Object.assign({}, s, { obligations: [...s.obligations] }))
      .sort((a, b) => (a.source || '').localeCompare(b.source) || a.ref.localeCompare(b.ref));
  }

  // ── Control 1 — Regulatory SOA completeness ──────────────────────
  function evidenceControl1(model, meta) {
    const covered = model.coveredObligations, total = model.totalObligations;
    const stat = statPill(covered, total, 'obligations backed by an owned statement', true)
      + `<span class="ev-note">Completeness is the Gate-1 precondition: an obligation with no owned policy or group-standard statement is a compliance gap regardless of downstream control activity.</span>`;

    const blocks = model.articles.map(a => {
      const cov = a.obligations.filter(o => o.covered).length;
      const body = a.obligations.map(o => `
        <tr class="${o.covered ? '' : 'ev-row-gap'}">
          <td class="ev-obl">${esc(o.obligationId)}</td>
          <td class="ev-req">${esc(o.requirement)}</td>
          <td class="ev-cov">${o.covered ? '<span class="ev-yes">Covered</span>' : '<span class="ev-no">Uncovered</span>'}</td>
          <td class="ev-refs">${o.mappedRefs.length ? o.mappedRefs.map(m => `<span class="ev-ref">${esc(m.ref)}</span>`).join(' ') : '<span class="ev-dash">— no matching statement —</span>'}</td>
        </tr>`).join('');
      return `
        <div class="ev-art">
          <div class="ev-art-hdr"><span>${esc(a.article)}</span><span class="ev-art-cov">${cov}/${a.obligations.length} covered</span></div>
          <table class="ev-tbl">
            <thead><tr><th>Obligation</th><th>Requirement</th><th>Coverage</th><th>Owned statement(s)</th></tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>`;
    }).join('');

    return pageHead('Control 1 · Regulatory SOA (DORA obligation completeness)', 'obligation → owned statement', meta, stat) + blocks;
  }

  // ── Control 2 — statements backed by a control, and owned ────────
  function evidenceControl2(model, meta) {
    const stmts  = collectStatements(model);
    const backed = stmts.filter(s => s.backing !== 'Uncovered').length;
    const owned  = stmts.filter(s => s.owner).length;
    const stat = statPill(backed, stmts.length, 'mapped statements backed by a control', true)
      + statPill(owned, stmts.length, 'with a named accountable owner', true)
      + `<span class="ev-note">Every DORA obligation shown in Control 1 as covered is backed here by an owned policy or group-standard statement and at least one control that cites it.</span>`;

    const body = stmts.map(s => `
      <tr class="${s.backing === 'Uncovered' ? 'ev-row-gap' : ''}">
        <td class="ev-ref-c"><span class="ev-ref">${esc(s.ref)}</span></td>
        <td class="ev-hdr-c">${esc(s.header)}</td>
        <td>${esc(s.source)}</td>
        <td class="ev-cap-c" title="${esc(capName(s.capId))}">${esc(shortName(capName(s.capId)))}</td>
        <td>${esc(s.owner) || '<span class="ev-no">Unassigned</span>'}</td>
        <td>${s.backing !== 'Uncovered' ? '<span class="ev-yes">Backed</span>' : '<span class="ev-no">No control</span>'}</td>
        <td class="ev-obls">${s.obligations.map(esc).join(', ')}</td>
      </tr>`).join('');

    return pageHead('Control 2 · Policy statements backed by controls', 'statement → control + owner', meta, stat) + `
      <table class="ev-tbl ev-tbl-wide">
        <thead><tr><th>Statement ref</th><th>Statement header</th><th>Source</th><th>Capability</th><th>Accountable owner</th><th>Backed by control</th><th>Obligation(s)</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  }

  // ── Control 3 — controls operationalised (live/effective) + exceptions ──
  function evidenceControl3(model, meta) {
    const stmts   = collectStatements(model).filter(s => s.backing !== 'Uncovered');
    const impl    = stmts.filter(s => s.status === 'implemented').length;
    const eff     = stmts.filter(s => s.effective).length;
    const excs    = stmts.filter(s => s.exception).length;
    const stat = statPill(impl, stmts.length, 'backing controls implemented / live', true)
      + statPill(eff, impl, 'of live controls rated effective', true)
      + `<span class="ev-pill ev-pill-plain"><b>${excs}</b> <span class="ev-pill-lbl">with an approved exception (E / WT / WP)</span></span>`
      + `<span class="ev-note">Control effectiveness is verified through the business-as-usual risk-and-control assessment cycle; exceptions record obligations we consciously waive or defer, with an approval on file.</span>`;

    const backLbl = { 'Built new': 'Built (new DORA control)', 'Reused pre-DORA': 'Reused (pre-DORA control)', 'Drafted': 'Drafted (not yet live)' };
    const statusCell = s => s.status === 'implemented'
      ? '<span class="ev-yes">Live</span>'
      : '<span class="ev-mid">Draft</span>';
    const effCell = s => s.status !== 'implemented' ? '<span class="ev-dash">—</span>'
      : s.effective ? '<span class="ev-yes">Effective</span>' : '<span class="ev-mid">Not yet</span>';
    const excCell = s => s.exception ? `<span class="ev-exc">${esc(s.exception)}</span>` : '<span class="ev-dash">—</span>';

    const body = stmts.map(s => `
      <tr>
        <td class="ev-ref-c"><span class="ev-ref">${esc(s.ref)}</span></td>
        <td class="ev-cap-c" title="${esc(capName(s.capId))}">${esc(shortName(capName(s.capId)))}</td>
        <td>${esc(backLbl[s.backing] || s.backing)}</td>
        <td>${statusCell(s)}</td>
        <td>${effCell(s)}</td>
        <td>${excCell(s)}</td>
        <td class="ev-obls">${s.obligations.map(esc).join(', ')}</td>
      </tr>`).join('');

    const empty = stmts.length ? '' : '<p class="ev-empty">No backing controls yet — Control 3 evidence appears once controls cite the mapped statements.</p>';

    return pageHead('Control 3 · Controls operationalised & live', 'control → status + effectiveness + exception', meta, stat) + (stmts.length ? `
      <table class="ev-tbl ev-tbl-wide">
        <thead><tr><th>Statement ref</th><th>Capability</th><th>Control provenance</th><th>Status</th><th>Effectiveness</th><th>Exception</th><th>Obligation(s)</th></tr></thead>
        <tbody>${body}</tbody>
      </table>` : empty);
  }

  // ── Expose globals ───────────────────────────────────────────────
  window.showEvidenceModal  = showEvidenceModal;
  window.closeEvidenceModal = closeEvidenceModal;
  window.generateEvidence   = generateEvidence;
})();
