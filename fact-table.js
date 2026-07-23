// ── Fact Table — Shared Helpers ───────────────────────────────────
//
// assessment.riskRows        — one row per control (from risk import)
// assessment.policyRows      — one row per policy statement (from policy import)
// assessment.riskPolicyFacts — riskRows enriched with matchedPolicyRows array

// ── Policy type detectors (used by both imports & metrics) ────────
function isLocPolType(t) {
  const s = (t || '').toLowerCase().trim();
  return s === 'locpol' || s === 'local policy' || s === 'local pol' || s.startsWith('loc');
}
function isGrpStdType(t) {
  const s = (t || '').toLowerCase().trim();
  return s === 'grpstd' || s === 'group standard' || s === 'group standards' ||
         s === 'group std' || s.startsWith('grp');
}

// ── Normalise string for case-insensitive matching ────────────────
function ftNorm(s) { return (s || '').toLowerCase().trim(); }

// ── Extract statement refs from a control name ────────────────────
// Handles two formats:
//   Parentheses suffix : "LocPol Control Name (REF1 / REF2)"
//   Slash-separated   : "GrpStd LP-20 PS05 / ITAM SR1"
function extractStatementRefs(rawName) {
  if (!rawName) return [];
  const stripped = rawName.replace(/^(GrpStd|LocPol)\s*/i, '').trim();
  if (!stripped) return [];
  const parenMatch = stripped.match(/\(([^)]+)\)\s*$/);
  if (parenMatch) return parenMatch[1].split('/').map(r => r.trim()).filter(Boolean);
  return stripped.split('/').map(r => r.trim()).filter(Boolean);
}

