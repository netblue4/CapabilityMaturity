// ── Policy Statements Import Wizard ──────────────────────────────

(function () {
  let _piRows                = [];
  let _piCsvCapNames         = [];
  let _piCols                = {};
  let _piComputed            = [];
  let _piCandidatePolicyRows = [];

  // ── Lens helpers ─────────────────────────────────────────────────
  // DORA maps CSV groupings onto CONFIG.capabilities; MiCA/NIST take the CSV's
  // own grouping values (Service / Category) directly as free-form groups.
  const _lk      = () => (typeof activeLens !== 'undefined') ? activeLens : 'dora';
  const _isDora  = () => _lk() === 'dora';
  const _fw      = () => (typeof activeFramework === 'function') ? activeFramework()
                         : { policyKey: 'policyRows', factsKey: 'riskPolicyFacts', policyMetaKey: 'policyStatements', groupsKey: null };
  const _slug    = s => (String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || 'group';
  // group CSV value → group id for the active lens.
  function _groupIdOf(csvName, mapping) {
    if (_isDora()) return mapping[csvName] || null;            // mapped CONFIG id
    return csvName ? _slug(csvName) : null;                    // free-form slug
  }
  function _groupName(csvCap, capId) {
    if (_isDora()) { const c = (CONFIG.capabilities || []).find(x => x.id === capId); return c ? c.name : capId; }
    return csvCap;                                             // free-form group name
  }
  // Flatten the CSV into policy rows (one per statement) for the active lens.
  function _extractPolicyRows(mapping) {
    const out = [];
    _piRows.forEach(row => {
      const csvCap = row[_piCols.capability] || '';
      const capId  = _groupIdOf(csvCap, mapping);
      if (!capId) return;
      const ref = _piCols.ref ? (row[_piCols.ref] || '').trim() : '';
      if (!ref) return;
      out.push({
        capId, capName: _groupName(csvCap, capId),
        statementRef:    ref,
        type:            _piCols.type      ? (row[_piCols.type]      || '').trim() : '',
        document:        _piCols.document  ? (row[_piCols.document]  || '').trim() : '',
        status:          _piCols.status    ? (row[_piCols.status]    || '').trim() : '',
        statementHeader: _piCols.header    ? (row[_piCols.header]    || '').trim() : '',
        statementDetail: _piCols.detail    ? (row[_piCols.detail]    || '').trim() : '',
        owner:           _piCols.owner     ? (row[_piCols.owner]     || '').trim() : '',
        exception:       _piCols.exception ? (row[_piCols.exception] || '').trim() : '',
      });
    });
    return out;
  }
  // Distinct {id,name} groups present in the rows (for the lens group registry).
  function _groupsFromRows(rows) {
    const seen = {}, out = [];
    rows.forEach(r => { if (!seen[r.capId]) { seen[r.capId] = 1; out.push({ id: r.capId, name: r.capName || r.capId }); } });
    return out;
  }
  function _currentMapping() {
    const sels = document.querySelectorAll('.pi-cap-sel');
    const mapping = {};
    sels.forEach(sel => { if (sel.value) mapping[_piCsvCapNames[parseInt(sel.dataset.idx)]] = sel.value; });
    return mapping;
  }

  // ── Entry point ──────────────────────────────────────────────────
  function initPolicyImport() {
    _piRows = []; _piCsvCapNames = []; _piCols = {}; _piComputed = []; _piCandidatePolicyRows = [];
    const fi = document.getElementById('pi-file-input');
    if (fi) fi.value = '';
    document.getElementById('pi-upload-info').textContent = '';
    showPiSection('pi-upload');

    const nameEl = document.getElementById('pi-assessment-name');
    if (nameEl) {
      const a = editingId ? db.assessments.find(x => x.id === editingId) : null;
      nameEl.textContent = a ? (a.label + ' · ' + formatDate(a.date)) : '(no assessment selected)';
    }
  }

  // ── CSV parsing ──────────────────────────────────────────────────
  // Single-pass, quote-aware parse. Commas AND newlines inside double-quoted
  // fields are treated as data, so multi-line free-text fields (e.g. the new
  // STATEMENT DETAIL column) don't break row/column alignment. Escaped quotes
  // ("") inside a quoted field become a literal quote.
  function piParseCSV(text) {
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

  // ── Column detection ─────────────────────────────────────────────
  function detectPiColumns(headers) {
    const hl = headers.map(h => h.toLowerCase());
    function find(...terms) {
      for (const t of terms) {
        const idx = hl.findIndex(h => h.includes(t));
        if (idx >= 0) return headers[idx];
      }
      return null;
    }
    // "Document" must not capture "Document Type" / "Document Status".
    let docIdx = hl.findIndex(h => h === 'document');
    if (docIdx < 0) docIdx = hl.findIndex(h => h.includes('document') && !h.includes('type') && !h.includes('status'));
    // Grouping column is lens-specific: DORA=Capability, MiCA=Service, NIST=Category.
    const lensKey = (typeof activeLens !== 'undefined') ? activeLens : 'dora';
    const groupTerms = lensKey === 'mica' ? ['service', 'capability', 'process', 'domain', 'function']
                     : lensKey === 'nist' ? ['category', 'subcategory', 'function', 'capability', 'process', 'domain']
                     :                       ['capability', 'process', 'domain', 'function'];
    return {
      capability: find(...groupTerms),
      ref:        find('statement ref', 'ref', 'reference'),
      type:       find('document type', 'type'),
      document:   docIdx >= 0 ? headers[docIdx] : null,
      status:     find('document status', 'status'),
      header:     find('statement header', 'header'),
      detail:     find('statement detail', 'detail'),
      owner:      find('owner', 'accountable', 'responsible'),
      exception:  find('exception', 'waiver', 'exemption', 'disposition', 'treatment'),
    };
  }

  // ── File handler ─────────────────────────────────────────────────
  function handlePiFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const { headers, rows } = piParseCSV(e.target.result);
      if (!rows.length) { alert('No data rows found in the CSV file.'); return; }
      _piCols = detectPiColumns(headers);
      if (!_piCols.ref) {
        alert('Could not find a Statement Ref column.\nColumns found: ' + headers.join(', '));
        return;
      }
      const dimLabel = (typeof lensDimLabel === 'function') ? lensDimLabel() : 'Capability';
      if (!_piCols.capability) {
        alert(`Could not find a ${dimLabel} column.\nColumns found: ` + headers.join(', '));
        return;
      }
      _piRows = rows;
      _piCsvCapNames = [...new Set(rows.map(r => r[_piCols.capability]).filter(Boolean))];
      document.getElementById('pi-upload-info').textContent =
        file.name + ' — ' + rows.length + ' rows, ' + _piCsvCapNames.length + ` unique ${dimLabel.toLowerCase()}(s) detected.`;
      renderPiMappingTable();
      showPiSection('pi-mapping');
    };
    reader.readAsText(file);
  }

  // ── Fuzzy capability matching ────────────────────────────────────
  function piAutoMatch(csvName) {
    const norm = s => s.toLowerCase()
      .replace(/\bict\b/g, '')
      .replace(/\bmgmt\b/g, 'management')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(w => w.length > 2);
    const nWords = new Set(norm(csvName));
    let bestId = null, bestScore = 0;
    for (const cap of CONFIG.capabilities) {
      const score = norm(cap.name).filter(w => nWords.has(w)).length;
      if (score > bestScore) { bestScore = score; bestId = cap.id; }
    }
    return bestScore > 0 ? bestId : null;
  }

  // ── Step 2: mapping table ────────────────────────────────────────
  function renderPiMappingTable() {
    const dimLabel = (typeof lensDimLabel === 'function') ? lensDimLabel() : 'Capability';
    const rows = _piCsvCapNames.map((name, i) => {
      if (!_isDora()) {
        // MiCA / NIST: the CSV's own grouping value is the group (identity map).
        return `
        <tr>
          <td class="rk-map-csv">${name}</td>
          <td><select class="pi-cap-sel" data-idx="${i}"><option value="${_slug(name)}" selected>${name}</option></select></td>
        </tr>`;
      }
      const match = piAutoMatch(name);
      const opts = CONFIG.capabilities.map(c =>
        `<option value="${c.id}"${c.id === match ? ' selected' : ''}>${c.name}</option>`
      ).join('');
      return `
        <tr>
          <td class="rk-map-csv">${name}</td>
          <td>
            <select class="pi-cap-sel" data-idx="${i}">
              <option value="">— skip —</option>
              ${opts}
            </select>
          </td>
        </tr>`;
    }).join('');
    document.getElementById('pi-map-body').innerHTML = rows;
    const countEl = document.getElementById('pi-map-count');
    if (countEl) countEl.textContent = _isDora()
      ? _piCsvCapNames.length + ' capabilities found — confirm or adjust the mappings below, then click Confirm Mappings.'
      : `${_piCsvCapNames.length} ${dimLabel.toLowerCase()}(s) found — confirm, then click Confirm Mappings.`;
  }

  // ── Step 3: process mappings → review ────────────────────────────
  function processPolicyImport() {
    const mapping = _currentMapping();
    if (!Object.keys(mapping).length) {
      alert('Map at least one ' + ((typeof lensDimLabel === 'function' ? lensDimLabel() : 'capability').toLowerCase()) + ' before confirming.');
      return;
    }
    _piCandidatePolicyRows = _extractPolicyRows(mapping);
    _piComputed = _groupsFromRows(_piCandidatePolicyRows);
    if (!_piCandidatePolicyRows.length) {
      alert('No statement refs matched the mappings.');
      return;
    }
    renderPiReviewTable();
    showPiSection('pi-review');
  }

  // ── Step 3: review table (uses same 4-table layout as main metrics card) ──
  function renderPiReviewTable() {
    const assessment      = editingId ? db.assessments.find(a => a.id === editingId) : null;
    const existingRiskRows = assessment?.riskRows || [];
    const enriched         = buildRiskPolicyFacts(existingRiskRows, _piCandidatePolicyRows);
    const candidateSummary = buildFactSummary(enriched, _piCandidatePolicyRows);

    document.getElementById('pi-review-wrap').innerHTML =
      renderFactSummaryTables(candidateSummary, null);

    const capCount = new Set(_piCandidatePolicyRows.map(r => r.capId)).size;
    const countEl  = document.getElementById('pi-review-count');
    if (countEl) countEl.textContent =
      capCount + ' capabilities with statement data — review and save.';
  }

  // ── Save ─────────────────────────────────────────────────────────
  function savePolicyImport() {
    const assessment = editingId ? db.assessments.find(a => a.id === editingId) : null;
    if (!assessment) { alert('No assessment open — return to an assessment before saving.'); return; }

    const mapping    = _currentMapping();
    const policyRows = _extractPolicyRows(mapping);
    const fw         = _fw();

    // Write policy + facts into the ACTIVE lens's slots. DORA uses the original
    // field names (policyRows / riskPolicyFacts) so its behaviour is unchanged.
    assessment[fw.policyKey] = policyRows;
    assessment[fw.policyMetaKey] = {
      uploadDate:      new Date().toISOString().slice(0, 10),
      totalStatements: policyRows.length,
      byCapability:    _isDora() ? buildPolicyByCapability(policyRows) : undefined,
    };
    if (fw.groupsKey) assessment[fw.groupsKey] = _groupsFromRows(policyRows);
    assessment[fw.factsKey] = buildRiskPolicyFacts(assessment.riskRows || [], policyRows);
    if (_isDora()) assessment.factSummary = buildFactSummary(assessment.riskPolicyFacts, policyRows);

    saveToLocalStorage();
    loadFromLocalStorage();
    openAssessmentForm(editingId);
  }

  // ── Section toggle helper ────────────────────────────────────────
  function showPiSection(id) {
    ['pi-upload', 'pi-mapping', 'pi-review'].forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = s === id ? 'block' : 'none';
    });
  }

  // ── Expose globals ───────────────────────────────────────────────
  window.initPolicyImport    = initPolicyImport;
  window.handlePiFile        = handlePiFile;
  window.processPolicyImport = processPolicyImport;
  window.savePolicyImport    = savePolicyImport;
})();

