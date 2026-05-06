// ── Ratings Modal ────────────────────────────────────────────
function showRatingsModal(measureId) {
  const m = measureId ? CONFIG.measures.find(x => x.id === measureId) : null;
  document.getElementById("modal-title").textContent = m
    ? `${m.name} — Rating Scale`
    : "Overall Score — Rating Scale";
  document.getElementById("modal-body").innerHTML = `
    <p class="modal-desc">${m
      ? `Each capability is rated 1–5 for <strong>${m.name}</strong>. The score shown is the average across all rated capabilities.`
      : `The overall score is the average of all dimension ratings (${CONFIG.measures.map(x => x.name).join(", ")}) across all rated capabilities.`
    }</p>
    <div class="modal-levels">
      ${CONFIG.levels.map(lv => {
        const label = m ? (m.levels.find(l => l.level === lv.level) || {}).label : null;
        return `<div class="modal-level-row">
         <span class="lvl-badge" style="border-color:${lv.color}; display:inline-block; min-width:105px; text-align:center">
            ${lv.level}-${lv.name}
          </span>
          
          <div>
            ${label 
              ? `<div class="modal-level-label">${label}</div>` 
              : `<div class="modal-level-desc">${lv.description}</div>`
            }
          </div>
        </div>`;
      }).join("")}
    </div>`;
  document.getElementById("ratings-modal").style.display = "flex";
}

function closeRatingsModal(e) {
  if (e.target.id === "ratings-modal") {
    document.getElementById("ratings-modal").style.display = "none";
  }
}
