// ── Executive Report ──────────────────────────────────────────

function showExecReportModal() {
  if (db.assessments.length < 2) {
    alert('You need at least 2 assessments to generate a report.');
    return;
  }
  const opts = db.assessments.map(a =>
    `<option value="${a.id}">${a.label} · ${formatDate(a.date)}</option>`
  ).join('');
  ['exec-prev-sel', 'exec-curr-sel', 'exec-plan-sel'].forEach(id => {
    document.getElementById(id).innerHTML = opts;
  });
  const n = db.assessments.length;
  document.getElementById('exec-prev-sel').value = db.assessments[Math.max(0, n - 3)].id;
  document.getElementById('exec-curr-sel').value = db.assessments[Math.max(0, n - 2)].id;
  document.getElementById('exec-plan-sel').value = db.assessments[n - 1].id;
  document.getElementById('exec-report-modal').style.display = 'flex';
}

function closeExecReportModal() {
  document.getElementById('exec-report-modal').style.display = 'none';
}

function generateExecReport() {
  const prevA    = db.assessments.find(a => a.id === document.getElementById('exec-prev-sel').value);
  const currentA = db.assessments.find(a => a.id === document.getElementById('exec-curr-sel').value);
  const plannedA = db.assessments.find(a => a.id === document.getElementById('exec-plan-sel').value);
  if (!prevA || !currentA || !plannedA) return;
  closeExecReportModal();

  const dimCards = CONFIG.measures.map(m =>
    execDimCard(m, prevA, currentA, plannedA)
  ).join('');

  document.getElementById('exec-report-content').innerHTML = `
    <div class="exec-report-top no-print">
      <div>
        <h2 class="exec-report-title">ICT Executive Risk Oversight Report</h2>
        <p class="exec-report-sub">${currentA.label} · ${formatDate(currentA.date)}</p>
      </div>
      <button class="btn btn-outline" onclick="window.print()">🖨 Print / Save PDF</button>
    </div>
    <div class="exec-report-top print-only" style="display:none">
      <h2 class="exec-report-title">ICT Executive Risk Oversight Report</h2>
      <p class="exec-report-sub">${currentA.label} · ${formatDate(currentA.date)}</p>
    </div>
    ${execSummaryPanel(prevA, currentA)}
    <div class="exec-sec-div">ICT Maturity — Continuous Improvement Cycle</div>
    ${dimCards}
    <div class="exec-sec-div">Current Risk Profile</div>
    <div class="exec-rcsa-wrap">${renderRiskMgmtSummaryCard(currentA, prevA)}</div>
  `;
  showView('exec-report');
}

// ── Dimension card ────────────────────────────────────────────
function execDimCard(measure, prevA, currentA, plannedA) {
  function dimAvg(a) {
    const vals = CONFIG.capabilities
      .map(c => getMeasureScore(a, c.id, measure.id))
      .filter(s => s > 0);
    return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0;
  }
  const cAvg = dimAvg(currentA);
  const pAvg = dimAvg(prevA);
  const lv   = levelForScore(cAvg);
  const d    = pAvg > 0 && cAvg > 0 ? cAvg - pAvg : null;
  const badge = pAvg > 0 && cAvg > 0
    ? `${pAvg.toFixed(1)} → ${cAvg.toFixed(1)}${d !== null && d !== 0 ? (d > 0 ? ' ▲' : ' ▼') : ''}`
    : cAvg > 0 ? cAvg.toFixed(1) : '—';

  const narr1 = execNarrative(prevA, currentA, measure, 'achieved');
  const narr2 = execNarrative(currentA, plannedA, measure, 'planned');
  const narrHtml = (narr1 || narr2)
    ? `<div class="exec-narr-row">${narr1}${narr2}</div>`
    : '';

  return `
    <div class="card exec-dim-card">
      <div class="exec-card-hdr">
        <span class="measure-icon">${measure.icon}</span>
        <div style="flex:1;min-width:0">
          <h3 class="measure-card-title">${measure.name}</h3>
          <p class="measure-card-desc">${measure.description}</p>
        </div>
        <span class="measure-avg-badge" style="background:${lv ? lv.color : 'var(--clr-badge-empty)'}">
          ${badge}
        </span>
      </div>
      ${execBarsCombo(currentA, plannedA, measure, prevA)}
      ${narrHtml}
    </div>`;
}

