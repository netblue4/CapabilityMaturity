// ── DORA SOA Import Wizard (Governance-Control 1 · completeness baseline) ──
//
// Uploads the DORA Statement of Applicability: the full DORA universe (articles
// + RTS/MIC/MIR) with an applicability decision per row. One row per
// (article × related RTS/MIC/MIR); article-only rows have the RTS_* columns
// blank. The shared transform (buildSoaEntries, in dora-soa.js) collapses each
// row to a tracked SOA entry (the RTS where present, else the article), so the
// evidence-page SOA display and its coverage join work off assessment.doraSoa.
// Flow: upload → review → save (no capability step — the join is by article/RTS
// index to the DORA mapping).

(function () {
  let _sRows = [];   // raw parsed CSV rows (objects keyed by header)
  let _sEntries = []; // transformed SOA entries (buildSoaEntries)

  function initDoraSoaImport() {
    _sRows = []; _sEntries = [];
    const fi = document.getElementById('dora-soa-file-input');
    if (fi) fi.value = '';
    const info = document.getElementById('dora-soa-upload-info');
    if (info) info.textContent = '';
    showSoaSection('dora-soa-upload');
    const nameEl = document.getElementById('dora-soa-assessment-name');
    if (nameEl) {
      const a = editingId ? db.assessments.find(x => x.id === editingId) : null;
      nameEl.textContent = a ? (a.label + ' · ' + formatDate(a.date)) : '(no assessment selected)';
    }
  }

  // Quote-aware CSV parse (commas + newlines inside quotes are data).
  function sParseCSV(text) {
    const s = String(text).replace(/\r\n?/g, '\n');
    const grid = []; let row = [], cur = '', inQ = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQ) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
      else if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); grid.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); grid.push(row); }
    if (!grid.length) return { headers: [], rows: [] };
    const headers = grid[0].map(h => h.trim());
    const rows = [];
    for (let r = 1; r < grid.length; r++) {
      const vals = grid[r];
      if (vals.length === 1 && vals[0].trim() === '') continue;
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (vals[idx] || '').trim(); });
      rows.push(obj);
    }
    return { headers, rows };
  }

  function handleDoraSoaFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const { headers, rows } = sParseCSV(e.target.result);
      if (!rows.length) { alert('No data rows found in the CSV file.'); return; }
      if (!headers.includes('DORA_Article_Index') && !headers.includes('RTS_Article_Index')) {
        alert('This does not look like a DORA SOA export — expected columns like DORA_Article_Index / RTS_Article_Index.\nColumns found: ' + headers.join(', '));
        return;
      }
      if (typeof buildSoaEntries !== 'function') { alert('SOA transform not loaded (dora-soa.js).'); return; }
      _sRows = rows;
      _sEntries = buildSoaEntries(rows);
      const info = document.getElementById('dora-soa-upload-info');
      const applicable = _sEntries.filter(en => en.applicable).length;
      if (info) info.textContent = `${file.name} — ${_sEntries.length} DORA articles/RTS, ${applicable} applicable.`;
      renderDoraSoaReview();
      showSoaSection('dora-soa-review');
    };
    reader.readAsText(file);
  }

  function renderDoraSoaReview() {
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const assessment = editingId ? db.assessments.find(a => a.id === editingId) : null;
    // Coverage join (by article/RTS index) to the already-uploaded DORA mapping.
    const artCov = {};
    if (assessment && (assessment.doraRows || []).length) {
      const model = buildDoraObligations(assessment.doraRows || [], assessment.policyRows || [], assessment.riskPolicyFacts || []);
      (model.articles || []).forEach(a => {
        const k = (typeof soaIndexKey === 'function') ? soaIndexKey(a.article) : a.article;
        artCov[k] = { cov: a.obligations.filter(o => o.covered).length, tot: a.obligations.length };
      });
    }
    const total = _sEntries.length, applicable = _sEntries.filter(e => e.applicable);
    const mapped = applicable.filter(e => artCov[e.idx]).length;

    const countEl = document.getElementById('dora-soa-review-count');
    if (countEl) {
      countEl.textContent = `${total} DORA articles/RTS · ${applicable.length} applicable · `
        + (Object.keys(artCov).length ? `${mapped} of the applicable already mapped in this cycle.` : 'no DORA mapping uploaded yet — coverage will show once the mapping is imported.');
    }

    const wrap = document.getElementById('dora-soa-review-wrap');
    if (!wrap) return;
    const covCell = e => {
      if (!e.applicable) return '<span class="ev-dash">—</span>';
      const c = artCov[e.idx];
      if (!c) return '<span class="soa-cov soa-cov-none">Not yet mapped</span>';
      if (c.tot > 0 && c.cov === c.tot) return '<span class="soa-cov soa-cov-full">Covered</span>';
      if (c.cov > 0) return `<span class="soa-cov soa-cov-part">Partial ${c.cov}/${c.tot}</span>`;
      return '<span class="soa-cov soa-cov-gap">Uncovered</span>';
    };
    const body = _sEntries.map(e => `<tr class="${e.applicable ? 'soa-row-app' : 'soa-row-na'}">
        <td class="soa-ref">${esc(e.ref)}</td>
        <td class="soa-ch">${esc(e.chapter)}</td>
        <td>${e.applicable ? '<span class="soa-app soa-app-yes">Applicable</span>' : '<span class="soa-app soa-app-no">Out of scope</span>'}</td>
        <td>${covCell(e)}</td>
      </tr>`).join('');
    wrap.innerHTML = `<div class="rcsa-table-wrap"><table class="ev-soa-tbl">
      <thead><tr><th>DORA Article / RTS</th><th>Chapter</th><th>Applicable</th><th>Coverage</th></tr></thead>
      <tbody>${body}</tbody></table></div>`;
  }

  function saveDoraSoaImport() {
    const assessment = editingId ? db.assessments.find(a => a.id === editingId) : null;
    if (!assessment) { alert('No assessment open — return to an assessment before saving.'); return; }
    assessment.doraSoa = _sEntries;
    assessment.doraSoaMeta = {
      uploadDate: new Date().toISOString().slice(0, 10),
      total: _sEntries.length,
      applicable: _sEntries.filter(e => e.applicable).length,
    };
    saveToLocalStorage();
    loadFromLocalStorage();
    openAssessmentForm(editingId);
  }

  function showSoaSection(id) {
    ['dora-soa-upload', 'dora-soa-review'].forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = s === id ? 'block' : 'none';
    });
  }

  window.initDoraSoaImport = initDoraSoaImport;
  window.handleDoraSoaFile = handleDoraSoaFile;
  window.saveDoraSoaImport = saveDoraSoaImport;
})();
