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

// ── Statement-reference pattern ───────────────────────────────────
// A reference is a document / standard code followed by a statement /
// requirement code, e.g. "LP-22 PS01", "ITIM SR2", "ITAM SR1", "DCLH SR3.1",
// "TPSRA SR5a". The statement code may end in digits, a sub-ref (".1") and/or a
// letter suffix ("a"/"b") — so "SR5", "SR5a", "SR11" and "SR3.1" all match.
// Matching on this pattern (rather than splitting on "/" or reading
// parentheses) lets us pull refs out of free text — control titles or the
// long-text Control: Description field — while ignoring surrounding prose and
// incidental parentheses like "(incl. privileged access rights)".
const FT_REF_RE = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)?\s+[A-Z]{1,4}\d+(?:\.\d+)?[a-z]?\b/g;

// Extract refs from a control title. Descriptive titles with no reference
// codes (e.g. "ITGC Incident management - Control") yield none.
function extractStatementRefs(rawName) {
  if (!rawName) return [];
  return ftDedupeRefs((String(rawName).match(FT_REF_RE) || []).map(r => r.replace(/\s+/g, ' ').trim()));
}

// Extract refs from a free-text field (e.g. Control: Description). The
// Riskonnect control title is capped at 80 chars, too short for controls that
// reference many statements, so the overflow list lives here. Any shape works
// — parenthesised, a labelled list ("… statements: ITIM SR2 / LP-22 PS01 …"),
// commas, or one per line — because refs are found by pattern, not delimiter.
function extractStatementRefsFromText(text) {
  return extractStatementRefs(text);
}

