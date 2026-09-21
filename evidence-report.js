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
    const policyRows = a.policyRows || [], facts = a.riskPolicyFacts || [];
    const model = buildDoraObligations(a.doraRows || [], policyRows, facts);
    const meta  = { label: a.label, date: formatDate(a.date) };
    const norm  = s => (s == null ? '' : String(s)).toLowerCase().trim();

    // Shared rollups so the evidence pages reconcile EXACTLY with the exec
    // report and the pillar cards (same populations + counting units):
    //   Control 1 → DORA obligations (buildDoraObligations)
    //   Control 2 → every distinct policy statement (buildStatementCoverage)
    //   Control 3 → every distinct backing control (buildBackingControlOps)
    const cov  = buildStatementCoverage(policyRows, facts);
    const bops = buildBackingControlOps(policyRows, facts);
    const capPillar = buildCapPillarFromModel(model);
    const docStatus = {};
    (buildGovernanceRows(policyRows, facts) || []).forEach(r => { docStatus[r.capId + '||' + r.document] = r.status; });
    // statement (capId||ref) → the DORA obligation ids it covers
    const oblByStmt = {};
    model.obligations.forEach(o => (o.mappedRefs || []).forEach(m => {
      const k = m.capId + '||' + norm(m.ref);
      (oblByStmt[k] = oblByStmt[k] || new Set()).add(o.obligationId);
    }));
    const stmtObls = (capId, ref) => [...(oblByStmt[capId + '||' + norm(ref)] || [])];

    const ctx = { a, model, meta, cov, bops, capPillar, docStatus, oblByStmt, stmtObls, norm };
    const html = control === 1 ? evidenceControl1(ctx)
               : control === 2 ? evidenceControl2(ctx)
               :                  evidenceControl3(ctx);
    document.getElementById('evidence-content').innerHTML = html;
    showView('evidence');
    window.scrollTo(0, 0);
  }

  // Copy a table into the clipboard as TSV (paste straight into Excel).
  function copyTableTsv(table, btn) {
    if (!table) return;
    const tsv = [...table.querySelectorAll('tr')].map(tr =>
      [...tr.querySelectorAll('th,td')].map(c => (c.innerText || '').trim().replace(/\s+/g, ' ')).join('\t')
    ).join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      const old = btn.textContent; btn.textContent = 'Copied ✓';
      setTimeout(() => { btn.textContent = old; }, 1500);
    }).catch(() => { btn.textContent = 'Copy failed'; });
  }
  // The page's detail table (Control 1/2/3) — the top "Copy for Excel" button.
  function copyEvidenceTable(btn) { copyTableTsv(document.querySelector('#evidence-content table.ev-tbl'), btn); }
  // The DORA SOA table (Control 1 only).
  function copySoaTable(btn) { copyTableTsv(document.querySelector('#evidence-content table.ev-soa-tbl'), btn); }

  // Click-to-sort for any evidence table tagged .ev-sortable. DOM-based: sorts
  // the existing rows by the clicked column's text (numeric-aware), toggling
  // asc/desc, with an arrow indicator. Delegated so it covers re-rendered tables.
  function sortEvTable(th) {
    const table = th.closest('table'), tbody = table.tBodies[0];
    if (!tbody) return;
    const ths = [...th.parentNode.children], idx = ths.indexOf(th);
    const dir = th.getAttribute('data-dir') === 'asc' ? 'desc' : 'asc';
    ths.forEach(h => { h.removeAttribute('data-dir'); const a = h.querySelector('.ev-sort-arr'); if (a) a.remove(); });
    th.setAttribute('data-dir', dir);
    const arr = document.createElement('span'); arr.className = 'ev-sort-arr'; arr.textContent = dir === 'asc' ? ' ▲' : ' ▼';
    th.appendChild(arr);
    const cellText = tr => (tr.children[idx] ? tr.children[idx].innerText : '').trim();
    const toNum = s => { const m = s.replace(/[%,]/g, '').match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
    const rows = [...tbody.rows];
    const numeric = rows.every(r => { const v = cellText(r); return v === '' || v === '—' || toNum(v) !== null; });
    rows.sort((a, b) => {
      const va = cellText(a), vb = cellText(b);
      let c = numeric ? ((toNum(va) ?? -Infinity) - (toNum(vb) ?? -Infinity)) : va.localeCompare(vb);
      return dir === 'asc' ? c : -c;
    });
    rows.forEach(r => tbody.appendChild(r));
  }
  document.addEventListener('click', e => {
    const th = e.target.closest('#evidence-content .ev-sortable thead th');
    if (th) sortEvTable(th);
  });

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
      ${stat ? `<div class="ev-stat">${stat}</div>` : ''}`;
  }
  function statPill(n, d, label, warnWhenShort) {
    const pct = d > 0 ? Math.round(100 * n / d) : 0;
    const warn = warnWhenShort && n < d ? ' ev-pill-warn' : '';
    return `<span class="ev-pill${warn}"><b>${n}</b>/<span class="ev-pill-d">${d}</span> <span class="ev-pill-lbl">${label}</span> <span class="ev-pill-pct">${pct}%</span></span>`;
  }
  const YES = '<span class="ev-yes">Yes</span>';
  const NO  = '<span class="ev-no">No</span>';
  const DASH = '<span class="ev-dash">—</span>';
  const GOV = { approved: ['gov-approved', 'Approved'], partial: ['gov-partial', 'Partial'], draft: ['gov-draft', 'Draft'] };
  function docStatusCell(status) {
    const g = GOV[status]; return g ? `<span class="gov-badge ${g[0]}">${g[1]}</span>` : DASH;
  }
  const ctrlStatusCell = c => c.status === 'implemented' ? '<span class="ev-yes">Implemented</span>' : '<span class="ev-mid">Draft</span>';

  const srcLabel = t => isLocPolType(t) ? 'Local Policy' : isGrpStdType(t) ? 'Group Standard' : ((t || '').trim() || '');

  // ── Control 1 — Regulatory SOA completeness (flat, all columns) ──
  // One row per obligation (× mapped statement). Matches exec Control 1.
  function evidenceControl1(ctx) {
    const { model, meta, docStatus } = ctx;
    const dkey = m => m.capId + '||' + ((m.document || '').trim() || '(no document)');
    const covered = model.coveredObligations, total = model.totalObligations;
    const stat = statPill(covered, total, 'objectives covered by either a policy or group standard statement', true)
      + `<span class="ev-note">Completeness is the Gate-1 precondition: an objective with no policy or group-standard statement is a compliance gap regardless of downstream control activity.</span>`;

    const rows = [];
    model.obligations.forEach(o => {
      if (o.covered) {
        o.mappedRefs.forEach(m => rows.push(`
          <tr>
            <td class="pil-col">${pillarTag(doraPillarShortForCap(capName(m.capId)))}</td>
            <td>${esc(o.article)}</td>
            <td class="ev-obl">${esc(o.obligationId)}</td>
            <td class="ev-req">${esc(o.requirement)}</td>
            <td><span class="ev-yes">Covered</span></td>
            <td>${esc(capName(m.capId))}</td>
            <td>${esc(m.document)}</td>
            <td>${docStatusCell(docStatus[dkey(m)])}</td>
            <td>${esc(m.source)}</td>
            <td class="ev-ref-c"><span class="ev-ref">${esc(m.ref)}</span></td>
            <td>${esc(m.header)}</td>
          </tr>`));
      } else {
        rows.push(`
          <tr class="ev-row-gap">
            <td class="pil-col">${pillarTag(doraPillarShortForCap(o.capability))}</td>
            <td>${esc(o.article)}</td>
            <td class="ev-obl">${esc(o.obligationId)}</td>
            <td class="ev-req">${esc(o.requirement)}</td>
            <td><span class="ev-no">Uncovered</span></td>
            <td>${esc(o.capability) || DASH}</td>
            <td>${DASH}</td><td>${DASH}</td><td>${DASH}</td><td>${DASH}</td><td>${DASH}</td>
          </tr>`);
      }
    });

    return pageHead('Control 1 · Applicable DORA articles/RTS objectives covered by Policies and Group Standards', 'DORA article/RTS → objective → policy/group standard statement', meta)
      + soaSection(ctx)
      + `<h3 class="ev-sect-h">Coverage detail — objective → owned statement</h3>
      <div class="ev-stat">${stat}</div>
      <table class="ev-tbl ev-tbl-wide ev-sortable">
        <thead><tr><th>DORA Pillar</th><th>DORA Article/RTS</th><th>Objective paragraph(s)</th><th>Objective</th><th>Coverage</th><th>Capability</th><th>Document</th><th>Document status</th><th>Source</th><th>Statement ref</th><th>Statement header</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>`;
  }

  // ── DORA Statement of Applicability (SOA) — separate completeness display ──
  // Lists the full DORA universe (from the seeded DORA_SOA catalogue, or an
  // uploaded assessment.doraSoa) with each item's applicability decision.
  // Applicable items are highlighted; for those, coverage status joins to the
  // mapping model so an auditor confirms completeness before the detail below.
  function soaSection(ctx) {
    const soa = (ctx.a.doraSoa && ctx.a.doraSoa.length) ? ctx.a.doraSoa
              : (typeof DORA_SOA !== 'undefined' ? DORA_SOA : []);
    if (!soa.length) return '';
    // Coverage joins by article/RTS INDEX (RTS4 / ARTICLE17 …) so SOA titles need
    // not match the mapping's titles exactly.
    const idxOf = s => (typeof soaIndexKey === 'function') ? soaIndexKey(s) : String(s || '').toUpperCase();
    const artCov = {};
    (ctx.model.articles || []).forEach(a => {
      artCov[idxOf(a.article)] = { cov: a.obligations.filter(o => o.covered).length, tot: a.obligations.length };
    });
    const total = soa.length, applicable = soa.filter(r => r.applicable);
    const mapped = applicable.filter(r => artCov[r.idx]).length;
    const notMapped = applicable.length - mapped;
    const appCell = r => r.applicable
      ? '<span class="soa-app soa-app-yes">Applicable</span>'
      : '<span class="soa-app soa-app-no">Out of scope</span>';
    const covCell = r => {
      if (!r.applicable) return DASH;
      const c = artCov[r.idx];
      if (!c) return '<span class="soa-cov soa-cov-none">Not yet mapped</span>';
      if (c.tot > 0 && c.cov === c.tot) return '<span class="soa-cov soa-cov-full">Covered</span>';
      if (c.cov > 0) return `<span class="soa-cov soa-cov-part">Partial ${c.cov}/${c.tot}</span>`;
      return '<span class="soa-cov soa-cov-gap">Uncovered</span>';
    };
    const refCell = r => r.url
      ? `<a class="soa-link" href="${esc(r.url)}" target="_blank" rel="noopener">EUR-Lex ↗</a>`
      : DASH;
    const rows = soa.map(r => `<tr class="${r.applicable ? 'soa-row-app' : 'soa-row-na'}">
        <td class="soa-ref">${esc(r.ref)}</td>
        <td class="soa-ch">${esc(r.chapter)}</td>
        <td>${appCell(r)}</td>
        <td>${covCell(r)}</td>
        <td class="soa-why">${refCell(r)}</td>
      </tr>`).join('');
    return `
      <div class="ev-soa">
        <div class="ev-soa-hd">
          <div>
            <h3 class="ev-sect-h">DORA Statement of Applicability (SOA)</h3>
            <p class="ev-soa-sub">Every DORA article/RTS with its applicability decision — the completeness baseline. <b>Applicable</b> items are highlighted; for those, coverage status joins to the detail below. Review this first to confirm the whole of DORA was considered.</p>
          </div>
          <button class="btn btn-outline no-print" onclick="copySoaTable(this)">⧉ Copy for Excel</button>
        </div>
        <div class="ev-stat">${statPill(applicable.length, total, 'DORA articles/RTS applicable', false)}<span class="ev-note"><b>${mapped}</b> applicable item(s) mapped this cycle · <b class="${notMapped ? 'dora-gap-num' : ''}">${notMapped}</b> applicable but not yet mapped. The Reference column links to the EUR-Lex text.</span></div>
        <table class="ev-soa-tbl ev-sortable">
          <thead><tr><th>DORA Article / RTS</th><th>Chapter</th><th>Applicable</th><th>Coverage</th><th>Reference</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── Control 2 — every policy/GS statement, and whether it is operationalised ──
  // One row PER STATEMENT (not per control), over the full statement population
  // (buildStatementCoverage), so counts reconcile with the exec Control 2 card
  // and the pillar cards. Filter Backed = Yes + Status = Implemented to get the
  // operationalised statements a pillar card reports.
  function evidenceControl2(ctx) {
    const { meta, cov, capPillar, docStatus, stmtObls } = ctx;
    const stmts = cov.statements.slice().sort((a, b) =>
      capName(a.capId).localeCompare(capName(b.capId)) || (a.ref || '').localeCompare(b.ref || ''));
    const total = cov.total, backed = cov.backed;
    const isLive = s => s.backing === 'Built new' || s.backing === 'Reused pre-DORA';
    const operationalised = stmts.filter(isLive).length;
    const stat = statPill(backed, total, 'statements backed by a control', true)
      + statPill(operationalised, total, 'operationalised (statement has a live control)', true)
      + `<span class="ev-note">One row per policy / group-standard statement. <b>Backed by control</b> = at least one control cites it; <b>Status = Implemented</b> = at least one of those controls is live (this is "operationalised"), Draft = only draft controls. Filter Backed = Yes and Status = Implemented to match a pillar card's operationalised count.</span>`;

    const dkey = s => s.capId + '||' + ((s.document || '').trim() || '(no document)');
    const statusCell = s => isLive(s) ? '<span class="ev-yes">Implemented</span>' : s.hasControl ? '<span class="ev-mid">Draft</span>' : DASH;

    const rows = stmts.map(s => {
      const objs = stmtObls(s.capId, s.ref);
      const ctrls = (s.controls || []).map(ctrlLabel).map(esc).join('; ');
      return `<tr${s.hasControl ? '' : ' class="ev-row-gap"'}>
        <td class="pil-col">${pillarTag(doraPillarShortFor('', '', s.capId, capPillar))}</td>
        <td>${esc(capName(s.capId))}</td>
        <td>${esc(s.document)}</td>
        <td>${docStatusCell(docStatus[dkey(s)])}</td>
        <td>${esc(s.source)}</td>
        <td class="ev-ref-c"><span class="ev-ref">${esc(s.ref)}</span></td>
        <td>${esc(s.header)}</td>
        <td>${s.hasControl ? YES : NO}</td>
        <td>${statusCell(s)}</td>
        <td>${s.exception ? `<span class="ev-exc">${esc(s.exception)}</span>` : DASH}</td>
        <td>${ctrls || DASH}</td>
        <td class="ev-obls">${objs.length ? objs.map(esc).join(', ') : DASH}</td>
      </tr>`;
    });

    return pageHead('Control 2 · Policy & Group Standard statement operationalised by controls', 'statement → control', meta, stat) + `
      <table class="ev-tbl ev-tbl-wide ev-sortable">
        <thead><tr><th>DORA Pillar</th><th>Capability</th><th>Document</th><th>Document status</th><th>Source</th><th>Statement ref</th><th>Statement header</th><th>Backed by control</th><th>Status</th><th>Exception</th><th>Control Number &amp; Name</th><th>Objective paragraph(s)</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>`;
  }

  // ── Control 3 — every backing control, its status & effectiveness ──
  // One row PER DISTINCT CONTROL (buildBackingControlOps), so counts reconcile
  // with the exec Control 3 card and the pillar cards. Filter Status = Implemented
  // + Effectiveness = Effective to get the live-&-effective controls a card reports.
  function evidenceControl3(ctx) {
    const { meta, bops, capPillar, stmtObls } = ctx;
    const ctrls = bops.controls.slice().sort((a, b) =>
      capName(a.capId).localeCompare(capName(b.capId)) || (a.number || '').localeCompare(b.number || '') || (a.name || '').localeCompare(b.name || ''));
    const total = bops.total;
    const impl = ctrls.filter(c => c.implemented).length;
    const eff  = ctrls.filter(c => c.liveEffective).length;
    const stat = statPill(impl, total, 'backing controls implemented / live', true)
      + statPill(eff, impl, 'of live controls rated effective', true)
      + `<span class="ev-note">One row per distinct backing control. <b>Status = Implemented</b> = the control is live; <b>Effectiveness = Effective</b> = it passed its RCSA design + operating test. Filter Status = Implemented and Effectiveness = Effective to match a pillar card's effective count.</span>`;

    const statusCell = c => c.implemented ? '<span class="ev-yes">Implemented</span>' : '<span class="ev-mid">Draft</span>';
    const effCell = c => !c.implemented ? DASH : c.effective ? '<span class="ev-yes">Effective</span>' : '<span class="ev-mid">Not yet</span>';

    const rows = ctrls.map(c => {
      const objs = [...new Set((c.refs || []).flatMap(r => stmtObls(c.capId, r)))];
      const refs = (c.refs || []).map(r => `<span class="ev-ref">${esc(r)}</span>`).join(' ');
      return `<tr${c.implemented ? '' : ' class="ev-row-gap"'}>
        <td class="pil-col">${pillarTag(doraPillarShortFor('', '', c.capId, capPillar))}</td>
        <td>${esc(capName(c.capId))}</td>
        <td>${esc(ctrlLabel(c))}</td>
        <td>${esc(c.provenance)}</td>
        <td>${statusCell(c)}</td>
        <td>${effCell(c)}</td>
        <td class="ev-ref-c">${refs || DASH}</td>
        <td class="ev-obls">${objs.length ? objs.map(esc).join(', ') : DASH}</td>
      </tr>`;
    });

    return pageHead('Control 3 · Control efficacy in treating risk', 'control → status + effectiveness', meta, stat) + `
      <table class="ev-tbl ev-tbl-wide ev-sortable">
        <thead><tr><th>DORA Pillar</th><th>Capability</th><th>Control Number &amp; Name</th><th>Control provenance</th><th>Status</th><th>Effectiveness</th><th>Statement ref(s)</th><th>Objective paragraph(s)</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>`;
  }

  // ── Expose globals ───────────────────────────────────────────────
  window.showEvidenceModal  = showEvidenceModal;
  window.closeEvidenceModal = closeEvidenceModal;
  window.generateEvidence   = generateEvidence;
  window.copyEvidenceTable  = copyEvidenceTable;
  window.copySoaTable       = copySoaTable;
})();
