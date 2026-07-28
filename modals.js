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
        const measureLevel = m ? (m.levels.find(l => l.level === lv.level) || {}) : {};
        const displayName  = measureLevel.name || lv.name;
        const label        = measureLevel.label || null;
        return `<div class="modal-level-row">
         <span class="lvl-badge" style="border-color:${lv.color}; display:inline-block; min-width:105px; text-align:center">
            ${lv.level} · ${displayName}
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

// ── Metrics explainer modal ──────────────────────────────────
// One entry per card: what each metric shows and why it matters.
const METRICS_INFO = {
  compliance: {
    title: "Policy vs Operational Compliance · Metrics",
    intro: "Two layers: policies written & approved (policy compliance) vs. policies actually operationalised (operational compliance) — and how much we can trust the operational picture.",
    sections: [
      { heading: "Policy Layer — Written & Approved", rows: [
        ["Policy statements catalogued", "The number of local-policy statements in the register", "The size of our policy rulebook — every statement is a commitment we've made and must be able to evidence"],
        ["Policy statements with an associated risk", "% of local-policy statements linked to a risk", "A policy with no risk attached is a rule nobody is watching — we wrote it but never asked 'what happens if we fail it?'"],
        ["Group standards catalogued", "The number of group-standard statements in the register", "The group-mandated rules we're required to meet"],
        ["Standard statements with associated risks", "% of group-standard statements linked to a risk", "Every group standard connected to a risk we track — unlike local policy, the group requirements are fully wired in"],
        ["Group requirements mapped into a policy statement", "% of group requirements localised into our own policy", "Group sets the standard; our job is to translate it into our own local policy. A low number means we're leaning on group's wording rather than adapting it to how we operate"],
      ]},
      { heading: "Operational Layer — Operationalised", rows: [
        ["Policy statements backed by implemented controls", "% of local-policy statements with an implemented control", "A policy with no control behind it is a promise with nothing enforcing it"],
        ["Group standards backed by implemented controls", "% of group standards with an implemented control", "The same test, for group standards"],
        ["Pre-DORA controls in place", "Count of implemented operational controls that predate DORA", "Controls we already ran before DORA — real and working, but built for the old, narrow 'systems availability' risk, not DORA's wider scope (security, privacy, third-party). Proof we're not starting from zero"],
        ["Pre-DORA controls mapped to a policy or standard", "% of pre-DORA controls tied to a policy or standard", "If a control isn't tied to a policy or standard there's no stated reason we're doing it — it may fall outside our remit, duplicate another team's work, or serve no purpose"],
      ]},
      { heading: "Confidence & assurance (verdict line)", rows: [
        ["Confidence — OK / Building / Low / None", "How well each capability's risk ratings are backed by control evidence", "How much we can trust our own risk ratings — 'Low/None' means the rating isn't backed by assessed controls, so we're asserting risk levels we can't yet prove"],
        ["Under-assured risk ratings", "Assessed risks with fewer than half their controls assessed", "Ratings we couldn't defend to an auditor — the controls behind them haven't been checked"],
      ]},
    ],
  },
  riskPortfolio: {
    title: "Risk Management · Metrics",
    intro: "For this theme's controls: the risks they touch, and how well those risk ratings are backed by control evidence.",
    sections: [{ rows: [
      ["Total Risks (open/draft/closed)", "Size and state of the register", "Draft backlog = risks known but not yet in the RCSA — the gap between spotting and managing"],
      ["Risks Assessed", "Active risks with a residual rating", "An unassessed risk is an unmanaged risk; this is your RCSA completion rate"],
      ["Severe (residual ≥ 20)", "Count of high-residual risks", "The board's watch-list — what can still hurt after controls"],
      ["Control Coverage", "% of controls assessed behind assessed risks", "Whether a risk rating is evidence-based or just opinion"],
      ["Risk Reduction (inherent→residual)", "How far controls pull risk down — Pre-DORA card only", "The one number proving controls add value; a small gap means controls aren't earning their keep (click the tile to see which)"],
      ["Controls Implemented", "% of the theme's controls implemented — Local Policy / Group Standard cards", "Shown in place of Risk Reduction, which can't be attributed to a single control type — the number to drive up as DORA controls come online"],
      ["Under-assured", "Assessed risks with < 50% of their controls assessed", "Ratings you couldn't defend to an auditor — where confidence is false (click the tile for the per-risk coverage split)"],
    ]}],
  },
  opCoverage: {
    title: "Policy Operationalisation Coverage · Metrics",
    intro: "How far each capability has progressed across the risk and control lifecycle, and whether its risk view can be trusted.",
    sections: [{ rows: [
      ["Risks Approved", "Risks past draft, in the register (open ÷ all)", "Progress from 'identified' to 'formally owned in RCSA'"],
      ["Risks Assessed", "Risks with a residual rating (assessed ÷ all)", "Whether we've evaluated the risk, not just logged it"],
      ["Ctrl Owned", "Controls with a named owner", "No owner = no accountability = not a real control"],
      ["Ctrl Implemented", "Controls actually in place", "The gap between designed and operating"],
      ["Ctrl Assessed", "Controls with an assessment", "Whether we know a control works, or just assume it"],
      ["Confidence chip", "Control evidence vs the risk-assessment claim", "One flag telling execs if a capability's risk view can be trusted"],
    ]}],
  },
  rcsa: {
    title: "ICT RCSA & CSA — Risk Management Metrics · Metrics",
    intro: "Derived from the Riskonnect and Policy Statement imports. KPI blocks summarise operationalisation and cooperation; the fact tables hold the detail.",
    sections: [
      { heading: "Policy Operationalisation (KPIs)", rows: [
        ["LocPol / GrpStd Coverage", "Policy statements referenced by ≥1 control", "Are approved policies even represented in the register?"],
        ["LocPol Blind Spots", "Statements with no implemented control", "Policy on paper with nothing operationalising it"],
        ["GrpStd Operationalised", "Requirements with ≥1 implemented control", "Documented vs actually put into practice"],
        ["Orphan Controls", "Controls citing a ref not in the register", "Traceability gaps — controls with no policy lineage"],
        ["Policy Control Effectiveness", "Implemented policy controls rated effective", "Whether the controls operationalising policy actually work"],
        ["GrpStd Localisation", "Group-standard requirements a local policy maps to", "Cross-team handoff: a group standard picked up locally"],
        ["Full Chain Complete", "Capabilities with Policy→Risk→Control→Assessment", "End-to-end DORA operationalisation per capability"],
      ]},
      { heading: "Cross Team Cooperation (KPIs)", rows: [
        ["Strategic KPIs (e.g. Access Review Completion, Security-Assessed Changes)", "Cross-functional cooperation on shared risks", "The cultural shift: 'IT risk is a business problem', measured"],
      ]},
      { heading: "Fact tables (dashboard view)", rows: [
        ["Policy Objectives", "Statement counts per capability × document", "The policy inventory underpinning everything"],
        ["DORA — Local Policy / Group Standard Controls", "Risk & control status for policy-driven controls", "DORA-scope operationalisation detail"],
        ["Pre-DORA Operational", "Legacy risks/controls not tied to policy refs", "The pre-DORA baseline still being managed"],
      ]},
    ],
  },
};

// Build the inner HTML (intro + section tables) for a METRICS_INFO-shaped
// object. Shared by the popup modal and the inline exec-report appendix so
// both render identical content. `headers` lets the confidence table relabel
// its columns; r[0] is kept raw so embedded chip HTML renders.
function metricsInfoBody(info, headers) {
  const h = headers || ["Metric", "What it shows", "Why it matters"];
  const table = rows => `
    <table class="metrics-info-table">
      <thead><tr><th>${h[0]}</th><th>${h[1]}</th><th>${h[2]}</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td class="mi-metric">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody>
    </table>`;
  const body = info.sections.map(s =>
    `${s.heading ? `<h4 class="metrics-info-hdr">${s.heading}</h4>` : ""}${table(s.rows)}`
  ).join("");
  return `<p class="modal-desc">${info.intro}</p>${body}`;
}

function showMetricsModal(cardKey) {
  const info = METRICS_INFO[cardKey];
  if (!info) return;
  document.getElementById("modal-title").textContent = info.title;
  document.getElementById("modal-body").innerHTML = metricsInfoBody(info);
  document.getElementById("ratings-modal").style.display = "flex";
}

// ── Confidence ratings explainer (Policy Operationalisation Coverage) ──
// Returns a METRICS_INFO-shaped object computed from CONFIG.opCoverage so the
// popup and the inline appendix share one source of truth.
function confidenceInfo() {
  const cfg   = (CONFIG && CONFIG.opCoverage) || {};
  const floor = cfg.ownershipFloorPct != null ? cfg.ownershipFloorPct : 20;
  const low   = cfg.confidenceLowPct  != null ? cfg.confidenceLowPct  : 40;
  const ok    = cfg.confidenceOkPct   != null ? cfg.confidenceOkPct   : 75;
  const chip = (cls, label) => `<span class="opcov-chip ${cls}">${label}</span>`;
  return {
    title: "Policy Operationalisation Coverage — Confidence Ratings",
    intro: "Each capability gets a confidence rating based on how well its risk assessments are backed by control evidence. <strong>Confidence Index = Control-Assessed % ÷ Risk-Assessed %</strong> (capped at 100%) — of the risks you've rated, how much of the control base behind them has actually been assessed. The ownership floor is checked first.",
    sections: [{ rows: [
      [chip('opcov-chip-ok',       '● OK'),       `Confidence Index ≥ ${ok}%`,                                                "Control evidence keeps pace with the risk assessment — this capability's risk view can be trusted"],
      [chip('opcov-chip-building', '◐ Building'), `Confidence Index ${low}–${ok - 1}%`,                                       "Some control evidence in place, but the risk view isn't fully backed yet"],
      [chip('opcov-chip-low',      '⚠ Low'),      `Confidence Index &lt; ${low}%, or fewer than ${floor}% of controls owned`, "Risk ratings have run ahead of the control evidence (or almost nothing is owned) — treat the risk view with caution"],
      [chip('opcov-chip-none',     '– None'),     'No approved risks assessed',                                               "Nothing asserted yet, so there's nothing to be confident or unsure about"],
    ]}],
  };
}

function showConfidenceModal() {
  const info = confidenceInfo();
  document.getElementById("modal-title").textContent = info.title;
  document.getElementById("modal-body").innerHTML =
    metricsInfoBody(info, ["Rating", "How it's calculated", "What it means"]);
  document.getElementById("ratings-modal").style.display = "flex";
}

// ── Under-assured drill-down — are risk ratings backed by control evidence? ──
function showUnderAssuredModal(assessmentId, theme) {
  const a = db.assessments.find(x => x.id === assessmentId);
  const s = a ? buildRiskPortfolioSummary(a.riskPolicyFacts || [], theme || null) : null;
  const themeName = { locPol: 'Local Policy', grpStd: 'Group Standard', operational: 'Pre-DORA' }[theme];
  document.getElementById("modal-title").textContent = `Under-assured${themeName ? ' · ' + themeName : ''} — are risk ratings backed by control evidence?`;
  if (!s || !s.assuranceRanking.length) {
    document.getElementById("modal-body").innerHTML = `<p class="modal-desc">No assessed risks to rank yet.</p>`;
    document.getElementById("ratings-modal").style.display = "flex";
    return;
  }
  const capName = id => (CONFIG.capabilities.find(c => c.id === id)?.name) || id;
  const rows = s.assuranceRanking.map(r => `
    <tr class="${r.underAssured ? 'rr-weak' : ''}">
      <td class="mi-metric">${r.title}${r.underAssured ? ' <span class="rr-flag">⚠ under-assured</span>' : ''}</td>
      <td>${shortName(capName(r.capId))}</td>
      <td class="rr-num">${r.controls}</td>
      <td class="rr-num">${r.ctrlAssessed}</td>
      <td class="rr-num">${r.coveragePct}%</td>
    </tr>`).join("");
  document.getElementById("modal-body").innerHTML = `
    <p class="modal-desc">Assessed risks ranked by how much of their control base has actually been assessed (controls with an assessment ÷ total controls). A risk is <strong>under-assured</strong> when this is below ${s.underAssuredFloor}% — the residual rating rests on control evidence that mostly hasn't been checked. This is an evidence gap, distinct from Weak Mitigation (controls checked but not reducing risk).</p>
    <table class="metrics-info-table rr-table">
      <thead><tr><th>Risk</th><th>Capability</th><th>Ctrl</th><th>Assessed</th><th>Coverage</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  document.getElementById("ratings-modal").style.display = "flex";
}

