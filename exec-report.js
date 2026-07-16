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
    <div class="exec-sec-div">ICT Maturity — Continuous Improvement Cycle</div>
    ${dimCards}
    <div class="exec-sec-div">Current Risk Profile</div>
    <div class="exec-rcsa-wrap">${renderRiskMgmtSummaryCard(currentA)}</div>
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
      <div class="exec-split">
        <div class="exec-half">
          <div class="exec-half-lbl">Current — ${currentA.label}</div>
          ${execBars(currentA, measure, prevA)}
          ${execNarrative(prevA, currentA, measure, 'achieved')}
        </div>
        <div class="exec-split-div"></div>
        <div class="exec-half">
          <div class="exec-half-lbl">Planned — ${plannedA.label}</div>
          ${execBars(plannedA, measure, currentA)}
          ${execNarrative(currentA, plannedA, measure, 'planned')}
        </div>
      </div>
    </div>`;
}

// ── Bar chart with 3.0 goal line ──────────────────────────────
function execBars(assessment, measure, compareA) {
  const GOAL    = 3;
  const goalPct = (GOAL / 5) * 100; // 60%

  const rows = CONFIG.capabilities.map(cap => {
    const s  = getMeasureScore(assessment, cap.id, measure.id) || 0;
    const ps = compareA ? getMeasureScore(compareA, cap.id, measure.id) || 0 : 0;
    const lv = levelForScore(s);
    const w  = (s / 5) * 100;
    const at = s > 0 && s >= GOAL;
    const dd = compareA && s > 0 && ps > 0 ? s - ps : null;
    const dh = dd !== null
      ? `<span class="delta ${dd > 0 ? 'delta-up' : dd < 0 ? 'delta-down' : 'delta-flat'}">${dd > 0 ? '▲' : dd < 0 ? '▼' : '●'}${Math.abs(dd) > 0 ? Math.abs(dd) : ''}</span>`
      : `<span class="delta delta-flat">●</span>`;
    return `
      <div class="exec-bar-row">
        <span class="exec-bar-lbl" title="${cap.name}">${shortName(cap.name)}</span>
        <div class="exec-bar-track">
          <div class="exec-bar-fill" style="width:${w}%;background:${lv ? lv.color : 'var(--clr-fill-dark)'}"></div>
          <div class="exec-goal-line" style="left:${goalPct}%"></div>
        </div>
        <span class="exec-bar-sc${at ? ' exec-at-goal' : ''}">${s > 0 ? s : '—'}</span>
        <span class="exec-bar-d">${dh}</span>
      </div>`;
  }).join('');

  return `
    <div class="exec-bars">
      <div class="exec-bar-row exec-bar-hdr">
        <span class="exec-bar-lbl"></span>
        <div class="exec-bar-track exec-bar-track-hdr">
          <span class="exec-goal-lbl" style="left:${goalPct}%">▾ TGT 3</span>
        </div>
        <span class="exec-bar-sc" style="color:var(--text-muted);font-size:.65rem;font-weight:normal">SC</span>
        <span class="exec-bar-d"  style="color:var(--text-muted);font-size:.65rem">Δ</span>
      </div>
      ${rows}
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
