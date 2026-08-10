// ── Dashboard data cards (governance + themed risk + RCSA metrics) ──
function renderMeasureSummary(assessment) {
  const currentIndex = db.assessments.findIndex(a => a.id === assessment.id);
  const prev = currentIndex > 0 ? db.assessments[currentIndex - 1] : null;

  const srcSlot = document.getElementById("sources-card-row");
  if (srcSlot) srcSlot.innerHTML = renderSourcesCard(assessment);
  const planSlot = document.getElementById("planning-card-row");
  if (planSlot) planSlot.innerHTML = renderPlanningCard(assessment);
  const govSlot = document.getElementById("governance-card-row");
  if (govSlot) govSlot.innerHTML = renderGovernanceCard(assessment);
  const rmSlot = document.getElementById("riskmgmt-card-row");
  if (rmSlot) rmSlot.innerHTML = renderThemedRiskSection(assessment, prev);
  document.getElementById("risk-card-row").innerHTML = renderRiskMgmtSummaryCard(assessment, prev);
}

// ── Risk-profile table (shared by the governance + Pre-DORA cards) ──
// "Elevated risks only" is a shared, persisted toggle across every risk-profile
// card on the screen.
function toggleRpElevated(el) {
  window._rpElevated = el.checked;
  document.querySelectorAll('.rp-card').forEach(c => c.classList.toggle('rp-elevated', el.checked));
  document.querySelectorAll('.rp-elev-toggle').forEach(cb => { cb.checked = el.checked; });
}
function rpElevToggle() {
  const on = window._rpElevated !== false;   // default ON
  return `<label class="rp-toggle"><input type="checkbox" class="rp-elev-toggle" ${on ? 'checked' : ''} onchange="toggleRpElevated(this)"> Elevated risks only</label>`;
}
function rpResCell(k) {
  if (k.band === 'na') return '<span class="rp-res rp-res-na">Not assessed</span>';
  const cls = { extreme: 'rp-res-extreme', significant: 'rp-res-significant', moderate: 'rp-res-moderate', low: 'rp-res-low', none: 'rp-res-low' }[k.band];
  const lbl = { extreme: 'Extreme', significant: 'Significant', moderate: 'Moderate', low: 'Low', none: 'Low' }[k.band];
  return `<span class="rp-res ${cls}">${lbl} &middot; ${k.residual}</span>`;
}
function rpFrac(n, d, eff) {
  const w = d > 0 ? Math.round(100 * n / d) : 0;
  const num = n === 0 ? `<span class="rp-zero">0</span>` : `${n}`;
  return `<div class="rp-frac"><span class="rp-frac-num">${num}<span class="rp-den">/${d}</span></span><span class="rp-bar${eff ? ' rp-bar-eff' : ''}"><i style="width:${w}%"></i></span></div>`;
}
function rpConfCell(k) {
  if (k.conf === 'na') return '<span class="rp-conf rp-conf-na">n/a</span>';
  const cls = { low: 'rp-conf-low', med: 'rp-conf-med', high: 'rp-conf-high' }[k.conf];
  const lbl = { low: 'Low', med: 'Medium', high: 'High' }[k.conf];
  return `<span class="rp-conf ${cls}">${lbl} &middot; ${k.testedPct}%</span>`;
}
// risks: finalized per-risk profile (buildRiskProfile). wrap: box the table in a
// bordered panel (for embedding in a cell); false renders the bare table.
function renderRiskProfileTable(risks, wrap) {
  if (!risks || !risks.length) return '<div class="rp-empty">No risks mapped &mdash; coverage gap.</div>';
  const body = risks.map(k => {
    const cls = 'rp-row' + (k.isAct ? ' rp-act' : (k.elevated ? ' rp-elev' : ''));
    const owner = (k.owner || '').trim();
    return `<tr class="${cls}">
      <td><div class="rp-title">${escHtml(k.title)}</div>${owner ? `<div class="rp-owner">Risk owner &middot; ${escHtml(owner)}</div>` : ''}</td>
      <td class="rp-num">${rpResCell(k)}</td>
      <td class="rp-num">${rpFrac(k.implemented, k.active)}</td>
      <td class="rp-num">${rpFrac(k.tested, k.active)}</td>
      <td class="rp-num">${rpFrac(k.effective, k.active, true)}</td>
      <td class="rp-num">${rpConfCell(k)}</td>
    </tr>`;
  }).join('');
  const allClear = risks.some(k => k.isAct || k.elevated)
    ? ''
    : `<tr class="rp-allclear"><td colspan="6">No elevated risks &mdash; all well-controlled.</td></tr>`;
  const table = `<table class="rp-table">
      <thead><tr><th>Risk</th><th class="rp-num">Residual</th><th class="rp-num">Implemented</th><th class="rp-num">Tested</th><th class="rp-num">Effective</th><th class="rp-num">Confidence</th></tr></thead>
      <tbody>${body}${allClear}</tbody></table>`;
  return wrap ? `<div class="rp-panel">${table}</div>` : table;
}

// ── Sources — policy-import summary (main working screen) ──────────
// One row per capability × document from the policy upload: how many
// risk-treatment measures (statements) it holds and its approval status.
let _srcRows = [];
let _srcSort = { col: 'capName', dir: 1 };
const SRC_STATUS_RANK = { approved: 0, partial: 1, draft: 2 };
const SRC_FIELD = {
  capName:  r => r.capName || '',
  document: r => r.document || '',
  type:     r => r.type || '',
  total:    r => r.total,
  status:   r => SRC_STATUS_RANK[r.status] ?? 9,
};
function srcSortRows() {
  const f = SRC_FIELD[_srcSort.col] || SRC_FIELD.capName;
  const dir = _srcSort.dir;
  return _srcRows.slice().sort((a, b) => {
    const va = f(a), vb = f(b);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });
}
function srcHead() {
  const arrow = c => _srcSort.col === c ? `<span class="mrt-arrow">${_srcSort.dir === 1 ? '▲' : '▼'}</span>` : '';
  const th = (k, label, cls) => `<th class="mrt-sort${cls ? ' ' + cls : ''}" onclick="sortSourcesTable('${k}')">${label}${arrow(k)}</th>`;
  return `<tr>
    ${th('capName', 'Capability')}
    ${th('document', 'Document')}
    ${th('type', 'Type')}
    ${th('total', "# RTM's", 'src-rtm')}
    ${th('status', 'Document status', 'src-status')}
  </tr>`;
}
function srcBody(rows) {
  const badge = r => {
    const map = { approved: ['gov-approved', 'Approved'], draft: ['gov-draft', 'Draft'], partial: ['gov-partial', 'Partial'] };
    const [cls, txt] = map[r.status];
    return `<span class="gov-badge ${cls}" title="${r.approved} approved &middot; ${r.draft} draft (of ${r.total})">${txt}</span>`;
  };
  return rows.map(r => `<tr>
    <td class="src-cap" title="${r.capName}">${shortName(r.capName)}</td>
    <td class="src-doc"><div class="src-doc-name">${r.document}</div></td>
    <td class="src-type">${r.type}</td>
    <td class="src-rtm" title="${r.total} risk-treatment measure(s) in this document">${r.total}</td>
    <td class="src-status">${badge(r)}</td>
  </tr>`).join('');
}
function sortSourcesTable(col) {
  if (_srcSort.col === col) _srcSort.dir *= -1;
  else _srcSort = { col, dir: 1 };
  const tb = document.getElementById('src-tbody');
  const th = document.getElementById('src-thead');
  if (tb) tb.innerHTML = srcBody(srcSortRows());
  if (th) th.innerHTML = srcHead();
}

