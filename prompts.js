// ── AI prompts for the Control-traceability table (one risk at a time) ──────
//
// The "✨ Prompts" button on the "<lens> → Control traceability (full export)"
// card opens this popup. Pick a risk and one of three prompts; the popup builds
// a ready-to-paste prompt that embeds the traceability extract for that one risk
// (the risk, the lens objectives it threatens, the statements covering those
// objectives and the controls operationalising them). The user copies it into
// their AI tool.
//
// The three prompts:
//   1. Validate the risk   — is the risk description really related to, and a
//                            threat to, the objectives it is mapped to? If not,
//                            output an improved description.
//   2. Control coverage    — do we need new draft controls to meet the policy
//                            statements? Output a table of proposed controls.
//   3. Reduce controls     — which controls can be merged into one? Output the
//                            controls to merge + the single merged control.

var _promptsA = (typeof _promptsA !== 'undefined') ? _promptsA : null;
var _promptsLens = (typeof _promptsLens !== 'undefined') ? _promptsLens : 'dora';
var _promptRisk = '';
var _promptKind = 'validate';

const PROMPT_KINDS = [
  { id: 'validate', label: '1 · Validate the risk',
    desc: 'Checks the risk description is genuinely related to — and a threat to — the objectives it is mapped to. If not, it returns an improved risk description.' },
  { id: 'coverage', label: '2 · Control coverage',
    desc: 'Looks at the policy statements and the controls behind them, and proposes new draft controls where a statement is not yet met by a live control.' },
  { id: 'reduce', label: '3 · Reduce number of controls',
    desc: 'Finds controls that pursue the same objective and suggests how to merge and reword them into a single control, keeping full coverage.' },
];

// Run fn with the lens the card was drawn under, so the extract matches the table.
function _promptsWithLens(fn) {
  const run = (typeof withLens === 'function') ? withLens : (k, f) => f();
  return run(_promptsLens, fn);
}

// Lens label for the prompt wording (DORA / MiCA / NIST CSF).
function _promptLensLabel() {
  return _promptsWithLens(() => (typeof lensLabel === 'function') ? lensLabel() : 'DORA');
}

// The active lens's RCSA facts (risk × control, from the Riskonnect import).
function _promptFacts() {
  return _promptsWithLens(() => (typeof lensFacts === 'function') ? lensFacts(_promptsA) : (_promptsA.riskPolicyFacts || []));
}
function _promptCtrlKey(f) { return f.capId + '|' + ftNorm(f.controlNumber) + '|' + ftNorm(f.controlName); }
function _promptIsLiveFact(f) {
  return !(typeof ftIsClosedControl === 'function' && ftIsClosedControl(f)) && (f.controlName || '').trim();
}

// Distinct risks (from the RCSA facts) that threaten a lens objective — i.e. a
// control treating the risk backs a statement mapped to an objective. Carries the
// risk description from the import. For the dropdown.
function _promptRiskList(all, facts) {
  const objCtrlKeys = new Set(all.filter(r => r._oKey && r._cKey).map(r => r._cKey));
  const out = new Map();
  (facts || []).forEach(f => {
    if (!_promptIsLiveFact(f)) return;
    const rt = (f.riskTitle || '').trim(); if (!rt) return;
    if (!objCtrlKeys.has(_promptCtrlKey(f))) return;   // this control backs no mapped objective
    if (!out.has(rt)) out.set(rt, (f.riskDesc || '').trim());
    else if (!out.get(rt) && (f.riskDesc || '').trim()) out.set(rt, f.riskDesc.trim());
  });
  return [...out].map(([title, desc]) => ({ title, desc })).sort((a, b) => a.title.localeCompare(b.title));
}

