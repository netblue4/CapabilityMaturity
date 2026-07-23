// ── Riskonnect CSV Import ────────────────────────────────────────

(function () {
  let _parsedRows   = [];
  let _csvCapNames  = [];
  let _detectedCols = {};
  let _computed     = [];

  // ── Entry point ──────────────────────────────────────────────────
  function initRiskonnectImport() {
    _parsedRows = []; _csvCapNames = []; _detectedCols = {}; _computed = [];
    const fi = document.getElementById('rk-file-input');
    if (fi) fi.value = '';
    showRkSection('rk-upload');
    document.getElementById('rk-upload-info').textContent = '';
  }

  // ── CSV parsing ──────────────────────────────────────────────────
  function parseCSVRow(line) {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        out.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    if (!lines.length) return [];
    const headers = parseCSVRow(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = parseCSVRow(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => { obj[h.trim()] = (vals[idx] || '').trim(); });
      rows.push(obj);
    }
    return rows;
  }

  // ── Column detection ─────────────────────────────────────────────
  function detectColumns(headers) {
    const hl = headers.map(h => h.toLowerCase());
    function find(...terms) {
      for (const t of terms) {
        const idx = hl.findIndex(h => h.includes(t));
        if (idx >= 0) return headers[idx];
      }
      return null;
    }
    return {
      capability:     find('business process', 'process', 'capability', 'function', 'domain'),
      riskTitle:      find('risk title', 'risk name', 'title'),
      status:         find('status'),
      owner:          find('owner'),
      designAss:      find('design assess', 'design effectiveness', 'design rating', 'design'),
      opAss:          find('operation assess', 'operational assess', 'operation effectiveness', 'operation rating', 'operation'),
      residual:       find('residual score', 'residual risk score', 'residual rating score', 'residual'),
      controlStatus:  find('control: status', 'control status'),
      lastAssessDate: find('last control assessment', 'last assessment', 'assessment date'),
      controlName:    find('control: name', 'control name', 'control: title', 'control title'),
    };
  }

  // ── File handler ─────────────────────────────────────────────────
  function handleRkFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const text = e.target.result;
      _parsedRows = parseCSV(text);
      if (!_parsedRows.length) { alert('No data rows found in the CSV file.'); return; }
      const headers = Object.keys(_parsedRows[0]);
      _detectedCols = detectColumns(headers);
      if (!_detectedCols.capability) {
        alert('Could not find a capability / business-process column.\nColumns found: ' + headers.join(', '));
        return;
      }
      _csvCapNames = [...new Set(_parsedRows.map(r => r[_detectedCols.capability]).filter(Boolean))];
      document.getElementById('rk-upload-info').textContent =
        file.name + ' — ' + _parsedRows.length + ' rows, ' + _csvCapNames.length + ' unique capabilities detected.';
      renderMappingTable();
      showRkSection('rk-mapping');
    };
    reader.readAsText(file);
  }

  // ── Fuzzy capability matching ────────────────────────────────────
  function autoMatch(csvName) {
    const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    const csvW = new Set(norm(csvName).split(/\s+/).filter(w => w.length > 2));
    let bestId = null, bestScore = -1;
    CONFIG.capabilities.forEach(cap => {
      const sysW = new Set(norm(cap.name).split(/\s+/).filter(w => w.length > 2));
      const inter = [...csvW].filter(w => sysW.has(w)).length;
      const score = inter / Math.max(csvW.size, sysW.size, 1);
      if (score > bestScore) { bestScore = score; bestId = cap.id; }
    });
    return bestId;
  }

  // ── Step 1: mapping table ────────────────────────────────────────
  function renderMappingTable() {
    const rows = _csvCapNames.map((name, i) => {
      const match = autoMatch(name);
      const opts = CONFIG.capabilities.map(c =>
        `<option value="${c.id}"${c.id === match ? ' selected' : ''}>${c.name}</option>`
      ).join('');
      return `
        <tr>
          <td class="rk-map-csv">${name}</td>
          <td>
            <select class="rk-cap-sel" data-idx="${i}">
              <option value="">— skip —</option>
              ${opts}
            </select>
          </td>
        </tr>`;
    }).join('');
    document.getElementById('rk-map-body').innerHTML = rows;
    document.getElementById('rk-map-count').textContent =
      _csvCapNames.length + ' capabilities found — confirm or adjust the mappings below, then click Import.';
  }

  // ── Build flat fact rows for one capability ───────────────────────
  function buildFactRows(rows, cols, capId) {
    return rows.map(row => {
      const rawName = cols.controlName ? (row[cols.controlName] || '').trim() : '';
      let controlType = 'operational';
      if (rawName.startsWith('LocPol')) controlType = 'locPol';
      else if (rawName.startsWith('GrpStd')) controlType = 'grpStd';

      const dRaw = (row[cols.designAss] || '').toLowerCase();
      const oRaw = (row[cols.opAss]     || '').toLowerCase();
      function toGAG(s) {
        if (s.includes('green') || s.includes('effective')) return 'green';
        if (s.includes('amber') || s.includes('partial'))  return 'amber';
        return 'grey';
      }
      const residualRaw = cols.residual ? row[cols.residual] : null;
      const residualNum = residualRaw ? (parseFloat(residualRaw) || null) : null;

      return {
        capId,
        riskTitle:      cols.riskTitle      ? (row[cols.riskTitle]      || '').trim() : '',
        riskStatus:     cols.status         ? (row[cols.status]         || '').toLowerCase().trim() : '',
        controlName:    rawName,
        controlType,
        controlStatus:  cols.controlStatus  ? (row[cols.controlStatus]  || '').toLowerCase().trim() : '',
        designAssess:   toGAG(dRaw),
        opAssess:       toGAG(oRaw),
        lastAssessDate: cols.lastAssessDate ? (row[cols.lastAssessDate] || '').trim() : '',
        residualScore:  residualNum,
        statementRefs:  extractStatementRefs(rawName),
        matchedPolicyRows: [],
      };
    });
  }

  // ── Process: CSV rows → per-capability fact rows ─────────────────
  function processRkImport() {
    const sels = document.querySelectorAll('.rk-cap-sel');
    const mapping = {};
    sels.forEach(sel => {
      if (sel.value) mapping[_csvCapNames[parseInt(sel.dataset.idx)]] = sel.value;
    });
    if (!Object.keys(mapping).length) {
      alert('Map at least one capability before importing.');
      return;
    }

    const cols = _detectedCols;
    const grouped = {};
    _parsedRows.forEach(row => {
      const capId = mapping[row[cols.capability]];
      if (!capId) return;
      if (!grouped[capId]) grouped[capId] = [];
      grouped[capId].push(row);
    });

    _computed = Object.entries(grouped).map(([capId, rows]) => {
      const cap   = CONFIG.capabilities.find(c => c.id === capId);
      const facts = buildFactRows(rows, cols, capId);
      const rm    = ftRiskMetrics(facts);
      const scores = facts.map(f => f.residualScore || 0).filter(n => n > 0);
      const maxScore = scores.length ? Math.max(...scores) : 0;
      return {
        capId,
        capName:        cap ? cap.name : capId,
        facts,
        totalRisks:     rm.total,
        openRisks:      rm.open,
        draftRisks:     rm.draft,
        residualRating: scoreToRating(maxScore),
      };
    });

    if (!_computed.length) {
      alert('No rows matched the configured mappings.');
      return;
    }

    renderReviewTable();

    const aSel = document.getElementById('rk-assessment-sel');
    aSel.innerHTML = [...db.assessments].reverse()
      .map(a => `<option value="${a.id}">${a.label} · ${formatDate(a.date)}</option>`)
      .join('');
    if (editingId) aSel.value = editingId;

    showRkSection('rk-review');
  }

  function scoreToRating(score) {
    if (!score || score < 4) return '';
    const keys = Object.keys(CONFIG.riskScoreMatrix || {});
    if (score >= 28) return keys.find(k => k.startsWith('Extreme'))     || '';
    if (score >= 20) return keys.find(k => k.startsWith('Significant')) || '';
    if (score >= 12) return keys.find(k => k.startsWith('Moderate'))    || '';
    return keys.find(k => k.startsWith('Low')) || '';
  }

  // ── Step 2: review table ─────────────────────────────────────────
  function renderReviewTable() {
    const riskKeys = Object.keys(CONFIG.riskScoreMatrix || {});

    const thead = document.getElementById('rk-rev-table-head');
    if (thead) {
      thead.innerHTML = `<tr>
        <th>Capability</th>
        <th>Risks</th>
        <th>Open</th>
        <th>Draft</th>
        <th>Operational</th>
        <th>LocPol</th>
        <th>GrpStd</th>
        <th>Residual</th>
      </tr>`;
    }

    function residualBadge(rating) {
      if (!rating) return `<span class="risk-residual-badge risk-badge-na">—</span>`;
      function abbr(v) {
        if (v.startsWith('Extreme'))     return 'EXT';
        if (v.startsWith('Significant')) return 'SIG';
        if (v.startsWith('Moderate'))    return 'MOD';
        if (v.startsWith('Low'))         return 'LOW';
        return '?';
      }
      const idx = riskKeys.indexOf(rating);
      const color = idx >= 0 ? (CONFIG.levels[idx]?.color || 'var(--bg3)') : 'var(--bg3)';
      return `<span class="risk-residual-badge" style="background:${color};color:#fff">${abbr(rating)}</span>`;
    }

    const rows = _computed.map(r => {
      const lp = ftLocPol(r.facts).length;
      const gs = ftGrpStd(r.facts).length;
      const op = ftOperational(r.facts).length;
      return `<tr>
        <td class="rk-rev-cap" title="${r.capName}">${shortName(r.capName)}</td>
        <td style="text-align:center">${r.totalRisks}</td>
        <td style="text-align:center">${r.openRisks}</td>
        <td style="text-align:center">${r.draftRisks}</td>
        <td style="text-align:center">${op || '—'}</td>
        <td style="text-align:center">${lp || '—'}</td>
        <td style="text-align:center">${gs || '—'}</td>
        <td style="text-align:center">${residualBadge(r.residualRating)}</td>
      </tr>`;
    }).join('');

    document.getElementById('rk-review-body').innerHTML = rows;
    document.getElementById('rk-review-count').textContent =
      _computed.length + ' capabilities ready — review and save.';
  }

  // ── Save ─────────────────────────────────────────────────────────
  function saveRkImport() {
    const aId = document.getElementById('rk-assessment-sel').value;
    const assessment = db.assessments.find(a => a.id === aId);
    if (!assessment) { alert('Please select an assessment.'); return; }

    if (!assessment.measureScores) assessment.measureScores = {};

    // Flat risk rows for the fact table
    const newRiskRows = _computed.flatMap(r => r.facts);
    assessment.riskRows = newRiskRows;

    // Join with any existing policy rows
    assessment.riskPolicyFacts = buildRiskPolicyFacts(newRiskRows, assessment.policyRows || []);

    // Keep residual + count fields in measureScores for the assessment form
    _computed.forEach(r => {
      if (!assessment.measureScores[r.capId]) assessment.measureScores[r.capId] = {};
      const existing = assessment.measureScores[r.capId].riskManagement || {};
      assessment.measureScores[r.capId].riskManagement = {
        ...existing,
        totalRisks:     r.totalRisks,
        openRisks:      r.openRisks,
        risksDraft:     r.draftRisks,
        residualRating: r.residualRating,
      };
    });

    saveToLocalStorage();
    loadFromLocalStorage();
    openAssessmentForm(aId);
  }

  // ── Section toggle helper ────────────────────────────────────────
  function showRkSection(id) {
    ['rk-upload', 'rk-mapping', 'rk-review'].forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = s === id ? 'block' : 'none';
    });
  }

  // ── Expose globals ───────────────────────────────────────────────
  window.initRiskonnectImport = initRiskonnectImport;
  window.handleRkFile        = handleRkFile;
  window.processRkImport     = processRkImport;
  window.saveRkImport        = saveRkImport;
})();
