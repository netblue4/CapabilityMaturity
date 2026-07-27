// ── History Table ─────────────────────────────────────────────
function renderHistory() {
  document.getElementById("history-thead").innerHTML = `
    <tr>
      <th>Date</th>
      <th>Label</th>
      <th>Actions</th>
    </tr>`;

  const tbody = document.getElementById("history-tbody");
  const rows = [...db.assessments].reverse();
  tbody.innerHTML = rows.map((a, i) => {
    const isLatest = i === 0;
    return `
      <tr class="${isLatest ? 'row-latest' : ''}">
        <td>${formatDate(a.date)}</td>
        <td>${a.label}${isLatest ? ' <span class="tag-latest">latest</span>' : ''}</td>
        <td>
          <button class="btn-link" onclick="openAssessmentForm('${a.id}')">Edit</button>
          <button class="btn-link" onclick="copyAssessment('${a.id}')">Copy</button>
          <button class="btn-link btn-link-danger" onclick="deleteAssessment('${a.id}')">Delete</button>
        </td>
      </tr>`;
  }).join("");
}

function deleteAssessment(id) {
  if (!confirm("Delete this assessment? This cannot be undone.")) return;
  db.assessments = db.assessments.filter(a => a.id !== id);
  saveToLocalStorage();
  renderHistory();
}

function copyAssessment(id) {
  const source = db.assessments.find(a => a.id === id);
  if (!source) return;

  editingId = null;
  document.getElementById("assessment-form").reset();
  document.getElementById("assessment-form-title").textContent = "New Assessment";
  document.getElementById("assessment-label").value = "";
  document.getElementById("assessment-date").value = new Date().toISOString().slice(0, 10);

  // Carry over the manual Strategic KPI values; risk/policy data is re-imported.
  document.querySelectorAll(".capability-check").forEach(cb => cb.checked = true);
  (CONFIG.kpis || []).forEach(kpi => {
    const val = source.kpiValues?.[kpi.id];
    const nEl = document.getElementById(`kpi-n-${kpi.id}`);
    const dEl = document.getElementById(`kpi-d-${kpi.id}`);
    if (nEl) nEl.value = val?.n ?? 0;
    if (dEl) dEl.value = val?.d ?? 0;
    updateKpiPct(kpi.id);
  });

  updateDimensionVisibility();
  showView("assessment");
}
