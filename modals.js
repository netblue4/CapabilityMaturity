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
          <span class="lvl-badge" style="background:${lv.color};min-width:105px;text-align:center">${lv.level} · ${lv.name}</span>
          <div>
            <div class="modal-level-desc">${lv.description}</div>
            ${label ? `<div class="modal-level-label">${label}</div>` : ""}
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

// ── ICT Risk Ratings Modal ────────────────────────────────────
function showIctRiskRatingsModal() {
  const ictMeasure = CONFIG.measures.find(m => m.id === 'risk');

  const levelRows = (ictMeasure?.levels || []).map(lvSpec => {
    const lv = CONFIG.levels.find(l => l.level === lvSpec.level);
    const color = lv?.color || 'var(--clr-badge-empty)';
    return `
      <div class="modal-level-row" style="border-bottom:1px solid var(--border);padding-bottom:.85rem;margin-bottom:.85rem">
        <span class="lvl-badge" style="background:${color};min-width:105px;text-align:center">${lvSpec.level} · ${lv?.name || ''}</span>
        <div>
          <div class="modal-level-desc">${lv?.description || ''}</div>
          <div class="modal-level-label">${lvSpec.label || ''}</div>
          ${lvSpec.exit ? `
            <div style="margin-top:.5rem">
              <span style="display:block;font-family:var(--font-mono);font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);margin-bottom:.2rem">Exit Condition:</span>
              <span style="font-style:italic;color:var(--text-muted);font-size:.78rem">${lvSpec.exit}</span>
            </div>` : ''}
        </div>
      </div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>ICT Risk — Maturity Level Guide</h3>
        <button class="modal-close" id="ict-risk-modal-close">✕</button>
      </div>
      <p class="modal-desc">The ICT Risk maturity score reflects how well risks associated with this capability are identified, assessed, treated and monitored. Use the slider to record the current maturity level based on the level descriptions below. Record the Residual Risk Rating and Risk Appetite separately to give executives a complete picture of the risk profile.</p>
      <div class="modal-levels">${levelRows}</div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#ict-risk-modal-close').addEventListener('click', () => overlay.remove());
}
