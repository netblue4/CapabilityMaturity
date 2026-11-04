// CBI evidence-pack generator.
// A standalone page (opened from the dashboard header) that helps answer the
// Central Bank of Ireland ICT Self-Assessment — Section 4 (ICT Risk Control).
// Each CBI question cites DORA article(s); we match those to our DORA control
// framework (traceability rows) and surface the evidence we hold, then build a
// prompt the user pastes into an LLM to draft Strengths / Weaknesses / a
// suggested maturity level, output as a table for Excel.

var _cbiText = '';
var _cbiActiveId = null;

function _cbiLoad(cb) {
  if (_cbiText) { if (cb) cb(); return; }
  if (typeof _loadFileText === 'function') { _loadFileText('docs/cbi-evidence-prompt.md', t => { _cbiText = t; }, cb); }
}
if (typeof fetch === 'function') { _cbiLoad(); }

function _cbiQ() { return (typeof window !== 'undefined' && window.CBI_SECTION4) || { categories: [], maturity: [] }; }
function _cbiEsc(s) { return (typeof escHtml === 'function') ? escHtml(s) : String(s == null ? '' : s); }

// Assessments available as evidence sources, most recent first.
function _cbiAssessments() {
  const list = (typeof db !== 'undefined' && db.assessments) ? db.assessments.slice() : [];
  return list.sort((a, b) => String(b.date || b.quarter || b.id).localeCompare(String(a.date || a.quarter || a.id)));
}
function _cbiActive() {
  const list = _cbiAssessments();
  return list.find(a => a.id === _cbiActiveId) || list[0] || null;
}

// Article number from an objective's article label, ONLY when it is a bare
// "Article N" (not an RTS/MIC/MIR, whose numbers are not DORA article numbers).
function _cbiArtNum(s) { const m = /^\s*article\s*0*(\d+)/i.exec(s || ''); return m ? parseInt(m[1], 10) : null; }
// Capability names for a set of capability ids (trace rows carry the name).
function _cbiCapNames(capHints) {
  const caps = (typeof CONFIG !== 'undefined' && CONFIG.capabilities) || [];
  const set = new Set();
  (capHints || []).forEach(id => { const c = caps.find(x => x.id === id); if (c) set.add(c.name); });
  return set;
}

// Evidence we hold for a CBI question: objectives whose label is one of the
// cited "Article N" (exact) PLUS objectives under the category's capabilities
// (robust to RTS-labelled objectives). Each item is tagged with how it matched.
function _cbiEvidence(assessment, articleNums, capHints) {
  if (!assessment) return null;
  const nums = new Set(articleNums || []);
  const capNames = _cbiCapNames(capHints);
  if (!nums.size && !capNames.size) return null;
  const run = (typeof withLens === 'function') ? withLens : (k, f) => f();
  const trace = run('dora', () => (typeof buildTraceabilityRows === 'function') ? buildTraceabilityRows(assessment) : { rows: [] });
  const rows = (trace.rows || []).filter(r => {
    const n = _cbiArtNum(r.article);
    return (n != null && nums.has(n)) || (r.capability && capNames.has(r.capability));
  });
  const objs = new Map(), stmts = new Map(), ctrls = new Map(), exc = new Map();
  rows.forEach(r => {
    const n = _cbiArtNum(r.article);
    const viaArt = n != null && nums.has(n);
    if (r._oKey && !objs.has(r._oKey)) objs.set(r._oKey, { id: r.objectiveId, text: r.objective, covered: r.covered, viaArt, article: r.article });
    if (r._sKey && r.statementRef && !stmts.has(r._sKey)) stmts.set(r._sKey, { ref: r.statementRef, header: r.statementHeader, document: r.document, disposition: r.disposition, op: r.stmtOperationalised, viaArt });
    if (r._cKey && r.control && !ctrls.has(r._cKey)) ctrls.set(r._cKey, { name: r.control, status: r.controlStatus, eff: r.effectiveness });
    if (r._sKey && /^(E|WT|WP)\b/.test(r.disposition || '') && !exc.has(r._sKey)) exc.set(r._sKey, { ref: r.statementRef, disp: r.disposition });
  });
  const objsArr = [...objs.values()], stmtsArr = [...stmts.values()], ctrlsArr = [...ctrls.values()];
  return {
    objectives: objsArr.length,
    exactArticle: objsArr.filter(o => o.viaArt).length,   // objectives matched on an exact "Article N"
    uncovered: objsArr.filter(o => o.covered !== 'Yes').length,
    statements: stmtsArr,
    controls: ctrlsArr,
    implemented: ctrlsArr.filter(c => c.status === 'Implemented').length,
    effective: ctrlsArr.filter(c => c.eff === 'Effective').length,
    exceptions: [...exc.values()],
  };
}