// ── Join riskRows + policyRows → enriched fact rows ───────────────
function buildRiskPolicyFacts(riskRows, policyRows) {
  const polByRef = {};
  (policyRows || []).forEach(pr => {
    const key = ftNorm(pr.statementRef);
    if (!key) return;
    if (!polByRef[key]) polByRef[key] = [];
    polByRef[key].push(pr);
  });

  return (riskRows || []).map(rr => {
    const matched = [];
    (rr.statementRefs || []).forEach(ref => {
      const key = ftNorm(ref);
      if (polByRef[key]) matched.push(...polByRef[key]);
    });
    const seen = new Set();
    const uniqueMatched = matched.filter(pr => {
      const k = ftNorm(pr.statementRef);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { ...rr, matchedPolicyRows: uniqueMatched };
  });
}

// ── Build byCapability summary from flat policyRows ───────────────
function buildPolicyByCapability(policyRows) {
  const by = {};
  (policyRows || []).forEach(pr => {
    if (!by[pr.capId]) by[pr.capId] = { count: 0, refs: [], types: {}, documents: [] };
    const g = by[pr.capId];
    g.count++;
    g.refs.push(pr.statementRef);
    if (pr.type) g.types[pr.type] = (g.types[pr.type] || 0) + 1;
    if (pr.document && !g.documents.includes(pr.document)) g.documents.push(pr.document);
  });
  return by;
}

// ── Control type filters ──────────────────────────────────────────
function ftLocPol(facts)      { return facts.filter(f => f.controlType === 'locPol'); }
function ftGrpStd(facts)      { return facts.filter(f => f.controlType === 'grpStd'); }
function ftOperational(facts) { return facts.filter(f => f.controlType === 'operational'); }

// ── Risk deduplication (one entry per unique risk title) ──────────
function ftUniqueRisks(facts) {
  const seen = new Set();
  return facts.filter((f, i) => {
    const key = ftNorm(f.riskTitle) || ('__i' + i);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Control assessment predicates ─────────────────────────────────
function ftIsImplemented(f) { return ftNorm(f.controlStatus) === 'implemented'; }
function ftIsAssessed(f)    { return !!(f.lastAssessDate && f.lastAssessDate.trim()); }
function ftIsEffective(f) {
  const g = s => s.includes('green') || s.includes('effective');
  return g(ftNorm(f.designAssess)) && g(ftNorm(f.opAssess));
}
function ftIsPartly(f) {
  const a    = s => s.includes('amber') || s.includes('partial');
  const grey = s => s.includes('grey')  || s.includes('gray') || s.includes('not assess') || s === '';
  if (grey(ftNorm(f.designAssess)) && grey(ftNorm(f.opAssess))) return false;
  return a(ftNorm(f.designAssess)) || a(ftNorm(f.opAssess));
}
function ftIsNotAssessed(f) {
  const grey = s => s.includes('grey') || s.includes('gray') || s.includes('not assess') || s === '';
  return grey(ftNorm(f.designAssess)) && grey(ftNorm(f.opAssess));
}

// ── Aggregation: control metrics ──────────────────────────────────
function ftControlMetrics(facts) {
  return {
    total:           facts.length,
    implemented:     facts.filter(ftIsImplemented).length,
    assessed:        facts.filter(ftIsAssessed).length,
    effective:       facts.filter(ftIsEffective).length,
    partlyEffective: facts.filter(ftIsPartly).length,
    notAssessed:     facts.filter(ftIsNotAssessed).length,
  };
}

// ── Aggregation: risk metrics (deduplicated by risk title) ────────
function ftRiskMetrics(facts) {
  const u = ftUniqueRisks(facts);
  return {
    total: u.length,
    open:  u.filter(f => ftNorm(f.riskStatus).includes('open')).length,
    draft: u.filter(f => ftNorm(f.riskStatus).includes('draft')).length,
  };
}

// ── Aggregation: policy metrics from policyRows ───────────────────
function ftPolicyMetrics(policyRows) {
  const rows = policyRows || [];
  return {
    total:  rows.length,
    locPol: rows.filter(r => isLocPolType(r.type)).length,
    grpStd: rows.filter(r => isGrpStdType(r.type)).length,
  };
}

// ── Per-capability accessors ──────────────────────────────────────
function ftForCap(assessment, capId) {
  return (assessment.riskPolicyFacts || []).filter(f => f.capId === capId);
}
function ftPolicyRowsForCap(assessment, capId) {
  return (assessment.policyRows || []).filter(r => r.capId === capId);
}

// ── Build stored fact summary (4 rolled-up tables) ────────────────
//
// Called after every import. Stores a snapshot on assessment.factSummary
// so quarter-over-quarter trend arrows can be computed.
//
function buildFactSummary(riskPolicyFacts, policyRows) {
  const facts   = riskPolicyFacts || [];
  const polRows = policyRows      || [];
  const hasPolicyData = polRows.length > 0;

  function capName(id) {
    return (CONFIG.capabilities || []).find(c => c.id === id)?.name || id;
  }

  // ── Table 1: Policy Objectives — one row per capId × document ────
  const poMap = {};
  polRows.forEach(pr => {
    const doc = (pr.document || '').trim() || '(no document)';
    const key = pr.capId + '||' + doc;
    if (!poMap[key]) poMap[key] = { capId: pr.capId, capName: capName(pr.capId), document: doc, ps1: 0, ps2: 0, ps3: 0 };
    poMap[key].ps1++;
    if (isLocPolType(pr.type))      poMap[key].ps2++;
    else if (isGrpStdType(pr.type)) poMap[key].ps3++;
  });
  const policyObjectives = Object.values(poMap);

  // ── Tables 2 & 3: LocPol / GrpStd Controls — by capId × document ─
  // Each control can link to multiple documents via matchedPolicyRows.
  // We count it in every document it links to (it's implementing all of them).
  // Controls with no policy match go into an "(unlinked)" bucket, but only
  // when policy data exists — without policy data we skip the bucket entirely.
  function buildControlTable(controlType) {
    const map = {};
    function getOrCreate(capId, doc) {
      const key = capId + '||' + doc;
      if (!map[key]) map[key] = {
        capId, capName: capName(capId), document: doc,
        risks: 0, open: 0, draft: 0,
        controls: 0, implemented: 0, assessed: 0,
        effective: 0, partly: 0, notAssessed: 0,
        _seen: new Set(),
      };
      return map[key];
    }

    facts.filter(f => f.controlType === controlType).forEach(f => {
      const docs = (f.matchedPolicyRows || [])
        .map(p => (p.document || '').trim() || '(no document)')
        .filter((d, i, arr) => arr.indexOf(d) === i); // unique

      const buckets = docs.length > 0 ? docs
        : (hasPolicyData ? ['(unlinked)'] : []);

      buckets.forEach(doc => {
        const row = getOrCreate(f.capId, doc);
        row.controls++;
        const rk = ftNorm(f.riskTitle) || ('__ctrl_' + row.controls);
        if (f.riskTitle && !row._seen.has(rk)) {
          row._seen.add(rk);
          row.risks++;
          if (ftNorm(f.riskStatus).includes('open'))  row.open++;
          if (ftNorm(f.riskStatus).includes('draft')) row.draft++;
        }
        if (ftIsImplemented(f))  row.implemented++;
        if (ftIsAssessed(f))     row.assessed++;
        if (ftIsEffective(f))    row.effective++;
        else if (ftIsPartly(f))  row.partly++;
        else                     row.notAssessed++;
      });
    });

    return Object.values(map).map(r => { delete r._seen; return r; });
  }

  // ── Table 4: Operational — one row per capId ──────────────────────
  const opMap = {};
  facts.filter(f => f.controlType === 'operational').forEach(f => {
    if (!opMap[f.capId]) opMap[f.capId] = {
      capId: f.capId, capName: capName(f.capId),
      risks: 0, open: 0, draft: 0,
      controls: 0, implemented: 0, assessed: 0,
      effective: 0, partly: 0, notAssessed: 0,
      _seen: new Set(),
    };
    const o = opMap[f.capId];
    o.controls++;
    const rk = ftNorm(f.riskTitle) || ('__op_' + o.controls);
    if (f.riskTitle && !o._seen.has(rk)) {
      o._seen.add(rk);
      o.risks++;
      if (ftNorm(f.riskStatus).includes('open'))  o.open++;
      if (ftNorm(f.riskStatus).includes('draft')) o.draft++;
    }
    if (ftIsImplemented(f))  o.implemented++;
    if (ftIsAssessed(f))     o.assessed++;
    if (ftIsEffective(f))    o.effective++;
    else if (ftIsPartly(f))  o.partly++;
    else                     o.notAssessed++;
  });
  const operational = Object.values(opMap).map(r => { delete r._seen; return r; });

  return {
    policyObjectives,
    locPolControls: buildControlTable('locPol'),
    grpStdControls: buildControlTable('grpStd'),
    operational,
  };
}