function renderSourcesCard(assessment) {
  const rows = buildGovernanceRows(assessment.policyRows || [], assessment.riskPolicyFacts || []);
  const title = '1 &middot; Sources';
  let desc = 'The policy upload &mdash; the source documents that make up our risk-treatment measures.';
  if (rows.length) {
    const totalRtm = rows.reduce((a, r) => a + r.total, 0);
    const caps = new Set(rows.map(r => r.capId)).size;
    desc = `${rows.length} document${rows.length === 1 ? '' : 's'} &middot; ${totalRtm} risk-treatment measure${totalRtm === 1 ? '' : 's'} across ${caps} capabilit${caps === 1 ? 'y' : 'ies'}.`;
  }
  const header = `
    <div class="measure-card-header">
      <span class="measure-icon">🗂️</span>
      <div style="flex:1"><h3 class="measure-card-title">${title}</h3><p class="measure-card-desc">${desc}</p></div>
    </div>`;
  if (!rows.length) {
    return `<div class="card measure-card">${header}<p class="policy-no-data" style="margin:.5rem 0">No policy data uploaded yet.</p></div>`;
  }
  _srcRows = rows;
  _srcSort = { col: 'capName', dir: 1 };
  return `
    <div class="card measure-card">
      ${header}
      <div class="rcsa-table-wrap">
        <table class="src-table">
          <colgroup><col class="src-c-cap"><col class="src-c-doc"><col class="src-c-type"><col class="src-c-rtm"><col class="src-c-status"></colgroup>
          <thead id="src-thead">${srcHead()}</thead>
          <tbody id="src-tbody">${srcBody(srcSortRows())}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Planning — RTM → Controls (flat, Excel-filterable) ────────────
function copyPlanningTable(btn) {
  const table = btn.closest('.card').querySelector('.plan-table');
  if (!table) return;
  const tsv = [...table.querySelectorAll('tr')].map(tr =>
    [...tr.querySelectorAll('th,td')].map(c => (c.innerText || '').trim().replace(/\s+/g, ' ')).join('\t')
  ).join('\n');
  navigator.clipboard.writeText(tsv).then(() => {
    const old = btn.textContent; btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = old; }, 1500);
  }).catch(() => { btn.textContent = 'Copy failed'; });
}

function renderPlanningCard(assessment) {
  const rows = buildPlanningRows(assessment.policyRows || [], assessment.riskPolicyFacts || []);
  const title = '3 &middot; Planning &mdash; Risk-Treatment Measures to Controls';
  const desc  = 'Which controls implement which RTMs — one row per control-to-statement mapping (with its risk), plus unmapped pre-DORA controls as capability rows. Copy into Excel and filter by capability, RTM or control. Use <b>RTM Source</b>, <b>Planning Status</b> and <b>Statement Owner</b> to reconcile with the exec-report funnel (each layer has a ℹ Detail popup with the exact filter).';
  const tools = `<div class="plan-tools">
    <button class="btn-link" onclick="showPlanningGuide()">ℹ Instructions &amp; prompts</button>
    ${rows.length ? `<button class="btn-link plan-copy" onclick="copyPlanningTable(this)">⧉ Copy for Excel</button>` : ''}
  </div>`;
  const header = `
    <div class="measure-card-header">
      <span class="measure-icon">🧭</span>
      <div style="flex:1"><h3 class="measure-card-title">${title}</h3><p class="measure-card-desc">${desc}</p></div>
      ${tools}
    </div>`;
  if (!rows.length) {
    return `<div class="card measure-card">${header}<p class="policy-no-data" style="margin:.5rem 0">No policy data uploaded yet.</p></div>`;
  }
  const typeCell = t => t ? `<span class="plan-type">${t}</span>` : '';
  const statusCell = s => s ? `<span class="plan-status ${s === 'Implemented' ? 'plan-st-impl' : 'plan-st-draft'}">${s}</span>` : '';
  const PLAN_ST_CLS = { 'Built new': 'plan-ps-built', 'Reused pre-DORA': 'plan-ps-reused', 'Drafted': 'plan-ps-drafted', 'Uncovered': 'plan-ps-uncovered', 'Pre-DORA (unmapped)': 'plan-ps-predora' };
  const planCell = s => s ? `<span class="plan-ps ${PLAN_ST_CLS[s] || ''}">${escHtml(s)}</span>` : '';
  const rowCls = r => r.controlName ? (r.preDora ? 'plan-predora' : '') : 'plan-gap';
  const body = rows.map(r => `<tr${rowCls(r) ? ` class="${rowCls(r)}"` : ''}>
    <td class="plan-cap" title="${r.capName}">${shortName(r.capName)}</td>
    <td class="plan-doc">${escHtml(r.document)}</td>
    <td class="plan-src">${escHtml(r.source)}</td>
    <td class="plan-ref">${escHtml(r.ref)}</td>
    <td class="plan-hdr">${escHtml(r.header)}</td>
    <td class="plan-owner">${escHtml(r.owner)}</td>
    <td class="plan-plan">${planCell(r.planStatus)}</td>
    <td class="plan-risk">${escHtml(r.risk)}</td>
    <td class="plan-ctrl">${r.controlName ? escHtml(r.controlName) : '<span class="plan-none">— no control mapped —</span>'}</td>
    <td class="plan-type-c">${typeCell(r.controlType)}</td>
    <td class="plan-status-c">${statusCell(r.controlStatus)}</td>
    <td class="plan-desc"><div class="plan-desc-clip" title="${escHtml(r.desc)}">${escHtml(r.desc)}</div></td>
  </tr>`).join('');
  return `
    <div class="card measure-card">
      ${header}
      <div class="rcsa-table-wrap">
        <table class="plan-table">
          <thead><tr>
            <th>Capability</th><th>Document</th><th>RTM Source</th><th>Statement Ref</th><th>Statement Header</th>
            <th>Statement Owner</th><th>Planning Status</th><th>Risk</th><th>Control Name</th><th>Control Type</th><th>Control Status</th><th>Control Description</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Planning guide (in-app instructions + AI prompts) ─────────────
// All three prompts operate on ONE shared 14-column table (progressive
// enrichment). Prompt 1 builds the table; you review it in Excel; Prompt 2
// appends the resolution columns; Prompt 3 appends the description column.
// Every prompt re-emits the WHOLE table so it round-trips Excel ↔ AI tool.
const PLAN_SHARED_COLS = `Capability | Control Name | Statement Ref | Control Objective | Expected Evidence | Verdict | Matched Existing Control | Existing Statement Ref | Confidence | Why | Description | Control Status | Control Reason | Ready-To-Adapt Description`;

const PLAN_PROMPT_1 = `ROLE
You are an IT risk & control analyst integrating newly generated controls into an existing
DORA control framework without creating duplicates.

TASK
Build the SHARED WORKING TABLE. For each NEW CANDIDATE control, extract its objective and
expected evidence, then decide whether an EXISTING control already achieves the same control
objective. Compare on OBJECTIVE / INTENT — what the control is trying to achieve — NOT on
wording, control name, or format.

THE SHARED WORKING TABLE (14 columns — every later prompt reuses this exact table)
${PLAN_SHARED_COLS}
You fill columns 1–10 now. Leave columns 11–14 EMPTY (later prompts fill them):
 1  Capability                — from the candidate
 2  Control Name              — the candidate's name
 3  Statement Ref             — the new statement ref the candidate operationalises
 4  Control Objective         — extracted from the candidate's description (what it achieves)
 5  Expected Evidence         — extracted from the candidate's description (what proves it)
 6  Verdict                   — DUPLICATE or NEW
 7  Matched Existing Control  — for DUPLICATE, the existing control's name (else blank)
 8  Existing Statement Ref    — for DUPLICATE, that control's statement ref (else blank)
 9  Confidence                — H / M / L
 10 Why                       — one line: the shared objective (DUPLICATE) or the gap (NEW)
 11–14 Description | Control Status | Control Reason | Ready-To-Adapt Description — leave blank

HOW TO READ THE INPUTS
- EXISTING INVENTORY is a tab-separated export with columns:
  Capability | Document | Statement Ref | Statement Header | Risk | Control Name |
  Control Type | Control Status | Control Description
  The control's objective lives in "Control Description". For newer controls it is stated
  explicitly (Objective / Description / Expected evidence). For older Pre-DORA controls it is
  usually NOT explicit — DERIVE the objective by reading the description.
- NEW CANDIDATES each have a name and a description containing objective + expected evidence.

RULES
1. Only compare controls within the SAME capability.
2. A candidate is a DUPLICATE only if an existing control's objective would already satisfy
   the candidate's objective (fully or substantially). Overlapping topic alone is not enough.
3. Be conservative: if unsure, mark confidence Medium or Low rather than forcing DUPLICATE.
4. A candidate may match more than one existing control — pick the single best match and name
   any others in the "Why" note.
5. Never invent controls, refs, or capabilities that are not in the inputs.

OUTPUT
Return ONLY the shared working table as TAB-SEPARATED values inside a code block: a header row
of all 14 column names, then one row per candidate (most-confident duplicates first, then the
NEW ones). Keep all 14 columns present even where empty, so it pastes straight into Excel.

=== EXISTING INVENTORY (paste the Planning card "Copy for Excel", filtered to one capability) ===
<PASTE HERE>

=== NEW CANDIDATE CONTROLS (from your generation step, same capability) ===
<PASTE HERE>`;

const PLAN_PROMPT_2 = `ROLE
You are an IT risk & control analyst resolving each row of the shared working table.

CONTEXT
This is the SAME table Prompt 1 produced. Since then a human has reviewed and corrected
columns 6–9 (Verdict, Matched Existing Control, Existing Statement Ref, Confidence) in Excel.
Trust those human values. Now fill the resolution columns for every row.

THE SHARED WORKING TABLE (14 columns)
${PLAN_SHARED_COLS}
Fill columns 11–13 (leave 14 for Prompt 3):
 11 Description     — the edit to make:
      • DUPLICATE → "Append «Statement Ref» to «Matched Existing Control» linked statements"
        (this tags the existing control so it also evidences the new RTM)
      • NEW        → leave blank (Prompt 3 writes the ready-to-adapt description)
 12 Control Status  — DUPLICATE → "Proposed Close"   |   NEW → "Implemented"
 13 Control Reason  —
      • DUPLICATE → use EXACTLY this wording, substituting the placeholders:
        Proposed Close — already mapped to «Matched Existing Control» «Existing Statement Ref»
      • NEW        → leave blank

RULES
- Do NOT change columns 1–10; echo them back exactly as received.
- Use only the values already in the row; do not invent refs or controls.
- Keep the DUPLICATE reason wording exactly as specified.

OUTPUT
Return ONLY the full shared working table as TAB-SEPARATED values inside a code block: the
14-column header row, then every input row with columns 11–13 now filled and 14 still blank.

=== SHARED WORKING TABLE (paste your reviewed Prompt 1 table) ===
<PASTE HERE>`;

const PLAN_PROMPT_3 = `ROLE
You are an IT risk & control analyst preparing genuinely-new controls for the operational
team to implement.

CONTEXT
This is the SAME table, now carrying Prompt 2's resolution columns. For each NEW row (Verdict
= NEW, Control Status = Implemented) write the description the operational team will adopt so
the control evidences its objective.

THE SHARED WORKING TABLE (14 columns)
${PLAN_SHARED_COLS}
Fill column 14 only:
 14 Ready-To-Adapt Description — for NEW rows, a plain-operational-language paragraph that
      meets the Control Objective and produces the Expected Evidence: state the specific
      activity performed, how often, by whom, and the artefact that proves it — written so an
      assessor could verify it. For DUPLICATE rows leave this blank.

RULES
- Do NOT change columns 1–13; echo them back exactly as received.
- Ground the description in the row's Control Objective and Expected Evidence; invent no scope.
- Keep it concise and practical for an operational owner to action.

OUTPUT
Return ONLY the full shared working table as TAB-SEPARATED values inside a code block: the
14-column header row, then every input row with column 14 filled for NEW rows.

=== SHARED WORKING TABLE (paste your Prompt 2 table) ===
<PASTE HERE>`;

function copyGuidePrompt(btn) {
  const pre = btn.closest('.guide-prompt').querySelector('pre');
  navigator.clipboard.writeText(pre.textContent).then(() => {
    const old = btn.textContent; btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = old; }, 1500);
  }).catch(() => { btn.textContent = 'Copy failed'; });
}

