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

function setDefaultDate() {
  const el = document.getElementById("assessment-date");
  if (el && !el.value) el.value = new Date().toISOString().slice(0, 10);
}