// The traceability extract for one risk: the risk's controls are found in the
// RCSA facts, then every traceability row for the objectives those controls back
// is included (so statements with no/only-draft controls show up as coverage
// gaps, not just the statements whose control already treats the risk).
// De-duplicated by objective × statement × control.
function _promptExtractRows(all, facts, riskTitle) {
  const ck = new Set();
  (facts || []).forEach(f => {
    if (!_promptIsLiveFact(f)) return;
    if (ftNorm(f.riskTitle) !== ftNorm(riskTitle)) return;
    ck.add(_promptCtrlKey(f));
  });
  const riskRows = all.filter(r => r._oKey && r._cKey && ck.has(r._cKey));
  const objIds = new Set(riskRows.map(r => r._oKey));
  let ext = objIds.size ? all.filter(r => r._oKey && objIds.has(r._oKey))
                        : all.filter(r => r._cKey && ck.has(r._cKey));
  const seen = new Set();
  return ext.filter(r => {
    const k = (r._oKey || '') + '¦' + (r._sKey || '') + '¦' + (r._cKey || '');
    if (seen.has(k)) return false; seen.add(k); return true;
  });
}

function _mdCell(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim() || '—'; }

function _promptExtractTable(rows, LL) {
  const cols = ['Article/RTS', 'Objective', 'Objective text', 'Covered', 'Statement ref', 'Statement header', 'Statement detail', 'Control', 'Control description', 'Control status', 'Effectiveness'];
  const head = '| ' + cols.join(' | ') + ' |';
  const sep  = '| ' + cols.map(() => '---').join(' | ') + ' |';
  const body = rows.map(r => '| ' + [
    r.article, r.objectiveId, r.objective, r.covered, r.statementRef, r.statementHeader,
    r.statementDetail, r.control, r.controlDescription, r.controlStatus, r.effectiveness,
  ].map(_mdCell).join(' | ') + ' |').join('\n');
  return `${head}\n${sep}\n${body}`;
}

function _promptPreamble(LL, risk, table) {
  return `You are a ${LL} regulatory-oversight analyst at a regulated financial entity.

Below is a control-traceability extract for a SINGLE ICT risk, taken from our oversight model. It links the risk to the ${LL} objectives it is mapped to, the policy / group-standard statements that cover those objectives, and the controls that operationalise those statements.

RISK NAME: ${risk.title}
RISK DESCRIPTION: ${risk.desc || '(no description provided)'}

TRACEABILITY EXTRACT (one row per ${LL} objective × statement × control):
${table}`;
}

function _promptBody(kind, LL) {
  if (kind === 'coverage') {
    return `TASK — CONTROL COVERAGE
For this single risk, examine each policy / group-standard statement in the extract and the control(s) currently mapped to it. Identify every statement whose objective is NOT yet met by a live (Implemented) control — i.e. the statement has no control, or only Draft controls.

For each such gap, propose ONE new DRAFT control that would meet that statement.

Output ONLY a markdown table, no preamble, with exactly these columns:
| Statement ref | Control name | Control objective | Control description |
- Statement ref — the statement the new control covers.
- Control name — a short, specific name for the proposed control.
- Control objective — one sentence stating the regulatory outcome the control must achieve (derived from the statement and the ${LL} objective).
- Control description — 1–3 sentences on what the control does, how, and how often.

If every statement is already met by a live control, output exactly:
No new controls required — every statement is operationalised by a live control.`;
  }
  if (kind === 'reduce') {
    return `TASK — REDUCE NUMBER OF CONTROLS
For this single risk, review the controls currently treating it (their names and descriptions in the extract) and infer each control's objective. Identify controls that overlap or pursue the same objective and could be merged into a single, broader control WITHOUT losing coverage of any policy statement they currently cover.

Output ONLY a markdown table, no preamble, with exactly these columns:
| Controls to merge | Control name | Control objective | Control description |
- Controls to merge — the existing control names/numbers being combined (comma-separated).
- Control name — a short name for the single merged control.
- Control objective — one sentence stating what the merged control achieves.
- Control description — 1–3 sentences for the merged, reworded control; it must still cover every statement the originals covered.

If no controls can be safely merged, output exactly:
No controls can be merged — each control addresses a distinct objective.`;
  }
  // validate (default)
  return `TASK — VALIDATE THE RISK
Assess whether the RISK DESCRIPTION above is genuinely related to, and actually threatens, the ${LL} objective(s) it is mapped to in the extract.

- If the description is well-aligned — it clearly describes an ICT threat that would undermine the mapped ${LL} objective(s) — reply exactly:
  VALID — <one sentence naming which objective(s) it threatens and how>.
- If it is vague, generic, mis-scoped, or does not actually threaten the mapped objective(s), reply:
  NEEDS REVISION — <one sentence on what is wrong>
  then, on a new line, give an improved risk description (2–4 sentences) that:
    1. states the ICT failure / disruption concretely,
    2. makes explicit how it threatens the specific ${LL} objective(s) listed above, and
    3. is specific and assessable (no boilerplate).
  Output only the revised description after that line.`;
}