function showPlanningGuide() {
  const promptBlock = (label, text) => `
    <div class="guide-prompt">
      <div class="guide-prompt-hd"><span>${label}</span><button class="btn-link guide-copy" onclick="copyGuidePrompt(this)">⧉ Copy prompt</button></div>
      <pre>${escHtml(text)}</pre>
    </div>`;
  const body = `
    <p class="guide-intro">Turn new source statements into live, non-duplicated controls. The three prompts all work on <b>one shared 14-column table</b> — each prompt fills its own columns and re-emits the whole table, so it round-trips cleanly between Excel and your AI tool. Filter this card to one capability, <b>Copy for Excel</b>, then run the prompts in order.</p>
    <h4 class="guide-h">The shared table</h4>
    <p class="guide-intro" style="margin-top:0"><code>Capability · Control Name · Statement Ref · Control Objective · Expected Evidence · Verdict · Matched Existing Control · Existing Statement Ref · Confidence · Why · Description · Control Status · Control Reason · Ready-To-Adapt Description</code></p>
    <h4 class="guide-h">The process</h4>
    <ol class="guide-steps">
      <li><b>Prep the sources</b> — add the new document's statements to the policy upload file, re-import, and <b>Generate</b> (your existing prompt) a draft risk + draft control per new RTM (objective, description &amp; expected evidence held in the control description).</li>
      <li><b>Prompt 1 — build the table.</b> <b>Copy for Excel</b> (filtered to the capability) for the existing inventory, then run Prompt 1. It creates the shared table and fills columns 1–10: it extracts each candidate's <b>Control Objective</b> and <b>Expected Evidence</b> and sets a <b>Verdict</b> (Duplicate / New).</li>
      <li><b>Review in Excel.</b> Paste Prompt 1's table into Excel and human-check the judgement columns — <b>Verdict, Matched Existing Control, Existing Statement Ref, Confidence</b> — correcting anything the AI got wrong.</li>
      <li><b>Prompt 2 — resolve.</b> Paste the reviewed table with Prompt 2. It fills <b>Description, Control Status, Control Reason</b>: Duplicates → tag the existing control with the new ref and set <i>“Proposed Close — already mapped to «control» «ref»”</i>; New → <b>Implemented</b>.</li>
      <li><b>Prompt 3 — describe.</b> Paste Prompt 2's table with Prompt 3. For every New row it fills <b>Ready-To-Adapt Description</b> — the operational paragraph that evidences the objective.</li>
      <li><b>Update Riskonnect.</b> Take Prompt 3's finished table and apply it: close the duplicates, adopt the new descriptions, then re-import the risk data — the funnel and framework cards reflect the integration; anything still Draft or Uncovered is your backlog.</li>
    </ol>
    <h4 class="guide-h">Prompts</h4>
    ${promptBlock('Prompt 1 — Build the table &amp; find duplicates (step 2)', PLAN_PROMPT_1)}
    ${promptBlock('Prompt 2 — Resolve (Description / Status / Reason) (step 4)', PLAN_PROMPT_2)}
    ${promptBlock('Prompt 3 — Ready-to-adapt description (step 5)', PLAN_PROMPT_3)}`;
  document.getElementById('modal-title').textContent = 'Planning — process & AI prompts';
  document.getElementById('modal-body').innerHTML = body;
  const m = document.getElementById('ratings-modal');
  const box = m.querySelector('.modal-box');
  if (box) box.classList.add('modal-wide');
  m.style.display = 'flex';
}

