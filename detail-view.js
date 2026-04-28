// ── Detail View ───────────────────────────────────────────────
function viewAssessment(id) {
  currentDetailId = id;
  const a = db.assessments.find(x => x.id === id);
  if (!a) return;
  document.getElementById("detail-title").textContent = `${a.label} — ${formatDate(a.date)}`;

  const content = document.getElementById("detail-content");
  const maturityIds = ['governance', 'risk', 'reporting'];

  // ── Local helpers ────────────────────────────────────────────
  function filledBadge(score, fsz, pad) {
    const lv = levelForScore(score);
    const bg = (score > 0 && lv) ? lv.color : 'var(--clr-badge-empty)';
    const label = (score > 0 && lv) ? `${score} · ${lv.name}` : '—';
    return `<span style="background:${bg};color:#fff;font-family:var(--font-mono);font-size:${fsz || '0.72rem'};padding:${pad || '0.15rem 0.45rem'};border-radius:4px;white-space:nowrap">${label}</span>`;
  }

  function outlinedBadge(score, fsz, pad) {
    const lv = levelForScore(score);
    const clr = (score > 0 && lv) ? lv.color : 'var(--clr-fill-muted)';
    const label = (score > 0 && lv) ? `${score} · ${lv.name}` : '—';
    return `<span style="border:1.5px solid ${clr};color:${clr};background:transparent;font-family:var(--font-mono);font-size:${fsz || '0.72rem'};padding:${pad || '0.15rem 0.45rem'};border-radius:4px;white-space:nowrap">${label}</span>`;
  }

  function filledAvgBadge(avg, fsz, pad) {
    const lv = levelForScore(avg);
    const bg = (avg > 0 && lv) ? lv.color : 'var(--clr-badge-empty)';
    const label = avg > 0 ? `${avg.toFixed(1)} · ${lv ? lv.name : '—'}` : '—';
    return `<span style="background:${bg};color:#fff;font-family:var(--font-mono);font-size:${fsz || '0.72rem'};padding:${pad || '0.15rem 0.45rem'};border-radius:4px;white-space:nowrap">${label}</span>`;
  }

  function outlinedAvgBadge(avg, fsz, pad) {
    const lv = levelForScore(avg);
    const clr = (avg > 0 && lv) ? lv.color : 'var(--clr-fill-muted)';
    const label = avg > 0 ? `${avg.toFixed(1)} · ${lv ? lv.name : '—'}` : '—';
    return `<span style="border:1.5px solid ${clr};color:${clr};background:transparent;font-family:var(--font-mono);font-size:${fsz || '0.72rem'};padding:${pad || '0.15rem 0.45rem'};border-radius:4px;white-space:nowrap">${label}</span>`;
  }

  function residualAbbr(rating) {
    const map = {
      'Extreme (28 to 40)':     { abbr: 'EXT', bg: '#a05a57' },
      'Significant (20 to 24)': { abbr: 'SIG', bg: '#a07848' },
      'Moderate (12 to 16)':    { abbr: 'MOD', bg: '#8f8a42' },
      'Low (4 to 10)':          { abbr: 'LOW', bg: '#4e8a6a' },
    };
    const m = map[rating];
    if (!m) return `<span style="color:var(--text-muted)">—</span>`;
    return `<span style="background:${m.bg};color:#fff;font-family:var(--font-mono);font-size:0.72rem;padding:0.15rem 0.4rem;border-radius:4px">${m.abbr}</span>`;
  }

  function residualFull(rating) {
    const map = {
      'Extreme (28 to 40)':     '#a05a57',
      'Significant (20 to 24)': '#a07848',
      'Moderate (12 to 16)':    '#8f8a42',
      'Low (4 to 10)':          '#4e8a6a',
    };
    if (!rating) return `<span style="color:var(--text-muted)">—</span>`;
    const bg = map[rating] || '#666';
    return `<span style="background:${bg};color:#fff;font-family:var(--font-mono);font-size:0.72rem;padding:0.18rem 0.55rem;border-radius:4px;white-space:nowrap">${rating}</span>`;
  }

  function openRisksColor(n) {
    if (n >= 10) return 'var(--clr-danger)';
    if (n >= 5)  return 'var(--clr-warning)';
    if (n > 0)   return 'var(--text)';
    return 'var(--clr-success)';
  }

  function controlsDisplay(na, pa, ef) {
    if (!na && !pa && !ef) return `<span style="color:var(--text-muted)">—</span>`;
    return `<span style="display:inline-flex;gap:0.5rem;align-items:center;font-family:var(--font-mono);font-size:0.75rem">` +
      `<span style="color:var(--clr-danger)">○${na}</span>` +
      `<span style="color:var(--clr-warning)">◑${pa}</span>` +
      `<span style="color:var(--clr-success)">✓${ef}</span>` +
      `</span>`;
  }

  const thStyle = `font-family:var(--font-mono);font-size:0.62rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);padding:0.3rem 0.5rem;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap`;

  // ── Overall average ──────────────────────────────────────────
  const overall  = overallAvg(a);
  const overallLv = levelForScore(overall);
  const overallBg = overallLv ? overallLv.color : 'var(--clr-badge-empty)';
  const overallLabel = overall > 0
    ? `${overall.toFixed(1)} / 5 · ${overallLv ? overallLv.name : '—'}`
    : '— / 5';

  // ── SECTION 1: Assessment Header Card ───────────────────────
  const headerCard = `
    <div class="detail-header-card">
      <div>
        <div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:700">${a.label}</div>
        <div style="color:var(--text-muted);font-size:0.85rem">${formatDate(a.date)}</div>
        ${a.notes ? `<p style="font-size:0.85rem;font-style:italic;color:var(--text);margin-top:0.35rem">${a.notes}</p>` : ''}
      </div>
      <span class="detail-overall-badge" style="background:${overallBg}">${overallLabel}</span>
    </div>`;

  // ── SECTION 2: Maturity Radar (full width) ───────────────────
  const radarCard = `
    <div class="card radar-card" style="margin-bottom:1.25rem">
      <canvas id="detail-radar-canvas" width="520" height="520"
        style="max-width:520px;margin:0 auto;width:100%;display:block"></canvas>
    </div>`;

  // ── SECTION 2B — Card A: Maturity Snapshot ───────────────────
  const snapshotRows = CONFIG.capabilities.map(cap => {
    const avg = capAvgScore(a, cap.id);
    const tVals = maturityIds.map(mid => getMeasureTarget(a, cap.id, mid)).filter(v => v > 0);
    const tAvg  = tVals.length ? tVals.reduce((x, y) => x + y, 0) / tVals.length : 0;
    const gap   = tAvg > 0 ? tAvg - avg : 0;
    const status = (avg > 0 && tAvg > 0 && avg >= tAvg)
      ? `<span style="color:var(--clr-success);font-family:var(--font-mono);font-size:0.75rem">✓</span>`
      : (gap > 0
        ? `<span style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.75rem">↑${gap.toFixed(1)}</span>`
        : `<span style="color:var(--text-muted)">—</span>`);
    return `<tr>
      <td style="font-weight:600;font-size:0.82rem;min-width:120px;padding:0.3rem 0.4rem;vertical-align:middle">${shortName(cap.name)}</td>
      <td style="padding:0.3rem 0.4rem;vertical-align:middle">${filledAvgBadge(avg)}</td>
      <td style="padding:0.3rem 0.4rem;vertical-align:middle">${outlinedAvgBadge(tAvg)}</td>
      <td style="padding:0.3rem 0.4rem;vertical-align:middle">${status}</td>
    </tr>`;
  }).join('');

  const overallBadgeLarge = `<span style="background:${overallBg};color:#fff;font-family:var(--font-mono);font-size:1rem;font-weight:700;padding:0.5rem 1rem;border-radius:8px;white-space:nowrap">${overallLabel}</span>`;

  const maturitySnapshot = `
    <div class="card" style="margin-bottom:0">
      <div class="card-title" style="margin-bottom:0.25rem">MATURITY SNAPSHOT</div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:1rem">Average score across Governance, Risk &amp; Reporting</div>
      <table style="width:100%;border-collapse:collapse">
        <tbody>${snapshotRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="border-top:1px solid var(--border);padding-top:0.5rem;padding-left:0.4rem;font-size:0.75rem;color:var(--text-muted)">Overall Average</td>
            <td colspan="2" style="border-top:1px solid var(--border);padding-top:0.5rem;padding-right:0.4rem;text-align:right">${overallBadgeLarge}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;

  // ── SECTION 2B — Card B: Risk Management Snapshot ────────────
  const allRm = CONFIG.capabilities.map(cap => ({ cap, rm: getRiskManagement(a, cap.id) }));
  const hasRiskData = allRm.some(({ rm }) =>
    rm.residualRating ||
    (rm.openRisks || 0) > 0 ||
    (rm.controlsNotAssessed || 0) > 0 ||
    (rm.controlsPartial || 0) > 0 ||
    (rm.controlsEffective || 0) > 0
  );
  const totalOpenRisks  = allRm.reduce((s, { rm }) => s + (rm.openRisks || 0), 0);
  const totalNotAssessed = allRm.reduce((s, { rm }) => s + (rm.controlsNotAssessed || 0), 0);
  const totalPartial    = allRm.reduce((s, { rm }) => s + (rm.controlsPartial || 0), 0);
  const totalEffective  = allRm.reduce((s, { rm }) => s + (rm.controlsEffective || 0), 0);

  const riskSnapshotContent = !hasRiskData
    ? `<p style="color:var(--text-muted);font-style:italic;font-size:0.82rem">No risk management data recorded for this assessment.</p>`
    : (() => {
        function statBox(val, lbl, color) {
          return `<div class="detail-stat-box">
            <span class="detail-stat-value" style="color:${color}">${val}</span>
            <span class="detail-stat-label">${lbl}</span>
          </div>`;
        }

        const statBoxes = `<div class="detail-stat-row">
          ${statBox(totalOpenRisks,   'Open Risks',   openRisksColor(totalOpenRisks))}
          ${statBox(totalNotAssessed, 'Not Assessed',  totalNotAssessed > 0 ? 'var(--clr-danger)'  : 'var(--clr-success)')}
          ${statBox(totalPartial,     'Partial',       totalPartial    > 0 ? 'var(--clr-warning)' : 'var(--clr-success)')}
          ${statBox(totalEffective,   'Effective',     'var(--clr-success)')}
        </div>`;

        const riskCapRows = allRm
          .filter(({ rm }) =>
            rm.residualRating ||
            (rm.openRisks || 0) > 0 ||
            (rm.controlsNotAssessed || 0) > 0 ||
            (rm.controlsPartial || 0) > 0 ||
            (rm.controlsEffective || 0) > 0
          )
          .map(({ cap, rm }) => {
            const na = rm.controlsNotAssessed || 0;
            const pa = rm.controlsPartial     || 0;
            const ef = rm.controlsEffective   || 0;
            const or = rm.openRisks || 0;
            const openHtml = or > 0
              ? `<span style="font-family:var(--font-mono);font-size:0.82rem;color:${openRisksColor(or)}">${or}</span>`
              : `<span style="color:var(--text-muted)">—</span>`;
            const notes = rm.riskMgmtNotes || getMeasureNote(a, cap.id, 'riskManagement') || '';
            const notesHtml = notes
              ? `<span style="font-size:0.75rem;color:var(--text-muted);font-style:italic;max-width:200px;display:inline-block">${notes}</span>`
              : `<span style="color:var(--text-muted)">—</span>`;
            return `<tr>
              <td style="font-size:0.82rem;font-weight:600;padding:0.35rem 0.5rem;vertical-align:middle">${shortName(cap.name)}</td>
              <td style="padding:0.35rem 0.5rem;vertical-align:middle">${residualAbbr(rm.residualRating)}</td>
              <td style="padding:0.35rem 0.5rem;vertical-align:middle">${openHtml}</td>
              <td style="padding:0.35rem 0.5rem;vertical-align:middle">${controlsDisplay(na, pa, ef)}</td>
              <td style="padding:0.35rem 0.5rem;vertical-align:middle">${notesHtml}</td>
            </tr>`;
          }).join('');

        const footerTally = `<span style="display:inline-flex;gap:0.5rem;align-items:center;font-family:var(--font-mono);font-size:0.75rem">` +
          `<span style="color:var(--clr-danger)">○${totalNotAssessed}</span>` +
          `<span style="color:var(--clr-warning)">◑${totalPartial}</span>` +
          `<span style="color:var(--clr-success)">✓${totalEffective}</span>` +
          `<span style="color:var(--text-muted)">· ${totalOpenRisks} open</span>` +
          `</span>`;

        return `${statBoxes}
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>
              <th style="${thStyle}">Capability</th>
              <th style="${thStyle}">Residual</th>
              <th style="${thStyle}">Open</th>
              <th style="${thStyle}">Controls</th>
              <th style="${thStyle}">Notes</th>
            </tr></thead>
            <tbody>${riskCapRows}</tbody>
            <tfoot><tr>
              <td colspan="3" style="border-top:1px solid var(--border);padding-top:0.5rem;font-size:0.72rem;color:var(--text-muted)">${a.label} · ${formatDate(a.date)}</td>
              <td colspan="2" style="border-top:1px solid var(--border);padding-top:0.5rem;text-align:right">${footerTally}</td>
            </tr></tfoot>
          </table>`;
      })();

  const riskSnapshot = `
    <div class="card" style="margin-bottom:0">
      <div class="card-title" style="margin-bottom:0.25rem">ICT RISK MANAGEMENT SNAPSHOT</div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:1rem">Open risks and control effectiveness across all capabilities</div>
      ${riskSnapshotContent}
    </div>`;

  const snapshotGrid = `<div class="detail-snapshot-grid">${maturitySnapshot}${riskSnapshot}</div>`;

  // ── SECTION 3: Capability Cards (2 per row) ──────────────────
  const capCards = CONFIG.capabilities.map(cap => {
    const capAvg  = capAvgScore(a, cap.id);
    const capNote = a.capNotes ? (a.capNotes[cap.id] || '') : '';

    // Part A — three measure columns
    const measureCols = CONFIG.measures.map(m => {
      const score  = getMeasureScore(a, cap.id, m.id);
      const target = getMeasureTarget(a, cap.id, m.id);
      const note   = getMeasureNote(a, cap.id, m.id) || '';
      const truncNote = note.length > 120 ? note.slice(0, 120) + '...' : note;
      return `<div class="detail-measure-col">
        <div class="detail-measure-col-header">
          <span>${m.icon}</span><span>${m.name}</span>
        </div>
        <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.35rem">
          ${filledBadge(score)}
          ${target > 0 ? `<span style="color:var(--text-muted)">→</span>${outlinedBadge(target)}` : ''}
        </div>
        ${truncNote ? `<div style="font-size:0.75rem;color:var(--text-muted);font-style:italic;line-height:1.4">${truncNote}</div>` : ''}
      </div>`;
    }).join('');

    // Part B — exit conditions and time estimates
    const exitRows = CONFIG.measures.map(m => {
      const score = getMeasureScore(a, cap.id, m.id);
      const mDef  = CONFIG.measures.find(md => md.id === m.id);
      const exit  = mDef ? (mDef.levels.find(l => l.level === score)?.exit || '') : '';
      const timeEst = getTimeEstimate(a, cap.id, m.id);
      const shortLabels = { governance: 'GOVERNANCE', risk: 'RISK', reporting: 'REPORTING' };

      let condHtml;
      if (score === 5) {
        condHtml = `<div style="font-size:0.78rem;color:var(--clr-success)">✓ Target state reached.</div>`;
      } else if (!score || !exit) {
        condHtml = `<div style="font-size:0.78rem;color:var(--text-muted)">— Not yet scored.</div>`;
      } else {
        condHtml = `<span class="detail-exit-sublabel">TO REACH LEVEL ${score + 1}:</span>
          <div style="font-size:0.78rem;color:var(--text);font-style:italic;line-height:1.5">${exit}</div>`;
      }

      const timeHtml = timeEst
        ? `<div style="font-size:0.78rem;color:var(--accent);font-family:var(--font-mono)">${timeEst}</div>`
        : `<span style="font-size:0.78rem;color:var(--text-muted)">—</span>`;

      return `<div class="detail-exit-row">
        <div class="detail-exit-measure-name">${shortLabels[m.id] || m.id.toUpperCase()}</div>
        <div class="detail-exit-condition">${condHtml}</div>
        <div class="detail-exit-time">
          <span class="detail-exit-sublabel">EST. TIME:</span>
          ${timeHtml}
        </div>
      </div>`;
    }).join('');

    return `<div class="detail-capability-card">
      <div class="detail-cap-header">
        <div style="font-weight:700;font-size:0.95rem">${cap.name}</div>
        ${filledAvgBadge(capAvg, '0.78rem', '0.2rem 0.6rem')}
      </div>
      ${capNote ? `<p style="font-style:italic;font-size:0.82rem;color:var(--text-muted);margin-bottom:0.75rem">${capNote}</p>` : ''}
      <div class="detail-measures-grid">${measureCols}</div>
      <div class="detail-exit-section">${exitRows}</div>
    </div>`;
  }).join('');

  const capsGrid = `<div class="detail-caps-grid">${capCards}</div>`;

  // ── SECTION 4: ICT Risk Management Full Table ────────────────
  const hasAnyResidual = CONFIG.capabilities.some(cap => getRiskManagement(a, cap.id).residualRating);

  const fullRiskTable = !hasAnyResidual ? '' : (() => {
    const thFull = `font-family:var(--font-mono);font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);padding:0.45rem 0.7rem;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap`;
    const rows = CONFIG.capabilities.map(cap => {
      const rm = getRiskManagement(a, cap.id);
      const na = rm.controlsNotAssessed || 0;
      const pa = rm.controlsPartial     || 0;
      const ef = rm.controlsEffective   || 0;
      const or = rm.openRisks || 0;
      const openHtml = or > 0
        ? `<span style="font-family:var(--font-mono);font-size:0.82rem;color:${openRisksColor(or)}">${or}</span>`
        : `<span style="color:var(--text-muted)">—</span>`;
      const notes = rm.riskMgmtNotes || getMeasureNote(a, cap.id, 'riskManagement') || '';
      const notesHtml = notes
        ? `<span style="font-size:0.75rem;color:var(--text-muted);font-style:italic;max-width:260px;display:inline-block">${notes}</span>`
        : `<span style="color:var(--text-muted)">—</span>`;
      return `<tr>
        <td style="font-size:0.82rem;padding:0.5rem 0.7rem;vertical-align:middle">${cap.name}</td>
        <td style="padding:0.5rem 0.7rem;vertical-align:middle">${residualFull(rm.residualRating)}</td>
        <td style="padding:0.5rem 0.7rem;vertical-align:middle">${residualFull(rm.appetiteRating)}</td>
        <td style="padding:0.5rem 0.7rem;vertical-align:middle">${openHtml}</td>
        <td style="padding:0.5rem 0.7rem;vertical-align:middle">${controlsDisplay(na, pa, ef)}</td>
        <td style="padding:0.5rem 0.7rem;vertical-align:middle">${notesHtml}</td>
      </tr>`;
    }).join('');
    return `<div class="card">
      <div class="card-title" style="margin-bottom:0.25rem">ICT Risk Management Profile</div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:1rem">Residual risk and control data from Riskonnect RCSA &amp; CSA cycle</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
          <thead><tr>
            <th style="${thFull}">Capability</th>
            <th style="${thFull}">Residual Risk</th>
            <th style="${thFull}">Appetite</th>
            <th style="${thFull}">Open Risks</th>
            <th style="${thFull}">Controls</th>
            <th style="${thFull}">Notes</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  })();

  content.innerHTML = headerCard + radarCard + snapshotGrid + capsGrid + fullRiskTable;

  showView("detail");
  setTimeout(() => renderRadar("detail-radar-canvas", a), 60);
}

