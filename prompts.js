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
  { id: 'csa', label: '4 · Rewrite to CSA standard',
    desc: 'Brings the selected risk’s controls up to the CSA / RCSA standard — drafts the Control Details, Control Test and Control Test Procedure for each. The controls are appended automatically (Control No, Name, Status, Frequency, Description, Owner); no pasting.' },
  { id: 'rating', label: '5 · Risk rationale & tier',
    desc: 'Produces the Inherent + Residual risk rationales and per-category tier selections (Customer, Brand, Regulatory, Operational, Project) using the Utmost tier descriptions. The selected risk’s data (description, controls + effectiveness, inherent/residual scores) is appended automatically.' },
];
// Static prompt texts held as repo files (kept out of JS so their backticks / paths /
// angle-brackets need no escaping), loaded once and cached.
let _csaText = '', _ratText = '';
function _loadFileText(url, set, cb) {
  try { fetch(url).then(r => r.ok ? r.text() : '').then(t => { if (t) set(t); if (cb) cb(); }).catch(() => {}); } catch (e) {}
}
function _loadCsaText(cb) { if (_csaText) { if (cb) cb(); return; } _loadFileText('docs/csa-rewrite-prompt.md', t => { _csaText = t; }, cb); }
function _loadRatText(cb) { if (_ratText) { if (cb) cb(); return; } _loadFileText('docs/risk-rationale-prompt.md', t => { _ratText = t; }, cb); }
if (typeof fetch === 'function') { _loadCsaText(); _loadRatText(); }

// The "CONTROLS TO PROCESS" block for option 4 — the selected risk's distinct
// controls (Control No, Name, Status, Frequency, Description, Owner).
function _csaControlData(riskTitle) {
  const facts = _promptFacts().filter(f => _promptIsLiveFact(f) && ftNorm(f.riskTitle) === ftNorm(riskTitle));
  if (!facts.length) return '(no controls found for this risk in the risk-data upload)';
  const seen = new Set(), rows = [];
  facts.forEach(f => {
    const ck = f.capId + '|' + ftNorm(f.controlNumber) + '|' + ftNorm(f.controlName);
    if (seen.has(ck)) return; seen.add(ck);
    rows.push({
      no: (f.controlNumber || '').trim(),
      name: (f.controlName || '').trim(),
      status: (typeof ftIsImplemented === 'function' && ftIsImplemented(f)) ? 'Implemented' : 'Draft',
      freq: (f.controlFreq || '').trim(),
      desc: (f.controlDesc || '').trim(),
      owner: (f.controlOwner || '').trim(),
    });
  });
  const cols = ['Control No', 'Control Name', 'Control Status', 'Control Frequency', 'Control Description', 'Control Owner'];
  const head = '| ' + cols.join(' | ') + ' |';
  const sep = '| ' + cols.map(() => '---').join(' | ') + ' |';
  const body = rows.map(r => '| ' + [r.no, r.name, r.status, r.freq, r.desc, r.owner].map(_amCell).join(' | ') + ' |').join('\n');
  return head + '\n' + sep + '\n' + body;
}
// One control's effectiveness as the CSA-style rating the rationale prompt expects.
function _ratEffectiveness(f) {
  if (typeof ftIsImplemented === 'function' && !ftIsImplemented(f)) return 'Not implemented (draft)';
  if (typeof ftIsNotAssessed === 'function' && ftIsNotAssessed(f)) return 'Not assessed';
  if (typeof ftIsEffective === 'function' && ftIsEffective(f)) return 'Effective';
  if (typeof ftIsPartly === 'function' && ftIsPartly(f)) return 'Partially effective';
  return 'Ineffective';
}
// The "Risk Content" block appended for the selected risk — one row per control.
// The dataset holds composite inherent/residual SCORES, not separate Likelihood &
// Impact ratings, so the columns carry the scores plus a note mapping them to the
// prompt's placeholders.
function _ratRiskContent(riskTitle) {
  const facts = _promptFacts().filter(f => _promptIsLiveFact(f) && ftNorm(f.riskTitle) === ftNorm(riskTitle));
  if (!facts.length) return `Risk: ${riskTitle}\n(no controls found for this risk in the risk-data upload)`;
  const desc = (facts.find(f => (f.riskDesc || '').trim()) || {}).riskDesc || '';
  const inh = Math.max(0, ...facts.map(f => f.inherentScore || 0)) || '';
  const res = Math.max(0, ...facts.map(f => f.residualScore || 0)) || '';
  const seen = new Set(), rows = [];
  facts.forEach(f => {
    const ck = f.capId + '|' + ftNorm(f.controlNumber) + '|' + ftNorm(f.controlName);
    if (seen.has(ck)) return; seen.add(ck);
    rows.push({ name: (f.controlNumber ? f.controlNumber + ' — ' : '') + (f.controlName || '').trim(), eff: _ratEffectiveness(f) });
  });
  const note = 'NOTE ON RATINGS: this dataset records Inherent and Residual risk as a single composite SCORE (0–25), not separate Likelihood and Impact ratings. For {InherentLikelihoodRating} and {InherentImpactRating} use the "Inherent Risk Score" below as the best available value and the Step-B ceiling; for {ResidualLikelihoodRating} and {ResidualImpactRating} use the "Residual Risk Score". State this assumption briefly in the rationales.';
  const cols = ['Description', 'Inherent Risk Score', 'Control: Control Name', 'Control Effectiveness Score', 'Residual Risk Score'];
  const head = '| ' + cols.join(' | ') + ' |';
  const sep = '| ' + cols.map(() => '---').join(' | ') + ' |';
  const body = rows.map(r => '| ' + [desc, inh, r.name, r.eff, res].map(_amCell).join(' | ') + ' |').join('\n');
  return `Risk: ${riskTitle}\n\n${note}\n\n${head}\n${sep}\n${body}`;
}

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