// ── Control Operationalisation Coverage — per document, with the risk profile ──
function renderGovernanceCard(assessment) {
  const rows  = buildGovernanceRows(assessment.policyRows || [], assessment.riskPolicyFacts || []);
  const title = 'Control Operationalisation Coverage';
  let desc = 'Are our policies and group standards approved, and what risk sits behind each? One row per document.';
  if (rows.length) {
    const totalStmts = rows.reduce((a, r) => a + r.total, 0);
    const apprStmts  = rows.reduce((a, r) => a + r.approved, 0);
    const pct = totalStmts ? Math.round(100 * apprStmts / totalStmts) : 0;
    desc = `${apprStmts} of ${totalStmts} policy statements approved (${pct}%) across ${rows.length} documents.`;
  }
  const elevOn = window._rpElevated !== false;   // default ON
  const header = `
    <div class="measure-card-header">
      <span class="measure-icon">⚖️</span>
      <div style="flex:1"><h3 class="measure-card-title">${title}</h3><p class="measure-card-desc">${desc}</p></div>
      ${rows.length ? rpElevToggle() : ''}
    </div>`;
  if (!rows.length) {
    return `<div class="card measure-card">${header}<p class="policy-no-data" style="margin:.5rem 0">No policy data uploaded yet.</p></div>`;
  }

  const statusBadge = r => {
    const map = { approved: ['gov-approved', 'Approved'], draft: ['gov-draft', 'Draft'], partial: ['gov-partial', 'Partial'] };
    const [cls, txt] = map[r.status];
    return `<span class="gov-badge ${cls}" title="${r.approved} approved · ${r.draft} draft (of ${r.total})">${txt}</span>`;
  };
  const trackCell = r => {
    const w = r.total > 0 ? Math.round(100 * r.riskTracked / r.total) : 0;
    return `<div class="rp-track"><span class="rp-track-num">${r.riskTracked}<span class="rp-den"> / ${r.total}</span></span><span class="rp-track-bar"><i style="width:${w}%"></i></span></div>`;
  };

  const body = rows.map(r => `<tr class="gp-row">
    <td class="gp-cap" title="${r.capName}">${shortName(r.capName)}</td>
    <td class="gp-doc"><div class="gp-doc-name">${r.document}</div><div class="gp-doc-sub">${r.type} &middot; ${statusBadge(r)}</div></td>
    <td class="gp-track" title="${r.riskTracked} of ${r.total} statement(s) tracked as risk(s)">${trackCell(r)}</td>
    <td class="gp-risks">${renderRiskProfileTable(r.risks, true)}</td>
  </tr>`).join('');

  return `
    <div class="card measure-card gov-profile rp-card${elevOn ? ' rp-elevated' : ''}" id="gov-profile-card">
      ${header}
      <div class="rcsa-table-wrap">
        <table class="gp-table">
          <colgroup><col class="gp-c-cap"><col class="gp-c-doc"><col class="gp-c-track"><col class="gp-c-risks"></colgroup>
          <thead><tr>
            <th>Capability</th>
            <th>Document</th>
            <th class="gp-track-h" title="Statements tracked as a risk / total statements in the document">Risk-tracked statements</th>
            <th>Risks behind this document</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Control Operationalisation Coverage — Pre-DORA ─────────────────
// Pre-DORA (operational) controls have no policy/standard home, so they are
// listed by risk with the same risk-profile columns as the governance card.
function renderPreDoraCard(assessment) {
  const facts = (assessment.riskPolicyFacts || []).filter(f => f.controlType === 'operational');
  const risks = buildRiskProfile(facts);
  const title = 'Control Operationalisation Coverage &mdash; Pre-DORA';
  const desc  = 'Pre-DORA operational controls (narrow disruption-risk scope) &mdash; the risks they mitigate and the control assurance behind them.';
  const elevOn = window._rpElevated !== false;
  const header = `
    <div class="measure-card-header">
      <span class="measure-icon">🎯</span>
      <div style="flex:1"><h3 class="measure-card-title">${title}</h3><p class="measure-card-desc">${desc}</p></div>
      ${risks.length ? rpElevToggle() : ''}
    </div>`;
  if (!risks.length) {
    return `<div class="card measure-card">${header}<p class="policy-no-data" style="margin:.5rem 0">No pre-DORA controls yet.</p></div>`;
  }
  return `
    <div class="card measure-card rp-card${elevOn ? ' rp-elevated' : ''}">
      ${header}
      <div class="rcsa-table-wrap">${renderRiskProfileTable(risks, false)}</div>
    </div>`;
}

// ── IT Risk & Control Framework card (per policy type) ─────────────
// The assurance + residual-risk layer: same risk-profile table as the other
// cards, scoped by what a control evidences, plus a measure-axis rollup.
function renderFrameworkCard(assessment, theme) {
  const fc = buildFrameworkCard(assessment.policyRows || [], assessment.riskPolicyFacts || [], theme.key);
  const title = `IT Risk &amp; Control Framework &mdash; ${theme.name}`;
  const desc  = theme.desc;
  const elevOn = window._rpElevated !== false;

  const pills = [];
  if (fc.measTotal != null) {
    pills.push(`<span class="fwk-pill fwk-pill-accent" title="risk-treatment measures of this type evidenced by a live control">${fc.measOped} / ${fc.measTotal} operationalised</span>`);
  } else {
    pills.push(`<span class="fwk-pill fwk-pill-count">${fc.risks.length} risk${fc.risks.length === 1 ? '' : 's'}</span>`);
  }
  if (fc.severe)      pills.push(`<span class="fwk-pill fwk-pill-danger">${fc.severe} severe residual</span>`);
  if (fc.notAssessed) pills.push(`<span class="fwk-pill fwk-pill-ghost">${fc.notAssessed} not assessed</span>`);
  if (fc.weakestConf) {
    const cls = fc.weakestConf === 'Low' ? 'fwk-pill-danger' : fc.weakestConf === 'Medium' ? 'fwk-pill-warn' : 'fwk-pill-ok';
    pills.push(`<span class="fwk-pill ${cls}">weakest confidence ${fc.weakestConf}</span>`);
  }

  const header = `
    <div class="measure-card-header">
      <span class="measure-icon">🛡️</span>
      <div style="flex:1"><h3 class="measure-card-title">${title}</h3><p class="measure-card-desc">${desc}</p></div>
      ${fc.risks.length ? rpElevToggle() : ''}
    </div>`;
  if (!fc.risks.length) {
    return `<div class="card measure-card">${header}<p class="policy-no-data" style="margin:.5rem 0">No controls evidencing ${theme.name.toLowerCase()} yet.</p></div>`;
  }
  return `
    <div class="card measure-card rp-card${elevOn ? ' rp-elevated' : ''}">
      ${header}
      <div class="fwk-rollup">${pills.join('')}</div>
      <div class="rcsa-table-wrap">${renderRiskProfileTable(fc.risks, true)}</div>
    </div>`;
}

// ── Shared 4-table body (used by the card AND import review screens) ──
function renderFactSummaryTables(curr, prevF) {
  curr  = curr  || {};
  prevF = prevF || {};

  // ── Trend arrow ───────────────────────────────────────────────
  function arrow(cv, pv) {
    if (pv === null || pv === undefined) return '';
    const d = cv - pv;
    if (d > 0) return `<span class="ft-trend-up"> ▲${d}</span>`;
    if (d < 0) return `<span class="ft-trend-dn"> ▼${Math.abs(d)}</span>`;
    return '';
  }

  // ── Build lookup from previous rows ──────────────────────────
  function prevMap(rows, keyFn) {
    const m = {};
    (rows || []).forEach(r => { m[keyFn(r)] = r; });
    return m;
  }

  // ── REMOVED rows: in prev but not in current ──────────────────
  function removedRows(currRows, prevRows, keyFn) {
    const currKeys = new Set((currRows || []).map(keyFn));
    return (prevRows || []).filter(r => !currKeys.has(keyFn(r)));
  }

  // ── Table 1: Policy Objectives ────────────────────────────────
  function renderPoTable() {
    const rows = curr.policyObjectives || [];
    const pm   = prevMap(prevF.policyObjectives, r => r.capId + '||' + r.document);
    const gone = removedRows(rows, prevF.policyObjectives, r => r.capId + '||' + r.document);

    if (!rows.length && !gone.length) return '';

    const activeHtml = rows.map(r => {
      const p = pm[r.capId + '||' + r.document];
      return `<tr>
        <td class="ft-td-cap">${shortName(r.capName)}</td>
        <td class="ft-td-doc">${r.document}</td>
        <td class="ft-col-ps">${r.ps1}${arrow(r.ps1, p?.ps1)}</td>
        <td class="ft-col-ps">${r.ps2}${arrow(r.ps2, p?.ps2)}</td>
        <td class="ft-col-ps">${r.ps3}${arrow(r.ps3, p?.ps3)}</td>
      </tr>`;
    }).join('');

    const removedHtml = gone.map(r => `<tr class="ft-row-removed">
      <td class="ft-td-cap">${shortName(r.capName)}</td>
      <td class="ft-td-doc">${r.document}&nbsp;<span class="ft-removed-badge">REMOVED</span></td>
      <td class="ft-col-ps ft-removed-val">${r.ps1}</td>
      <td class="ft-col-ps ft-removed-val">${r.ps2}</td>
      <td class="ft-col-ps ft-removed-val">${r.ps3}</td>
    </tr>`).join('');

    return `
      <div class="ft-section">
        <div class="ft-section-hdr ft-hdr-ps">Policy Objectives</div>
        <div class="rcsa-table-wrap">
          <table class="rcsa-metrics-table ft-sub-table">
            <thead><tr>
              <th class="ft-th-cap">Capability</th>
              <th class="ft-th-doc">Document</th>
              <th class="ft-col-ps ft-sub-hdr" title="Total statements">Total</th>
              <th class="ft-col-ps ft-sub-hdr" title="Local Policy">LocPol</th>
              <th class="ft-col-ps ft-sub-hdr" title="Group Standard">GrpStd</th>
            </tr></thead>
            <tbody>${activeHtml}${removedHtml}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── Tables 2 & 3: LocPol / GrpStd Controls ───────────────────
  // Column order: Inherent · Residual · Open · Draft · Controls · Impl · Assessed · Eff · Partly · Not Ass.
  // Identical structure to Operational except "Document" replaces "Risk Title"
  function renderControlTable(fsKey, title, colCls) {
    const rows = curr[fsKey] || [];
    const pm   = prevMap(prevF[fsKey], r => r.capId + '||' + r.document);
    const gone = removedRows(rows, prevF[fsKey], r => r.capId + '||' + r.document);

    if (!rows.length && !gone.length) return '';

    const KEYS = ['open','draft','controls','implemented','assessed','effective','partly','notAssessed'];

    function scoreCell(val, removed) {
      return `<td class="${colCls}${removed ? ' ft-removed-val' : ''}">${val != null ? val.toFixed(1) : '—'}</td>`;
    }
    function dataCells(r, p, cls, removed) {
      return KEYS.map(k =>
        `<td class="${cls}${removed ? ' ft-removed-val' : ''}">${r[k] ?? 0}${removed ? '' : arrow(r[k] ?? 0, p?.[k])}</td>`
      ).join('');
    }

    const activeHtml = rows.map(r => {
      const p = pm[r.capId + '||' + r.document];
      return `<tr>
        <td class="ft-td-cap">${shortName(r.capName)}</td>
        <td class="ft-td-doc">${r.document}</td>
        ${scoreCell(r.inherentScore, false)}
        ${scoreCell(r.residualScore, false)}
        ${dataCells(r, p, colCls, false)}
      </tr>`;
    }).join('');

    const removedHtml = gone.map(r => `<tr class="ft-row-removed">
      <td class="ft-td-cap">${shortName(r.capName)}</td>
      <td class="ft-td-doc">${r.document}&nbsp;<span class="ft-removed-badge">REMOVED</span></td>
      ${scoreCell(r.inherentScore, true)}
      ${scoreCell(r.residualScore, true)}
      ${dataCells(r, null, colCls, true)}
    </tr>`).join('');

    return `
      <div class="ft-section">
        <div class="ft-section-hdr ${colCls.replace('ft-col-','ft-hdr-')}">${title}</div>
        <div class="rcsa-table-wrap">
          <table class="rcsa-metrics-table ft-sub-table">
            <thead><tr>
              <th class="ft-th-cap">Capability</th>
              <th class="ft-th-doc">Document</th>
              <th class="${colCls} ft-sub-hdr" title="Inherent risk score">Inherent</th>
              <th class="${colCls} ft-sub-hdr" title="Residual risk score">Residual</th>
              <th class="${colCls} ft-sub-hdr" title="Open risks">Open</th>
              <th class="${colCls} ft-sub-hdr" title="Draft risks">Draft</th>
              <th class="${colCls} ft-sub-hdr" title="Total controls">Controls</th>
              <th class="${colCls} ft-sub-hdr" title="Implemented">Impl</th>
              <th class="${colCls} ft-sub-hdr" title="Assessed">Assessed</th>
              <th class="${colCls} ft-sub-hdr" title="Effective">Effective</th>
              <th class="${colCls} ft-sub-hdr" title="Partly effective">Partly</th>
              <th class="${colCls} ft-sub-hdr" title="Not assessed">Not Ass.</th>
            </tr></thead>
            <tbody>${activeHtml}${removedHtml}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── Table 4: Pre-DORA Operational ────────────────────────────
  function renderOpTable() {
    const rows = curr.operational || [];
    const keyFn = r => r.capId + '||' + ftNorm(r.riskTitle || '');
    const pm   = prevMap(prevF.operational, keyFn);
    const gone = removedRows(rows, prevF.operational, keyFn);

    if (!rows.length && !gone.length) return '';

    const KEYS = ['open','draft','controls','implemented','assessed','effective','partly','notAssessed'];

    function numCells(r, p, removed) {
      return KEYS.map(k =>
        `<td class="ft-col-p${removed ? ' ft-removed-val' : ''}">${r[k] ?? 0}${removed ? '' : arrow(r[k] ?? 0, p?.[k])}</td>`
      ).join('');
    }
    function scoreCell(val, removed) {
      return `<td class="ft-col-p${removed ? ' ft-removed-val' : ''}">${val != null ? val.toFixed(1) : '—'}</td>`;
    }

    const activeHtml = rows.map(r => {
      const p = pm[keyFn(r)];
      return `<tr>
        <td class="ft-td-cap">${shortName(r.capName)}</td>
        <td class="ft-td-rtitle" title="${r.riskTitle || ''}">${r.riskTitle || '—'}</td>
        ${scoreCell(r.inherentScore, false)}
        ${scoreCell(r.residualScore, false)}
        ${numCells(r, p, false)}
      </tr>`;
    }).join('');

    const removedHtml = gone.map(r => `<tr class="ft-row-removed">
      <td class="ft-td-cap">${shortName(r.capName)}&nbsp;<span class="ft-removed-badge">REMOVED</span></td>
      <td class="ft-td-rtitle ft-removed-val">${r.riskTitle || '—'}</td>
      ${scoreCell(r.inherentScore, true)}
      ${scoreCell(r.residualScore, true)}
      ${numCells(r, null, true)}
    </tr>`).join('');

    return `
      <div class="ft-section">
        <div class="ft-section-hdr ft-hdr-p">Pre-DORA Operational</div>
        <div class="rcsa-table-wrap">
          <table class="rcsa-metrics-table ft-sub-table">
            <thead><tr>
              <th class="ft-th-cap">Capability</th>
              <th class="ft-th-rtitle">Risk Title</th>
              <th class="ft-col-p ft-sub-hdr" title="Inherent risk score">Inherent</th>
              <th class="ft-col-p ft-sub-hdr" title="Residual risk score">Residual</th>
              <th class="ft-col-p ft-sub-hdr" title="Open risk">Open</th>
              <th class="ft-col-p ft-sub-hdr" title="Draft risk">Draft</th>
              <th class="ft-col-p ft-sub-hdr" title="Total controls">Controls</th>
              <th class="ft-col-p ft-sub-hdr" title="Implemented">Impl</th>
              <th class="ft-col-p ft-sub-hdr" title="Assessed">Assessed</th>
              <th class="ft-col-p ft-sub-hdr" title="Effective">Effective</th>
              <th class="ft-col-p ft-sub-hdr" title="Partly effective">Partly</th>
              <th class="ft-col-p ft-sub-hdr" title="Not assessed">Not Ass.</th>
            </tr></thead>
            <tbody>${activeHtml}${removedHtml}</tbody>
          </table>
        </div>
      </div>`;
  }

  return renderPoTable() +
    renderControlTable('locPolControls', 'DORA — Local Policy Controls', 'ft-col-d') +
    renderControlTable('grpStdControls', 'DORA — Group Standard Controls', 'ft-col-g') +
    renderOpTable();
}

// ── Policy Operationalisation + Cross Team Cooperation KPI sections ──
function renderKpiSection(curr, prevF, currA, prevA) {
  const ks     = curr?.kpiSummary  || {};
  const prevKs = prevF?.kpiSummary || {};

  function pct(n, d)  { return d > 0 ? Math.round((n / d) * 100) : null; }
  function ppArrow(cv, pv, lowerIsBetter) {
    if (pv == null || cv == null) return '';
    const d = cv - pv;
    if (!d) return '';
    const good = lowerIsBetter ? d < 0 : d > 0;
    return good
      ? `<span class="ft-trend-up"> ▲${Math.abs(d)}pp</span>`
      : `<span class="ft-trend-dn"> ▼${Math.abs(d)}pp</span>`;
  }
  function nArrow(cv, pv, lowerIsBetter) {
    if (pv == null || cv == null) return '';
    const d = cv - pv;
    if (!d) return '';
    const good = lowerIsBetter ? d < 0 : d > 0;
    return good
      ? `<span class="ft-trend-up"> ▲${Math.abs(d)}</span>`
      : `<span class="ft-trend-dn"> ▼${Math.abs(d)}</span>`;
  }

  // Generic count/rate row: numKey/denKey read from current (c) and previous (p) sub-objects.
  function row(label, sub, c, p, numKey, denKey, lowerIsBetter, subTitle) {
    if (!c) return '';
    const cp  = pct(c[numKey], c[denKey]);
    const pp2 = p ? pct(p[numKey], p[denKey]) : null;
    const titleAttr = subTitle ? ` title="${subTitle}"` : '';
    return `<tr>
      <td class="kpi-td-label">${label}</td>
      <td class="kpi-td-sub"${titleAttr}>${sub}</td>
      <td class="kpi-td-count">${c[numKey]}/${c[denKey]}${nArrow(c[numKey], p?.[numKey], lowerIsBetter)}</td>
      <td class="kpi-td-pct">${cp != null ? cp+'%' : '—'}${ppArrow(cp, pp2, lowerIsBetter)}</td>
    </tr>`;
  }

  function tableBlock(title, rows) {
    if (!rows.length) return '';
    return `
      <div class="ft-section">
        <div class="ft-section-hdr kpi-section-hdr">${title}</div>
        <div class="rcsa-table-wrap">
          <table class="rcsa-metrics-table ft-sub-table kpi-table">
            <thead><tr>
              <th class="kpi-td-label">KPI</th>
              <th class="kpi-td-sub">Description</th>
              <th class="kpi-td-count">Count</th>
              <th class="kpi-td-pct">Rate</th>
            </tr></thead>
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── Block 1: Policy Operationalisation ──────────────────────────
  const polRows = [];
  polRows.push(row('LocPol Coverage', 'Local-policy statements referenced by ≥1 control (any status)',
    ks.locPolCoverage, prevKs.locPolCoverage, 'covered', 'total', false));
  polRows.push(row('LocPol Blind Spots', 'Statements with no implemented control',
    ks.locPolOperationalisation, prevKs.locPolOperationalisation, 'blindSpots', 'total', true));
  polRows.push(row('GrpStd Coverage', 'Group-standard requirements referenced by ≥1 control (any status)',
    ks.grpStdCoverage, prevKs.grpStdCoverage, 'covered', 'total', false));
  polRows.push(row('GrpStd Operationalised', 'Requirements with ≥1 implemented control',
    ks.grpStdOperationalisation, prevKs.grpStdOperationalisation, 'operationalised', 'total', false));
  polRows.push(row('Orphan Controls', 'Policy controls citing a ref not in the policy register',
    ks.orphanControls, prevKs.orphanControls, 'orphans', 'total', true));
  if (ks.policyControlEffectiveness && ks.policyControlEffectiveness.total > 0) {
    polRows.push(row('Policy Control Effectiveness', 'Implemented policy controls rated effective (green design + op)',
      ks.policyControlEffectiveness, prevKs.policyControlEffectiveness, 'effective', 'total', false));
  } else if (ks.policyControlEffectiveness) {
    polRows.push(`<tr>
      <td class="kpi-td-label">Policy Control Effectiveness</td>
      <td class="kpi-td-sub">Implemented policy controls rated effective (green design + op)</td>
      <td class="kpi-td-count kpi-not-recorded" colspan="2">No implemented policy controls yet</td>
    </tr>`);
  }
  polRows.push(row('GrpStd Localisation', 'Requirements a local policy maps to (via cited ref)',
    ks.grpStdLocalisation, prevKs.grpStdLocalisation, 'localised', 'total', false));
  if (ks.chainCompleteness) {
    const c = ks.chainCompleteness, p = prevKs.chainCompleteness;
    const cp = pct(c.complete, c.total), pp2 = p ? pct(p.complete, p.total) : null;
    const gaps = (c.details || [])
      .filter(d => !d.complete)
      .map(d => {
        const missing = ['Policy','Risk','Control','Assessed']
          .filter((_, i) => ![d.hasPolicy,d.hasRisk,d.hasControl,d.hasAssessment][i]);
        return `${shortName(d.capName)}: missing ${missing.join(', ')}`;
      }).join('\n');
    polRows.push(`<tr>
      <td class="kpi-td-label">Full Chain Complete</td>
      <td class="kpi-td-sub" title="${gaps}">Policy → Risk → Control → Assessment (hover for gaps)</td>
      <td class="kpi-td-count">${c.complete}/${c.total}${nArrow(c.complete, p?.complete, false)}</td>
      <td class="kpi-td-pct">${cp != null ? cp+'%' : '—'}${ppArrow(cp, pp2, false)}</td>
    </tr>`);
  }

  // ── Block 2: Cross Team Cooperation (manual KPIs) ───────────────
  const ctcRows = [];

  // Manual KPIs from config
  (CONFIG.kpis || []).forEach(kpi => {
    const cv = currA?.kpiValues?.[kpi.id];
    const pv = prevA?.kpiValues?.[kpi.id];
    const hasData = cv && (cv.d > 0);
    if (!hasData) {
      ctcRows.push(`<tr>
        <td class="kpi-td-label">${kpi.label}</td>
        <td class="kpi-td-sub">${kpi.description}</td>
        <td class="kpi-td-count kpi-not-recorded" colspan="2">Not recorded this period</td>
      </tr>`);
      return;
    }
    const cp = pct(cv.n, cv.d);
    const pp2 = (pv && pv.d > 0) ? pct(pv.n, pv.d) : null;
    ctcRows.push(`<tr>
      <td class="kpi-td-label">${kpi.label}</td>
      <td class="kpi-td-sub">${kpi.description}</td>
      <td class="kpi-td-count">${cv.n}/${cv.d}${nArrow(cv.n, pv?.n, false)}</td>
      <td class="kpi-td-pct">${cp != null ? cp+'%' : '—'}${ppArrow(cp, pp2, false)}</td>
    </tr>`);
  });

  const filteredCtc = ctcRows.filter(Boolean);
  return tableBlock('Cross Team Cooperation', filteredCtc);
}

// ── Risk themes (by control type) ────────────────────────────
const RISK_THEMES = [
  { key: 'locPol',      name: 'Local Policy',   dora: true,  rowBy: 'document', rowHeader: 'Local policy',   covPrefix: 'Policy Operationalisation Coverage',  desc: 'Every control evidencing a local policy — new or reused pre-DORA — the risks they touch and the control assurance behind them.', covDesc: "Operational compliance is measured by the percentage of each local policy's controls that are owned, implemented and assessed." },
  { key: 'grpStd',      name: 'Group Standard', dora: true,  rowBy: 'document', rowHeader: 'Group standard', covPrefix: 'Policy Operationalisation Coverage',  desc: 'Every control evidencing a group standard — new or reused pre-DORA — the risks they touch and the control assurance behind them.', covDesc: "Operational compliance is measured by the percentage of each group standard's controls that are owned, implemented and assessed." },
  { key: 'operational', name: 'Pre-DORA',       dora: false, rowBy: 'risk',     rowHeader: 'Risk',           covPrefix: 'Control Operationalisation Coverage', desc: 'Pre-DORA operational controls — narrow disruption-risk scope &amp; operational controls.', covDesc: "Operational compliance is measured by the percentage of each risk's controls that are owned, implemented and assessed." },
];

// Main (working) screen: only the Pre-DORA control-operationalisation card.
// The Local Policy / Group Standard operationalisation cards were removed.
function renderThemedRiskSection(assessment, prev) {
  return `<div class="theme-block">${renderPreDoraCard(assessment)}</div>`;
}

// Quarter-over-quarter arrow — green when the change is in the good direction.
function qoqArrow(curr, prev, lowerIsBetter) {
  if (prev == null || curr == null) return '';
  const d = Math.round((curr - prev) * 10) / 10;
  if (!d) return '';
  const good = lowerIsBetter ? d < 0 : d > 0;
  return ` <span class="qoq ${good ? 'qoq-good' : 'qoq-bad'}" title="was ${prev} last period">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</span>`;
}

// ── Risk Management — Portfolio Health Card ──────────────────
// theme (optional) = { key, name, dora }: scopes the card to one control type.
// prev (optional) = previous assessment, for quarter-over-quarter arrows.
// Radial gauge for the card's headline "% of controls implemented" — the
// single number an exec can point at as "our operational compliance here".
function rmGauge(pct) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const r = 25, c = 2 * Math.PI * r, off = c * (1 - p / 100);
  return `<div class="rm-gauge">
    <svg width="62" height="62" viewBox="0 0 62 62" aria-hidden="true">
      <circle cx="31" cy="31" r="${r}" fill="none" stroke="var(--clr-fill-dark)" stroke-width="7"/>
      <circle cx="31" cy="31" r="${r}" fill="none" stroke="var(--theme-acc,var(--accent))" stroke-width="7"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
        transform="rotate(-90 31 31)"/>
      <text x="31" y="36" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text)">${p}%</text>
    </svg>
    <span class="rm-gauge-cap">Implemented</span>
  </div>`;
}

