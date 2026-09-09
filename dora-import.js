// ── DORA → Policy Mapping Import Wizard (Control 1) ───────────────
//
// Third upload in the workflow (after Policy statements, before / with Risk
// data). One row per (obligation × mapped statement ref); the obligation id is
// the "paragraph reference" column and the requirement text is the "digital
// resilience objectives" column. Joins to the already-uploaded policy
// statements on STATEMENT REF, so there is NO capability-mapping step — the
// flow is simply upload → review → save.
//
// Unmapped obligations arrive as explicit sentinel rows
// (STATEMENT REF = "No matching policy", HEADER = "N/A", Document = "Not Found");
// the full obligation universe is therefore in the file and completeness is
// computable from it alone (see buildDoraObligations).

(function () {
  let _dRows = [];   // parsed { article, obligationId, requirement, statementRef, statementHeader, document, unmapped }
  let _dCols = {};

  // ── Entry point ──────────────────────────────────────────────────
  function initDoraImport() {
    _dRows = []; _dCols = {};
    const fi = document.getElementById('dora-file-input');
    if (fi) fi.value = '';
    const info = document.getElementById('dora-upload-info');
    if (info) info.textContent = '';
    showDoraSection('dora-upload');

    const nameEl = document.getElementById('dora-assessment-name');
    if (nameEl) {
      const a = editingId ? db.assessments.find(x => x.id === editingId) : null;
      nameEl.textContent = a ? (a.label + ' · ' + formatDate(a.date)) : '(no assessment selected)';
    }
  }

  // ── CSV parsing ──────────────────────────────────────────────────
  // Single-pass, quote-aware parse. Commas AND newlines inside double-quoted
  // fields are treated as data, so multi-line free-text fields (e.g. the
  // Paragraph Requirement column) don't break row/column alignment.
  function dParseCSV(text) {
    const s = String(text).replace(/\r\n?/g, '\n');   // normalise CRLF / CR → LF
    const grid = [];
    let row = [], cur = '', inQ = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQ) {
        if (ch === '"') {
          if (s[i + 1] === '"') { cur += '"'; i++; }   // escaped quote
          else inQ = false;
        } else cur += ch;
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === ',') {
        row.push(cur); cur = '';
      } else if (ch === '\n') {
        row.push(cur); grid.push(row); row = []; cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur !== '' || row.length) { row.push(cur); grid.push(row); }   // flush final field/row
    if (!grid.length) return { headers: [], rows: [] };

    const headers = grid[0].map(h => h.trim());
    const rows = [];
    for (let r = 1; r < grid.length; r++) {
      const vals = grid[r];
      if (vals.length === 1 && vals[0].trim() === '') continue;   // skip blank lines
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (vals[idx] || '').trim(); });
      rows.push(obj);
    }
    return { headers, rows };
  }

  // ── Column detection (lenient header matching) ───────────────────
  function detectDoraColumns(headers) {
    const hl = headers.map(h => h.toLowerCase());
    function find(...terms) {
      for (const t of terms) {
        const idx = hl.findIndex(h => h.includes(t));
        if (idx >= 0) return headers[idx];
      }
      return null;
    }
    let docIdx = hl.findIndex(h => h === 'document');
    if (docIdx < 0) docIdx = hl.findIndex(h => h.includes('document') && !h.includes('type') && !h.includes('status'));
    return {
      obligation:  find('paragraph reference', 'paragraph ref', 'compliancestatementnumber', 'compliance statement', 'statement number', 'obligation'),
      requirement: find('digital resilience objective', 'digital resilience', 'resilience objective', 'objective', 'paragraph requirement', 'requirement'),
      ref:         find('statement ref', 'ref', 'reference'),
      header:      find('statement header', 'header'),
      document:    docIdx >= 0 ? headers[docIdx] : null,
      capability:  find('capability', 'process', 'domain', 'function'),
      article:     find('dora', 'article', 'regulation'),
    };
  }

  // ── Unmapped sentinel — "No matching policy" / blank ref / "Not Found" ──
  function isUnmapped(ref, doc) {
    const r = (ref || '').toLowerCase().trim();
    const d = (doc || '').toLowerCase().trim();
    return !r || /no matching/.test(r) || /not found/.test(d);
  }

  // ── File handler ─────────────────────────────────────────────────
  function handleDoraFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const { headers, rows } = dParseCSV(e.target.result);
      if (!rows.length) { alert('No data rows found in the CSV file.'); return; }
      _dCols = detectDoraColumns(headers);
      if (!_dCols.obligation) {
        alert('Could not find a "paragraph reference" (obligation) column.\nColumns found: ' + headers.join(', '));
        return;
      }
      if (!_dCols.ref) {
        alert('Could not find a Statement Ref column.\nColumns found: ' + headers.join(', '));
        return;
      }
      _dRows = rows.map(row => {
        const ref = _dCols.ref      ? (row[_dCols.ref]      || '').trim() : '';
        const doc = _dCols.document ? (row[_dCols.document] || '').trim() : '';
        return {
          article:         _dCols.article     ? (row[_dCols.article]     || '').trim() : '',
          obligationId:    (row[_dCols.obligation] || '').trim(),
          requirement:     _dCols.requirement ? (row[_dCols.requirement] || '').trim() : '',
          statementRef:    ref,
          statementHeader: _dCols.header      ? (row[_dCols.header]      || '').trim() : '',
          document:        doc,
          capability:      _dCols.capability   ? (row[_dCols.capability]   || '').trim() : '',
          unmapped:        isUnmapped(ref, doc),
        };
      }).filter(r => r.obligationId);

      const info = document.getElementById('dora-upload-info');
      const obligations = new Set(_dRows.map(r => r.obligationId)).size;
      if (info) info.textContent = `${file.name} — ${_dRows.length} rows, ${obligations} distinct obligations detected.`;
      renderDoraReview();
      showDoraSection('dora-review');
    };
    reader.readAsText(file);
  }

  // ── Review — coverage computed against the assessment's policy + risk data ──
  function renderDoraReview() {
    const assessment = editingId ? db.assessments.find(a => a.id === editingId) : null;
    const policyRows = assessment?.policyRows || [];
    const facts      = assessment?.riskPolicyFacts || [];
    const model      = buildDoraObligations(_dRows, policyRows, facts);

    const countEl = document.getElementById('dora-review-count');
    if (countEl) {
      countEl.textContent = policyRows.length
        ? `${model.totalObligations} obligations · ${model.coveredObligations} covered (${model.completenessPct}%) · ${model.totalObligations - model.coveredObligations} uncovered — review and save.`
        : `${model.totalObligations} obligations detected. No policy statements uploaded yet, so coverage will compute once policy data is imported.`;
    }

    const wrap = document.getElementById('dora-review-wrap');
    if (!wrap) return;
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const artBlocks = model.articles.map(a => {
      const cov = a.obligations.filter(o => o.covered).length;
      const body = a.obligations.map(o => {
        const refs = o.mappedRefs.length
          ? o.mappedRefs.map(m => `<span class="dora-ref">${esc(m.ref)}</span>`).join(' ')
          : '<span class="dora-uncov-tag">No matching policy</span>';
        return `
          <tr class="${o.covered ? '' : 'dora-row-uncov'}">
            <td class="dora-obl">${esc(o.obligationId)}</td>
            <td>${esc(o.capability)}</td>
            <td class="dora-req">${esc(o.requirement)}</td>
            <td class="dora-cov">${o.covered ? '<span class="dora-cov-yes">Covered</span>' : '<span class="dora-cov-no">Uncovered</span>'}</td>
            <td>${refs}</td>
          </tr>`;
      }).join('');
      return `
        <div class="dora-art-block">
          <div class="dora-art-hdr"><span class="dora-art-name">${esc(a.article)}</span><span class="dora-art-count">${cov}/${a.obligations.length} covered</span></div>
          <table class="dora-tbl">
            <thead><tr><th>Obligation</th><th>Capability</th><th>Requirement</th><th>Coverage</th><th>Policy / Standard ref</th></tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>`;
    }).join('');

    wrap.innerHTML = artBlocks;
  }

  // ── Save ─────────────────────────────────────────────────────────
  function saveDoraImport() {
    const assessment = editingId ? db.assessments.find(a => a.id === editingId) : null;
    if (!assessment) { alert('No assessment open — return to an assessment before saving.'); return; }

    const model = buildDoraObligations(_dRows, assessment.policyRows || [], assessment.riskPolicyFacts || []);

    assessment.doraRows = _dRows;
    assessment.doraMeta = {
      uploadDate:         new Date().toISOString().slice(0, 10),
      totalRows:          _dRows.length,
      totalObligations:   model.totalObligations,
      coveredObligations: model.coveredObligations,
    };

    saveToLocalStorage();
    loadFromLocalStorage();
    openAssessmentForm(editingId);
  }

  // ── Section toggle helper ────────────────────────────────────────
  function showDoraSection(id) {
    ['dora-upload', 'dora-review'].forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = s === id ? 'block' : 'none';
    });
  }

  // ── Expose globals ───────────────────────────────────────────────
  window.initDoraImport = initDoraImport;
  window.handleDoraFile = handleDoraFile;
  window.saveDoraImport = saveDoraImport;
})();
