// ── History Table ─────────────────────────────────────────────
function renderHistory() {
  const caps = CONFIG.capabilities;
  const measures = CONFIG.measures;

  document.getElementById("history-thead").innerHTML = `
    <tr>
      <th rowspan="2">Date</th>
      <th rowspan="2">Label</th>
      ${caps.map(c => `<th colspan="${measures.length}" class="th-cap-group">${shortName(c.name)}</th>`).join("")}
      <th rowspan="2">Avg</th>
      <th rowspan="2">Actions</th>
    </tr>
    <tr>
      ${caps.map(() => measures.map(m => `<th class="th-measure" title="${m.name}">${m.icon}</th>`).join("")).join("")}
    </tr>`;

  const tbody = document.getElementById("history-tbody");
  const rows = [...db.assessments].reverse();
  tbody.innerHTML = rows.map((a, i) => {
    const isLatest = i === 0;
    const capCells = caps.map(cap =>
      measures.map(m => {
        const s = getMeasureScore(a, cap.id, m.id);
        const lv = levelForScore(s);
        return `<td><span class="level-dot" style="background:${lv ? lv.color : 'var(--clr-dot-empty)'}" title="${lv ? lv.name : 'Not scored'}">${s || '—'}</span></td>`;
      }).join("")
    ).join("");

    return `
      <tr class="${isLatest ? 'row-latest' : ''}">
        <td>${formatDate(a.date)}</td>
        <td>${a.label}${isLatest ? ' <span class="tag-latest">latest</span>' : ''}</td>
        ${capCells}
        <td><strong>${overallAvg(a).toFixed(1)}</strong></td>
        <td>
          <button class="btn-link" onclick="viewAssessment('${a.id}')">View</button>
          <button class="btn-link" onclick="openAssessmentForm('${a.id}')">Edit</button>
          <button class="btn-link" onclick="copyAssessment('${a.id}')">Copy</button>
          <button class="btn-link btn-link-danger" onclick="deleteAssessment('${a.id}')">Delete</button>
        </td>
      </tr>`;
  }).join("");
}