// Control-assurance funnel for the exec theme cards: Owned → Implemented →
// Tested → Effective, each as a share of this theme's controls. Bars only ever
// shrink down the funnel, so the drop-off ("owned but not proven") is visible.
function rmFunnel(s, sp) {
  const stages = [
    ['Owned',       s.ctrlOwnedPct,     sp && sp.ctrlOwnedPct,     s.ctrlOwned,       'unassigned'],
    ['Implemented', s.implementedPct,   sp && sp.implementedPct,   s.ctrlImplemented, 'not in place'],
    ['Tested',      s.ctrlTestedPct,    sp && sp.ctrlTestedPct,    s.ctrlTested,      'untested'],
    ['Effective',   s.ctrlEffectivePct, sp && sp.ctrlEffectivePct, s.ctrlEffective,   'unproven'],
  ];
  const rows = stages.map(([label, p, prev, n, gap]) => {
    const comp = 100 - p;
    return `
      <div class="rmf-stage">
        <div class="rmf-row">
          <span class="rmf-lbl">${label}</span>
          <span class="rmf-bar"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></span>
          <span class="rmf-val">${p}%${qoqArrow(p, prev, false)}</span>
        </div>
        <div class="rmf-gap">${n}/${s.ctrlCount}${comp ? ` · ${comp}% ${gap}` : ''}</div>
      </div>`;
  }).join('');
  return `<div class="rmf">
    <div class="rmf-title">Control assurance <span class="rmf-note">of ${s.ctrlCount} controls</span></div>
    ${rows}</div>`;
}

