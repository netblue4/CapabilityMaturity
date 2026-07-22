// ── Data Helpers ─────────────────────────────────────────────
function getMeasureScore(assessment, capId, measureId) {
  if (!assessment.measureScores || !assessment.measureScores[capId]) return 0;
  // riskManagement has no numeric maturity score
  if (measureId === 'riskManagement') return 0;
  let val = assessment.measureScores[capId][measureId];
  // Backward compat: "ict_risk" key in old assessments
  if (val === undefined && measureId === 'risk') {
    val = assessment.measureScores[capId]['ict_risk'];
    if (val !== undefined) console.info(`Legacy ict_risk score for ${capId} — treating as risk score.`);
  }
  if (val && typeof val === 'object') return val.score || 0;
  return val || 0;
}

function getMeasureTarget(assessment, capId, measureId) {
  // riskManagement target is a string (residual rating), not a number
  if (measureId === 'riskManagement') {
    return assessment.measureTargets?.[capId]?.riskManagement || '';
  }
  if (!assessment.measureTargets || !assessment.measureTargets[capId]) return 0;
  let val = assessment.measureTargets[capId][measureId];
  // Backward compat: "ict_risk" key in old assessments
  if (val === undefined && measureId === 'risk') {
    val = assessment.measureTargets[capId]['ict_risk'];
  }
  return val || 0;
}

function getMeasureNote(assessment, capId, measureId) {
  if (measureId === 'riskManagement') {
    return assessment.measureNotes?.[capId]?.riskManagement || '';
  }
  if (!assessment.measureNotes || !assessment.measureNotes[capId]) return '';
  let val = assessment.measureNotes[capId][measureId];
  // Backward compat: "ict_risk" key in old assessments
  if (val === undefined && measureId === 'risk') {
    val = assessment.measureNotes[capId]['ict_risk'];
  }
  return val || '';
}

// Returns free-text time estimate for a maturity measure (governance, risk, reporting only)
function getTimeEstimate(assessment, capId, measureId) {
  if (!['governance', 'risk', 'reporting'].includes(measureId)) return '';
  return assessment.measureTimeEstimates?.[capId]?.[measureId] || '';
}

// Returns riskManagement object for a capability.
// Falls back to legacy assessment.riskProfile[capId] if new structure absent.
function getRiskManagement(assessment, capId) {
  const newData = assessment.measureScores?.[capId]?.riskManagement;
  if (newData && typeof newData === 'object') return newData;
  // Backward compat: old riskProfile top-level key
  const legacyRp = assessment.riskProfile?.[capId];
  if (legacyRp) {
    console.info(`Legacy riskProfile data for ${capId} — reading from riskProfile.`);
    return legacyRp;
  }
  return {};
}

// Returns the target residual rating string for a capability, or "".
function getRiskManagementTarget(assessment, capId) {
  return assessment.measureTargets?.[capId]?.riskManagement || '';
}

// Derives the Risk Management Sustainability level (1–5) from RCSA data.
// Level is based on worst assessed risk (residual rating) + whether controls
// are formally evidenced. Draft/unassessed risks are flagged separately.
function computeSustainabilityLevel(rm) {
  if (!rm) return 1;
  const assessed  = rm.risksAssessed || 0;
  const residual  = rm.residualRating || '';
  const eff       = rm.controlsEffective || 0;
  const part      = rm.controlsPartial   || 0;

  if (assessed === 0) return 1;

  const outOfTol  = residual.startsWith('Extreme') || residual.startsWith('Significant');
  const inTol     = residual.startsWith('Moderate') || residual.startsWith('Low');
  const anyCtrl   = (eff + part) > 0;
  const evidenced = eff > 0;

  if (outOfTol && !anyCtrl)  return 2;
  if (outOfTol &&  anyCtrl)  return 3;
  if (inTol    && !evidenced) return 4;
  if (inTol    &&  evidenced) return 5;
  return 1;
}

function sustLevelDef(level) {
  const defs = CONFIG.riskSustainabilityLevels || [];
  return defs.find(d => d.level === level) || null;
}

function capAvgScore(assessment, capId) {
  const vals = CONFIG.measures.map(m => getMeasureScore(assessment, capId, m.id)).filter(v => v > 0);
  return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 0;
}

function overallAvg(assessment) {
  const vals = CONFIG.capabilities.flatMap(cap =>
    CONFIG.measures.map(m => getMeasureScore(assessment, cap.id, m.id))
  ).filter(v => v > 0);
  return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 0;
}

function levelForScore(score) {
  if (!score || score < 1) return null;
  return CONFIG.levels[Math.round(score) - 1] || CONFIG.levels[CONFIG.levels.length - 1];
}

// ── UI Helpers ───────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function shortName(name) {
  return name
    .replace("ICT ", "")
    .replace("Management", "Mgmt")
    .replace("Performance & Capacity", "Perf & Cap")
    .replace("Disaster Recovery", "DR");
}

// Returns a short abbreviation for a measure-specific level name.
function abbrevMeasureLevel(name) {
  if (!name) return '';
  const map = {
    'initial': 'INIT', 'drafted': 'DRFT', 'approved': 'APPD',
    'in rcsa': 'RCSA', 'measured': 'MSRD', 'reviewed': 'REVD',
  };
  return map[name.toLowerCase()] || name.substring(0, 4).toUpperCase();
}

function setDefaultDate() {
  const el = document.getElementById("assessment-date");
  if (el && !el.value) el.value = new Date().toISOString().slice(0, 10);
}
