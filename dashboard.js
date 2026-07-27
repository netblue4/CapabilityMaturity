// ── Dashboard ────────────────────────────────────────────────
function renderDashboard() {
  if (!CONFIG) return;
  const hasData = db.assessments.length > 0;
  document.getElementById("no-data-message").style.display = hasData ? "none" : "flex";
  document.getElementById("dashboard-content").style.display = hasData ? "block" : "none";
  if (!hasData) return;

  const latest = db.assessments[db.assessments.length - 1];
  renderMeasureSummary(latest);
  renderHistory();
}