function renderRiskPortfolioCard(assessment, theme, prev, opts = {}) {
  const tk = theme ? theme.key : null;
  const s  = buildRiskPortfolioSummary(assessment.riskPolicyFacts || [], tk);
  const sp = prev ? buildRiskPortfolioSummary(prev.riskPolicyFacts || [], tk) : null;
  const title = theme ? `IT Risk &amp; Control Framework — ${theme.name}` : 'Risk Management — Portfolio Health';
  const desc  = theme ? theme.desc
    : 'Operational compliance — are we doing what our local policies, group standards and DORA say we should? The control evidence behind our risk ratings, from the RCSA.';

  if (!s) {
    return `
      <div class="card measure-card">
        <div class="measure-card-header">
          <span class="measure-icon">🛡️</span>
          <div><h3 class="measure-card-title">${title}</h3><p class="measure-card-desc">${desc}</p></div>
        </div>
        <p class="policy-no-data" style="margin:.5rem 0">No ${theme ? theme.name.toLowerCase() + ' controls' : 'risk data'} yet.</p>
      </div>`;
  }

  const tk2 = theme ? theme.key : '';
  const tile = (label, num, sub, cls, onclick) => `
    <div class="rm-tile${onclick ? ' rm-tile-clickable' : ''}"${onclick ? ` onclick="${onclick}" title="Click for the per-risk breakdown"` : ''}>
      <div class="rm-tile-lbl">${label}${onclick ? ' <span class="rm-tile-more">▸</span>' : ''}</div>
      <div class="rm-tile-num ${cls || ''}">${num}</div>
      <div class="rm-tile-sub">${sub}</div>
    </div>`;

  // Exec-report slim card: two risk tiles (Risks Assessed, Severe) plus a
  // control-assurance funnel (Owned → Implemented → Tested → Effective).
  // In-card callouts are dropped here — the exec report summarises them once
  // below all three cards.
  if (opts.exec && theme) {
    const raComp = 100 - s.assessedPct;
    const raSub  = raComp ? `${raComp}% spotted but not yet managed (${s.assessed}/${s.active})` : `all active risks rated (${s.assessed}/${s.active})`;
    const dynDesc = `${s.active} risk${s.active === 1 ? '' : 's'} — ${s.assessedPct}% assessed, ${s.severe} severe. ${s.ctrlCount} control${s.ctrlCount === 1 ? '' : 's'} — ${s.implementedPct}% implemented, ${s.ctrlEffectivePct}% effective.`;
    const slimTiles = [
      tile('Risks Assessed', s.assessedPct + '%' + qoqArrow(s.assessedPct, sp?.assessedPct, false), raSub, ''),
      tile('Severe',         s.severe + qoqArrow(s.severe, sp?.severe, true), `residual ≥ ${s.severeThreshold} (${s.severe}/${s.assessed})`, s.severe > 0 ? 'rm-num-warn' : ''),
    ].join('');
    return `
      <div class="card measure-card rm-card rm-theme-${theme.key}">
        <div class="measure-card-header">
          <span class="measure-icon">🛡️</span>
          <div style="flex:1">
            <h3 class="measure-card-title">${title}</h3>
            <p class="measure-card-desc">${dynDesc}</p>
          </div>
        </div>
        <div class="rm-tiles rm-tiles-slim">${slimTiles}</div>
        ${rmFunnel(s, sp)}
      </div>`;
  }

  // DORA themes swap Risk Reduction (not control-type-attributable) for
  // implemented rate; Pre-DORA keeps the reduction tile with its drill-down.
  const fifthTile = (theme && theme.dora)
    ? tile('Controls Implemented', s.implementedPct + '%' + qoqArrow(s.implementedPct, sp?.implementedPct, false), `of ${theme.name.toLowerCase()} controls implemented (${s.ctrlImplemented}/${s.ctrlCount})`, '')
    : tile('Risk Reduction', (s.reductionPct != null ? s.reductionPct + '%' : '—') + qoqArrow(s.reductionPct, sp?.reductionPct, false), `How far our controls cut risk, from inherent down to residual (${s.avgInherent} → ${s.avgResidual})`, 'rm-num-good', `showRiskReductionModal('${assessment.id}', '${tk2}')`);

  const tiles = [
    tile('Total Risks',      s.total, `${s.open} open · ${s.draft} draft · ${s.closed} closed`, ''),
    tile('Risks Assessed',   s.assessedPct + '%' + qoqArrow(s.assessedPct, sp?.assessedPct, false), `${s.assessed} of ${s.active} active risks rated`, ''),
    tile('Severe',           s.severe + qoqArrow(s.severe, sp?.severe, true), `residual ≥ ${s.severeThreshold} (${s.severe}/${s.assessed} assessed)`, s.severe > 0 ? 'rm-num-warn' : ''),
    tile('Control Coverage', (s.ctrlCoveragePct != null ? s.ctrlCoveragePct + '%' : '—') + qoqArrow(s.ctrlCoveragePct, sp?.ctrlCoveragePct, false), `How much of the control evidence behind our risk ratings has actually been checked (${s.ctrlAssessed}/${s.ctrlTotal})`, ''),
    fifthTile,
    tile('Under-assured',    s.underAssuredCount + qoqArrow(s.underAssuredCount, sp?.underAssuredCount, true), `Risk ratings we couldn't defend to an auditor yet — rated, but the controls weren't checked (${s.underAssuredCount}/${s.assessed})`, s.underAssuredCount > 0 ? 'rm-num-warn' : '', `showUnderAssuredModal('${assessment.id}', '${tk2}')`),
  ].join('');

  // Severity distribution bar — portfolio view only (dropped on theme cards).
  const sevDefs = [
    { k: 'extreme',     label: 'Extreme',     color: '#b34d4d' },
    { k: 'significant', label: 'Significant', color: '#bc7439' },
    { k: 'moderate',    label: 'Moderate',    color: '#d1c73b' },
    { k: 'low',         label: 'Low',         color: '#418f64' },
  ];
  const totalSev = sevDefs.reduce((n, d) => n + s.severity[d.k], 0);
  const segs = totalSev > 0
    ? sevDefs.filter(d => s.severity[d.k] > 0).map(d =>
        `<div class="rm-sev-seg" style="width:${100 * s.severity[d.k] / totalSev}%;background:${d.color}" title="${d.label}: ${s.severity[d.k]}"></div>`).join('')
    : '<div class="rm-sev-empty">No assessed risks yet</div>';
  const legend = sevDefs.map(d =>
    `<span class="rm-sev-leg"><span class="rm-sev-dot" style="background:${d.color}"></span>${d.label} ${s.severity[d.k]}</span>`).join('');
  const sevBlock = theme ? '' : `
      <div class="rm-sev">
        <div class="rm-sev-hdr">Residual severity of assessed risks</div>
        <div class="rm-sev-bar">${segs}</div>
        <div class="rm-sev-legend">${legend}</div>
      </div>`;

  const trunc = t => (t.length > 42 ? t.slice(0, 42) + '…' : t);
  const under = s.underAssuredCount ? `
    <div class="rm-underassured">
      <span class="rm-ua-flag">⚠ ${s.underAssuredCount} assessed ${s.underAssuredCount === 1 ? 'risk' : 'risks'} not backed by control evidence (&lt; ${s.underAssuredFloor}% of controls assessed):</span>
      <span class="rm-ua-list">${s.underAssured.map(trunc).join(' · ')}</span>
      <span class="rm-ua-more" onclick="showUnderAssuredModal('${assessment.id}', '${tk2}')">See all →</span>
    </div>` : '';

  const weak = s.weakMitigationCount ? `
    <div class="rm-underassured">
      <span class="rm-ua-flag">⚠ ${s.weakMitigationCount} ${s.weakMitigationCount === 1 ? 'risk' : 'risks'} where controls aren't earning their keep (&lt; ${s.weakThreshold}% reduction with implemented controls):</span>
      <span class="rm-ua-list">${s.weakMitigation.map(r => `${trunc(r.title)} (${r.reductionPct}%${r.effective ? ', ' + r.effective + ' eff' : ''})`).join(' · ')}</span>
      <span class="rm-ua-more" onclick="showRiskReductionModal('${assessment.id}', '${tk2}')">See all →</span>
    </div>` : '';

  return `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">🛡️</span>
        <div>
          <h3 class="measure-card-title">${title}</h3>
          <p class="measure-card-desc">${desc}</p>
        </div>
      </div>
      <button class="btn-link ratings-link" onclick="showMetricsModal('riskPortfolio')">ℹ Metrics</button>
      <div class="rm-tiles">${tiles}</div>
      ${sevBlock}
      ${under}
      ${weak}
    </div>`;
}

