// ── Policy Statements Import ──────────────────────────────────

function handlePolicyFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    parsePolicyCSV(e.target.result);
    input.value = '';
  };
  reader.readAsText(file);
}

function parsePolicyCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) { alert('No data found in file.'); return; }

  // Parse header row
  const headers = policyParseRow(lines[0]).map(h => h.toLowerCase().trim());
  function col() {
    for (let i = 0; i < arguments.length; i++) {
      const idx = headers.findIndex(h => h.includes(arguments[i]));
      if (idx >= 0) return idx;
    }
    return -1;
  }
  const capCol  = col('capability', 'process', 'domain', 'function');
  const refCol  = col('statement ref', 'ref', 'reference');
  const typeCol = col('type');
  const docCol  = col('document');

  if (refCol < 0) { alert('Could not find a Statement Ref column.'); return; }

  // Parse data rows
  const byCapability = {};
  let total = 0, unmapped = 0;

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = policyParseRow(lines[i]);
    const ref    = row[refCol]  ? row[refCol].trim()  : '';
    const csvCap = capCol >= 0  ? (row[capCol]  || '').trim() : '';
    const type   = typeCol >= 0 ? (row[typeCol] || '').trim() : '';
    const doc    = docCol  >= 0 ? (row[docCol]  || '').trim() : '';
    if (!ref) continue;
    total++;

    const capId = matchPolicyCap(csvCap);
    if (!capId) { unmapped++; continue; }

    if (!byCapability[capId]) {
      byCapability[capId] = { count: 0, refs: [], types: {}, documents: [] };
    }
    const c = byCapability[capId];
    c.count++;
    c.refs.push(ref);
    if (type) c.types[type] = (c.types[type] || 0) + 1;
    if (doc && !c.documents.includes(doc)) c.documents.push(doc);
  }

  const assessment = db.assessments.find(a => a.id === editingId);
  if (!assessment) { alert('No assessment selected — open an assessment before uploading policy data.'); return; }

  assessment.policyStatements = {
    uploadDate: new Date().toISOString().slice(0, 10),
    totalStatements: total - unmapped,
    unmapped,
    byCapability
  };
  saveToLocalStorage();
  refreshPolicyCards();

  const msg = unmapped > 0
    ? `Saved ${total - unmapped} statements across ${Object.keys(byCapability).length} capabilities. (${unmapped} rows could not be matched.)`
    : `Saved ${total} statements across ${Object.keys(byCapability).length} capabilities.`;
  const msgEl = document.getElementById('policy-import-msg');
  if (msgEl) {
    msgEl.textContent = msg;
    msgEl.style.display = 'block';
    setTimeout(() => { msgEl.style.display = 'none'; }, 5000);
  }
}

function policyParseRow(line) {
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

function matchPolicyCap(csvName) {
  if (!csvName) return null;
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

function getPolicyData(assessment, capId) {
  return assessment?.policyStatements?.byCapability?.[capId] || null;
}

function renderPolicyCardContent(assessment, capId) {
  const pd = getPolicyData(assessment, capId);
  if (!pd || !pd.count) {
    return '<p class="policy-no-data">No data for this capability</p>';
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

  // Assessment-level summary
  const summaryEl = document.getElementById('policy-import-summary');
  if (summaryEl) {
    const ps = assessment?.policyStatements;
    summaryEl.textContent = ps
      ? `${ps.totalStatements} statements · Uploaded ${ps.uploadDate}`
      : 'No policy data uploaded';
  }

  // Per-capability cards
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
