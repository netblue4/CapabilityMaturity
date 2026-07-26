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
  document.getElementById('exec-prev-sel').value = db.assessments[Math.max(0, n - 2)].id;
  document.getElementById('exec-curr-sel').value = db.assessments[n - 1].id;
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
        <h2 class="exec-report-title">Policy vs Operational Compliance</h2>
        <p class="exec-report-sub">${currentA.label} · ${formatDate(currentA.date)}</p>
      </div>
      <button class="btn btn-outline" onclick="window.print()">🖨 Print / Save PDF</button>
    </div>
    <div class="exec-report-top print-only" style="display:none">
      <h2 class="exec-report-title">Policy vs Operational Compliance</h2>
      <p class="exec-report-sub">${currentA.label} · ${formatDate(currentA.date)}</p>
    </div>
    ${execComplianceSummary(currentA)}
    <div class="exec-sec-div">Policy Layer — Governance Maturity</div>
    ${dimCards}
    <div class="exec-sec-div">Operational Layer — Risk Management — Portfolio Health</div>
    <div class="exec-rcsa-wrap">${renderRiskPortfolioCard(currentA)}</div>
    <div class="exec-sec-div">Operational Layer — Policy Operationalisation Coverage</div>
    <div class="exec-rcsa-wrap">${renderOpCoverageCard(currentA)}</div>
    <div class="exec-sec-div">Supporting Detail — RCSA &amp; CSA Metrics</div>
    <div class="exec-rcsa-wrap">${renderRiskMgmtSummaryCard(currentA, prevA, 'exec')}</div>
  `;
  showView('exec-report');
}

// ── Policy vs Operational Compliance summary ──────────────────
// Two-layer split: policies written & approved (policy compliance) vs.
// policies actually operationalised (operational compliance), with the
// confidence behind the operational claim.
function execComplianceSummary(a) {
  const ks = buildKpiSummary(a.policyRows || [], a.riskPolicyFacts || []);
  const rp = buildRiskPortfolioSummary(a.riskPolicyFacts || []);
  const oc = buildOperationalisationCoverage(a.riskPolicyFacts || []);
  const polRows = a.policyRows || [];
  const locCount = polRows.filter(r => isLocPolType(r.type)).length;
  const grpCount = polRows.filter(r => isGrpStdType(r.type)).length;

  const pct  = (n, d) => (d > 0 ? Math.round(100 * n / d) : 0);
  const metric = (val, lbl) => `<div class="pvo-metric"><span class="pvo-val">${val}</span><span class="pvo-lbl">${lbl}</span></div>`;

  // Policy layer
  const locCov    = ks.locPolCoverage || { covered: 0, total: 0 };
  const grpCov    = ks.grpStdCoverage || { covered: 0, total: 0 };
  const locCovPct = pct(locCov.covered, locCov.total);
  const grpCovPct = pct(grpCov.covered, grpCov.total);
  const locPct    = ks.grpStdLocalisation ? pct(ks.grpStdLocalisation.localised, ks.grpStdLocalisation.total) : 0;
  const policyCol = `
    <div class="pvo-col pvo-policy">
      <div class="pvo-col-hdr">📜 Policy Layer — Written &amp; Approved</div>
      ${metric(locCount || '—', 'policy statements catalogued')}
      ${metric(locCovPct + '%', `local policy statements with an associated risk (${locCov.covered}/${locCov.total})`)}
      ${metric(grpCount || '—', 'group standards catalogued')}
      ${metric(grpCovPct + '%', `group standards with associated risks (${grpCov.covered}/${grpCov.total})`)}
      ${metric(locPct + '%', 'group requirements mapped into a local policy')}
      <div class="pvo-verdict pvo-verdict-ok">Policies rewritten &amp; approved — group→local mapping still light</div>
    </div>`;

  // Operational layer — controls behind the policies & standards
  const locOp = ks.locPolOperationalisation || { total: 0, operationalised: 0 };
  const grpOp = ks.grpStdOperationalisation || { total: 0, operationalised: 0 };
  const locBackedPct = pct(locOp.operationalised, locOp.total);
  const grpBackedPct = pct(grpOp.operationalised, grpOp.total);
  // Pre-DORA controls = implemented operational-type controls (narrow disruption
  // scope, no policy/standard prefix). Aim: map them all to a policy or standard.
  const facts   = a.riskPolicyFacts || [];
  const preDora = facts.filter(f => f.controlType === 'operational' && ftIsImplemented(f));
  const preDoraMapped = preDora.filter(f => (f.matchedPolicyRows || []).length > 0).length;
  const preDoraPct    = pct(preDoraMapped, preDora.length);
  const underCount = rp ? rp.underAssuredCount : 0;
  const ru = oc.rollup || { ok: 0, building: 0, low: 0, none: 0 };
  const opsCol = `
    <div class="pvo-col pvo-ops">
      <div class="pvo-col-hdr">⚙️ Operational Layer — Operationalised</div>
      ${metric(locBackedPct + '%', `policy statements backed by an implemented control (${locOp.operationalised}/${locOp.total})`)}
      ${metric(grpBackedPct + '%', `group standards backed by an implemented control (${grpOp.operationalised}/${grpOp.total})`)}
      ${metric(preDora.length || '—', 'pre-DORA controls in place (disruption-risk scope)')}
      ${metric(preDoraPct + '%', `pre-DORA controls mapped to a policy or standard (${preDoraMapped}/${preDora.length})`)}
      <div class="pvo-verdict pvo-verdict-warn">Operationalisation early — ${underCount} risk rating${underCount === 1 ? '' : 's'} under-assured; confidence ${ru.ok} OK · ${ru.building} Building · ${ru.low} Low · ${ru.none} None</div>
    </div>`;

  const notes = a.notes
    ? `<div class="exec-notes-block"><div class="exec-notes-lbl">Assessment Notes</div>${a.notes}</div>`
    : '';

  return `
    <div class="pvo-summary">
      <div class="pvo-banner">
        <span class="pvo-banner-title">Policy compliance ≠ operational compliance</span>
        <span class="pvo-banner-sub">Local policies are rewritten and approved to group &amp; DORA requirements. Operationalising them — building, owning and assessing the controls — is a separate, earlier-stage effort, reported distinctly below.</span>
      </div>
      <div class="pvo-cols">${policyCol}${opsCol}</div>
      ${notes}
    </div>`;
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