// ── Policy Operationalisation Coverage Card ──────────────────
// Per-capability funnel: five independent coverage bars + a confidence chip
// that judges how well risk-assessment claims are backed by control evidence.
const OPCOV_THEME_NAME = { locPol: 'Local Policy', grpStd: 'Group Standard', operational: 'Pre-DORA' };
// Tag naming the other themed report(s) a row's risk also appears in, so a
// cross-theme overlap (e.g. a GrpStd risk keeping a pre-DORA control) reads as
// intentional rather than as duplication.
function opcovAlsoIn(keys) {
  if (!keys || !keys.length) return '';
  const order = { locPol: 0, grpStd: 1, operational: 2 };
  const names = keys.slice().sort((a, b) => (order[a] ?? 9) - (order[b] ?? 9))
    .map(k => OPCOV_THEME_NAME[k] || k);
  return `<span class="opcov-xtheme" title="This risk is also mitigated by ${names.join(' & ')} controls — shown in that report with those controls">↔ also in ${names.join(', ')}</span>`;
}

function renderOpCoverageCard(assessment, theme) {
  const rowBy = theme ? theme.rowBy : null;
  const named = !!rowBy && rowBy !== 'capability';
  const oc = buildOperationalisationCoverage(assessment.riskPolicyFacts || [], theme ? theme.key : null, rowBy, assessment.policyRows || []);
  const ocTitle = theme ? `${theme.covPrefix} — ${theme.name}` : 'Policy Operationalisation Coverage';
  if (!oc.rows.length) {
    return `
      <div class="card measure-card">
        <div class="measure-card-header">
          <span class="measure-icon">🎯</span>
          <div>
            <h3 class="measure-card-title">${ocTitle}</h3>
            <p class="measure-card-desc">${theme && theme.covDesc ? theme.covDesc : "Operational compliance is measured by the percentage of controls that are owned, implemented and assessed."}</p>
          </div>
        </div>
        <p class="policy-no-data" style="margin:.5rem 0">No ${theme ? theme.name.toLowerCase() + ' controls' : 'risk data imported'} yet.</p>
      </div>`;
  }

  const bar = o => {
    const p = o.d > 0 ? Math.round(100 * o.n / o.d) : 0;
    return `<div class="opcov-cell">
      <div class="opcov-bar"><div class="opcov-bar-fill" style="width:${p}%"></div></div>
      <span class="opcov-val"><b>${o.d > 0 ? p + '%' : '—'}</b><span class="opcov-frac">${o.n}/${o.d}</span></span>
    </div>`;
  };

  // Binary Yes/No — Yes only when every risk in the row qualifies.
  const yesNo = o => {
    if (o.d === 0) return `<span class="opcov-yn opcov-yn-na" title="no risks">—</span>`;
    const yes = o.n === o.d;
    return `<span class="opcov-yn ${yes ? 'opcov-yn-yes' : 'opcov-yn-no'}" title="${o.n}/${o.d}">${yes ? 'Yes' : 'No'}</span>`;
  };

  const chipMap = {
    none:     { cls: 'opcov-chip-none',     txt: '– None' },
    low:      { cls: 'opcov-chip-low',      txt: '⚠ Low' },
    building: { cls: 'opcov-chip-building', txt: '◐ Building' },
    ok:       { cls: 'opcov-chip-ok',       txt: '● OK' },
  };

  // Name cell: document rows list each risk beneath the document, with a
  // per-risk cross-theme tag; risk rows tag themselves; capability rows plain.
  const nameCell = r => {
    if (rowBy === 'document') {
      const risks = (r.risks || []).map(rk =>
        `<span class="opcov-risk">${rk.title}${opcovAlsoIn(rk.alsoIn)}</span>`).join('');
      return `<span class="opcov-doc">${r.capName}</span>${risks}`;
    }
    if (named) return `${r.capName}${opcovAlsoIn(r.alsoIn)}`;
    return shortName(r.capName);
  };

  const bodyRows = oc.rows.map(r => {
    const c = chipMap[r.chip] || chipMap.none;
    const title = r.index != null
      ? `Confidence ${r.index}% = control-assessed ÷ risk-assessed`
      : 'No approved risks assessed yet';
    return `<tr>
      <td class="opcov-cap" title="${r.capName}">${nameCell(r)}</td>
      <td>${yesNo(r.approved)}</td>
      <td>${yesNo(r.assessed)}</td>
      <td>${bar(r.owned)}</td>
      <td>${bar(r.implemented)}</td>
      <td>${bar(r.ctrlAssessed)}</td>
      <td class="opcov-chip-cell"><span class="opcov-chip ${c.cls}" title="${title}">${c.txt}</span></td>
    </tr>`;
  }).join('');

  const ru = oc.rollup;
  const rollup = [
    ru.low      ? `<span class="opcov-chip opcov-chip-low">${ru.low} Low</span>` : '',
    ru.building ? `<span class="opcov-chip opcov-chip-building">${ru.building} Building</span>` : '',
    ru.ok       ? `<span class="opcov-chip opcov-chip-ok">${ru.ok} OK</span>` : '',
    ru.none     ? `<span class="opcov-chip opcov-chip-none">${ru.none} None</span>` : '',
  ].filter(Boolean).join('');

  return `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">🎯</span>
        <div style="flex:1">
          <h3 class="measure-card-title">${ocTitle}</h3>
          <p class="measure-card-desc">${theme && theme.covDesc ? theme.covDesc : "Operational compliance is measured by the percentage of controls that are owned, implemented and assessed."}</p>
        </div>
        <div class="opcov-rollup">${rollup}</div>
      </div>
      <div class="card-info-links">
        <button class="btn-link ratings-link ratings-link-inline" onclick="showMetricsModal('opCoverage')">ℹ Metrics</button>
        <button class="btn-link ratings-link ratings-link-inline" onclick="showConfidenceModal()">ℹ Confidence</button>
      </div>
      <div class="rcsa-table-wrap">
        <table class="opcov-table${named ? ' opcov-table-named' : ''}">
          <thead><tr>
            <th class="opcov-cap">${theme ? theme.rowHeader : ''}</th>
            <th>Risks Approved<span class="opcov-th-sub">Yes if all open</span></th>
            <th>Risks Assessed<span class="opcov-th-sub">Yes if all rated</span></th>
            <th>Ctrl Owned<span class="opcov-th-sub">owned / controls</span></th>
            <th>Ctrl Impl<span class="opcov-th-sub">impl / controls</span></th>
            <th>Ctrl Assessed<span class="opcov-th-sub">assessed / controls</span></th>
            <th class="opcov-chip-cell">Confidence</th>
          </tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
      ${renderOpCoverageLegend()}
    </div>`;
}