// ── Merged bar chart: solid current + striped planned extension ─
function execBarsCombo(currentA, plannedA, measure, prevA) {
  // 5 tick lines at 20%, 40%, 60%, 80%, 100%
  const levelLines = [1, 2, 3, 4, 5].map(l =>
    `<div class="exec-goal-line" style="left:${l * 20}%"></div>`
  ).join('');

  // Header labels — full names, uppercase
  const levelHdrLabels = [1, 2, 3, 4, 5].map(l => {
    const ls = measure.levels ? measure.levels.find(ls => ls.level === l) : null;
    const name = ls?.name ? ls.name.toUpperCase() : String(l);
    // Last label right-anchors to avoid overflow beyond track edge
    const style = l === 5
      ? 'right:0;transform:none'
      : `left:${l * 20}%;transform:translateX(-50%)`;
    return `<span class="exec-goal-lbl" style="${style}">${name}</span>`;
  }).join('');

  const rows = CONFIG.capabilities.map(cap => {
    const curr   = getMeasureScore(currentA, cap.id, measure.id) || 0;
    const plan   = getMeasureScore(plannedA, cap.id, measure.id) || 0;
    const lvCurr = levelForScore(curr);
    const lvPlan = levelForScore(plan);
    const currW  = (curr / 5) * 100;
    const planW  = (plan / 5) * 100;
    const extW   = Math.max(0, planW - currW);
    const planColor = lvPlan ? lvPlan.color : 'var(--clr-fill-dark)';
    const at = curr > 0 && curr >= 3;

    const planExt = extW > 0
      ? `<div class="exec-bar-plan-ext" style="left:${currW}%;width:${extW}%;--plan-color:${planColor}"></div>`
      : '';

    return `
      <div class="exec-bar-row">
        <span class="exec-bar-lbl" title="${cap.name}">${shortName(cap.name)}</span>
        <div class="exec-bar-track">
          <div class="exec-bar-fill" style="width:${currW}%;background:${lvCurr ? lvCurr.color : 'var(--clr-fill-dark)'}"></div>
          ${planExt}
          ${levelLines}
        </div>
        <span class="exec-bar-sc${at ? ' exec-at-goal' : ''}">${curr > 0 ? curr : '—'}</span>
        <span class="exec-bar-tgt">${plan > 0 ? plan : '—'}</span>
      </div>`;
  }).join('');

  return `
    <div class="exec-bars">
      <div class="exec-bar-row exec-bar-hdr">
        <span class="exec-bar-lbl"></span>
        <div class="exec-bar-track exec-bar-track-hdr">
          ${levelHdrLabels}
        </div>
        <span class="exec-bar-sc" style="color:var(--text-muted);font-size:.65rem;font-weight:normal">SC</span>
        <span class="exec-bar-tgt" style="color:var(--text-muted);font-size:.65rem;font-weight:normal">TGT</span>
      </div>
      ${rows}
    </div>`;
}