// Merge ref lists, de-duplicating case-insensitively while preserving the
// first-seen original casing.
function ftDedupeRefs(...lists) {
  const seen = new Set();
  const out = [];
  lists.flat().forEach(ref => {
    const k = ftNorm(ref);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(ref);
  });
  return out;
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
  const polKeys = Object.keys(polByRef);

  return (riskRows || []).map(rr => {
    const matched = [];
    (rr.statementRefs || []).forEach(ref => {
      const key = ftNorm(ref);
      if (polByRef[key]) {
        matched.push(...polByRef[key]);
      } else {
        // Parent-ref match: sub-ref DCLH SR3.1 → parent policy statement DCLH SR3
        // Guard: next char must be '.' to avoid DCLH SR30 matching DCLH SR3
        polKeys.forEach(pk => {
          if (key.startsWith(pk) && key[pk.length] === '.') {
            matched.push(...polByRef[pk]);
          }
        });
      }
    });
    const seen = new Set();
    const uniqueMatched = matched.filter(pr => {
      const k = ftNorm(pr.statementRef);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    // Accountable owner is derived from the matched policy statement(s), not the
    // Riskonnect control owner — the policy OWNER is the team we hold accountable
    // for operationalising the control. controlOwner (who runs it) is kept as-is.
    // When a control matches several statements, the most common owner wins.
    const ownerCounts = {};
    uniqueMatched.forEach(pr => {
      const o = (pr.owner || '').trim();
      if (o) ownerCounts[o] = (ownerCounts[o] || 0) + 1;
    });
    let policyOwner = '', best = 0;
    Object.entries(ownerCounts).forEach(([o, n]) => { if (n > best) { best = n; policyOwner = o; } });
    return { ...rr, matchedPolicyRows: uniqueMatched, policyOwner };
  });
}

// ── Ownership of the unimplemented gap ────────────────────────────
// Of the controls not yet implemented, which accountable team (policy OWNER)
// owns them. Grouped by the raw owner string — no role→department mapping.
// Controls with no matched policy statement fall into "Unassigned".
function buildOwnerGapRollup(riskPolicyFacts) {
  const facts = (riskPolicyFacts || []).filter(f => !ftIsClosedControl(f));
  const totalControls = facts.length;
  const gap = facts.filter(f => !ftIsImplemented(f));
  const owners = {};
  facts.forEach(f => {
    const key = (f.policyOwner || '').trim() || 'Unassigned';
    const o = owners[key] || (owners[key] = { owner: key, ownedTotal: 0, ownedImpl: 0, gap: 0 });
    o.ownedTotal++;
    if (ftIsImplemented(f)) o.ownedImpl++; else o.gap++;
  });
  const byOwner = {};
  Object.values(owners).forEach(o => {
    byOwner[o.owner] = {
      ...o,
      shareOfGap: gap.length ? Math.round(100 * o.gap / gap.length) : 0,
      implRate:   o.ownedTotal ? Math.round(100 * o.ownedImpl / o.ownedTotal) : null,
    };
  });
  const rows = Object.values(byOwner)
    .filter(o => o.gap > 0)
    .sort((a, b) => b.gap - a.gap || a.owner.localeCompare(b.owner));
  return {
    totalControls,
    gapCount: gap.length,
    gapPct: totalControls ? Math.round(100 * gap.length / totalControls) : 0,
    rows,
    byOwner,
  };
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

// ── Per-risk profile (shared: governance card + Pre-DORA card) ────
// Aggregate active (non-closed) controls into one row per risk (capId|title),
// excluding closed risks. Residual = the risk's max residual; the three
// fractions count over the risk's active controls; confidence is a band of the
// tested %. docKeys records which (capability||document) each risk maps to.
function ftAggregateRisks(facts) {
  const map = {};
  (facts || []).forEach(f => {
    if (ftIsClosedControl(f) || ftRiskStatus(f) === 'closed') return;
    const t = ftNorm(f.riskTitle);
    if (!t) return;
    const key = f.capId + '|' + t;
    const r = map[key] || (map[key] = { title: f.riskTitle, owner: '', residual: 0, active: 0, implemented: 0, tested: 0, effective: 0, docKeys: new Set() });
    r.active++;
    if (ftIsImplemented(f)) r.implemented++;
    if (ftIsAssessed(f))    r.tested++;
    if (ftIsEffective(f))   r.effective++;
    if ((f.residualScore || 0) > r.residual) r.residual = f.residualScore || 0;
    if (!r.owner && (f.riskOwner || '').trim()) r.owner = f.riskOwner.trim();
    (f.matchedPolicyRows || []).forEach(mp => r.docKeys.add(mp.capId + '||' + ((mp.document || '').trim() || '(no document)')));
  });
  return map;
}

const FT_SEV_RANK  = { extreme: 5, significant: 4, na: 3, moderate: 2, low: 1, none: 0 };
const FT_CONF_RANK = { low: 0, med: 1, high: 2, na: 3 };

function ftFinalizeRisk(r) {
  const cfg = (CONFIG && CONFIG.riskManagement) || {};
  const severeAt = cfg.severeResidualThreshold != null ? cfg.severeResidualThreshold : 20;
  const b = r.residual > 0
    ? (r.residual >= 28 ? 'extreme' : r.residual >= severeAt ? 'significant' : r.residual >= 12 ? 'moderate' : 'low')
    : 'na';
  const testedPct = r.active > 0 ? Math.round(100 * r.tested / r.active) : 0;
  const conf = r.active === 0 ? 'na' : testedPct <= 33 ? 'low' : testedPct <= 66 ? 'med' : 'high';
  const gap = r.implemented === 0 || r.tested === 0 || r.effective === 0;
  const isAct = (b === 'extreme' || b === 'significant') && conf === 'low';
  const elevated = b === 'extreme' || b === 'significant' || b === 'na' || conf === 'low' || conf === 'med' || gap;
  return { title: r.title, owner: r.owner, residual: r.residual, active: r.active,
    implemented: r.implemented, tested: r.tested, effective: r.effective,
    band: b, testedPct, conf, gap, isAct, elevated, docKeys: r.docKeys };
}

function ftSortRisks(arr) {
  return arr.sort((a, b) =>
    (FT_SEV_RANK[b.band] - FT_SEV_RANK[a.band]) ||
    (b.residual - a.residual) ||
    (FT_CONF_RANK[a.conf] - FT_CONF_RANK[b.conf]) ||
    a.title.localeCompare(b.title));
}

// Finalized, worst-first per-risk profile from a set of facts.
function buildRiskProfile(facts) {
  return ftSortRisks(Object.values(ftAggregateRisks(facts)).map(ftFinalizeRisk));
}

// ── Governance rows — one per (capability × document), approved vs draft ──
// Derived from the policy upload's Document Status; replaces the old
// governance maturity slider.
function buildGovernanceRows(policyRows, facts) {
  const capName = id => (CONFIG.capabilities || []).find(c => c.id === id)?.name || id;
  const active = (facts || []).filter(f => !ftIsClosedControl(f));   // non-closed controls only

  // Statement refs that an active control touches — the "tracked as risks" rule.
  const refAny = new Set();
  active.forEach(f => (f.matchedPolicyRows || []).forEach(mp => {
    const k = ftNorm(mp.statementRef); if (k) refAny.add(k);
  }));

  // Per-risk profile (shared with the Pre-DORA card), bucketed by document.
  // A risk associates to a document when one of its active controls maps to a
  // statement in that document.
  const risksByDoc = {};
  buildRiskProfile(facts).forEach(fin => {
    fin.docKeys.forEach(dk => { (risksByDoc[dk] = risksByDoc[dk] || []).push(fin); });
  });

  // ── Document rows (approval status + statement counts) ──
  const map = {};
  (policyRows || []).forEach(pr => {
    const doc = (pr.document || '').trim() || '(no document)';
    const key = pr.capId + '||' + doc;
    if (!map[key]) map[key] = { key, capId: pr.capId, capName: capName(pr.capId), document: doc, type: pr.type || '', total: 0, approved: 0, draft: 0, riskTracked: 0 };
    const r = map[key];
    r.total++;
    if (ftNorm(pr.status).includes('approv')) r.approved++;
    else r.draft++;   // anything not explicitly approved counts as draft/not-approved
    if (refAny.has(ftNorm(pr.statementRef))) r.riskTracked++;
  });
  const rows = Object.values(map).map(r => ({
    ...r,
    status: r.approved === r.total ? 'approved' : r.approved === 0 ? 'draft' : 'partial',
    risks: risksByDoc[r.key] || [],   // already worst-first from buildRiskProfile
  }));
  rows.sort((a, b) => a.capName.localeCompare(b.capName) || a.document.localeCompare(b.document));
  return rows;
}

// ── Planning table — RTM → controls, flattened for export ─────────
// One row per (policy statement × control that maps to it), repeating the
// statement columns so it filters cleanly in Excel. Statements with no control
// still appear (one row, blank control) so gaps are visible. Closed controls
// are excluded; a control on several risks lists once per statement.
function buildPlanningRows(policyRows, facts) {
  const capName = id => (CONFIG.capabilities || []).find(c => c.id === id)?.name || id;
  const typeLabel = t => t === 'locPol' ? 'Local Policy' : t === 'grpStd' ? 'Group Standard' : 'Pre-DORA';
  const live = (facts || []).filter(f => !ftIsClosedControl(f) && (f.controlName || '').trim());

  // Statement-driven rows: one per (statement × control × risk).
  const byStmt = {};
  live.forEach(f => {
    const entry = {
      name: f.controlName.trim(),
      type: typeLabel(f.controlType),
      status: ftIsImplemented(f) ? 'Implemented' : 'Draft',
      risk: (f.riskTitle || '').trim(),
    };
    (f.matchedPolicyRows || []).forEach(mp => {
      const key = mp.capId + '||' + ftNorm(mp.statementRef);
      (byStmt[key] = byStmt[key] || []).push(entry);
    });
  });
  const rows = [];
  (policyRows || []).forEach(pr => {
    const key = pr.capId + '||' + ftNorm(pr.statementRef);
    const base = {
      capName: capName(pr.capId),
      document: (pr.document || '').trim() || '(no document)',
      ref: pr.statementRef || '',
      header: pr.statementHeader || '',
    };
    const seen = new Set();
    const ctrls = (byStmt[key] || []).filter(c => {
      const k = ftNorm(c.name) + '|' + ftNorm(c.risk);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    if (!ctrls.length) {
      rows.push({ ...base, risk: '', controlName: '', controlType: '', controlStatus: '' });
    } else {
      ctrls.forEach(c => rows.push({ ...base, risk: c.risk, controlName: c.name, controlType: c.type, controlStatus: c.status }));
    }
  });

  // Pre-DORA (operational) controls with no policy mapping — capability-level
  // rows (document / ref / header blank), one per (control × risk). The mapped
  // pre-DORA controls already appear under their statement above.
  const preSeen = new Set();
  live.filter(f => f.controlType === 'operational' && !(f.matchedPolicyRows || []).length).forEach(f => {
    const name = f.controlName.trim();
    const risk = (f.riskTitle || '').trim();
    const k = f.capId + '|' + ftNorm(name) + '|' + ftNorm(risk);
    if (preSeen.has(k)) return;
    preSeen.add(k);
    rows.push({
      capName: capName(f.capId), document: '', ref: '', header: '',
      risk, controlName: name, controlType: 'Pre-DORA',
      controlStatus: ftIsImplemented(f) ? 'Implemented' : 'Draft', preDora: true,
    });
  });

  rows.sort((a, b) =>
    a.capName.localeCompare(b.capName) ||
    ((a.document ? 0 : 1) - (b.document ? 0 : 1)) ||
    a.document.localeCompare(b.document) ||
    a.ref.localeCompare(b.ref) ||
    (a.controlName || '').localeCompare(b.controlName || '') ||
    (a.risk || '').localeCompare(b.risk || ''));
  return rows;
}

// ── Risk-treatment operationalisation funnel ──────────────────────
// One unit = one risk-treatment measure (a policy-upload row). Each is placed
// in exactly one state, so the states sum to the total:
//   built     — evidenced by a live NEW control (LocPol/GrpStd, implemented)
//   reused    — evidenced only by a mapped pre-DORA (operational) control
//   drafted   — has a control, but only draft (not yet live)
//   uncovered — no control cites it
// "built" wins when a measure is evidenced by both a new and a pre-DORA control.
// Story 2 (control axis): orphans = pre-DORA controls we run that map to no
// measure — reconciles with the "pre-DORA not linked" exec metric.
function buildRtmFunnel(policyRows, facts) {
  const polRows = policyRows || [];
  const live = (facts || []).filter(f => !ftIsClosedControl(f));

  const rtm = {};        // capId||statementRef → evidence flags
  const srcCount = {};   // document-type label → count of measures
  polRows.forEach(pr => {
    const key = pr.capId + '||' + ftNorm(pr.statementRef);
    if (key in rtm) return;
    rtm[key] = { built: false, reused: false, drafted: false };
    const label = isLocPolType(pr.type) ? 'Local Policy'
      : isGrpStdType(pr.type) ? 'Group Standards'
      : ((pr.type || '').trim() || 'Other');
    srcCount[label] = (srcCount[label] || 0) + 1;
  });

  live.forEach(f => {
    const impl = ftIsImplemented(f);
    const isDora = f.controlType === 'locPol' || f.controlType === 'grpStd';
    (f.matchedPolicyRows || []).forEach(mp => {
      const r = rtm[mp.capId + '||' + ftNorm(mp.statementRef)];
      if (!r) return;
      if (impl) { if (isDora) r.built = true; else r.reused = true; }
      else r.drafted = true;
    });
  });

  let built = 0, reused = 0, drafted = 0, uncovered = 0;
  Object.values(rtm).forEach(r => {
    if (r.built) built++;
    else if (r.reused) reused++;
    else if (r.drafted) drafted++;
    else uncovered++;
  });
  const total = built + reused + drafted + uncovered;

  const orphans = live.filter(f =>
    f.controlType === 'operational' && ftIsImplemented(f) && !(f.matchedPolicyRows || []).length).length;

  // Layer 4 — control axis: of the implemented controls we run, how many map to
  // a measure vs have no home (unmapped). Counted the same way as every other
  // control count in the app (one per fact row).
  const impl = live.filter(ftIsImplemented);
  const ctrlTotal = impl.length;
  const ctrlMapped = impl.filter(f => (f.matchedPolicyRows || []).length > 0).length;
  const ctrlUnmapped = ctrlTotal - ctrlMapped;

  const order = { 'Local Policy': 0, 'Group Standards': 1 };
  const sources = Object.entries(srcCount).map(([name, count]) => ({ name, count }))
    .sort((a, b) => ((order[a.name] ?? 9) - (order[b.name] ?? 9)) || a.name.localeCompare(b.name));

  const pct = n => total ? Math.round(100 * n / total) : 0;
  return {
    sources, total, built, reused, drafted, uncovered, orphans,
    evidenced: built + reused, inProcess: drafted + uncovered,
    haveControl: built + reused + drafted,
    evidencedPct: pct(built + reused), haveControlPct: pct(built + reused + drafted),
    ctrlTotal, ctrlMapped, ctrlUnmapped,
  };
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

// ── Status canonicalisation ───────────────────────────────────────
// Risk status — read the "Status*" column of the risk file. Display values:
//   Draft → Draft ; Open → Open ; Proposed Closed / Closed → Closed
function ftRiskStatus(f) {
  const s = ftNorm(typeof f === 'string' ? f : (f && f.riskStatus));
  if (s.includes('draft')) return 'draft';
  if (s.includes('close')) return 'closed';   // "closed" or "proposed closed"
  if (s.includes('open'))  return 'open';
  return s;
}
const FT_RISK_STATUS_LABEL = { draft: 'Draft', open: 'Open', closed: 'Closed' };
function ftRiskStatusLabel(f) { return FT_RISK_STATUS_LABEL[ftRiskStatus(f)] || ''; }

// Control status — read the SEPARATE "Control Status*" column (never risk
// status). Display values:
//   Open → Implemented ; closed / Inactive / Proposed Close → Closed ;
//   empty / "-" → Not implemented
function ftControlStatus(f) {
  const s = ftNorm(typeof f === 'string' ? f : (f && f.controlStatus));
  if (s === '' || s === '-')                    return 'not-implemented';
  if (s === 'open')                             return 'implemented';
  if (s.includes('close') || s.includes('inactive')) return 'closed';
  return 'not-implemented';
}
const FT_CTRL_STATUS_LABEL = { implemented: 'Implemented', closed: 'Closed', 'not-implemented': 'Not implemented' };
function ftControlStatusLabel(f) { return FT_CTRL_STATUS_LABEL[ftControlStatus(f)] || ''; }

// A closed control (Control Status* = closed / Inactive / Proposed Close) is
// excluded from every card and metric.
function ftIsClosedControl(f) { return ftControlStatus(f) === 'closed'; }

// ── Control assessment predicates ─────────────────────────────────
function ftIsImplemented(f) { return ftControlStatus(f) === 'implemented'; }
function ftIsAssessed(f)    { return !!(f.lastAssessDate && f.lastAssessDate.trim()); }
function ftIsOwned(f)       { return !!(f.controlOwner && f.controlOwner.trim()); }
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

// ── Build auto-computed KPI summary ──────────────────────────────
function buildKpiSummary(polRows, riskPolicyFacts) {
  const facts      = (riskPolicyFacts || []).filter(f => !ftIsClosedControl(f));
  polRows          = polRows || [];
  const locPolRows = polRows.filter(r => isLocPolType(r.type));
  const grpStdRows = polRows.filter(r => isGrpStdType(r.type));

  // Reference maps: which policy statement refs are picked up by a control row,
  // and which are picked up by an *implemented* control row.
  const refAny  = new Set();  // referenced by ≥1 control of any status
  const refImpl = new Set();  // referenced by ≥1 implemented control
  facts.forEach(f => {
    const impl = ftIsImplemented(f);
    (f.matchedPolicyRows || []).forEach(mp => {
      const k = ftNorm(mp.statementRef);
      if (!k) return;
      refAny.add(k);
      if (impl) refImpl.add(k);
    });
  });

  // Coverage — statements referenced by ≥1 control (any status)
  function coverage(rows) {
    if (!rows.length) return null;
    const covered = rows.filter(r => refAny.has(ftNorm(r.statementRef))).length;
    return { total: rows.length, covered };
  }
  // Operationalisation — statements with ≥1 implemented control
  function operationalisation(rows) {
    if (!rows.length) return null;
    const operationalised = rows.filter(r => refImpl.has(ftNorm(r.statementRef))).length;
    return { total: rows.length, operationalised, blindSpots: rows.length - operationalised };
  }

  const locPolCoverage = coverage(locPolRows);
  const grpStdCoverage = coverage(grpStdRows);
  const locPolOps      = operationalisation(locPolRows);
  const grpStdOps      = operationalisation(grpStdRows);

  // Localisation (ref-based) — a group-standard requirement is localised when a
  // local-policy control explicitly cites its ref (e.g. "LocPol … (LP-20 PS03 / ITAM SR3)").
  let grpStdLocal = null;
  if (grpStdRows.length) {
    const locPolCited = new Set();
    facts.filter(f => f.controlType === 'locPol').forEach(f => {
      (f.statementRefs || []).forEach(ref => locPolCited.add(ftNorm(ref)));
    });
    const localised = grpStdRows.filter(r => locPolCited.has(ftNorm(r.statementRef))).length;
    grpStdLocal = { total: grpStdRows.length, localised };
  }

  // Policy-type control rows (LocPol / GrpStd prefix)
  const polTypeFacts = facts.filter(f => f.controlType === 'locPol' || f.controlType === 'grpStd');

  // Traceability — orphan controls that cite a ref not present in the policy register
  let orphanResult = null;
  if (polTypeFacts.length) {
    const orphans = polTypeFacts.filter(f => !(f.matchedPolicyRows || []).length).length;
    orphanResult = { total: polTypeFacts.length, orphans };
  }

  // Effectiveness — of implemented policy controls, how many are rated effective
  let effResult = null;
  if (polTypeFacts.length) {
    const impl = polTypeFacts.filter(ftIsImplemented);
    effResult = { total: impl.length, effective: impl.filter(ftIsEffective).length };
  }

  // Full chain: Policy → Risk → Control → Assessment, per configured capability
  const caps = (CONFIG.capabilities || []);
  let chainResult = null;
  if (caps.length) {
    const details = caps.map(cap => {
      const hasPolicy     = polRows.some(r => r.capId === cap.id);
      const capFacts      = facts.filter(f => f.capId === cap.id);
      const hasRisk       = capFacts.some(f => (f.riskTitle || '').trim());
      const hasControl    = capFacts.length > 0;
      const hasAssessment = capFacts.some(ftIsAssessed);
      const complete      = hasPolicy && hasRisk && hasControl && hasAssessment;
      return { capId: cap.id, capName: cap.name, hasPolicy, hasRisk, hasControl, hasAssessment, complete };
    });
    chainResult = { total: caps.length, complete: details.filter(d => d.complete).length, details };
  }

  return {
    // Policy Operationalisation
    locPolCoverage,
    grpStdCoverage,
    locPolOperationalisation:   locPolOps,
    grpStdOperationalisation:   grpStdOps,
    orphanControls:             orphanResult,
    policyControlEffectiveness: effResult,
    // Cross Team Cooperation
    grpStdLocalisation: grpStdLocal,
    chainCompleteness:  chainResult,
  };
}

// ── Operationalisation Coverage — per-capability funnel bars + confidence ──
//
// Five independent coverage ratios per capability (risks are deduplicated by
// title; controls are the individual fact rows). The confidence chip judges
// how well the risk-assessment *claim* is backed by control *evidence*.
//
// rowBy: 'capability' (default) | 'control' (one row per control/statement name)
//        | 'risk' (one row per risk title) | 'document' (one row per policy /
//        standard). For 'document', pass policyRows so EVERY registered policy /
//        standard of the theme's type is listed — untouched ones appear as empty
//        rows, surfacing coverage gaps.
function buildOperationalisationCoverage(riskPolicyFacts, theme, rowBy, policyRows) {
  const liveFacts = (riskPolicyFacts || []).filter(f => !ftIsClosedControl(f));
  let facts = liveFacts;
  if (theme) facts = facts.filter(f => f.controlType === theme);
  const cfg   = (CONFIG && CONFIG.opCoverage) || {};
  const floor = cfg.ownershipFloorPct != null ? cfg.ownershipFloorPct : 20;
  const lowCut = cfg.confidenceLowPct  != null ? cfg.confidenceLowPct  : 40;
  const okCut  = cfg.confidenceOkPct   != null ? cfg.confidenceOkPct   : 75;

  const isClosed = f => {
    const s = ftNorm(f.riskStatus);
    return s.includes('closed') || s.includes('proposed close');
  };
  const isOpen  = f => ftNorm(f.riskStatus).includes('open');
  const isDraft = f => ftNorm(f.riskStatus).includes('draft');
  const pct = (n, d) => d > 0 ? Math.round((n / d) * 100) : 0;

  // One row's metrics from a display name + its set of control facts.
  function makeRow(name, groupFacts) {
    const riskMap = {};
    groupFacts.forEach(f => {
      const title = ftNorm(f.riskTitle);
      if (!title || isClosed(f)) return;
      if (!riskMap[title]) riskMap[title] = { open: false, draft: false, assessed: false };
      const r = riskMap[title];
      if (isOpen(f))  r.open  = true;
      if (isDraft(f)) r.draft = true;
      if (f.residualScore != null && f.residualScore > 0) r.assessed = true;
    });
    const risks      = Object.values(riskMap);
    const totalRisks = risks.length;
    const openRisks  = risks.filter(r => r.open).length;
    const draftRisks = risks.filter(r => r.draft && !r.open).length;
    const assessedRk = risks.filter(r => r.assessed).length;

    const totalCtrls = groupFacts.length;
    const ownedCtrls = groupFacts.filter(ftIsOwned).length;
    const implCtrls  = groupFacts.filter(ftIsImplemented).length;
    const assdCtrls  = groupFacts.filter(ftIsAssessed).length;

    const assessedPct = pct(assessedRk, totalRisks);
    const ctrlAssdPct = pct(assdCtrls, totalCtrls);
    const ownedPct    = pct(ownedCtrls, totalCtrls);

    let index = null, chip;
    if (assessedRk === 0) {
      chip = 'none';
    } else {
      index = Math.min(100, Math.round((ctrlAssdPct / assessedPct) * 100));
      if (ownedPct < floor)     chip = 'low';
      else if (index < lowCut)  chip = 'low';
      else if (index < okCut)   chip = 'building';
      else                      chip = 'ok';
    }
    return {
      capName: name,
      approved:    { n: openRisks,  d: openRisks + draftRisks },
      assessed:    { n: assessedRk, d: totalRisks },
      owned:       { n: ownedCtrls, d: totalCtrls },
      implemented: { n: implCtrls,  d: totalCtrls },
      ctrlAssessed:{ n: assdCtrls,  d: totalCtrls },
      index, chip,
    };
  }

  let rows;
  if (rowBy === 'control' || rowBy === 'risk' || rowBy === 'document') {
    const keyOf =
      rowBy === 'control' ? f => (f.controlName || '').trim() || '(unnamed control)' :
      rowBy === 'risk'    ? f => (f.riskTitle   || '').trim() || '(no risk)' :
      /* document */        f => ((f.matchedPolicyRows && f.matchedPolicyRows[0] && f.matchedPolicyRows[0].document) || '').trim() || '(unmapped)';
    const groups = {};
    // Seed every registered policy / standard of this theme's type, so untouched
    // documents still list as (empty) rows rather than silently dropping out.
    if (rowBy === 'document') {
      const typeCheck = theme === 'locPol' ? isLocPolType : theme === 'grpStd' ? isGrpStdType : null;
      if (typeCheck) (policyRows || []).forEach(pr => {
        if (typeCheck(pr.type)) {
          const doc = (pr.document || '').trim();
          if (doc) groups[doc] = groups[doc] || [];
        }
      });
    }
    facts.forEach(f => { const k = keyOf(f); (groups[k] = groups[k] || []).push(f); });
    // Cross-theme index: which control types touch each risk, across ALL themes.
    // A risk mitigated by more than one control type legitimately appears in
    // more than one themed card (e.g. a GrpStd risk that retains a pre-DORA
    // control). alsoIn names the other theme(s) so the overlap reads as
    // intentional — each card still shows only its own theme's controls.
    const riskTypeIndex = {};
    if (theme) liveFacts.forEach(f => {
      const t = ftNorm(f.riskTitle);
      if (!t) return;
      (riskTypeIndex[t] = riskTypeIndex[t] || new Set()).add(f.controlType);
    });
    rows = Object.entries(groups).map(([name, gf]) => {
      const row = makeRow(name, gf);
      if (theme) {
        const otherThemes = t => Array.from(riskTypeIndex[t] || []).filter(ct => ct !== theme);
        if (rowBy === 'risk') {
          // Risk-grained row: the row itself is the risk, so tag it directly.
          row.alsoIn = otherThemes(ftNorm(name));
        } else {
          // Document-/control-grained row: list each distinct risk under it,
          // each carrying its own cross-theme tag so "also in" points at the
          // specific risk (a document may hold 4 risks, only 2 shared).
          const seen = new Set();
          row.risks = [];
          gf.forEach(f => {
            const norm = ftNorm(f.riskTitle);
            if (!norm || seen.has(norm)) return;
            seen.add(norm);
            row.risks.push({ title: (f.riskTitle || '').trim(), alsoIn: otherThemes(norm) });
          });
        }
      }
      return row;
    });
    // Order: touched rows (some risk/control data) first, untouched documents
    // next, and the "(unmapped)" catch-all always last.
    const rank = r => r.capName === '(unmapped)' ? 2
      : (r.assessed.d === 0 && r.owned.d === 0 ? 1 : 0);
    rows.sort((a, b) => rank(a) - rank(b));
  } else {
    rows = (CONFIG.capabilities || []).map(cap => {
      const cf = facts.filter(f => f.capId === cap.id);
      return cf.length ? makeRow(cap.name, cf) : null;
    }).filter(Boolean);
  }

  const rollup = { none: 0, low: 0, building: 0, ok: 0 };
  rows.forEach(r => { rollup[r.chip] = (rollup[r.chip] || 0) + 1; });

  return { rows, rollup };
}

// ── Merged operationalisation-detail rows (one flat table for the exec) ──
//
// One row per (theme × capability × risk × document): the three themed
// coverage tables collapsed into a single dataset. Control counts are scoped
// to the row's theme+document, residual/status are risk-level. Registered
// local-policy / group-standard documents with no controls yet are added as
// "not started" rows so the coverage gap stays visible. Default order groups
// by capability (touched risks first, not-started last); the exec re-sorts
// Capability / Theme / Document / Risk on screen.
// ── DORA transition — old (pre-DORA) vs new (DORA) ────────────────
// DORA = controls with a locPol/grpStd prefix (same rule as the theme cards);
// pre-DORA = operational. Control gauge = share of *implemented* controls that
// are DORA. Risk gauge = share of *open* risks that have >=1 DORA control.
// A prevFacts argument yields the previous quarter's percentages for the
// adoption delta.
function buildDoraTransition(facts, prevFacts) {
  const isDora = f => f.controlType === 'locPol' || f.controlType === 'grpStd';
  const calc = fx => {
    const live = (fx || []).filter(f => !ftIsClosedControl(f));
    const impl = live.filter(ftIsImplemented);
    const ctrlDora = impl.filter(isDora).length;
    const ctrlPre  = impl.length - ctrlDora;
    const ctrlPct  = impl.length ? Math.round(100 * ctrlDora / impl.length) : null;

    const byRisk = {};
    live.forEach(f => {
      const key = ftNorm(f.riskTitle);
      if (!key) return;
      const r = byRisk[key] || (byRisk[key] = { open: false, dora: false });
      if (ftRiskStatus(f) === 'open') r.open = true;
      if (isDora(f)) r.dora = true;
    });
    const openRisks = Object.values(byRisk).filter(r => r.open);
    const riskDora = openRisks.filter(r => r.dora).length;
    const riskPre  = openRisks.length - riskDora;
    const riskPct  = openRisks.length ? Math.round(100 * riskDora / openRisks.length) : null;

    return { ctrlDora, ctrlPre, ctrlPct, riskDora, riskPre, riskPct };
  };
  const cur  = calc(facts);
  const prev = prevFacts ? calc(prevFacts) : null;
  return { ...cur, prev: prev ? { ctrlPct: prev.ctrlPct, riskPct: prev.riskPct } : null };
}

function buildMergedRiskRows(riskPolicyFacts, policyRows) {
  const allFacts = riskPolicyFacts || [];
  const cfg    = (CONFIG && CONFIG.opCoverage) || {};
  const floor  = cfg.ownershipFloorPct != null ? cfg.ownershipFloorPct : 20;
  const lowCut = cfg.confidenceLowPct  != null ? cfg.confidenceLowPct  : 40;
  const okCut  = cfg.confidenceOkPct   != null ? cfg.confidenceOkPct   : 75;
  const severeAt = ((CONFIG && CONFIG.riskManagement) || {}).severeResidualThreshold;
  const sev = severeAt != null ? severeAt : 20;

  const THEME_NAMES = { locPol: 'Local Policy', grpStd: 'Group Standard', operational: 'Pre-DORA' };
  const capName = id => (CONFIG.capabilities.find(c => c.id === id)?.name) || id;
  const ownerOf = facts => {
    const c = {};
    facts.forEach(f => { const o = (f.policyOwner || '').trim(); if (o) c[o] = (c[o] || 0) + 1; });
    let best = '', n = 0;
    Object.entries(c).forEach(([k, v]) => { if (v > n) { n = v; best = k; } });
    return best;
  };
  const isClosed = f => { const s = ftNorm(f.riskStatus); return s.includes('closed') || s.includes('proposed close'); };
  const isOpen  = f => ftNorm(f.riskStatus).includes('open');
  const isDraft = f => ftNorm(f.riskStatus).includes('draft');
  const pct = (n, d) => d > 0 ? Math.round(n / d * 100) : 0;
  const band = r => r >= 28 ? 'extreme' : r >= sev ? 'significant' : r >= 12 ? 'moderate' : r >= 4 ? 'low' : 'none';

  // Group facts by theme × capability × risk × document.
  const groups = {};
  allFacts.forEach(f => {
    const norm = ftNorm(f.riskTitle);
    if (!norm || isClosed(f) || ftIsClosedControl(f)) return;
    const theme = f.controlType;
    const doc = theme === 'operational' ? '' :
      (((f.matchedPolicyRows && f.matchedPolicyRows[0] && f.matchedPolicyRows[0].document) || '').trim() || '(unmapped)');
    const key = theme + '|' + f.capId + '|' + norm + '|' + doc;
    (groups[key] = groups[key] || { theme, capId: f.capId, riskTitle: f.riskTitle, doc, facts: [] }).facts.push(f);
  });

  const rows = Object.values(groups).map(g => {
    const total = g.facts.length;
    const owned = g.facts.filter(ftIsOwned).length;
    const impl  = g.facts.filter(ftIsImplemented).length;
    const assd  = g.facts.filter(ftIsAssessed).length;
    const res   = g.facts.reduce((m, f) => Math.max(m, f.residualScore || 0), 0);
    const assessed = res > 0;
    const open  = g.facts.some(isOpen);
    const draft = g.facts.some(isDraft) && !open;
    return {
      capId: g.capId, capName: capName(g.capId),
      themeKey: g.theme, themeName: THEME_NAMES[g.theme] || g.theme,
      document: g.theme === 'operational' ? '' : g.doc,
      riskTitle: g.riskTitle,
      owner: ownerOf(g.facts),
      residual: res, residualBand: assessed ? band(res) : null,
      assessed, open, draft,
      owned: { n: owned, d: total }, implemented: { n: impl, d: total }, ctrlAssessed: { n: assd, d: total },
      notStarted: false,
    };
  });

  // "Not started" — registered local-policy / group-standard documents with
  // no controls mapped to them yet, per (capability, document).
  const themeOfType = pr => isLocPolType(pr.type) ? 'locPol' : isGrpStdType(pr.type) ? 'grpStd' : null;
  const touched = new Set(rows.map(r => r.themeKey + '|' + r.capId + '|' + r.document));
  const seenNS  = new Set();
  (policyRows || []).forEach(pr => {
    const theme = themeOfType(pr);
    if (!theme) return;
    const doc = (pr.document || '').trim();
    if (!doc) return;
    const key = theme + '|' + pr.capId + '|' + doc;
    if (touched.has(key) || seenNS.has(key)) return;
    seenNS.add(key);
    rows.push({
      capId: pr.capId, capName: capName(pr.capId),
      themeKey: theme, themeName: THEME_NAMES[theme],
      document: doc, riskTitle: '', owner: (pr.owner || '').trim(),
      residual: 0, residualBand: null, assessed: false, open: false, draft: false,
      owned: { n: 0, d: 0 }, implemented: { n: 0, d: 0 }, ctrlAssessed: { n: 0, d: 0 },
      notStarted: true,
    });
  });

  // Default order: by capability, touched first, then theme order, then risk.
  const themeOrder = { locPol: 0, grpStd: 1, operational: 2 };
  rows.sort((a, b) =>
    a.capName.localeCompare(b.capName) ||
    (a.notStarted ? 1 : 0) - (b.notStarted ? 1 : 0) ||
    (themeOrder[a.themeKey] - themeOrder[b.themeKey]) ||
    a.riskTitle.localeCompare(b.riskTitle)
  );
  return rows;
}

// ── Risk Portfolio summary — register, exposure & control assurance ──
//
// Portfolio-level roll-up of the RCSA: risk counts by status, assessment
// completion, residual-severity distribution, inherent→residual reduction,
// control-assessment coverage on assessed risks, and under-assured risks
// (assessed ratings not backed by enough control evidence).
//
// `theme`, when given, scopes the whole summary to one control type
// ('locPol' | 'grpStd' | 'operational'): risks are those touched by a control
// of that type, and control metrics count only that type's controls.
// Theme scoping for the IT Risk & Control Framework cards. Local-policy and
// group-standard cards scope by what a control EVIDENCES (its matched policy
// statements), so a pre-DORA control mapped to a group standard counts toward
// the group-standard card — consistent with the operationalisation funnel. A
// control mapped to more than one type appears in each. Pre-DORA scopes by
// control type (operational).
function ftThemeMatch(f, theme) {
  if (!theme) return true;
  if (theme === 'operational') return f.controlType === 'operational';
  const check = theme === 'locPol' ? isLocPolType : theme === 'grpStd' ? isGrpStdType : null;
  if (!check) return f.controlType === theme;
  return (f.matchedPolicyRows || []).some(mp => check(mp.type));
}

// IT Risk & Control Framework card (per policy type): the scoped risk profile
// plus a measure-axis rollup. For local-policy / group-standard, "operationalised"
// = RTMs of that type evidenced by a live (implemented, non-closed) control —
// matching the funnel. Pre-DORA has no measure axis, so it rolls up by risk count.
function buildFrameworkCard(policyRows, facts, themeKey) {
  const risks = buildRiskProfile((facts || []).filter(f => ftThemeMatch(f, themeKey)));
  const severe = risks.filter(r => r.band === 'extreme' || r.band === 'significant').length;
  const notAssessed = risks.filter(r => r.band === 'na').length;
  const weakestConf = risks.some(r => r.conf === 'low') ? 'Low'
    : risks.some(r => r.conf === 'med') ? 'Medium'
    : risks.some(r => r.conf === 'high') ? 'High' : null;

  let measTotal = null, measOped = null;
  if (themeKey === 'locPol' || themeKey === 'grpStd') {
    const check = themeKey === 'locPol' ? isLocPolType : isGrpStdType;
    const typeRtms = new Set();
    (policyRows || []).forEach(pr => { if (check(pr.type)) typeRtms.add(pr.capId + '||' + ftNorm(pr.statementRef)); });
    measTotal = typeRtms.size;
    const oped = new Set();
    (facts || []).forEach(f => {
      if (ftIsClosedControl(f) || !ftIsImplemented(f)) return;
      (f.matchedPolicyRows || []).forEach(mp => {
        const k = mp.capId + '||' + ftNorm(mp.statementRef);
        if (typeRtms.has(k)) oped.add(k);
      });
    });
    measOped = oped.size;
  }
  return { risks, severe, notAssessed, weakestConf, measTotal, measOped };
}

function buildRiskPortfolioSummary(riskPolicyFacts, theme) {
  let facts = riskPolicyFacts || [];
  if (theme) facts = facts.filter(f => ftThemeMatch(f, theme));
  const cfg      = (CONFIG && CONFIG.riskManagement) || {};
  const severeAt = cfg.severeResidualThreshold      != null ? cfg.severeResidualThreshold      : 20;
  const underAt  = cfg.underAssuredCoveragePct      != null ? cfg.underAssuredCoveragePct      : 50;
  const weakAt   = cfg.weakMitigationMaxReductionPct != null ? cfg.weakMitigationMaxReductionPct : 25;

  const isClosed = s => { s = ftNorm(s); return s.includes('closed') || s.includes('proposed close'); };

  // One entry per unique risk (capId + title); scores repeat across control rows.
  const map = {};
  facts.forEach(f => {
    const t = ftNorm(f.riskTitle);
    if (!t) return;
    const key = f.capId + '|' + t;
    if (!map[key]) map[key] = { capId: f.capId, title: f.riskTitle, status: ftNorm(f.riskStatus), inh: 0, res: 0, ctrls: 0, ctrlAssd: 0, impl: 0, eff: 0 };
    const r = map[key];
    r.status = ftNorm(f.riskStatus);
    if ((f.inherentScore || 0) > r.inh) r.inh = f.inherentScore || 0;
    if ((f.residualScore || 0) > r.res) r.res = f.residualScore || 0;
    // Closed controls are ignored in every control tally.
    if (ftIsClosedControl(f)) return;
    r.ctrls++;
    if (ftIsAssessed(f))   r.ctrlAssd++;
    if (ftIsImplemented(f)) r.impl++;
    if (ftIsEffective(f))   r.eff++;
  });
  const risks = Object.values(map);
  if (!risks.length) return null;

  const closed   = risks.filter(r => isClosed(r.status)).length;
  const open     = risks.filter(r => r.status.includes('open')).length;
  const draft    = risks.filter(r => r.status.includes('draft')).length;
  const active   = risks.filter(r => !isClosed(r.status));
  const assessed = active.filter(r => r.res > 0);

  const band = res => res >= 28 ? 'extreme' : res >= severeAt ? 'significant' : res >= 12 ? 'moderate' : res >= 4 ? 'low' : 'none';
  const severity = { extreme: 0, significant: 0, moderate: 0, low: 0 };
  assessed.forEach(r => { const b = band(r.res); if (severity[b] != null) severity[b]++; });
  const severe = severity.extreme + severity.significant;

  const avg = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
  const avgInh = avg(assessed.map(r => r.inh));
  const avgRes = avg(assessed.map(r => r.res));
  const reductionPct = avgInh > 0 ? Math.round(100 * (avgInh - avgRes) / avgInh) : null;

  const totCtrls    = assessed.reduce((s, r) => s + r.ctrls, 0);
  const totCtrlAssd = assessed.reduce((s, r) => s + r.ctrlAssd, 0);
  const ctrlCoveragePct = totCtrls > 0 ? Math.round(100 * totCtrlAssd / totCtrls) : null;

  // Assurance ranking: per assessed risk, how much of its control base is assessed.
  const assuranceRanking = assessed
    .map(r => {
      const coveragePct = r.ctrls > 0 ? Math.round(100 * r.ctrlAssd / r.ctrls) : 0;
      return { title: r.title, capId: r.capId, controls: r.ctrls, ctrlAssessed: r.ctrlAssd, coveragePct, underAssured: coveragePct < underAt };
    })
    .sort((a, b) => a.coveragePct - b.coveragePct);
  const underAssured = assuranceRanking.filter(r => r.underAssured).map(r => r.title);

  // Per-risk mitigation ranking (assessed risks), worst reduction first.
  const ranking = assessed
    .filter(r => r.inh > 0)
    .map(r => ({
      title: r.title, capId: r.capId,
      inherent: r.inh, residual: r.res,
      reductionPct: Math.round(100 * (r.inh - r.res) / r.inh),
      controls: r.ctrls, implemented: r.impl, effective: r.eff,
    }))
    .sort((a, b) => a.reductionPct - b.reductionPct);

  // Weak mitigation: controls exist (>=1 implemented) but risk barely dropped.
  const weakMitigation = ranking.filter(r => r.implemented >= 1 && r.reductionPct < weakAt);

  // Control counts exclude closed controls (Control Status* = closed / Inactive /
  // Proposed Close), matching the Own & Implement card, the Operationalisation
  // Detail table and the DORA gauges — so every card's control totals reconcile.
  const ctrlFacts       = facts.filter(f => !ftIsClosedControl(f));
  const ctrlImplemented = ctrlFacts.filter(ftIsImplemented).length;
  const ctrlOwned       = ctrlFacts.filter(ftIsOwned).length;
  const ctrlTested      = ctrlFacts.filter(ftIsAssessed).length;
  const ctrlEffective   = ctrlFacts.filter(ftIsEffective).length;
  const ctrlCount       = ctrlFacts.length;
  const p100 = n => ctrlCount > 0 ? Math.round(100 * n / ctrlCount) : 0;
  const implementedPct  = p100(ctrlImplemented);

  return {
    total: risks.length, open, draft, closed,
    active: active.length,
    assessed: assessed.length,
    assessedPct: active.length ? Math.round(100 * assessed.length / active.length) : 0,
    severity, severe, severeThreshold: severeAt,
    avgInherent: Math.round(avgInh * 10) / 10,
    avgResidual: Math.round(avgRes * 10) / 10,
    reductionPct,
    ctrlCoveragePct, ctrlAssessed: totCtrlAssd, ctrlTotal: totCtrls,
    ctrlImplemented, ctrlCount, implementedPct,
    ctrlOwned, ctrlOwnedPct: p100(ctrlOwned),
    ctrlTested, ctrlTestedPct: p100(ctrlTested),
    ctrlEffective, ctrlEffectivePct: p100(ctrlEffective),
    underAssured, underAssuredCount: underAssured.length, underAssuredFloor: underAt, assuranceRanking,
    ranking, weakMitigation, weakMitigationCount: weakMitigation.length, weakThreshold: weakAt,
  };
}

// ── Build stored fact summary (4 rolled-up tables) ────────────────
//
// Called after every import. Stores a snapshot on assessment.factSummary
// so quarter-over-quarter trend arrows can be computed.
//
function buildFactSummary(riskPolicyFacts, policyRows) {
  const facts   = (riskPolicyFacts || []).filter(f => !ftIsClosedControl(f));
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
  // Policy-document-driven: every capId × document from the policy CSV
  // appears as a row even when no risk data exists yet. Risk/control
  // data from the fact rows fills in where available.
  function buildControlTable(policyType) {
    const typeCheck = policyType === 'locPol' ? isLocPolType : isGrpStdType;

    const map = {};
    function getOrCreate(capId, doc) {
      const key = capId + '||' + doc;
      if (!map[key]) map[key] = {
        capId, capName: capName(capId), document: doc,
        risks: 0, open: 0, draft: 0,
        inherentScore: null, residualScore: null,
        controls: 0, implemented: 0, assessed: 0,
        effective: 0, partly: 0, notAssessed: 0,
        _seen: new Set(),
      };
      return map[key];
    }

    // Baseline: initialise one row per capId × document from the policy CSV
    // so every document appears even when no risk data has been imported yet.
    polRows.filter(pr => typeCheck(pr.type)).forEach(pr => {
      getOrCreate(pr.capId, (pr.document || '').trim() || '(no document)');
    });

    // Fill in: aggregate risk/control data from matching fact rows.
    facts.forEach(f => {
      const byPrefix      = f.controlType === policyType;
      const matchedOfType = (f.matchedPolicyRows || []).filter(p => typeCheck(p.type));
      const byPolicyMatch = matchedOfType.length > 0;
      if (!byPrefix && !byPolicyMatch) return;

      // Prefer matched policy rows of this type for document bucketing
      const docSource = byPolicyMatch ? matchedOfType : (f.matchedPolicyRows || []);
      const docs = docSource
        .map(p => (p.document || '').trim() || '(no document)')
        .filter((d, i, arr) => arr.indexOf(d) === i);

      const buckets = docs.length > 0 ? docs : (hasPolicyData ? ['(unlinked)'] : []);

      buckets.forEach(doc => {
        const row = getOrCreate(f.capId, doc);
        row.controls++;
        const rk = ftNorm(f.riskTitle) || ('__ctrl_' + row.controls);
        if (f.riskTitle && !row._seen.has(rk)) {
          row._seen.add(rk);
          row.risks++;
          if (ftNorm(f.riskStatus).includes('open'))  row.open++;
          if (ftNorm(f.riskStatus).includes('draft')) row.draft++;
          if (f.inherentScore != null && (row.inherentScore === null || f.inherentScore > row.inherentScore))
            row.inherentScore = f.inherentScore;
          if (f.residualScore != null && (row.residualScore === null || f.residualScore > row.residualScore))
            row.residualScore = f.residualScore;
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

  // ── Table 4: Operational — one row per capId × riskTitle ─────────────
  const opMap = {};
  facts.filter(f => f.controlType === 'operational').forEach(f => {
    const rk  = ftNorm(f.riskTitle) || '';
    const key = f.capId + '||' + rk;
    if (!opMap[key]) opMap[key] = {
      capId: f.capId, capName: capName(f.capId),
      riskTitle:     f.riskTitle || '(unknown)',
      open: 0, draft: 0,
      inherentScore: null, residualScore: null,
      controls: 0, implemented: 0, assessed: 0,
      effective: 0, partly: 0, notAssessed: 0,
      _riskCounted: false,
    };
    const o = opMap[key];
    o.controls++;
    if (!o._riskCounted) {
      o._riskCounted = true;
      if (ftNorm(f.riskStatus).includes('open'))  o.open  = 1;
      if (ftNorm(f.riskStatus).includes('draft')) o.draft = 1;
    }
    if (o.inherentScore === null && f.inherentScore != null) o.inherentScore = f.inherentScore;
    if (o.residualScore === null && f.residualScore != null) o.residualScore = f.residualScore;
    if (ftIsImplemented(f))  o.implemented++;
    if (ftIsAssessed(f))     o.assessed++;
    if (ftIsEffective(f))    o.effective++;
    else if (ftIsPartly(f))  o.partly++;
    else                     o.notAssessed++;
  });
  const operational = Object.values(opMap).map(r => { delete r._riskCounted; return r; });

  return {
    policyObjectives,
    locPolControls: buildControlTable('locPol'),
    grpStdControls: buildControlTable('grpStd'),
    operational,
    kpiSummary: buildKpiSummary(polRows, facts),
  };
}
