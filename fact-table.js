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

// ── RTM ownership rollup (exec report) ────────────────────────────
// Groups by the RTM owner defined in the POLICY upload. For each owning team:
//   • RTMs owned      — distinct policy statements they own
//   • Controls linked — controls that operationalise those RTMs
//   • Implemented     — of those, how many are implemented
//   • Assessed        — of those, how many have been assessed
// A control that backs RTMs owned by several teams counts under EACH of those
// owners (option a), so per-owner figures sum to MORE than the de-duplicated
// grand total — the totals row counts each control once. Owners with RTMs but
// no controls yet still appear (operationalisation not started).
function buildRtmOwnerRows(policyRows, facts) {
  const OWNER = o => (o || '').trim() || 'Unassigned';
  const live  = (facts || []).filter(f => !ftIsClosedControl(f) && (f.controlName || '').trim());
  const map = {};
  const bucket = o => map[o] || (map[o] = { owner: o, rtmKeys: new Set(), ctrl: new Set(), impl: new Set(), assessed: new Set() });

  // RTMs owned — one per distinct policy statement.
  const allRtm = new Set();
  (policyRows || []).forEach(pr => {
    const key = pr.capId + '||' + ftNorm(pr.statementRef);
    allRtm.add(key);
    bucket(OWNER(pr.owner)).rtmKeys.add(key);
  });

  // Controls linked — attribute each control to every owner whose RTM it backs.
  const allCtrl = new Set(), allImpl = new Set(), allAssessed = new Set();
  live.forEach((f, i) => {
    const owners = new Set((f.matchedPolicyRows || []).map(mp => OWNER(mp.owner)));
    if (!owners.size) return;                        // not linked to any RTM
    const id   = ftNorm(f.controlName) + '#' + i;    // each fact is one control
    const impl = ftIsImplemented(f), asd = ftIsAssessed(f);
    owners.forEach(o => {
      const b = bucket(o);
      b.ctrl.add(id);
      if (impl) b.impl.add(id);
      if (asd)  b.assessed.add(id);
    });
    allCtrl.add(id); if (impl) allImpl.add(id); if (asd) allAssessed.add(id);
  });

  const rows = Object.values(map)
    .map(b => ({ owner: b.owner, rtms: b.rtmKeys.size, controls: b.ctrl.size, implemented: b.impl.size, assessed: b.assessed.size }))
    .filter(r => r.rtms > 0 || r.controls > 0);

  return {
    rows,
    totals: { rtms: allRtm.size, controls: allCtrl.size, implemented: allImpl.size, assessed: allAssessed.size },
  };
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
    const r = map[key] || (map[key] = { title: f.riskTitle, capId: f.capId, owner: '', residual: 0, active: 0, implemented: 0, tested: 0, effective: 0, srcLoc: 0, srcGrp: 0, srcPre: 0, docKeys: new Set() });
    r.active++;
    if (f.controlType === 'locPol') r.srcLoc++;
    else if (f.controlType === 'grpStd') r.srcGrp++;
    else if (f.controlType === 'operational') r.srcPre++;
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
  return { title: r.title, capId: r.capId, owner: r.owner, residual: r.residual, active: r.active,
    implemented: r.implemented, tested: r.tested, effective: r.effective,
    srcLoc: r.srcLoc, srcGrp: r.srcGrp, srcPre: r.srcPre,
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
// Normalise the RTM "Exception" column (Lens A) to a canonical code.
// Values in the policy upload (from the exception form):
//   E  = Exemption        — objective applies but we cannot implement it (technical)
//   WT = Waiver Temporary — objective applies but we need time / a new tool
//   WP = Waiver Permanent — objective applies but we will not build it (regulatory)
//   ''  (blank)           = no exception → we do it.
// Matching is lenient (accepts the code or the full wording).
function ftException(v) {
  const s = ftNorm(v);
  if (!s) return '';
  if (s === 'e'  || s.includes('exempt')) return 'E';
  if (s === 'wt' || (s.includes('waiver') && s.includes('temp')) || s.includes('temporary')) return 'WT';
  if (s === 'wp' || (s.includes('waiver') && s.includes('perm')) || s.includes('permanent')) return 'WP';
  return '';
}

// Full statement disposition (the Exception column is now a disposition field).
// Values in the policy upload:
//   IMPLEMENTED       → 'IMP'     — control in place & running (self-declared)
//   PART-Implemented  → 'PART'    — half implemented
//   UNKNOWN / blank   → 'UNKNOWN' — not known (a blank is NEVER treated as implemented)
//   E / WT / WP                  — the exemption / temporary / permanent waivers
// Order matters: test "part" before "implement" so PART-Implemented ≠ IMPLEMENTED.
function ftDisposition(v) {
  const s = ftNorm(v);
  if (!s) return 'UNKNOWN';
  if (s.includes('part')) return 'PART';
  if (s.includes('implement')) return 'IMP';
  if (s === 'e'  || s.includes('exempt')) return 'E';
  if (s === 'wt' || (s.includes('waiver') && s.includes('temp')) || s.includes('temporary')) return 'WT';
  if (s === 'wp' || (s.includes('waiver') && s.includes('perm')) || s.includes('permanent')) return 'WP';
  return 'UNKNOWN';
}

function buildGovernanceRows(policyRows, facts) {
  const capName = id => (CONFIG.capabilities || []).find(c => c.id === id)?.name || id;
  const active = (facts || []).filter(f => !ftIsClosedControl(f));   // non-closed controls only
  const cls = buildRtmClass(policyRows, facts);   // per-RTM control coverage (for "invisible work")

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
    if (!map[key]) map[key] = { key, capId: pr.capId, capName: capName(pr.capId), document: doc, type: pr.type || '', total: 0, approved: 0, draft: 0, riskTracked: 0, imp: 0, part: 0, unknown: 0, excE: 0, excWT: 0, excWP: 0, invisible: 0 };
    const r = map[key];
    r.total++;
    if (ftNorm(pr.status).includes('approv')) r.approved++;
    else r.draft++;   // anything not explicitly approved counts as draft/not-approved
    if (refAny.has(ftNorm(pr.statementRef))) r.riskTracked++;
    // Raw exception counts (E/WT/WP) — shown whatever the control status, so an
    // uploaded exception always appears. "Invisible" is the hidden work: a
    // statement self-declared implemented / part-implemented but with no control.
    const e = ftException(pr.exception);
    const disp = ftDisposition(pr.exception);
    // Self-declared disposition counts (a blank cell is UNKNOWN, never Implemented).
    if (disp === 'IMP')       r.imp++;
    else if (disp === 'PART') r.part++;
    else if (disp === 'UNKNOWN') r.unknown++;
    if (e === 'E') r.excE++;
    else if (e === 'WT') r.excWT++;
    else if (e === 'WP') r.excWP++;
    if ((disp === 'IMP' || disp === 'PART') && cls[pr.capId + '||' + ftNorm(pr.statementRef)] === 'Uncovered') r.invisible++;
  });
  const rows = Object.values(map).map(r => ({
    ...r,
    status: r.approved === r.total ? 'approved' : r.approved === 0 ? 'draft' : 'partial',
    risks: risksByDoc[r.key] || [],   // already worst-first from buildRiskProfile
  }));
  rows.sort((a, b) => a.capName.localeCompare(b.capName) || a.document.localeCompare(b.document));
  return rows;
}