// ── Executive Summary Panel ───────────────────────────────────
function execSummaryPanel(prevA, currentA) {
  const shortLabel = { governance: 'Governance', risk: 'Risk Management', reporting: 'Reporting' };

  // KPI tile per dimension
  const tiles = CONFIG.measures.map(m => {
    const vals = c => CONFIG.capabilities.map(cap => getMeasureScore(c, cap.id, m.id)).filter(s => s > 0);
    const cVals = vals(currentA); const pVals = vals(prevA);
    const cAvg = cVals.length ? cVals.reduce((a,b) => a+b,0) / cVals.length : 0;
    const pAvg = pVals.length ? pVals.reduce((a,b) => a+b,0) / pVals.length : 0;
    const lv   = levelForScore(cAvg);
    const d    = pAvg > 0 && cAvg > 0 ? cAvg - pAvg : null;
    const val  = pAvg > 0 && cAvg > 0
      ? `${pAvg.toFixed(1)} → ${cAvg.toFixed(1)}${d !== null && d !== 0 ? (d > 0 ? ' ▲' : ' ▼') : ''}`
      : cAvg > 0 ? cAvg.toFixed(1) : '—';
    const color = lv ? lv.color : 'var(--clr-badge-empty)';
    return `
      <div class="exec-kpi-tile">
        <span class="exec-kpi-icon">${m.icon}</span>
        <span class="exec-kpi-label">${shortLabel[m.id] || m.name}</span>
        <span class="exec-kpi-value" style="color:${color}">${val}</span>
      </div>`;
  }).join('');

  // Risk Profile tile
  const riskKeys = Object.keys(CONFIG.riskScoreMatrix || {});
  function getAbbrev(v) {
    if (!v) return null;
    if (v.startsWith('Extreme'))     return 'EXT';
    if (v.startsWith('Significant')) return 'SIG';
    if (v.startsWith('Moderate'))    return 'MOD';
    return 'LOW';
  }
  let extC = 0, sigC = 0, othC = 0;
  CONFIG.capabilities.forEach(cap => {
    const rm = getRiskManagement(currentA, cap.id);
    if (rm.risksAssessed > 0 && rm.residualRating) {
      const a = getAbbrev(rm.residualRating);
      if (a === 'EXT') extC++;
      else if (a === 'SIG') sigC++;
      else othC++;
    }
  });
  const totalAssessed = extC + sigC + othC;
  const riskVal  = totalAssessed === 0 ? 'Not assessed'
    : [extC > 0 ? `${extC} Extreme` : '', sigC > 0 ? `${sigC} Significant` : '', othC > 0 ? `${othC} other` : '']
        .filter(Boolean).join(' · ');
  const riskColor = extC > 0 ? (CONFIG.levels[0]?.color || 'var(--clr-danger)')
    : sigC > 0 ? (CONFIG.levels[1]?.color || 'var(--clr-warning)')
    : totalAssessed > 0 ? 'var(--clr-success)' : 'var(--clr-badge-empty)';
  const riskTile = `
    <div class="exec-kpi-tile">
      <span class="exec-kpi-icon">🛡️</span>
      <span class="exec-kpi-label">Risk Profile</span>
      <span class="exec-kpi-value" style="color:${riskColor}">${riskVal}</span>
    </div>`;

  // Notes block
  const notesHtml = currentA.notes
    ? `<div class="exec-notes-block"><div class="exec-notes-lbl">Assessment Notes</div>${currentA.notes}</div>`
    : '';

  return `
    <div class="exec-summary-panel">
      <div class="exec-kpi-row">${tiles}${riskTile}</div>
      ${notesHtml}
    </div>`;
}

// ── Narrative — grouped by level transition ───────────────────
function execNarrative(fromA, toA, measure, type) {
  const groups = {};
  CONFIG.capabilities.forEach(cap => {
    const f = getMeasureScore(fromA, cap.id, measure.id) || 0;
    const t = getMeasureScore(toA,   cap.id, measure.id) || 0;
    if (t > f && f > 0 && t > 0) {
      const key = `${f}->${t}`;
      if (!groups[key]) {
        const lvDef = (measure.levels || []).find(l => l.level === f);
        groups[key] = { f, t, caps: [], exit: lvDef ? lvDef.exit : '' };
      }
      groups[key].caps.push(cap);
    }
  });

  const keys = Object.keys(groups);
  if (!keys.length) return '';

  const title = type === 'achieved' ? 'What we achieved' : 'What we plan';
  const items = keys.sort().map(key => {
    const g = groups[key];
    const n = g.caps.length;
    const names = g.caps.map(c => shortName(c.name)).join(' · ');
    return `
      <div class="exec-narr-group">
        <div class="exec-narr-heading">
          <strong>${n} ${n === 1 ? 'capability' : 'capabilities'}</strong>
          progressed Level ${g.f} → ${g.t}
        </div>
        <div class="exec-narr-caps">${names}</div>
        ${g.exit ? `<div class="exec-narr-exit">${g.exit}</div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="exec-narr exec-narr-${type}">
      <div class="exec-narr-title">${title}</div>
      ${items}
    </div>`;
}
