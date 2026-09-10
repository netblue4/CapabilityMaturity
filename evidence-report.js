// ── Evidence pages (Control 1 / 2 / 3) ────────────────────────────
//
// Three self-contained, print-ready pages — one per Riskonnect control — that
// evidence the regulatory-oversight methodology end to end:
//   Control 1 — Regulatory SOA: DORA obligations backed by an owned statement (completeness / Gate 1)
//   Control 2 — those statements are backed by a control
//   Control 3 — those controls are operationalised (live/effective), with exceptions
// All three read the single buildDoraObligations model, so their figures
// reconcile with the dashboard card and with each other. Each renders into the
// #view-evidence view; the user prints / saves it as PDF (window.print()), or
// copies the full table into Excel (Copy for Excel → TSV to clipboard).
//
// Tables list every column so they stand alone as an exported spreadsheet.

(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function capName(id) { return (CONFIG.capabilities || []).find(c => c.id === id)?.name || id; }
  function appName()   { return (CONFIG && CONFIG.appTitle) || 'Measurable IT Regulatory Oversight Model'; }
  function ctrlLabel(c) { return c.number ? (c.number + ' — ' + c.name) : c.name; }

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

  // Copy the evidence table into the clipboard as TSV (paste straight into Excel).
  function copyEvidenceTable(btn) {
    const table = document.querySelector('#evidence-content table.ev-tbl');
    if (!table) return;
    const tsv = [...table.querySelectorAll('tr')].map(tr =>
      [...tr.querySelectorAll('th,td')].map(c => (c.innerText || '').trim().replace(/\s+/g, ' ')).join('\t')
    ).join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      const old = btn.textContent; btn.textContent = 'Copied ✓';
      setTimeout(() => { btn.textContent = old; }, 1500);
    }).catch(() => { btn.textContent = 'Copy failed'; });
  }

  // ── Shared page chrome ───────────────────────────────────────────
  function pageHead(controlName, subtitle, meta, stat) {
    const title = `${esc(appName())} — ${esc(controlName)}`;
    const sub   = `${esc(meta.label)} · ${esc(meta.date)}${subtitle ? ' · ' + subtitle : ''}`;
    return `
      <div class="ev-top no-print">
        <div><h2 class="ev-title">${title}</h2><p class="ev-sub">${sub}</p></div>
        <div class="ev-top-btns">
          <button class="btn btn-outline" onclick="copyEvidenceTable(this)">⧉ Copy for Excel</button>
          <button class="btn btn-outline" onclick="window.print()">🖨 Print / Save PDF</button>
        </div>
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
  const YES = '<span class="ev-yes">Yes</span>';
  const NO  = '<span class="ev-no">No</span>';
  const DASH = '<span class="ev-dash">—</span>';

  // Deduped mapped statements across covered obligations (Control 2 & 3 unit),
  // each carrying its backing controls and the obligation(s) it covers.
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

  // ── Control 1 — Regulatory SOA completeness (flat, all columns) ──
  function evidenceControl1(model, meta) {
    const covered = model.coveredObligations, total = model.totalObligations;
    const stat = statPill(covered, total, 'objectives covered by either a policy or group standard statement', true)
      + `<span class="ev-note">Completeness is the Gate-1 precondition: an objective with no policy or group-standard statement is a compliance gap regardless of downstream control activity.</span>`;

    const rows = [];
    model.obligations.forEach(o => {
      if (o.covered) {
        o.mappedRefs.forEach(m => rows.push(`
          <tr>
            <td>${esc(o.article)}</td>
            <td class="ev-obl">${esc(o.obligationId)}</td>
            <td class="ev-req">${esc(o.requirement)}</td>
            <td><span class="ev-yes">Covered</span></td>
            <td>${esc(capName(m.capId))}</td>
            <td>${esc(m.document)}</td>
            <td>${esc(m.source)}</td>
            <td class="ev-ref-c"><span class="ev-ref">${esc(m.ref)}</span></td>
            <td>${esc(m.header)}</td>
          </tr>`));
      } else {
        rows.push(`
          <tr class="ev-row-gap">
            <td>${esc(o.article)}</td>
            <td class="ev-obl">${esc(o.obligationId)}</td>
            <td class="ev-req">${esc(o.requirement)}</td>
            <td><span class="ev-no">Uncovered</span></td>
            <td>${DASH}</td><td>${DASH}</td><td>${DASH}</td><td>${DASH}</td><td>${DASH}</td>
          </tr>`);
      }
    });

    return pageHead('Control 1 · Applicable DORA articles/RTS objectives covered by Policies and Group Standards', 'DORA article/RTS → objective → policy/group standard statement', meta, stat) + `
      <table class="ev-tbl ev-tbl-wide">
        <thead><tr><th>DORA Article/RTS</th><th>Paragraph</th><th>Objective</th><th>Coverage</th><th>Capability</th><th>Document</th><th>Source</th><th>Statement ref</th><th>Statement header</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>`;
  }

  // ── Control 2 — statements backed by a control ───────────────────
  function evidenceControl2(model, meta) {
    const stmts  = collectStatements(model);
    const backed = stmts.filter(s => s.controls.length).length;
    const stat = statPill(backed, stmts.length, 'mapped statements backed by a control', true)
      + `<span class="ev-note">Every DORA objective shown in Control 1 as covered is backed here by a policy or group-standard statement that at least one control cites. One row per statement × control.</span>`;

    const rows = [];
    stmts.forEach(s => {
      const base = `
        <td>${esc(capName(s.capId))}</td>
        <td>${esc(s.document)}</td>
        <td>${esc(s.source)}</td>
        <td class="ev-ref-c"><span class="ev-ref">${esc(s.ref)}</span></td>
        <td>${esc(s.header)}</td>`;
      const obls = `<td class="ev-obls">${s.obligations.map(esc).join(', ')}</td>`;
      if (s.controls.length) {
        s.controls.forEach(c => rows.push(`<tr>${base}<td>${YES}</td><td>${esc(ctrlLabel(c))}</td>${obls}</tr>`));
      } else {
        rows.push(`<tr class="ev-row-gap">${base}<td>${NO}</td><td>${DASH}</td>${obls}</tr>`);
      }
    });

    return pageHead('Control 2 · Policy & Group Standard statement operationalised by controls', 'statement → control', meta, stat) + `
      <table class="ev-tbl ev-tbl-wide">
        <thead><tr><th>Capability</th><th>Document</th><th>Source</th><th>Statement ref</th><th>Statement header</th><th>Backed by control</th><th>Control Number &amp; Name</th><th>Objective paragraph(s)</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>`;
  }

  // ── Control 3 — controls operationalised (live/effective) + exceptions ──
  function evidenceControl3(model, meta) {
    const stmts = collectStatements(model);
    // Flatten to control-level rows for the implemented / effective tallies.
    const ctrlRows = stmts.flatMap(s => s.controls);
    const impl = ctrlRows.filter(c => c.status === 'implemented').length;
    const eff  = ctrlRows.filter(c => c.effective).length;
    const excs = stmts.filter(s => s.exception).length;
    const stat = statPill(impl, ctrlRows.length, 'backing controls implemented / live', true)
      + statPill(eff, impl, 'of live controls rated effective', true)
      + `<span class="ev-pill ev-pill-plain"><b>${excs}</b> <span class="ev-pill-lbl">statements with an approved exception (E / WT / WP)</span></span>`
      + `<span class="ev-note">Control effectiveness is verified through the business-as-usual risk-and-control assessment cycle; exceptions record obligations we consciously waive or defer, with an approval on file. One row per statement × control.</span>`;

    const statusCell = c => c.status === 'implemented' ? '<span class="ev-yes">Live</span>' : '<span class="ev-mid">Draft</span>';
    const effCell = c => c.status !== 'implemented' ? DASH : c.effective ? '<span class="ev-yes">Effective</span>' : '<span class="ev-mid">Not yet</span>';
    const excCell = s => s.exception ? `<span class="ev-exc">${esc(s.exception)}</span>` : DASH;

    const rows = [];
    stmts.forEach(s => {
      const base = `
        <td>${esc(capName(s.capId))}</td>
        <td>${esc(s.document)}</td>
        <td>${esc(s.source)}</td>
        <td class="ev-ref-c"><span class="ev-ref">${esc(s.ref)}</span></td>
        <td>${esc(s.header)}</td>`;
      const obls = `<td class="ev-obls">${s.obligations.map(esc).join(', ')}</td>`;
      if (s.controls.length) {
        s.controls.forEach(c => rows.push(
          `<tr>${base}<td>${YES}</td><td>${esc(ctrlLabel(c))}</td><td>${esc(c.provenance)}</td><td>${statusCell(c)}</td><td>${effCell(c)}</td><td>${excCell(s)}</td>${obls}</tr>`));
      } else {
        rows.push(
          `<tr class="ev-row-gap">${base}<td>${NO}</td><td>${DASH}</td><td>${DASH}</td><td>${DASH}</td><td>${DASH}</td><td>${excCell(s)}</td>${obls}</tr>`);
      }
    });

    return pageHead('Control 3 · Controls operationalised & live', 'control → status + effectiveness + exception', meta, stat) + `
      <table class="ev-tbl ev-tbl-wide">
        <thead><tr><th>Capability</th><th>Document</th><th>Source</th><th>Statement ref</th><th>Statement header</th><th>Backed by control</th><th>Control Number &amp; Name</th><th>Control provenance</th><th>Status</th><th>Effectiveness</th><th>Exception</th><th>Obligation(s)</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>`;
  }

  // ── Expose globals ───────────────────────────────────────────────
  window.showEvidenceModal  = showEvidenceModal;
  window.closeEvidenceModal = closeEvidenceModal;
  window.generateEvidence   = generateEvidence;
  window.copyEvidenceTable  = copyEvidenceTable;
})();
