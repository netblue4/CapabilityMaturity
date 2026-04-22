// ── Data Helpers ─────────────────────────────────────────────
function getMeasureScore(assessment, capId, measureId) {
  if (!assessment.measureScores || !assessment.measureScores[capId]) return 0;
  const val = assessment.measureScores[capId][measureId];
  if (val && typeof val === 'object') return val.score || 0;
  return val || 0;
}

function getMeasureTarget(assessment, capId, measureId) {
  return assessment.measureTargets && assessment.measureTargets[capId]
    ? assessment.measureTargets[capId][measureId] || 0
    : 0;
}

function getMeasureNote(assessment, capId, measureId) {
  return assessment.measureNotes && assessment.measureNotes[capId]
    ? assessment.measureNotes[capId][measureId] || ""
    : "";
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