// ── Risk Reduction drill-down — which controls aren't earning their keep ──
function showRiskReductionModal(assessmentId, theme) {
  const a = db.assessments.find(x => x.id === assessmentId);
  const s = a ? buildRiskPortfolioSummary(a.riskPolicyFacts || [], theme || null) : null;
  const themeName = { locPol: 'Local Policy', grpStd: 'Group Standard', operational: 'Pre-DORA' }[theme];
  document.getElementById("modal-title").textContent = `Risk Reduction${themeName ? ' · ' + themeName : ''} — are controls earning their keep?`;
  if (!s || !s.ranking.length) {
    document.getElementById("modal-body").innerHTML = `<p class="modal-desc">No assessed risks to rank yet.</p>`;
    document.getElementById("ratings-modal").style.display = "flex";
    return;
  }
  const capName = id => (CONFIG.capabilities.find(c => c.id === id)?.name) || id;
  const rows = s.ranking.map(r => {
    const weak = r.implemented >= 1 && r.reductionPct < s.weakThreshold;
    return `<tr class="${weak ? 'rr-weak' : ''}">
      <td class="mi-metric">${r.title}${weak ? ' <span class="rr-flag">⚠ weak</span>' : ''}</td>
      <td>${shortName(capName(r.capId))}</td>
      <td class="rr-num">${r.inherent}</td>
      <td class="rr-num">${r.residual}</td>
      <td class="rr-num">${r.reductionPct}%</td>
      <td class="rr-num">${r.controls}</td>
      <td class="rr-num">${r.implemented}</td>
      <td class="rr-num">${r.effective}</td>
    </tr>`;
  }).join("");
  document.getElementById("modal-body").innerHTML = `
    <p class="modal-desc">Assessed risks ranked by how far controls pull risk down (inherent → residual). A <strong>low reduction with implemented — especially effective — controls</strong> means the controls aren't earning their keep: the control design or its rating needs review. Flagged when reduction is below ${s.weakThreshold}% with at least one implemented control.</p>
    <table class="metrics-info-table rr-table">
      <thead><tr><th>Risk</th><th>Capability</th><th>Inh</th><th>Res</th><th>Red%</th><th>Ctrl</th><th>Impl</th><th>Eff</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  document.getElementById("ratings-modal").style.display = "flex";
}
