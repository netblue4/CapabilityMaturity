// ── Dashboard ────────────────────────────────────────────────
function renderDashboard() {
  if (!CONFIG) return;
  stopRadarAnimation();
  const hasData = db.assessments.length > 0;
  document.getElementById("no-data-message").style.display = hasData ? "none" : "flex";
  document.getElementById("dashboard-content").style.display = hasData ? "block" : "none";
  if (!hasData) return;

  const latest = db.assessments[db.assessments.length - 1];
  buildAssessmentFilter();
  renderRadar("radar-chart", null, getSelectedRadarCaps(), getSelectedAssessments());
  renderMeasureSummary(latest);
  renderRiskProfileSummary(latest);
  renderHistory();
}
