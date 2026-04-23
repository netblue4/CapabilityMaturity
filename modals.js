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

// ── Risk Matrix Modal ─────────────────────────────────────────
function showRiskMatrixModal() {
  const residuals = Object.keys(CONFIG.riskScoreMatrix || {});
  const appetites = CONFIG.riskProfile?.appetiteStatus || [];
  const ctrls     = CONFIG.riskProfile?.controlEffectiveness || [];

  let tableRows = '';
  residuals.forEach((res, ri) => {
    const resColor = CONFIG.levels[ri]?.color || '#888';
    tableRows += `
      <tr style="background:var(--bg3)">
        <td colspan="4" style="padding:.4rem .7rem;font-family:var(--font-mono);font-size:.7rem;text-transform:uppercase;letter-spacing:.06em">
          <span class="lvl-badge" style="background:${resColor}">${res}</span>
        </td>
      </tr>`;
    appetites.forEach(app => {
      ctrls.forEach(ctrl => {
        const score = CONFIG.riskScoreMatrix?.[res]?.[app]?.[ctrl] || 0;
        const lv = levelForScore(score);
        const badge = score > 0
          ? `<span class="lvl-badge" style="background:${lv ? lv.color : '#555'}">${score} · ${lv ? lv.name : ''}</span>`
          : '—';
        tableRows += `
          <tr>
            <td style="padding:.4rem .7rem;font-size:.8rem"></td>
            <td style="padding:.4rem .7rem;font-size:.8rem;color:var(--text-muted)">${app}</td>
            <td style="padding:.4rem .7rem;font-size:.8rem">${ctrl}</td>
            <td style="padding:.4rem .7rem">${badge}</td>
          </tr>`;
      });
    });
  });

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:640px">
      <div class="modal-header">
        <h3>ICT Risk Score Calculation</h3>
        <button class="modal-close" id="risk-matrix-modal-close">✕</button>
      </div>
      <p class="modal-desc">Scores are automatically calculated from the Residual Risk Rating, Risk Appetite Status, and Control Effectiveness selected in the assessment form. The target is the score achievable at the same Residual Risk Rating when appetite is Within Appetite and controls are Effective.</p>
      <div style="overflow-x:auto">
        <table class="risk-profile-table">
          <thead>
            <tr>
              <th>Residual Risk</th>
              <th>Appetite Status</th>
              <th>Control Effectiveness</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#risk-matrix-modal-close').addEventListener('click', () => overlay.remove());
}