// ── In-card legend (so it travels with the screenshot into slides) ──
function renderOpCoverageLegend() {
  const cfg   = (CONFIG && CONFIG.opCoverage) || {};
  const floor = cfg.ownershipFloorPct != null ? cfg.ownershipFloorPct : 20;
  const low   = cfg.confidenceLowPct  != null ? cfg.confidenceLowPct  : 40;
  const ok    = cfg.confidenceOkPct   != null ? cfg.confidenceOkPct   : 75;
  return `
    <div class="opcov-legend">
      <span class="opcov-legend-lead"><b>Confidence</b> = controls assessed ÷ risks assessed — how well risk conclusions are backed by control evidence:</span>
      <span class="opcov-legend-item"><span class="opcov-chip opcov-chip-ok">● OK</span> evidence keeps pace (≥ ${ok}%)</span>
      <span class="opcov-legend-item"><span class="opcov-chip opcov-chip-building">◐ Building</span> partial evidence (${low}–${ok - 1}%)</span>
      <span class="opcov-legend-item"><span class="opcov-chip opcov-chip-low">⚠ Low</span> risks ran ahead of controls (&lt; ${low}%, or &lt; ${floor}% of controls owned)</span>
      <span class="opcov-legend-item"><span class="opcov-chip opcov-chip-none">– None</span> no risks assessed yet</span>
    </div>`;
}

// ── ICT Risk Management Metrics Card ─────────────────────────
// mode 'detail' (edit assessment screen): full fact-summary tables.
// mode 'exec'   (executive report):       Coverage & Governance KPI metrics only.
function renderRiskMgmtSummaryCard(assessment, prev, mode = 'detail') {
  const curr  = assessment.factSummary || {};
  const prevF = prev?.factSummary     || {};

  if (mode === 'exec') {
    // Recompute kpiSummary live from stored facts so new metric definitions
    // apply to previously-saved assessments without needing a re-import.
    const currLive = { ...curr,  kpiSummary: buildKpiSummary(assessment.policyRows || [], assessment.riskPolicyFacts || []) };
    const prevLive = prev
      ? { ...prevF, kpiSummary: buildKpiSummary(prev.policyRows || [], prev.riskPolicyFacts || []) }
      : {};
    const kpiHtml = renderKpiSection(currLive, prevLive, assessment, prev);
    return `
      <div class="card measure-card">
        <div class="measure-card-header">
          <span class="measure-icon">🛡️</span>
          <div>
            <h3 class="measure-card-title">ICT RCSA &amp; CSA — Risk Management Metrics</h3>
            <p class="measure-card-desc">Coverage &amp; governance KPIs derived from Riskonnect and Policy Statement imports.${prev ? ' ▲▼ shows movement vs previous assessment.' : ''}</p>
          </div>
        </div>
        <button class="btn-link ratings-link" onclick="showMetricsModal('rcsa')">ℹ Metrics</button>
        ${kpiHtml || '<p class="policy-no-data" style="margin:.5rem 0">No KPI metrics recorded yet.</p>'}
      </div>`;
  }

  const noData = !curr.policyObjectives?.length && !curr.locPolControls?.length &&
                 !curr.grpStdControls?.length   && !curr.operational?.length;

  return `
    <div class="card measure-card">
      <div class="measure-card-header">
        <span class="measure-icon">🛡️</span>
        <div>
          <h3 class="measure-card-title">ICT RCSA &amp; CSA — Risk Management Metrics</h3>
          <p class="measure-card-desc">Metrics derived from Riskonnect and Policy Statement imports.${prev ? ' ▲▼ shows movement vs previous assessment.' : ''}</p>
        </div>
      </div>
      <button class="btn-link ratings-link" onclick="showMetricsModal('rcsa')">ℹ Metrics</button>
      ${noData ? '<p class="policy-no-data" style="margin:.5rem 0">No risk or policy data imported yet.</p>' : ''}
      ${renderFactSummaryTables(curr, prevF)}
    </div>`;
}