// Build the full prompt text for the current selection.
function buildPromptText() {
  if (!_promptsA) return '';
  const LL = _promptLensLabel();
  const all = _promptsWithLens(() => buildTraceabilityRows(_promptsA)).rows;
  const facts = _promptFacts();
  const risks = _promptRiskList(all, facts);
  const risk = risks.find(r => r.title === _promptRisk) || risks[0];
  if (!risk) return 'No risks are linked to the ' + LL + ' objectives yet.';
  const ext = _promptExtractRows(all, facts, risk.title);
  const table = _promptExtractTable(ext, LL);
  return `${_promptPreamble(LL, risk, table)}\n\n${_promptBody(_promptKind, LL)}\n`;
}

function _promptModalEl() { return document.getElementById('prompts-modal'); }

function openPromptsModal() {
  const m = _promptModalEl();
  if (!m || !_promptsA) return;
  const LL = _promptLensLabel();
  const all = _promptsWithLens(() => buildTraceabilityRows(_promptsA)).rows;
  const facts = _promptFacts();
  const risks = _promptRiskList(all, facts);
  // Keep the current risk if still present, else default to the first.
  if (!risks.some(r => r.title === _promptRisk)) _promptRisk = risks.length ? risks[0].title : '';
  const esc = (typeof escHtml === 'function') ? escHtml : (s => String(s == null ? '' : s));
  document.getElementById('prompts-modal-title').textContent = `✨ AI prompts — ${LL} risks, one at a time`;
  const riskOpts = risks.map(r => `<option value="${esc(r.title)}"${r.title === _promptRisk ? ' selected' : ''}>${esc(r.title)}</option>`).join('');
  document.getElementById('prompt-risk-sel').innerHTML = riskOpts
    || '<option value="">No risks linked to objectives</option>';
  document.getElementById('prompt-kind-tabs').innerHTML = PROMPT_KINDS.map(k =>
    `<button type="button" class="prompt-kind-tab${k.id === _promptKind ? ' prompt-kind-on' : ''}" data-kind="${k.id}" onclick="setPromptKind('${k.id}')">${esc(k.label)}</button>`).join('');
  updatePromptView();
  m.style.display = 'flex';
}

function closePromptsModal() { const m = _promptModalEl(); if (m) m.style.display = 'none'; }

function setPromptKind(kind) {
  _promptKind = kind;
  document.querySelectorAll('#prompt-kind-tabs .prompt-kind-tab').forEach(b =>
    b.classList.toggle('prompt-kind-on', b.dataset.kind === kind));
  updatePromptView();
}

function updatePromptView() {
  const sel = document.getElementById('prompt-risk-sel');
  if (sel) _promptRisk = sel.value;
  const kd = PROMPT_KINDS.find(k => k.id === _promptKind);
  const dd = document.getElementById('prompt-kind-desc');
  if (dd) dd.textContent = kd ? kd.desc : '';
  const ta = document.getElementById('prompt-text');
  if (ta) ta.value = buildPromptText();
}

function copyPromptText(btn) {
  const ta = document.getElementById('prompt-text');
  if (!ta) return;
  const done = ok => { const o = btn.textContent; btn.textContent = ok ? 'Copied ✓' : 'Copy failed'; setTimeout(() => { btn.textContent = o; }, 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ta.value).then(() => done(true)).catch(() => { ta.select(); done(false); });
  } else { ta.select(); try { document.execCommand('copy'); done(true); } catch (e) { done(false); } }
}

if (typeof window !== 'undefined') {
  window.openPromptsModal = openPromptsModal;
  window.closePromptsModal = closePromptsModal;
  window.setPromptKind = setPromptKind;
  window.updatePromptView = updatePromptView;
  window.copyPromptText = copyPromptText;
  window.buildPromptText = buildPromptText;
}