// ALL distinct risks from the risk-data upload (not only those whose controls back
// a lens objective), carrying the risk description from the import. For the dropdown.
function _promptRiskList(all, facts) {
  const out = new Map();
  (facts || []).forEach(f => {
    if (!_promptIsLiveFact(f)) return;
    const rt = (f.riskTitle || '').trim(); if (!rt) return;
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
For this single risk, examine each policy / group-standard statement in the extract and the control(s) currently mapped to it. Identify every statement whose objective is NOT yet met by a control, either a live control or a draft control — i.e. the statement has no control mapped to it at all.

For each such gap, propose ONE new DRAFT control that would meet that statement.

Output ONLY a markdown table, no preamble, with exactly these columns:
| Statement ref | Control name | Control objective | Control description |
- Statement ref — the statement the new control covers.
- Control name — a short, specific name for the proposed control.
- Control objective — one sentence stating the regulatory outcome the control must achieve (derived from the statement and the ${LL} objective).
- Control description — 1–3 sentences on what the control does, how, and how often.

If every statement already has a control mapped to it (live or draft), output exactly:
No new controls required — every statement already has a control mapped to it.`;
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
  if (!risk) return 'No risks in the risk-data upload yet.';
  // Option 4 — the CSA prompt with the selected risk's controls appended.
  if (_promptKind === 'csa') {
    if (!_csaText) return 'Loading the CSA prompt… select "4 · Rewrite to CSA standard" again in a moment.';
    return _csaText.replace('{{CSA_CONTROLS}}', _csaControlData(risk.title));
  }
  // Option 5 — the risk-rationale prompt with the selected risk's data appended.
  if (_promptKind === 'rating') {
    if (!_ratText) return 'Loading the risk-rationale prompt… select "5 · Risk rationale & tier" again in a moment.';
    return _ratText.replace('<<--["Risk you need to assess"]-->>', _ratRiskContent(risk.title));
  }
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
  if (kind === 'csa' && !_csaText) _loadCsaText(updatePromptView);        // re-render once loaded
  if (kind === 'rating' && !_ratText) _loadRatText(updatePromptView);
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

// ── "Map a new DORA article" prompt (DORA Reporting → traceability card) ──
// Authoring helper to speed up loading a newly-applicable DORA article: paste the
// article/RTS text, tick the policies / group standards to map it against, and
// generate a prompt that CREATES digital-resilience objectives and MAPS them to
// those statements — output in the exact "Import DORA Mapping" column layout, so
// the LLM's table pastes straight into that upload.
var _amA = (typeof _amA !== 'undefined') ? _amA : null;
var _amLens = (typeof _amLens !== 'undefined') ? _amLens : 'dora';

function _amWithLens(fn) { const run = (typeof withLens === 'function') ? withLens : (k, f) => f(); return run(_amLens, fn); }
function _amPolicy() { return _amWithLens(() => (typeof lensPolicy === 'function') ? lensPolicy(_amA) : ((_amA && _amA.policyRows) || [])); }
function _amSrcLabel(t) {
  if (typeof isLocPolType === 'function' && isLocPolType(t)) return 'Local Policy';
  if (typeof isGrpStdType === 'function' && isGrpStdType(t)) return 'Group Standard';
  return (t || '').trim() || 'Other';
}
// Distinct documents in the assessment's policy data, grouped for the picker.
function _amDocList() {
  const pol = _amPolicy();
  const map = new Map();
  pol.forEach(pr => {
    const doc = (pr.document || '').trim(); if (!doc) return;
    let d = map.get(doc);
    if (!d) { d = { document: doc, type: _amSrcLabel(pr.type), count: 0, rows: [] }; map.set(doc, d); }
    d.count++; d.rows.push(pr);
  });
  return [...map.values()].sort((a, b) => a.type.localeCompare(b.type) || a.document.localeCompare(b.document));
}
function _amCell(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim() || '—'; }
function _amExtractTable(rows) {
  const cols = ['Capability', 'Statement Ref', 'Document', 'Type', 'Statement Header', 'Statement Detail'];
  const head = '| ' + cols.join(' | ') + ' |';
  const sep = '| ' + cols.map(() => '---').join(' | ') + ' |';
  const body = rows.map(r => '| ' + [r.cap, r.ref, r.doc, r.type, r.header, r.detail].map(_amCell).join(' | ') + ' |').join('\n');
  return head + '\n' + sep + '\n' + body;
}
function _amPromptText(article, ext) {
  return `You are a DORA (Digital Operational Resilience Act) regulatory-oversight analyst at a regulated financial entity.

TASK
Create digital-resilience objectives for the DORA article / RTS below, then map each objective to the policy / group-standard statements provided. Return a mapping table I can paste straight into our "Import DORA Mapping" upload.

RULES
1. The DORA article and the statements use DIFFERENT, non-matching taxonomies — the article is finer-grained; the statements are coarser, with catch-all capabilities such as "Ops". Use the Capability column only as a HINT to narrow candidates — never require the labels to match. Match on the MEANING of the requirement.
2. Break the article into single-purpose digital-resilience objectives. An objective may map to MANY statements — list them all, ONE output row per (objective × matched statement).
3. If an objective has NO adequate statement, output ONE row for it with Statement Ref, Statement Header and Document LEFT BLANK — this is a coverage gap to disclose (exception evidence); the objective still appears, as uncovered.
4. Match a statement only when its text genuinely satisfies the objective. NEVER invent statement refs — use only refs that appear in the STATEMENTS EXTRACT below. Ignore any separator rows that carry only a capability name with an empty Statement Ref.
5. Paragraph Reference = the article's own paragraph / point reference where it exists (e.g. 10(1), 10(2)(a)); otherwise number them <DORA Ref>-1, -2, … Order the output grouped by Paragraph Reference.

DORA ARTICLE / RTS
${article}

STATEMENTS EXTRACT (policy / group-standard statements to map against)
${_amExtractTable(ext)}

OUTPUT
Return ONLY a table as TAB-SEPARATED values inside a single code block, header row first, with EXACTLY these seven columns and no others:
DORA Article\tParagraph Reference\tDigital Resilience Objective\tStatement Ref\tStatement Header\tDocument\tCapability
- DORA Article — the article/RTS name (e.g. "RTS 10 — Vulnerability and patch management"), identical on every row.
- Paragraph Reference — per rule 5 (this is the objective's id).
- Digital Resilience Objective — one concise sentence stating the objective.
- Statement Ref / Statement Header / Document — the matched statement, copied verbatim from the extract (all three blank on a coverage-gap row).
- Capability — the matched statement's Capability (blank on a gap row).
Output nothing except that single code block — no commentary, no extra columns.
`;
}
function openArticleMapModal() {
  const m = document.getElementById('article-map-modal');
  if (!m || !_amA) return;
  const esc = (typeof escHtml === 'function') ? escHtml : (s => String(s == null ? '' : s));
  const docs = _amDocList();
  const host = document.getElementById('am-docs');
  if (host) {
    if (!docs.length) host.innerHTML = '<p class="policy-no-data" style="margin:.3rem 0">No policy data in this assessment — import Policy Data first.</p>';
    else {
      const byType = {};
      docs.forEach(d => { (byType[d.type] = byType[d.type] || []).push(d); });
      host.innerHTML = Object.keys(byType).map(type =>
        `<div class="am-doc-group"><div class="am-doc-type">${esc(type)}</div>${byType[type].map(d =>
          `<label class="am-doc"><input type="checkbox" class="am-doc-cb" value="${esc(d.document)}"> ${esc(d.document)} <span class="am-doc-n">(${d.count})</span></label>`).join('')}</div>`).join('');
    }
  }
  const art = document.getElementById('am-article'); if (art) art.value = '';
  const out = document.getElementById('am-prompt'); if (out) out.value = '';
  m.style.display = 'flex';
}
function generateArticleMapPrompt() {
  const out = document.getElementById('am-prompt'); if (!out) return;
  const article = (document.getElementById('am-article').value || '').trim();
  const checked = [...document.querySelectorAll('#am-docs .am-doc-cb:checked')].map(c => c.value);
  if (!article) { out.value = '⚠ Paste the DORA article / RTS text first.'; return; }
  if (!checked.length) { out.value = '⚠ Tick at least one policy or group standard to map against.'; return; }
  const cN = id => _amWithLens(() => (typeof lensCapName === 'function') ? lensCapName(_amA, id) : id);
  const rows = [];
  _amDocList().filter(d => checked.includes(d.document)).forEach(d => d.rows.forEach(pr => rows.push({
    cap: cN(pr.capId), ref: pr.statementRef || '', doc: pr.document || '', type: d.type,
    header: pr.statementHeader || '', detail: pr.statementDetail || '',
  })));
  const seen = new Set();
  const ext = rows.filter(r => { const k = r.doc + '|' + (r.ref || '').toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  out.value = _amPromptText(article, ext);
}
function copyArticleMapPrompt(btn) {
  const ta = document.getElementById('am-prompt'); if (!ta || !ta.value) return;
  const done = ok => { const o = btn.textContent; btn.textContent = ok ? 'Copied ✓' : 'Copy failed'; setTimeout(() => { btn.textContent = o; }, 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ta.value).then(() => done(true)).catch(() => { ta.select(); done(false); });
  } else { ta.select(); try { document.execCommand('copy'); done(true); } catch (e) { done(false); } }
}
function closeArticleMapModal() { const m = document.getElementById('article-map-modal'); if (m) m.style.display = 'none'; }

// ── "Link statements to controls" prompt (DORA Reporting → traceability card) ──
// Maps risk-treatment controls to policy/GS statements by intent. Pick one or
// more RISKS (from the Riskonnect upload — ALL risks, DORA-linked or not; their
// controls are what gets mapped) and the policies / group standards whose
// statements to check against. The generated prompt lists the selected
// statements (+ the DORA objectives they cover, from the mapping) and the
// controls under the selected risks, and asks the LLM to link them by intent.
function _lcFacts() { return _amWithLens(() => (typeof lensFacts === 'function') ? lensFacts(_amA) : ((_amA && _amA.riskPolicyFacts) || [])); }
// Distinct risks from the register (all of them), each with its controls.
function _lcRiskList() {
  const facts = _lcFacts();
  const cN = id => _amWithLens(() => (typeof lensCapName === 'function') ? lensCapName(_amA, id) : id);
  const map = new Map();
  facts.forEach(f => {
    if (typeof ftIsClosedControl === 'function' && ftIsClosedControl(f)) return;
    if (!(f.controlName || '').trim()) return;
    const rt = (f.riskTitle || '').trim(); if (!rt) return;
    let r = map.get(rt);
    if (!r) { r = { title: rt, capId: f.capId, cap: cN(f.capId), ctrls: new Map() }; map.set(rt, r); }
    const ck = f.capId + '|' + ftNorm(f.controlNumber) + '|' + ftNorm(f.controlName);
    if (!r.ctrls.has(ck)) r.ctrls.set(ck, { label: (f.controlNumber ? f.controlNumber + ' — ' : '') + (f.controlName || '').trim(), desc: (f.controlDesc || '').trim() });
  });
  return [...map.values()].sort((a, b) => (a.cap || '').localeCompare(b.cap || '') || a.title.localeCompare(b.title));
}
// statement ref (normalised) → the DORA objectives it covers (from the mapping).
function _lcObjByStmt() {
  const doraRows = _amWithLens(() => (typeof lensRows === 'function') ? lensRows(_amA) : ((_amA && _amA.doraRows) || []));
  const idx = {};
  (doraRows || []).forEach(r => { const ref = ftNorm(r.statementRef); if (!ref) return; (idx[ref] = idx[ref] || []).push({ id: (r.obligationId || '').trim(), text: (r.requirement || '').trim() }); });
  return idx;
}
function _lcStmtTable(rows) {
  const cols = ['Statement Ref', 'Statement Header', 'Statement Detail', 'Capability', 'DORA Objective(s) covered'];
  const head = '| ' + cols.join(' | ') + ' |';
  const sep = '| ' + cols.map(() => '---').join(' | ') + ' |';
  const body = rows.map(r => '| ' + [r.ref, r.header, r.detail, r.cap, r.objs].map(_amCell).join(' | ') + ' |').join('\n');
  return head + '\n' + sep + '\n' + body;
}
function _lcCtrlTable(rows) {
  const cols = ['Risk(s)', 'Control Number & Name', 'Control Description'];
  const head = '| ' + cols.join(' | ') + ' |';
  const sep = '| ' + cols.map(() => '---').join(' | ') + ' |';
  const body = rows.map(r => '| ' + [r.risks, r.label, r.desc].map(_amCell).join(' | ') + ' |').join('\n');
  return head + '\n' + sep + '\n' + body;
}
function _lcPromptText(stRows, ctrlRows) {
  return `You are a DORA (Digital Operational Resilience Act) regulatory-oversight analyst at a regulated financial entity.

TASK
Map the risk-treatment controls below to the policy / group-standard statements they implement, by INTENT — i.e. whether what the control actually does operationalises what the statement requires. This establishes the statement → control links we need to implement the statements.

RULES
1. Match a control to a statement only when the control genuinely implements the statement's intent — judge on the control's name + description against the statement's meaning, not on wording overlap alone.
2. A control may implement several statements, and a statement may be implemented by several controls — output ONE row per (DORA objective × statement × matched control).
3. Derive a concise "Control objective" for each control (one sentence: the outcome it achieves). Copy the "Control description" verbatim from the CONTROLS extract.
4. Use ONLY the statements and controls in the extracts below — never invent statement refs, controls or objectives.
5. If a statement has no control that implements it, output one row for it with Control name / Control objective / Control description LEFT BLANK — a coverage gap to close.

STATEMENTS (policy / group-standard statements to implement — with the DORA objectives they cover)
${_lcStmtTable(stRows)}

CONTROLS (risk-treatment controls from the selected risks)
${_lcCtrlTable(ctrlRows)}

OUTPUT
Return ONLY a table as TAB-SEPARATED values inside a single code block, header row first, with EXACTLY these seven columns and no others:
DORA object\tDORA objective text\tStatement ref\tStatement header\tControl name\tControl objective\tControl description
- DORA object / DORA objective text — taken from the statement's "DORA Objective(s) covered" (blank if the statement maps to no objective). One row per objective when a statement covers several.
- Statement ref / Statement header — the statement being implemented.
- Control name — the matched control "number — name" (blank on a coverage-gap row).
- Control objective — one concise sentence (blank on a gap row).
- Control description — copied verbatim from the CONTROLS extract (blank on a gap row).
Output nothing except that single code block — no commentary, no extra columns.
`;
}
function openLinkCtrlModal() {
  const m = document.getElementById('link-ctrl-modal');
  if (!m || !_amA) return;
  const esc = (typeof escHtml === 'function') ? escHtml : (s => String(s == null ? '' : s));
  // Risks grouped by capability.
  const risks = _lcRiskList();
  const rhost = document.getElementById('lc-risks');
  if (rhost) {
    if (!risks.length) rhost.innerHTML = '<p class="policy-no-data" style="margin:.3rem 0">No risk &amp; control data in this assessment — import Risk Data first.</p>';
    else {
      const byCap = {};
      risks.forEach(r => { const c = r.cap || '(no capability)'; (byCap[c] = byCap[c] || []).push(r); });
      rhost.innerHTML = Object.keys(byCap).sort().map(cap =>
        `<div class="am-doc-group"><div class="am-doc-type">${esc(cap)}</div>${byCap[cap].map(r =>
          `<label class="am-doc"><input type="checkbox" class="lc-risk-cb" value="${esc(r.title)}"> ${esc(r.title)} <span class="am-doc-n">(${r.ctrls.size} control${r.ctrls.size === 1 ? '' : 's'})</span></label>`).join('')}</div>`).join('');
    }
  }
  // Documents (reuse the policy picker).
  const docs = _amDocList();
  const dhost = document.getElementById('lc-docs');
  if (dhost) {
    if (!docs.length) dhost.innerHTML = '<p class="policy-no-data" style="margin:.3rem 0">No policy data in this assessment — import Policy Data first.</p>';
    else {
      const byType = {};
      docs.forEach(d => { (byType[d.type] = byType[d.type] || []).push(d); });
      dhost.innerHTML = Object.keys(byType).map(type =>
        `<div class="am-doc-group"><div class="am-doc-type">${esc(type)}</div>${byType[type].map(d =>
          `<label class="am-doc"><input type="checkbox" class="lc-doc-cb" value="${esc(d.document)}"> ${esc(d.document)} <span class="am-doc-n">(${d.count})</span></label>`).join('')}</div>`).join('');
    }
  }
  const out = document.getElementById('lc-prompt'); if (out) out.value = '';
  m.style.display = 'flex';
}
function generateLinkCtrlPrompt() {
  const out = document.getElementById('lc-prompt'); if (!out) return;
  const risks = [...document.querySelectorAll('#lc-risks .lc-risk-cb:checked')].map(c => c.value);
  const docs = [...document.querySelectorAll('#lc-docs .lc-doc-cb:checked')].map(c => c.value);
  if (!risks.length) { out.value = '⚠ Select at least one risk (its controls will be mapped).'; return; }
  if (!docs.length) { out.value = '⚠ Select at least one policy or group standard.'; return; }
  const cN = id => _amWithLens(() => (typeof lensCapName === 'function') ? lensCapName(_amA, id) : id);
  const objIdx = _lcObjByStmt();
  const stRows = []; const seenS = new Set();
  _amDocList().filter(d => docs.includes(d.document)).forEach(d => d.rows.forEach(pr => {
    const k = (pr.document || '') + '|' + (pr.statementRef || '').toLowerCase(); if (seenS.has(k)) return; seenS.add(k);
    const objs = (objIdx[ftNorm(pr.statementRef)] || []).map(o => o.id + (o.text ? (': ' + o.text) : '')).join('  ·  ');
    stRows.push({ ref: pr.statementRef || '', header: pr.statementHeader || '', detail: pr.statementDetail || '', cap: cN(pr.capId), objs });
  }));
  const ctrlMap = new Map();
  _lcRiskList().filter(r => risks.includes(r.title)).forEach(r => r.ctrls.forEach((c, ck) => {
    let e = ctrlMap.get(ck); if (!e) { e = { label: c.label, desc: c.desc, risks: new Set() }; ctrlMap.set(ck, e); } e.risks.add(r.title);
  }));
  const ctrlRows = [...ctrlMap.values()].map(c => ({ label: c.label, desc: c.desc, risks: [...c.risks].join('; ') }));
  out.value = _lcPromptText(stRows, ctrlRows);
}
function copyLinkCtrlPrompt(btn) {
  const ta = document.getElementById('lc-prompt'); if (!ta || !ta.value) return;
  const done = ok => { const o = btn.textContent; btn.textContent = ok ? 'Copied ✓' : 'Copy failed'; setTimeout(() => { btn.textContent = o; }, 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ta.value).then(() => done(true)).catch(() => { ta.select(); done(false); });
  } else { ta.select(); try { document.execCommand('copy'); done(true); } catch (e) { done(false); } }
}
function closeLinkCtrlModal() { const m = document.getElementById('link-ctrl-modal'); if (m) m.style.display = 'none'; }

if (typeof window !== 'undefined') {
  window.openPromptsModal = openPromptsModal;
  window.closePromptsModal = closePromptsModal;
  window.setPromptKind = setPromptKind;
  window.updatePromptView = updatePromptView;
  window.copyPromptText = copyPromptText;
  window.buildPromptText = buildPromptText;
  window.openArticleMapModal = openArticleMapModal;
  window.generateArticleMapPrompt = generateArticleMapPrompt;
  window.copyArticleMapPrompt = copyArticleMapPrompt;
  window.closeArticleMapModal = closeArticleMapModal;
  window.openLinkCtrlModal = openLinkCtrlModal;
  window.generateLinkCtrlPrompt = generateLinkCtrlPrompt;
  window.copyLinkCtrlPrompt = copyLinkCtrlPrompt;
  window.closeLinkCtrlModal = closeLinkCtrlModal;
}