// ── Per-capability policy data helpers (used by assessment-form) ──

function getPolicyData(assessment, capId) {
  return assessment?.policyStatements?.byCapability?.[capId] || null;
}

function renderPolicyCardContent(assessment, capId) {
  const pd = getPolicyData(assessment, capId);
  if (!pd || !pd.count) {
    return '<p class="policy-no-data">No policy data uploaded</p>';
  }
  const typeItems = Object.entries(pd.types || {})
    .map(([t, n]) => `<span class="policy-type-pill">${t}: <strong>${n}</strong></span>`)
    .join('');
  const refs = pd.refs || [];
  const refsText = refs.slice(0, 8).join(' · ') + (refs.length > 8 ? ` <em>+${refs.length - 8} more</em>` : '');
  return `
    <div class="policy-card-body">
      <div class="policy-stat-row">
        <span class="policy-stat-num">${pd.count}</span>
        <span class="policy-stat-label">statements</span>
        ${typeItems}
      </div>
      <div class="policy-refs-list">${refsText || '—'}</div>
    </div>`;
}

// Update the per-lens import summaries on the New/Edit Assessment screen.
function refreshPolicyCards() {
  const a = editingId ? db.assessments.find(x => x.id === editingId) : null;
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const FW = (typeof FRAMEWORKS !== 'undefined') ? FRAMEWORKS : {};

  ['dora', 'mica', 'nist'].forEach(key => {
    const f = FW[key]; if (!f) return;
    const soa = a && a[f.soaMetaKey];
    set(`imp-soa-${key}`, soa ? `${soa.total} ${f.unitLabel} · ${soa.applicable} applicable · ${soa.uploadDate}` : `No ${f.label} SOA uploaded`);
    const pol = a && a[f.policyMetaKey];
    set(`imp-pol-${key}`, pol ? `${pol.totalStatements} statements · ${pol.uploadDate}` : `No ${f.label} policy data uploaded`);
    const map = a && a[f.metaKey];
    set(`imp-map-${key}`, map ? `${map.totalObligations} objectives · ${map.coveredObligations} covered · ${map.uploadDate}` : `No ${f.label} mapping uploaded`);
  });

  const riskRows = a?.riskRows || [];
  const caps = new Set(riskRows.map(r => r.capId)).size;
  set('rk-data-summary', caps > 0 ? `Risk data · ${riskRows.length} controls across ${caps} capabilities` : 'No risk data uploaded');
}
