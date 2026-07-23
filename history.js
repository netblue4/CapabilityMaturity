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
  document.getElementById("assessment-notes").value = source.notes || "";

  document.querySelectorAll(".dimension-check").forEach(cb => cb.checked = true);
  CONFIG.measures.forEach(m => {
    const hasScore = CONFIG.capabilities.some(cap => getMeasureScore(source, cap.id, m.id) > 0);
    const cb = document.querySelector(`.dimension-check[value="${m.id}"]`);
    if (cb) cb.checked = hasScore;
  });

  CONFIG.capabilities.forEach(cap => {
    document.getElementById("capnote-" + cap.id).value = (source.capNotes && source.capNotes[cap.id]) || "";
    CONFIG.measures.forEach(m => {
      const score  = getMeasureScore(source, cap.id, m.id) || 1;
      const target = getMeasureTarget(source, cap.id, m.id) || 3;
      const note   = getMeasureNote(source, cap.id, m.id) || "";
      setSlider(`score-${cap.id}-${m.id}`, score);
      setSlider(`target-${cap.id}-${m.id}`, target);
      const noteEl = document.getElementById(`note-${cap.id}-${m.id}`);
      if (noteEl) noteEl.value = note;
      updateMeasureDisplay(cap.id, m.id, score);
      updateTargetDisplay(cap.id, m.id, target);

      if (['governance', 'risk', 'reporting'].includes(m.id)) {
        const timeEstEl = document.getElementById(`timeest-${cap.id}-${m.id}`);
        if (timeEstEl) {
          let timeEst = source.measureTimeEstimates?.[cap.id]?.[m.id] || '';
          if (!timeEst && m.id === 'risk' && source.weeksToNext?.[cap.id]) {
            timeEst = String(source.weeksToNext[cap.id]);
          }
          timeEstEl.value = timeEst;
        }
      }
    });

    const rmData   = source.measureScores?.[cap.id]?.riskManagement;
    const legacyRp = source.riskProfile?.[cap.id];
    let rm;
    if (rmData && typeof rmData === 'object') {
      rm = rmData;
    } else if (legacyRp) {
      rm = legacyRp;
    } else {
      const legacyRaw = source.measureScores?.[cap.id]?.['ict_risk'];
      rm = (legacyRaw && typeof legacyRaw === 'object' && !('score' in legacyRaw)) ? legacyRaw : {};
    }

    setRiskRatingBtns(cap.id, 'residual', rm.residualRating || '');
    setRiskRatingBtns(cap.id, 'appetite', rm.appetiteRating || '');

    const cc = rm.controlCounts || {};
    const openEl          = document.getElementById(`ctrl-openrisks-${cap.id}`);
    const risksAssessedEl = document.getElementById(`ctrl-risksassessed-${cap.id}`);
    const notEl           = document.getElementById(`ctrl-not-${cap.id}`);
    const partialEl       = document.getElementById(`ctrl-partial-${cap.id}`);
    const effEl           = document.getElementById(`ctrl-effective-${cap.id}`);
    if (openEl)          openEl.value          = rm.openRisks           ?? cc.openRisks   ?? 0;
    if (risksAssessedEl) risksAssessedEl.value  = rm.risksAssessed       ?? 0;
    if (notEl)           notEl.value            = rm.controlsNotAssessed ?? cc.notAssessed ?? 0;
    if (partialEl)       partialEl.value        = rm.controlsPartial     ?? cc.partial     ?? 0;
    if (effEl)           effEl.value            = rm.controlsEffective   ?? cc.effective   ?? 0;

    const rmNote = getMeasureNote(source, cap.id, 'riskManagement') || rm.riskMgmtNotes || '';
    const rmNotesEl = document.getElementById(`note-risk-mgmt-${cap.id}`);
    if (rmNotesEl) rmNotesEl.value = rmNote;
  });

  updateDimensionVisibility();
  showView("assessment");
}