// A one-line evidence badge summary for the question list.
function _cbiBadge(ev) {
  if (!ev) return '<span class="cbi-ev-none">no evidence source</span>';
  if (!ev.objectives && !ev.statements.length && !ev.controls.length) return '<span class="cbi-ev-none">no mapped evidence</span>';
  const parts = [];
  parts.push(`<span class="cbi-ev">Obj ${ev.objectives}${ev.exactArticle ? ` <span class="cbi-ev-dim">(${ev.exactArticle} by article)</span>` : ''}${ev.uncovered ? ` <b class="cbi-gap">(${ev.uncovered} gap)</b>` : ''}</span>`);
  parts.push(`<span class="cbi-ev">Stmt ${ev.statements.length}</span>`);
  parts.push(`<span class="cbi-ev">Ctrl ${ev.controls.length} <span class="cbi-ev-dim">(${ev.implemented} impl · ${ev.effective} eff)</span></span>`);
  if (ev.exceptions.length) parts.push(`<span class="cbi-ev cbi-exc">Exc ${ev.exceptions.length}</span>`);
  return parts.join(' ');
}

function openCbiModal() {
  const m = document.getElementById('cbi-modal'); if (!m) return;
  _cbiLoad();
  const asel = document.getElementById('cbi-assessment');
  const list = _cbiAssessments();
  if (asel) {
    if (!list.length) asel.innerHTML = '<option value="">(no assessments — import or load demo data)</option>';
    else asel.innerHTML = list.map(a => `<option value="${_cbiEsc(a.id)}">${_cbiEsc(a.name || a.quarter || a.id)}</option>`).join('');
    _cbiActiveId = list.length ? (list.find(a => a.id === _cbiActiveId) ? _cbiActiveId : list[0].id) : null;
    if (_cbiActiveId) asel.value = _cbiActiveId;
  }
  const csel = document.getElementById('cbi-category');
  if (csel) csel.innerHTML = _cbiQ().categories.map((c, i) => `<option value="${i}">${_cbiEsc(c.id + ' ' + c.name)}</option>`).join('');
  const out = document.getElementById('cbi-prompt'); if (out) out.value = '';
  renderCbiQuestions();
  m.style.display = 'flex';
}
function setCbiAssessment() { const a = document.getElementById('cbi-assessment'); if (a) _cbiActiveId = a.value; renderCbiQuestions(); }

function renderCbiQuestions() {
  const host = document.getElementById('cbi-questions'); if (!host) return;
  const ci = parseInt((document.getElementById('cbi-category') || {}).value || '0', 10) || 0;
  const cat = _cbiQ().categories[ci];
  const assessment = _cbiActive();
  if (!cat) { host.innerHTML = ''; return; }
  if (!assessment) { host.innerHTML = '<p class="policy-no-data" style="margin:.4rem 0">No assessment selected — import one or load demo data first.</p>'; return; }
  const rows = cat.questions.map(q => {
    const ev = _cbiEvidence(assessment, q.articleNums, cat.capHints);
    const arts = (q.articles && q.articles.length) ? ('Art ' + q.articles.join(', ')) : '<span class="cbi-ev-dim">no article cited</span>';
    return `<label class="cbi-q">
      <input type="checkbox" class="cbi-q-cb" value="${_cbiEsc(q.ref)}">
      <span class="cbi-q-ref">${_cbiEsc(q.ref)}</span>
      <span class="cbi-q-main"><span class="cbi-q-text">${_cbiEsc(q.text)}</span>
      <span class="cbi-q-meta"><span class="cbi-q-art">${arts}</span> ${_cbiBadge(ev)}</span></span>
    </label>`;
  }).join('');
  host.innerHTML = rows;
}
function cbiSelectAll(on) { document.querySelectorAll('#cbi-questions .cbi-q-cb').forEach(c => { c.checked = !!on; }); }

