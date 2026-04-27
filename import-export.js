// ── Import / Export ───────────────────────────────────────────
function exportJSON() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ict-maturity-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const imported = JSON.parse(evt.target.result);
      if (imported.assessments) {
        const existing = db.assessments.length;
        const msg = existing > 0
          ? `Import ${imported.assessments.length} assessment(s)?\n\nThis will REPLACE all ${existing} existing assessment(s). This cannot be undone.`
          : `Import ${imported.assessments.length} assessment(s)?`;
        if (confirm(msg)) {
          db.assessments = imported.assessments.slice();
          db.assessments.sort((a, b) => a.date.localeCompare(b.date));
          saveToLocalStorage();
          renderDashboard();
          alert("Import successful!");
        }
      } else {
        alert("Invalid file: expected an object with an 'assessments' array.");
      }
    } catch { alert("Could not parse the JSON file. Please check it is valid."); }
  };
  reader.readAsText(file);
  e.target.value = "";
}
