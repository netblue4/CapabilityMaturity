// ── Riskonnect CSV Import ────────────────────────────────────

(function () {
  let _parsedRows   = [];
  let _csvCapNames  = [];
  let _detectedCols = {};
  let _computed     = [];

  // ── Entry point ──────────────────────────────────────────────
  function initRiskonnectImport() {
    _parsedRows = []; _csvCapNames = []; _detectedCols = {}; _computed = [];
    const fi = document.getElementById('rk-file-input');
    if (fi) fi.value = '';
    showRkSection('rk-upload');
    document.getElementById('rk-upload-info').textContent = '';
  }

  // ── CSV parsing ──────────────────────────────────────────────
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

  // ── Column detection ─────────────────────────────────────────
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
      capability: find('business process', 'process', 'capability', 'function', 'domain'),
      riskTitle:  find('risk title', 'risk name', 'title'),
      status:     find('status'),
      owner:      find('owner'),
      designAss:  find('design assess', 'design effectiveness', 'design rating', 'design'),
      opAss:      find('operation assess', 'operational assess', 'operation effectiveness', 'operation rating', 'operation'),
      residual:   find('residual score', 'residual risk score', 'residual rating score', 'residual'),
    };
  }

  // ── File handler ─────────────────────────────────────────────
  function handleRkFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const text = e.target.result;
      _parsedRows = parseCSV(text);
      if (!_parsedRows.length) {
        alert('No data rows found in the CSV file.');
        return;
      }
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

  // ── Fuzzy capability matching ────────────────────────────────
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

  // ── Step 1: mapping table ────────────────────────────────────
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

  // ── Process: CSV rows → computed results ─────────────────────
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
      const cap = CONFIG.capabilities.find(c => c.id === capId);
      return { capId, capName: cap ? cap.name : capId, ...computeMaturity(rows, cols) };
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

    showRkSection('rk-review');
  }

  // ── Maturity derivation ──────────────────────────────────────
  //
  // The CSV has ONE ROW PER CONTROL. Each risk repeats across multiple
  // rows (one per control it has). We must deduplicate by Risk Title
  // before counting risks; control rows are counted as-is.
  //
  function computeMaturity(rows, cols) {
    if (!rows.length) {
      return {
        level: 1, risksDraft: 0, risksAssessed: 0,
        controlsEffective: 0, controlsPartial: 0, controlsNotAssessed: 0,
        residualRating: '', evidence: 'No risks',
      };
    }

    // ── Deduplicate risks by title (one row per unique risk) ──────
    // Each risk appears once per control in the CSV. We keep the first
    // row per unique title to count risk-level fields (status, residual).
    const uniqueRisks = new Map(); // title → first representative row
    rows.forEach(row => {
      const title = cols.riskTitle ? row[cols.riskTitle] : null;
      const key   = (title && title.trim()) ? title.trim() : '__row_' + rows.indexOf(row);
      if (!uniqueRisks.has(key)) uniqueRisks.set(key, row);
    });
    const riskRows = [...uniqueRisks.values()];

    // ── Risk-level counts (use deduplicated risk rows) ────────────
    const statusOf   = r => (r[cols.status] || '').toLowerCase();
    const draftRisks = riskRows.filter(r => statusOf(r).includes('draft'));
    const openRisks  = riskRows.filter(r => statusOf(r).includes('open'));

    // A risk is "assessed" when it has a non-empty Residual Score
    const assessedRisks = riskRows.filter(r => {
      if (!cols.residual) return false;
      const sc = (r[cols.residual] || '').trim();
      return sc !== '' && sc !== '0' && !isNaN(parseFloat(sc));
    });

    // Highest residual score → rating (use deduplicated risk rows)
    let maxScore = 0;
    if (cols.residual) {
      riskRows.forEach(r => {
        const sc = parseFloat(r[cols.residual] || '0');
        if (sc > maxScore) maxScore = sc;
      });
    }
    const residualRating = scoreToRating(maxScore);

    // ── Control counts (use ALL rows — one row per control) ───────
    let eff = 0, part = 0, notAss = 0, anyCtrlAssessed = false;
    rows.forEach(row => {
      const d = (row[cols.designAss] || '').toLowerCase();
      const o = (row[cols.opAss]     || '').toLowerCase();

      const isGreen  = s => s.includes('green')  || s.includes('effective');
      const isAmber  = s => s.includes('amber')  || s.includes('partial');
      const isGrey   = s => s.includes('grey')   || s.includes('gray') || s.includes('not assess') || s === '';

      if (isGrey(d) && isGrey(o)) { notAss++; return; }
      anyCtrlAssessed = true;
      if (isGreen(d) && isGreen(o)) eff++;
      else if (isAmber(d) || isAmber(o)) part++;
      else notAss++;
    });

    // ── Sustainability level (1–5) using shared helper ────────────
    const rmForLevel = {
      risksAssessed:       assessedRisks.length,
      residualRating:      scoreToRating(maxScore),
      controlsEffective:   eff,
      controlsPartial:     part,
      controlsNotAssessed: notAss,
    };
    const level = computeSustainabilityLevel(rmForLevel);

    // ── Compute configured risk metrics ──────────────────────────
    const totalRisks = riskRows.length;
    const metricsData = {};
    (CONFIG.riskMetrics || []).forEach(m => {
      let value = null;
      if (m.id === 'risk_coverage') {
        value = totalRisks > 0
          ? Math.round(((totalRisks - draftRisks.length) / totalRisks) * 100)
          : null;
      }
      // Future metrics: add else-if branches here when new metrics are defined
      metricsData[m.id] = { value };
    });

    // ── Evidence summary ──────────────────────────────────────────
    const ev = [];
    if (draftRisks.length)    ev.push(draftRisks.length    + ' draft');
    if (openRisks.length)     ev.push(openRisks.length      + ' open');
    if (assessedRisks.length) ev.push(assessedRisks.length  + ' assessed');
    if (eff)    ev.push(eff    + ' ctrl eff');
    if (part)   ev.push(part   + ' ctrl part');
    if (notAss) ev.push(notAss + ' ctrl NA');

    return {
      level,
      sustainabilityLevel: level,
      totalRisks,
      risksDraft:          draftRisks.length,
      openRisksCount:      openRisks.length,
      risksAssessed:       assessedRisks.length,
      controlsEffective:   eff,
      controlsPartial:     part,
      controlsNotAssessed: notAss,
      residualRating,
      evidence: ev.join(' · ') || totalRisks + ' risks',
      metrics:  metricsData,
    };
  }

  function scoreToRating(score) {
    if (!score || score < 4) return '';
    const keys = Object.keys(CONFIG.riskScoreMatrix || {});
    if (score >= 28) return keys.find(k => k.startsWith('Extreme'))     || '';
    if (score >= 20) return keys.find(k => k.startsWith('Significant')) || '';
    if (score >= 12) return keys.find(k => k.startsWith('Moderate'))    || '';
    return keys.find(k => k.startsWith('Low')) || '';
  }

  // ── Step 2: review table ─────────────────────────────────────
  function renderReviewTable() {
    const riskKeys = Object.keys(CONFIG.riskScoreMatrix || {});
    function getAbbrev(v) {
      if (!v) return null;
      if (v.startsWith('Extreme'))     return 'EXT';
      if (v.startsWith('Significant')) return 'SIG';
      if (v.startsWith('Moderate'))    return 'MOD';
      if (v.startsWith('Low'))         return 'LOW';
      return null;
    }

    const rows = _computed.map((r, i) => {
      const abbrev = getAbbrev(r.residualRating);
      const rIdx   = riskKeys.indexOf(r.residualRating);
      const rColor = rIdx >= 0 ? (CONFIG.levels[rIdx]?.color || 'var(--bg3)') : 'var(--bg3)';
      const rBadge = abbrev
        ? `<span class="risk-residual-badge" style="background:${rColor};color:#fff">${abbrev}</span>`
        : `<span class="risk-residual-badge risk-badge-na">NA</span>`;

      const lvColor = CONFIG.levels[r.level - 1]?.color || 'var(--bg3)';
      const lvDef   = sustLevelDef(r.level);
      const lvName  = lvDef ? lvDef.shortName : '';

      const overrideOpts = [1, 2, 3, 4, 5].map(l => {
        const def = sustLevelDef(l);
        return `<option value="${l}"${l === r.level ? ' selected' : ''}>${l} — ${def ? def.shortName : ''}</option>`;
      }).join('');

      return `
        <tr>
          <td class="rk-rev-cap" title="${r.capName}">${shortName(r.capName)}</td>
          <td class="rk-rev-ev">${r.evidence}</td>
          <td class="rk-rev-risk">${rBadge}</td>
          <td class="rk-rev-sug">
            <span class="rk-level-badge" style="background:${lvColor}">${r.level}</span>
            <span class="rk-level-name">${lvName}</span>
          </td>
          <td class="rk-rev-ovr">
            <select class="rk-override-sel" data-idx="${i}">${overrideOpts}</select>
          </td>
        </tr>`;
    }).join('');

    document.getElementById('rk-review-body').innerHTML = rows;
    document.getElementById('rk-review-count').textContent =
      _computed.length + ' capabilities ready — review suggested levels and adjust if needed.';
  }

  // ── Save ─────────────────────────────────────────────────────
  function saveRkImport() {
    const aId = document.getElementById('rk-assessment-sel').value;
    const assessment = db.assessments.find(a => a.id === aId);
    if (!assessment) { alert('Please select an assessment.'); return; }

    const overrides = {};
    document.querySelectorAll('.rk-override-sel').forEach(sel => {
      overrides[parseInt(sel.dataset.idx)] = parseInt(sel.value);
    });

    if (!assessment.measureScores)  assessment.measureScores  = {};
    if (!assessment.measureTargets) assessment.measureTargets = {};

    _computed.forEach((r, i) => {
      const level = overrides[i] !== undefined ? overrides[i] : r.level;
      const capId = r.capId;

      if (!assessment.measureScores[capId])  assessment.measureScores[capId]  = {};
      if (!assessment.measureTargets[capId]) assessment.measureTargets[capId] = {};

      // Merge RCSA fields — governance/reporting/riskFramework scores untouched
      const existing = assessment.measureScores[capId].riskManagement || {};
      assessment.measureScores[capId].riskManagement = {
        ...existing,
        sustainabilityLevel: level,
        totalRisks:          r.totalRisks          || 0,
        risksDraft:          r.risksDraft,
        openRisks:           r.openRisksCount,
        risksAssessed:       r.risksAssessed,
        controlsEffective:   r.controlsEffective,
        controlsPartial:     r.controlsPartial,
        controlsNotAssessed: r.controlsNotAssessed,
        residualRating:      r.residualRating,
        metrics:             r.metrics             || {},
      };
    });

    saveToLocalStorage();
    alert('Saved to "' + assessment.label + '". ' + _computed.length + ' capabilities updated.');
    showView('dashboard');
  }

  // ── Section toggle helper ────────────────────────────────────
  function showRkSection(id) {
    ['rk-upload', 'rk-mapping', 'rk-review'].forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = s === id ? 'block' : 'none';
    });
  }

  // ── Expose globals ───────────────────────────────────────────
  window.initRiskonnectImport = initRiskonnectImport;
  window.handleRkFile        = handleRkFile;
  window.processRkImport     = processRkImport;
  window.saveRkImport        = saveRkImport;
})();