// ── Policy-statement ownership (capability × document × owner) ────────
// One row per accountable owner within a document: how many policy/GS
// statements they own, and how many distinct (non-closed) controls
// operationalise those statements. Accountable owner comes from the policy
// statement's Owner column; a blank owner is grouped as "Unassigned".
function buildPolicyOwnership(policyRows, facts) {
  const capName = id => (CONFIG.capabilities || []).find(c => c.id === id)?.name || id;
  const map = {};
  const gkey = (capId, doc, owner) => capId + '||' + doc + '||' + owner;

  // Statements owned — one count per distinct statement.
  const seenStmt = new Set();
  (policyRows || []).forEach(pr => {
    const doc   = (pr.document || '').trim() || '(no document)';
    const owner = (pr.owner || '').trim() || 'Unassigned';
    const key   = gkey(pr.capId, doc, owner);
    const g = map[key] || (map[key] = { capId: pr.capId, capName: capName(pr.capId), document: doc, owner, statements: 0, controls: 0, ctrlImpl: 0, ctrlDraft: 0, _ctrl: new Set() });
    const sKey = pr.capId + '||' + ftNorm(pr.statementRef);
    if (seenStmt.has(sKey)) return;   // one row per distinct statement
    seenStmt.add(sKey);
    g.statements++;
  });

  // Controls owned — distinct non-closed controls mapping to a statement the
  // owner holds, attributed to that statement's (capability × document × owner)
  // and split by status (implemented vs draft).
  (facts || []).filter(f => !ftIsClosedControl(f) && (f.controlName || '').trim()).forEach(f => {
    const cid = ftNorm(f.controlNumber) + '|' + ftNorm(f.controlName);
    const impl = ftIsImplemented(f);
    (f.matchedPolicyRows || []).forEach(mp => {
      const doc   = (mp.document || '').trim() || '(no document)';
      const owner = (mp.owner || '').trim() || 'Unassigned';
      const g = map[gkey(mp.capId, doc, owner)];
      if (!g || g._ctrl.has(cid)) return;
      g._ctrl.add(cid);
      g.controls++;
      if (impl) g.ctrlImpl++; else g.ctrlDraft++;
    });
  });

  const rows = Object.values(map).map(r => { delete r._ctrl; return r; });
  rows.sort((a, b) => a.capName.localeCompare(b.capName) || a.document.localeCompare(b.document) || a.owner.localeCompare(b.owner));
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
  const srcLabel  = t => isLocPolType(t) ? 'Local Policy' : isGrpStdType(t) ? 'Group Standard' : ((t || '').trim() || '');
  const cls = buildRtmClass(policyRows, facts);   // per-RTM bucket (reconciles with the funnel)
  const live = (facts || []).filter(f => !ftIsClosedControl(f) && (f.controlName || '').trim());

  // Statement-driven rows: one per (statement × control × risk).
  const byStmt = {};
  live.forEach(f => {
    const entry = {
      name: f.controlName.trim(),
      type: typeLabel(f.controlType),
      status: ftIsImplemented(f) ? 'Implemented' : 'Draft',
      risk: (f.riskTitle || '').trim(),
      desc: (f.controlDesc || '').trim(),
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
      source: srcLabel(pr.type),
      ref: pr.statementRef || '',
      header: pr.statementHeader || '',
      owner: (pr.owner || '').trim(),
      exception: ftException(pr.exception),   // raw code (E/WT/WP) for its own column
      planStatus: cls[key] || 'Uncovered',
    };
    const seen = new Set();
    const ctrls = (byStmt[key] || []).filter(c => {
      const k = ftNorm(c.name) + '|' + ftNorm(c.risk);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    if (!ctrls.length) {
      rows.push({ ...base, risk: '', controlName: '', controlType: '', controlStatus: '', desc: '' });
    } else {
      ctrls.forEach(c => rows.push({ ...base, risk: c.risk, controlName: c.name, controlType: c.type, controlStatus: c.status, desc: c.desc }));
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
      capName: capName(f.capId), document: '', source: '', ref: '', header: '',
      owner: '', exception: '', planStatus: 'Pre-DORA (unmapped)',
      risk, controlName: name, controlType: 'Pre-DORA',
      controlStatus: ftIsImplemented(f) ? 'Implemented' : 'Draft',
      desc: (f.controlDesc || '').trim(), preDora: true,
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
// Per-RTM operationalisation bucket — the single source of truth shared by the
// exec-report funnel (renderRtmFunnel) and the main-screen Planning table
// (buildPlanningRows), so their counts always reconcile. Returns
// { "capId||normRef" -> 'Built new' | 'Reused pre-DORA' | 'Drafted' | 'Uncovered' }
// for every policy statement, applying the priority built > reused > drafted >
// uncovered. Closed controls are excluded (same as everywhere else).
function buildRtmClass(policyRows, facts) {
  const rtm = {};
  (policyRows || []).forEach(pr => {
    const key = pr.capId + '||' + ftNorm(pr.statementRef);
    if (!(key in rtm)) rtm[key] = { built: false, reused: false, drafted: false };
  });
  (facts || []).filter(f => !ftIsClosedControl(f)).forEach(f => {
    const impl   = ftIsImplemented(f);
    const isDora = f.controlType === 'locPol' || f.controlType === 'grpStd';
    (f.matchedPolicyRows || []).forEach(mp => {
      const r = rtm[mp.capId + '||' + ftNorm(mp.statementRef)];
      if (!r) return;
      if (impl) { if (isDora) r.built = true; else r.reused = true; }
      else r.drafted = true;
    });
  });
  const out = {};
  Object.entries(rtm).forEach(([k, r]) => {
    out[k] = r.built ? 'Built new' : r.reused ? 'Reused pre-DORA' : r.drafted ? 'Drafted' : 'Uncovered';
  });
  return out;
}

function buildRtmFunnel(policyRows, facts) {
  const polRows = policyRows || [];
  const live = (facts || []).filter(f => !ftIsClosedControl(f));

  // Layer 1/2 — sources: distinct RTMs counted by document-type label.
  const seenSrc = new Set();
  const srcCount = {};
  polRows.forEach(pr => {
    const key = pr.capId + '||' + ftNorm(pr.statementRef);
    if (seenSrc.has(key)) return;
    seenSrc.add(key);
    const label = isLocPolType(pr.type) ? 'Local Policy'
      : isGrpStdType(pr.type) ? 'Group Standards'
      : ((pr.type || '').trim() || 'Other');
    srcCount[label] = (srcCount[label] || 0) + 1;
  });

  // Layer 3 — per-RTM operationalisation bucket (shared classifier).
  const cls = buildRtmClass(polRows, facts);
  let built = 0, reused = 0, drafted = 0, uncovered = 0;
  Object.values(cls).forEach(b => {
    if (b === 'Built new') built++;
    else if (b === 'Reused pre-DORA') reused++;
    else if (b === 'Drafted') drafted++;
    else uncovered++;
  });
  const total = built + reused + drafted + uncovered;

  // Decision view of the IN-PROCESS RTMs (drafted + uncovered), using the
  // Exception column. Partitions in-process into exactly three decision states:
  //   inBuild        — a control is drafted (decision: build, in progress)
  //   waived         — uncovered but has an E/WT/WP exception (decision taken)
  //   decisionNeeded — uncovered with no exception (invisible work, no decision)
  // These sum to inProcess (drafted + uncovered).
  const excByKey = {};
  polRows.forEach(pr => {
    const key = pr.capId + '||' + ftNorm(pr.statementRef);
    const e = ftException(pr.exception);
    if (e && !excByKey[key]) excByKey[key] = e;
  });
  let decisionNeeded = 0, inBuild = 0, waived = 0;
  Object.entries(cls).forEach(([k, bucket]) => {
    if (bucket === 'Drafted') inBuild++;
    else if (bucket === 'Uncovered') { if (excByKey[k]) waived++; else decisionNeeded++; }
  });

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
    decisionNeeded, inBuild, waived,
    haveControl: built + reused + drafted,
    evidencedPct: pct(built + reused), haveControlPct: pct(built + reused + drafted),
    ctrlTotal, ctrlMapped, ctrlUnmapped,
  };
}

// ── RTM maturity (5 states) split by source ───────────────────────
// Combines control coverage (buildRtmClass) with the Exception column into one
// per-RTM maturity state, counted separately for Local Policy vs Group Standards.
//   treated      — control implemented, no exception (consistent, repeatable)
//   incomplete   — a control exists (draft/implemented) AND an exception is open
//                  (WT = incomplete/fixing, E/WP = suspended/partial)
//   proposed     — control drafted, no exception (reactive, key-person)
//   notTreated   — no control, but an exception is filed (accepted / waived)
//   notPerformed — no control, no exception (not performed or ad hoc)
const RTM_MATURITY = [
  { key: 'treated',      label: 'Treated',                meaning: 'Risk identified & treated — consistent, repeatable.' },
  { key: 'incomplete',   label: 'Incomplete / suspended', meaning: 'A control exists but an exception is open — WT: incomplete, fix in progress; E/WP: suspended, no fix planned.' },
  { key: 'proposed',     label: 'Proposed',               meaning: 'Risk identified, treatment proposed (control drafted) — reactive, unstructured, key-person dependent.' },
  { key: 'notTreated',   label: 'Not treated',            meaning: 'Risk identified but not treated — accepted under an exception (E/WT/WP).' },
  { key: 'notPerformed', label: 'Performed ad hoc',        meaning: 'Risk identified, but the RTM is not performed or done ad hoc — key-person dependent.' },
];
function buildRtmMaturity(policyRows, facts) {
  const cls = buildRtmClass(policyRows, facts);
  const srcLabel = t => isLocPolType(t) ? 'Local Policy' : isGrpStdType(t) ? 'Group Standards' : 'Other';
  const blank = () => ({ treated: 0, incomplete: 0, proposed: 0, notTreated: 0, notPerformed: 0, total: 0 });
  const bySource = { 'Local Policy': blank(), 'Group Standards': blank(), 'Other': blank() };
  const total = blank();
  const seen = new Set();
  (policyRows || []).forEach(pr => {
    const key = pr.capId + '||' + ftNorm(pr.statementRef);
    if (seen.has(key)) return;                 // one row per distinct RTM
    seen.add(key);
    const bucket = cls[key] || 'Uncovered';
    const exc = ftException(pr.exception);
    let state;
    if (exc) state = (bucket === 'Uncovered') ? 'notTreated' : 'incomplete';
    else if (bucket === 'Built new' || bucket === 'Reused pre-DORA') state = 'treated';
    else if (bucket === 'Drafted') state = 'proposed';
    else state = 'notPerformed';
    const src = srcLabel(pr.type);
    (bySource[src] || bySource['Other'])[state]++;
    (bySource[src] || bySource['Other']).total++;
    total[state]++; total.total++;
  });
  return { states: RTM_MATURITY, bySource, total };
}

// ── DORA obligation completeness (Control 1) ──────────────────────
// Joins the DORA→policy mapping upload (doraRows) onto the existing policy
// statements + controls, so we can measure COMPLETENESS: which DORA obligations
// have an owned policy / group-standard statement (Gate 1), and for the covered
// ones, whether that statement is backed by a control and how far it is
// operationalised. Single source shared by the import review step, the
// dashboard completeness card and the three evidence pages.
//
// doraRows : { article, obligationId, requirement, statementRef,
//              statementHeader, document, unmapped }  — one row per
//              (compliance statement × mapped ref); unmapped rows are the
//              "No matching policy" sentinels from the upload.
// Join key : statementRef → policyRows.statementRef, same normalisation and
//            sub-ref→parent fallback used by buildRiskPolicyFacts.
//
// Returns { articles:[{article,obligations:[o]}], obligations:[o],
//           totalObligations, coveredObligations, completenessPct }
//   o = { obligationId, article, requirement, covered,
//         mappedRefs:[{ ref, header, capId, source, owner, backing,
//                       status, effective, exception }] }
// An obligation is COVERED when at least one of its non-sentinel refs resolves
// to a statement in the policy register (any covered row wins).
function buildDoraObligations(doraRows, policyRows, facts) {
  doraRows   = doraRows   || [];
  policyRows = policyRows || [];

  // Ref index: normRef → [policyRow]. Each policy row carries capId/owner/type/…
  const polByRef = {};
  policyRows.forEach(pr => {
    const key = ftNorm(pr.statementRef);
    if (!key) return;
    (polByRef[key] = polByRef[key] || []).push(pr);
  });
  const polKeys = Object.keys(polByRef);

  // Resolve a DORA statement ref to policy rows — exact, else sub-ref→parent
  // (guard next char '.' so "SR30" does not match "SR3"), mirroring
  // buildRiskPolicyFacts.
  function resolveRef(ref) {
    const key = ftNorm(ref);
    if (!key) return [];
    if (polByRef[key]) return polByRef[key];
    const out = [];
    polKeys.forEach(pk => { if (key.startsWith(pk) && key[pk.length] === '.') out.push(...polByRef[pk]); });
    return out;
  }

  // Per-RTM control backing (shared classifier, reconciles with the funnel).
  const cls = buildRtmClass(policyRows, facts);   // capId||normRef → bucket

  // Effectiveness index: capId||normRef → true when a live control mapped to it
  // is rated effective (design + operating both green).
  const effByKey = {};
  (facts || []).filter(f => !ftIsClosedControl(f) && ftIsEffective(f)).forEach(f => {
    (f.matchedPolicyRows || []).forEach(mp => { effByKey[mp.capId + '||' + ftNorm(mp.statementRef)] = true; });
  });

  // Per-statement backing controls: capId||normRef → [{ name, number,
  // provenance, status, effective }] — the actual live controls that cite the
  // statement, for the evidence "Control Number & Name" / provenance columns.
  const ctrlByKey = {};
  (facts || []).filter(f => !ftIsClosedControl(f) && (f.controlName || '').trim()).forEach(f => {
    const detail = {
      name:       (f.controlName || '').trim(),
      number:     (f.controlNumber || '').trim(),
      provenance: f.controlType === 'operational' ? 'Reused (pre-DORA control)' : 'New (DORA control)',
      status:     ftControlStatus(f) === 'implemented' ? 'implemented' : ftControlStatus(f) === 'closed' ? 'closed' : 'draft',
      effective:  ftIsEffective(f),
    };
    (f.matchedPolicyRows || []).forEach(mp => {
      const k = mp.capId + '||' + ftNorm(mp.statementRef);
      const arr = ctrlByKey[k] || (ctrlByKey[k] = []);
      const dk = ftNorm(detail.number) + '|' + ftNorm(detail.name);
      if (!arr.some(c => (ftNorm(c.number) + '|' + ftNorm(c.name)) === dk)) arr.push(detail);
    });
  });

  const srcLabel = t => isLocPolType(t) ? 'Local Policy' : isGrpStdType(t) ? 'Group Standard' : ((t || '').trim() || '');

  // Group DORA rows by obligation id.
  const oblMap = {};
  const oblOrder = [];
  doraRows.forEach(row => {
    const id = (row.obligationId || '').trim();
    if (!id) return;
    if (!oblMap[id]) {
      oblMap[id] = { obligationId: id, article: (row.article || '').trim(), requirement: (row.requirement || '').trim(), capability: (row.capability || '').trim(), mappedRefs: [], _seen: new Set() };
      oblOrder.push(id);
    }
    const o = oblMap[id];
    if (!o.requirement && row.requirement) o.requirement = row.requirement.trim();
    if (!o.article && row.article)         o.article     = row.article.trim();
    if (!o.capability && row.capability)   o.capability   = row.capability.trim();
    if (row.unmapped) return;                       // sentinel — no statement
    resolveRef(row.statementRef).forEach(pr => {
      const key = pr.capId + '||' + ftNorm(pr.statementRef);
      if (o._seen.has(key)) return;
      o._seen.add(key);
      const backing = cls[key] || 'Uncovered';
      o.mappedRefs.push({
        ref:       pr.statementRef,
        header:    pr.statementHeader || row.statementHeader || '',
        detail:    pr.statementDetail || '',
        document:  (pr.document || '').trim(),
        capId:     pr.capId,
        source:    srcLabel(pr.type),
        owner:     (pr.owner || '').trim(),
        backing,                                     // Built new | Reused pre-DORA | Drafted | Uncovered
        status:    (backing === 'Built new' || backing === 'Reused pre-DORA') ? 'implemented' : backing === 'Drafted' ? 'draft' : 'not-implemented',
        effective: !!effByKey[key],
        exception: ftException(pr.exception),
        controls:  ctrlByKey[key] || [],             // backing controls (name/number/provenance/status/effective)
      });
    });
  });

  // Group obligations by article (first-appearance order), sorted numerically by id within.
  const artMap = {}, artOrder = [];
  oblOrder.forEach(id => {
    const o = oblMap[id];
    delete o._seen;
    o.covered = o.mappedRefs.length > 0;
    const a = o.article || '(no article)';
    if (!artMap[a]) { artMap[a] = { article: a, obligations: [] }; artOrder.push(a); }
    artMap[a].obligations.push(o);
  });
  const articles = artOrder.map(a => {
    artMap[a].obligations.sort((x, y) => x.obligationId.localeCompare(y.obligationId, undefined, { numeric: true }));
    // Article-level capability = distinct capabilities of its obligations.
    artMap[a].capability = [...new Set(artMap[a].obligations.map(o => o.capability).filter(Boolean))].join(', ');
    return artMap[a];
  });
  const obligations = articles.flatMap(a => a.obligations);

  const totalObligations   = obligations.length;
  const coveredObligations = obligations.filter(o => o.covered).length;
  const completenessPct    = totalObligations ? Math.round(100 * coveredObligations / totalObligations) : 0;

  return { articles, obligations, totalObligations, coveredObligations, completenessPct };
}

// ── Statement coverage (Control 2) ────────────────────────────────
// One entry per distinct policy statement (capId||ref): is it backed by a
// control, plus the backing control(s). Feeds the Sources card's summary,
// progress bar and "statements with no control" action list.
function buildStatementCoverage(policyRows, facts) {
  const capName  = id => (CONFIG.capabilities || []).find(c => c.id === id)?.name || id;
  const srcLabel = t => isLocPolType(t) ? 'Local Policy' : isGrpStdType(t) ? 'Group Standard' : ((t || '').trim() || '');
  const cls = buildRtmClass(policyRows, facts);   // capId||normRef → bucket

  const ctrlByKey = {};
  (facts || []).filter(f => !ftIsClosedControl(f) && (f.controlName || '').trim()).forEach(f => {
    const detail = {
      name:       (f.controlName || '').trim(),
      number:     (f.controlNumber || '').trim(),
      status:     ftIsImplemented(f) ? 'implemented' : 'draft',
      effective:  ftIsEffective(f),
    };
    (f.matchedPolicyRows || []).forEach(mp => {
      const k = mp.capId + '||' + ftNorm(mp.statementRef);
      (ctrlByKey[k] = ctrlByKey[k] || []).push(detail);
    });
  });

  const seen = new Set();
  const statements = [];
  (policyRows || []).forEach(pr => {
    const key = pr.capId + '||' + ftNorm(pr.statementRef);
    if (seen.has(key)) return;
    seen.add(key);
    const backing = cls[key] || 'Uncovered';
    statements.push({
      key, capId: pr.capId, capName: capName(pr.capId),
      ref: pr.statementRef || '', header: pr.statementHeader || '',
      document: (pr.document || '').trim() || '(no document)', source: srcLabel(pr.type),
      owner: (pr.owner || '').trim(), exception: ftException(pr.exception),
      backing, hasControl: backing !== 'Uncovered', controls: ctrlByKey[key] || [],
    });
  });
  const total  = statements.length;
  const backed = statements.filter(s => s.hasControl).length;
  return { statements, total, backed, backedPct: total ? Math.round(100 * backed / total) : 0,
           uncovered: statements.filter(s => !s.hasControl) };
}

// ── Backing-control operationalisation (Control 3) ────────────────
// One entry per distinct live control that cites ≥1 policy statement (deduped by
// capability + number + name). Feeds the Risks card's Control-3 summary,
// progress bar and "controls not yet live/effective" action list.
function buildBackingControlOps(policyRows, facts) {
  const capName = id => (CONFIG.capabilities || []).find(c => c.id === id)?.name || id;
  const map = {};
  (facts || []).filter(f => !ftIsClosedControl(f) && (f.controlName || '').trim() && (f.matchedPolicyRows || []).length).forEach(f => {
    const ck = f.capId + '|' + ftNorm(f.controlNumber) + '|' + ftNorm(f.controlName);
    const d = map[ck] || (map[ck] = {
      capId: f.capId, capName: capName(f.capId),
      name: (f.controlName || '').trim(), number: (f.controlNumber || '').trim(),
      provenance: f.controlType === 'operational' ? 'Reused (pre-DORA control)' : 'New (DORA control)',
      implemented: false, effective: false, refs: new Set(), risks: new Set(),
    });
    if (ftIsImplemented(f)) d.implemented = true;
    if (ftIsEffective(f))   d.effective = true;
    (f.matchedPolicyRows || []).forEach(mp => d.refs.add(mp.statementRef));
    if ((f.riskTitle || '').trim()) d.risks.add(f.riskTitle.trim());
  });
  const controls = Object.values(map).map(d => ({
    capId: d.capId, capName: d.capName, name: d.name, number: d.number, provenance: d.provenance,
    implemented: d.implemented, effective: d.effective,
    liveEffective: d.implemented && d.effective,
    status: d.implemented ? 'implemented' : 'draft',
    refs: [...d.refs], risks: [...d.risks],
  }));
  const total   = controls.length;
  const liveEff = controls.filter(c => c.liveEffective).length;
  return { controls, total, liveEffective: liveEff, pct: total ? Math.round(100 * liveEff / total) : 0,
           gap: controls.filter(c => !c.liveEffective) };
}

// ══════════════════════════════════════════════════════════════════
// Executive-report rollups (the 3-control scorecard). Pure — computed for
// the current assessment; the exec generator runs them again on the previous
// assessment to drive QoQ arrows. See docs/exec-report-plan.md.
// ══════════════════════════════════════════════════════════════════

// ── Control 1: per-DORA-article coverage (spec rows 2–5) ──────────
// Per article: total obligations and how many are covered overall, by a policy,
// by a group standard, by any control (backed), by an implemented (live)
// control, and fully operationalised (live AND effective). An obligation counts
// toward a lens if ANY of its mapped statements satisfies it.
function buildDoraArticleCoverage(doraRows, policyRows, facts) {
  const model = buildDoraObligations(doraRows, policyRows, facts);
  const articles = model.articles.map(a => {
    let covered = 0, byPolicy = 0, byGroupStandard = 0, byBacked = 0, byImplemented = 0, fullyOperationalised = 0;
    a.obligations.forEach(o => {
      if (!o.covered) return;
      covered++;
      const refs = o.mappedRefs;
      if (refs.some(m => m.source === 'Local Policy'))    byPolicy++;
      if (refs.some(m => m.source === 'Group Standard'))  byGroupStandard++;
      if (refs.some(m => m.backing !== 'Uncovered'))      byBacked++;
      if (refs.some(m => m.status === 'implemented'))     byImplemented++;
      if (refs.some(m => m.status === 'implemented' && m.effective)) fullyOperationalised++;
    });
    return { article: a.article, capability: a.capability || '', total: a.obligations.length,
             covered, byPolicy, byGroupStandard, byBacked, byImplemented, fullyOperationalised };
  });
  const sum = k => articles.reduce((s, r) => s + r[k], 0);
  return {
    articles,
    totals: {
      total: sum('total'), covered: sum('covered'), byPolicy: sum('byPolicy'),
      byGroupStandard: sum('byGroupStandard'), byBacked: sum('byBacked'),
      byImplemented: sum('byImplemented'), fullyOperationalised: sum('fullyOperationalised'),
    },
  };
}

// ── Control 2: statement operationalisation, split by source (rows 8–9) ──
// Per distinct statement: backed (any control) and operationalised (a live
// control — Built new / Reused pre-DORA). Aggregated overall and by source.
function buildStatementOps(policyRows, facts) {
  const cov = buildStatementCoverage(policyRows, facts);
  const mk = () => ({ total: 0, backed: 0, operationalised: 0 });
  const all = mk(), bySource = { 'Local Policy': mk(), 'Group Standard': mk(), 'Other': mk() };
  cov.statements.forEach(s => {
    const grp = bySource[s.source] || bySource['Other'];
    const live = s.backing === 'Built new' || s.backing === 'Reused pre-DORA';
    [all, grp].forEach(b => { b.total++; if (s.hasControl) b.backed++; if (live) b.operationalised++; });
  });
  const pct = b => b.total ? Math.round(100 * b.operationalised / b.total) : 0;
  return {
    all, policy: bySource['Local Policy'], groupStandard: bySource['Group Standard'], other: bySource['Other'],
    operationalisedPct: { all: pct(all), policy: pct(bySource['Local Policy']), groupStandard: pct(bySource['Group Standard']) },
  };
}

// ── Control 2: per-document detail + anomalies (rows 12–16, 19–21, 13, 14) ──
// Per policy / group-standard document:
//   disposition   — statements by Implemented-status (no waiver) / E / WT / WP  (12,19)
//   operationalised — statements with a live control                            (15,20)
//   control mix   — controls citing the doc's statements by Draft / Implemented /
//                   Tested / Effective (independent flags; controls deduped)     (16,21)
//   invisibleWork — Implemented-status statements with NO control                (13)
//   staleWaiver   — statements with a waiver that DO have a live control         (14)
function buildExecDocDetail(policyRows, facts) {
  const capName = id => (CONFIG.capabilities || []).find(c => c.id === id)?.name || id;
  const typeOf  = pr => isLocPolType(pr.type) ? 'policy' : isGrpStdType(pr.type) ? 'groupStandard' : 'other';
  const cls = buildRtmClass(policyRows, facts);
  const dkey = (capId, doc) => capId + '||' + doc;

  const docs = {};
  const seenStmt = new Set();
  (policyRows || []).forEach(pr => {
    const doc = (pr.document || '').trim() || '(no document)';
    const key = dkey(pr.capId, doc);
    const d = docs[key] || (docs[key] = {
      key, capId: pr.capId, capName: capName(pr.capId), document: doc, type: typeOf(pr),
      total: 0, approved: 0, draft: 0, implementedStatus: 0, partImplemented: 0, unknown: 0, excE: 0, excWT: 0, excWP: 0,
      operationalised: 0, invisibleWork: 0, staleWaiver: 0, ctrlDraft: 0, ctrlImpl: 0, ctrlTested: 0, ctrlEffective: 0,
      _ctrlSeen: new Set(),
    });
    const sKey = pr.capId + '||' + ftNorm(pr.statementRef);
    if (seenStmt.has(sKey)) return;   // one row per distinct statement
    seenStmt.add(sKey);
    d.total++;
    // Approval status (matches the main-screen Sources card): a statement whose
    // status includes "approv" counts as approved, everything else as draft.
    if (ftNorm(pr.status).includes('approv')) d.approved++; else d.draft++;
    const disp = ftDisposition(pr.exception);   // IMP | PART | UNKNOWN | E | WT | WP
    const b = cls[sKey];
    const live = b === 'Built new' || b === 'Reused pre-DORA';
    if (disp === 'IMP')       d.implementedStatus++;
    else if (disp === 'PART') d.partImplemented++;
    else if (disp === 'E')    d.excE++;
    else if (disp === 'WT')   d.excWT++;
    else if (disp === 'WP')   d.excWP++;
    else                      d.unknown++;      // UNKNOWN (and any blank — never "implemented")
    if (live) d.operationalised++;
    // Invisible work — statements self-declared implemented or part-implemented
    // but with NO control citing them (the hidden work we're doing).
    if ((disp === 'IMP' || disp === 'PART') && b === 'Uncovered') d.invisibleWork++;
    // Stale waiver — a waiver (E/WT/WP) that already has a live control.
    const e = ftException(pr.exception);
    if (e && live) d.staleWaiver++;                   // waiver but a live control exists
  });

  // Control-status mix per document (controls deduped by identity per doc).
  (facts || []).filter(f => !ftIsClosedControl(f) && (f.controlName || '').trim()).forEach(f => {
    const impl = ftIsImplemented(f), tested = ftIsAssessed(f), eff = ftIsEffective(f);
    const cid = ftNorm(f.controlNumber) + '|' + ftNorm(f.controlName);
    const docsSeen = new Set();
    (f.matchedPolicyRows || []).forEach(mp => {
      const key = dkey(mp.capId, (mp.document || '').trim() || '(no document)');
      const d = docs[key];
      if (!d || docsSeen.has(key)) return;
      docsSeen.add(key);
      if (d._ctrlSeen.has(cid)) return;
      d._ctrlSeen.add(cid);
      if (impl) d.ctrlImpl++; else d.ctrlDraft++;
      if (tested) d.ctrlTested++;
      if (eff) d.ctrlEffective++;
    });
  });

  const rows = Object.values(docs).map(d => {
    delete d._ctrlSeen;
    d.status = d.approved === d.total ? 'approved' : d.approved === 0 ? 'draft' : 'partial';
    return d;
  });
  rows.sort((a, b) => a.type.localeCompare(b.type) || a.capName.localeCompare(b.capName) || a.document.localeCompare(b.document));
  return { rows, policy: rows.filter(r => r.type === 'policy'), groupStandard: rows.filter(r => r.type === 'groupStandard') };
}

// ── The hero scorecard (three control %s + composite + chain) ─────
function buildExecScorecard(doraRows, policyRows, facts) {
  const art  = buildDoraArticleCoverage(doraRows, policyRows, facts);
  const sops = buildStatementOps(policyRows, facts);
  const ops  = buildBackingControlOps(policyRows, facts);
  const t = art.totals;
  const pctOf = (n, d) => d ? Math.round(100 * n / d) : 0;
  return {
    control1: { pct: pctOf(t.covered, t.total), n: t.covered, d: t.total },          // obligations covered
    control2: { pct: pctOf(sops.all.backed, sops.all.total), n: sops.all.backed, d: sops.all.total },  // statements backed
    control3: { pct: ops.pct, n: ops.liveEffective, d: ops.total },                   // controls live & effective
    composite: { pct: pctOf(t.fullyOperationalised, t.total), n: t.fullyOperationalised, d: t.total },  // obligations fully operationalised
    chain: {
      obligations: t.total,
      ownedStatement: t.covered,
      backedByControl: t.byBacked,
      liveEffective: t.fullyOperationalised,
    },
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
  if (s.startsWith('not'))                      return 'not-implemented';   // "Not implemented" / "Not started"
  if (s.includes('close') || s.includes('inactive')) return 'closed';       // closed / inactive / proposed close
  if (s === 'open' || s.includes('implement') || s.includes('live')) return 'implemented';
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