function deleteCurrentAssessment() {
  if (!currentDetailId) return;
  if (!confirm("Delete this assessment? This cannot be undone.")) return;
  db.assessments = db.assessments.filter(a => a.id !== currentDetailId);
  saveToLocalStorage();
  currentDetailId = null;
  showView("dashboard");
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

      if (m.id === 'ict_risk') {
        const rp = source.riskProfile?.[cap.id];
        const legacyRaw = source.measureScores?.[cap.id]?.['ict_risk'];
        const legacy = (!rp && legacyRaw && typeof legacyRaw === 'object') ? legacyRaw : null;
        const effectiveRp = rp || (legacy ? {
          residualRating: legacy.residualRating || '',
          appetiteRating: legacy.appetiteRating || '',
          timeEstimate: ''
        } : null);

        if (effectiveRp) {
          setRiskRatingBtns(cap.id, 'residual', effectiveRp.residualRating || '');
          setRiskRatingBtns(cap.id, 'appetite', effectiveRp.appetiteRating || '');
          const timeEl = document.getElementById(`timeest-${cap.id}`);
          if (timeEl) timeEl.value = effectiveRp.timeEstimate || '';
        } else {
          clearRiskRatingBtns(cap.id, 'residual');
          clearRiskRatingBtns(cap.id, 'appetite');
        }
      }
    });
  });

  updateDimensionVisibility();
  showView("assessment");
}