// Build the appended evidence block for one question.
function _cbiQuestionBlock(cat, q, assessment) {
  const ev = _cbiEvidence(assessment, q.articleNums, cat.capHints);
  const artLine = (q.articles && q.articles.length) ? ('Article ' + q.articles.join(', Article ')) : 'none cited';
  const capNames = [...(_cbiCapNames(cat.capHints))];
  let body;
  if (!ev || (!ev.objectives && !ev.statements.length && !ev.controls.length)) {
    body = 'Our evidence: nothing mapped for the cited article(s) or the category capabilities (' + (capNames.join(', ') || 'none') + ') — treat as a gap / human judgement.';
  } else {
    const cap = (arr, n) => arr.length > n ? arr.slice(0, n) : arr;
    const stmts = cap(ev.statements, 25).map(s => `   - ${s.ref} — ${s.header}${s.document ? ' (' + s.document + ')' : ''}${/^(E|WT|WP)\b/.test(s.disposition || '') ? ' [exception: ' + s.disposition + ']' : ''}`).join('\n');
    const ctrls = cap(ev.controls, 25).map(c => `   - ${c.name} — ${c.status}${c.eff && c.eff !== '—' ? ', ' + c.eff : ''}`).join('\n');
    const excs = ev.exceptions.length ? ev.exceptions.map(e => `${e.ref} (${e.disp})`).join('; ') : 'none';
    body = `Our evidence (matched on the cited DORA article(s) and the category capabilities: ${capNames.join(', ') || 'none'}):
- Objectives: ${ev.objectives} applicable${ev.exactArticle ? ` (${ev.exactArticle} matched directly on the cited article)` : ''}${ev.uncovered ? ` — ${ev.uncovered} uncovered (coverage gap)` : ' — all covered'}
- Documented statements (${ev.statements.length}${ev.statements.length > 25 ? ', first 25' : ''}):
${stmts || '   - (none)'}
- Controls (${ev.controls.length}${ev.controls.length > 25 ? ', first 25' : ''}; ${ev.implemented} implemented, ${ev.effective} effective):
${ctrls || '   - (none)'}
- Disclosed exceptions: ${excs}`;
  }
  return `### CBI ${q.ref} — ${cat.id} ${cat.name}
Question: ${q.text}
DORA article(s) cited: ${artLine}
${body}`;
}

function generateCbiPrompt() {
  const out = document.getElementById('cbi-prompt'); if (!out) return;
  const ci = parseInt((document.getElementById('cbi-category') || {}).value || '0', 10) || 0;
  const cat = _cbiQ().categories[ci];
  const assessment = _cbiActive();
  const picked = [...document.querySelectorAll('#cbi-questions .cbi-q-cb:checked')].map(c => c.value);
  if (!assessment) { out.value = '⚠ No assessment selected — import one or load demo data first.'; return; }
  if (!picked.length) { out.value = '⚠ Tick at least one question to process.'; return; }
  if (!_cbiText) { out.value = '⚠ Prompt template still loading — try again in a moment.'; _cbiLoad(); return; }
  const blocks = cat.questions.filter(q => picked.includes(q.ref)).map(q => _cbiQuestionBlock(cat, q, assessment)).join('\n\n');
  out.value = _cbiText.replace('{{CBI_QUESTIONS}}', blocks);
}
function copyCbiPrompt(btn) {
  const ta = document.getElementById('cbi-prompt'); if (!ta || !ta.value) return;
  const done = ok => { const o = btn.textContent; btn.textContent = ok ? 'Copied ✓' : 'Copy failed'; setTimeout(() => { btn.textContent = o; }, 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ta.value).then(() => done(true)).catch(() => { ta.select(); done(false); });
  } else { ta.select(); try { document.execCommand('copy'); done(true); } catch (e) { done(false); } }
}
function closeCbiModal() { const m = document.getElementById('cbi-modal'); if (m) m.style.display = 'none'; }

if (typeof window !== 'undefined') {
  window.openCbiModal = openCbiModal;
  window.closeCbiModal = closeCbiModal;
  window.setCbiAssessment = setCbiAssessment;
  window.renderCbiQuestions = renderCbiQuestions;
  window.cbiSelectAll = cbiSelectAll;
  window.generateCbiPrompt = generateCbiPrompt;
  window.copyCbiPrompt = copyCbiPrompt;
}
