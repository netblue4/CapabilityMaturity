// ── Policy Statements Import Wizard ──────────────────────────────

(function () {
  let _piRows                = [];
  let _piCsvCapNames         = [];
  let _piCols                = {};
  let _piComputed            = [];
  let _piCandidatePolicyRows = [];

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
  function piParseRow(line) {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        out.push(cur); cur = '';
      } else { cur += ch; }
    }
    out.push(cur);
    return out;
  }

  function piParseCSV(text) {
    const lines = text.split(/\r?\n/);
    if (!lines.length) return { headers: [], rows: [] };
    const headers = piParseRow(lines[0]).map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = piParseRow(lines[i]);
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
    return {
      capability: find('capability', 'process', 'domain', 'function'),
      ref:        find('statement ref', 'ref', 'reference'),
      type:       find('type'),
      document:   find('document'),
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
      if (!_piCols.capability) {
        alert('Could not find a Capability column.\nColumns found: ' + headers.join(', '));
        return;
      }
      _piRows = rows;
      _piCsvCapNames = [...new Set(rows.map(r => r[_piCols.capability]).filter(Boolean))];
      document.getElementById('pi-upload-info').textContent =
        file.name + ' — ' + rows.length + ' rows, ' + _piCsvCapNames.length + ' unique capabilities detected.';
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
    const rows = _piCsvCapNames.map((name, i) => {
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
    if (countEl) countEl.textContent =
      _piCsvCapNames.length + ' capabilities found — confirm or adjust the mappings below, then click Confirm Mappings.';
  }

  // ── Step 3: process mappings → review ────────────────────────────
  function processPolicyImport() {
    const sels = document.querySelectorAll('.pi-cap-sel');
    const mapping = {};
    sels.forEach(sel => {
      if (sel.value) mapping[_piCsvCapNames[parseInt(sel.dataset.idx)]] = sel.value;
    });
    if (!Object.keys(mapping).length) {
      alert('Map at least one capability before confirming.');
      return;
    }

    const grouped = {};
    _piRows.forEach(row => {
      const csvCap = row[_piCols.capability] || '';
      const capId  = mapping[csvCap];
      if (!capId) return;
      const ref  = _piCols.ref      ? (row[_piCols.ref]      || '').trim() : '';
      const type = _piCols.type     ? (row[_piCols.type]     || '').trim() : '';
      const doc  = _piCols.document ? (row[_piCols.document] || '').trim() : '';
      if (!ref) return;
      if (!grouped[capId]) grouped[capId] = { count: 0, refs: [], types: {}, documents: [] };
      const g = grouped[capId];
      g.count++;
      g.refs.push(ref);
      if (type) g.types[type] = (g.types[type] || 0) + 1;
      if (doc && !g.documents.includes(doc)) g.documents.push(doc);
    });

    _piComputed = Object.entries(grouped).map(([capId, data]) => {
      const cap = CONFIG.capabilities.find(c => c.id === capId);
      return { capId, capName: cap ? cap.name : capId, ...data };
    });

    if (!_piComputed.length) {
      alert('No statement refs matched the configured mappings.');
      return;
    }

    // Build flat policy rows for the preview (same logic as savePolicyImport)
    _piCandidatePolicyRows = [];
    _piRows.forEach(row => {
      const csvCap = row[_piCols.capability] || '';
      const capId  = mapping[csvCap];
      if (!capId) return;
      const ref  = _piCols.ref      ? (row[_piCols.ref]      || '').trim() : '';
      const type = _piCols.type     ? (row[_piCols.type]     || '').trim() : '';
      const doc  = _piCols.document ? (row[_piCols.document] || '').trim() : '';
      if (!ref) return;
      _piCandidatePolicyRows.push({ capId, statementRef: ref, type, document: doc });
    });

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

    // Rebuild mapping from current select state
    const sels = document.querySelectorAll('.pi-cap-sel');
    const mapping = {};
    sels.forEach(sel => {
      if (sel.value) mapping[_piCsvCapNames[parseInt(sel.dataset.idx)]] = sel.value;
    });

    // Build flat policyRows (one per statement) from _piRows
    const policyRows = [];
    let unmapped = 0;
    _piRows.forEach(row => {
      const csvCap = row[_piCols.capability] || '';
      const capId  = mapping[csvCap];
      if (!capId) { unmapped++; return; }
      const ref  = _piCols.ref      ? (row[_piCols.ref]      || '').trim() : '';
      const type = _piCols.type     ? (row[_piCols.type]     || '').trim() : '';
      const doc  = _piCols.document ? (row[_piCols.document] || '').trim() : '';
      if (!ref) return;
      policyRows.push({ capId, statementRef: ref, type, document: doc });
    });

    assessment.policyRows = policyRows;
    assessment.policyStatements = {
      uploadDate:      new Date().toISOString().slice(0, 10),
      totalStatements: policyRows.length,
      unmapped,
      byCapability:    buildPolicyByCapability(policyRows),
    };

    // Rebuild enriched fact table
    assessment.riskPolicyFacts = buildRiskPolicyFacts(assessment.riskRows || [], policyRows);

    // Rebuild stored summary tables for trend arrows
    assessment.factSummary = buildFactSummary(assessment.riskPolicyFacts, policyRows);

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

function refreshPolicyCards() {
  const assessment = editingId ? db.assessments.find(a => a.id === editingId) : null;

  const ps = assessment?.policyStatements;
  const polSummary = document.getElementById('policy-import-summary');
  if (polSummary) {
    polSummary.textContent = ps
      ? `${ps.totalStatements} statements · Uploaded ${ps.uploadDate}`
      : 'No policy data uploaded';
  }

  const rkSummary = document.getElementById('rk-data-summary');
  if (rkSummary) {
    const riskRows = assessment?.riskRows || [];
    const caps = new Set(riskRows.map(r => r.capId)).size;
    rkSummary.textContent = caps > 0
      ? `Risk data for ${caps} capabilities · ${riskRows.length} controls`
      : 'No risk data uploaded';
  }

  (CONFIG.capabilities || []).forEach(cap => {
    const el = document.getElementById(`policy-card-${cap.id}`);
    if (!el) return;
    el.innerHTML = `
      <div class="policy-data-card-hdr">
        <span>📋</span>
        <span>Uploaded Policy Data</span>
      </div>
      ${renderPolicyCardContent(assessment, cap.id)}`;
  });
}
