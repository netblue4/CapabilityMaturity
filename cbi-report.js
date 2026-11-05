// CBI evidence-pack generator — full page, two-pane manual mapper.
// Left: the Central Bank of Ireland ICT Self-Assessment (Section 4) questions.
// Right: our Import DORA Mapping (articles/RTS -> paragraph refs / objectives).
// You map each question to the DORA objective(s) it covers (or mark it Not
// applicable); the mapping is the source of truth for the evidence pack and is
// saved in db.cbiMapping (persists to localStorage and exports with the JSON).
// "Suggest" pre-fills a best-guess mapping (exact Article N + category
// capabilities) that you can edit. The pack prompt pulls statements / controls
// for exactly the objectives you mapped.

var _cbiText = '';
var _cbiActiveId = null;   // assessment id providing the evidence
var _cbiCatIdx = 0;        // selected category index
var _cbiFocusRef = null;   // question currently being mapped (right pane)
var _cbiExpanded = {};      // article label -> expanded in the tree

function _cbiLoad(cb) {
  if (_cbiText) { if (cb) cb(); return; }
  if (typeof _loadFileText === 'function') { _loadFileText('docs/cbi-evidence-prompt.md', t => { _cbiText = t; }, cb); }
}
if (typeof fetch === 'function') { _cbiLoad(); }

function _cbiQ() { return (typeof window !== 'undefined' && window.CBI_SECTION4) || { categories: [], maturity: [] }; }
function _cbiEsc(s) { return (typeof escHtml === 'function') ? escHtml(s) : String(s == null ? '' : s); }

// ── persisted mapping: db.cbiMapping = { "<cbiRef>": { objectives:[objKey], na:bool } } ──
function _cbiMapping() { if (typeof db === 'undefined') return {}; if (!db.cbiMapping) db.cbiMapping = {}; return db.cbiMapping; }
function _cbiEntry(ref) { const m = _cbiMapping(); if (!m[ref]) m[ref] = { objectives: [], na: false }; if (!Array.isArray(m[ref].objectives)) m[ref].objectives = []; return m[ref]; }
function _cbiSave() { if (typeof saveToLocalStorage === 'function') saveToLocalStorage(); }
function _cbiState(ref) { const e = _cbiMapping()[ref]; if (e && e.na) return 'na'; if (e && e.objectives && e.objectives.length) return 'mapped'; return 'unmapped'; }

// ── assessments (evidence sources) ──
function _cbiAssessments() {
  const list = (typeof db !== 'undefined' && db.assessments) ? db.assessments.slice() : [];
  return list.sort((a, b) => String(b.date || b.quarter || b.id).localeCompare(String(a.date || a.quarter || a.id)));
}
function _cbiActive() { const list = _cbiAssessments(); return list.find(a => a.id === _cbiActiveId) || list[0] || null; }

// ── DORA objectives from the Import DORA Mapping (for the right-pane tree) ──
// objKey = "<article> ¦ <obligationId>" — stable across assessments using the
// same mapping, so a saved CBI->objective mapping keeps resolving.
function _cbiObjKey(article, oblId) { return (article || '') + ' ¦ ' + (oblId || ''); }
function _cbiDoraObjectives(assessment) {
  const run = (typeof withLens === 'function') ? withLens : (k, f) => f();
  const rows = run('dora', () => (typeof lensRows === 'function') ? lensRows(assessment) : (assessment.doraRows || []));
  const byArt = new Map();
  (rows || []).forEach(r => {
    if (r.unmapped) return;
    const art = (r.article || '').trim(); const obl = (r.obligationId || '').trim();
    if (!art || !obl) return;
    let a = byArt.get(art); if (!a) { a = { article: art, objs: new Map() }; byArt.set(art, a); }
    if (!a.objs.has(obl)) a.objs.set(obl, { key: _cbiObjKey(art, obl), obligationId: obl, requirement: (r.requirement || '').trim() });
  });
  const arts = [...byArt.values()].map(a => ({ article: a.article, objs: [...a.objs.values()].sort((x, y) => x.obligationId.localeCompare(y.obligationId)) }));
  arts.sort((a, b) => a.article.localeCompare(b.article));
  return arts;
}
// Flat lookup objKey -> {article, obligationId, requirement} for chip labels.
function _cbiObjIndex(assessment) {
  const idx = {}; _cbiDoraObjectives(assessment).forEach(a => a.objs.forEach(o => { idx[o.key] = { article: a.article, obligationId: o.obligationId, requirement: o.requirement }; })); return idx;
}

// ── auto-match (for Suggest): objKeys from exact "Article N" + category capabilities ──
function _cbiArtNum(s) { const m = /^\s*article\s*0*(\d+)/i.exec(s || ''); return m ? parseInt(m[1], 10) : null; }
function _cbiCapNames(capHints) {
  const caps = (typeof CONFIG !== 'undefined' && CONFIG.capabilities) || [];
  const set = new Set(); (capHints || []).forEach(id => { const c = caps.find(x => x.id === id); if (c) set.add(c.name); }); return set;
}
function _cbiTrace(assessment) {
  const run = (typeof withLens === 'function') ? withLens : (k, f) => f();
  return run('dora', () => (typeof buildTraceabilityRows === 'function') ? buildTraceabilityRows(assessment) : { rows: [] });
}
function _cbiAutoKeys(assessment, articleNums, capHints) {
  const nums = new Set(articleNums || []); const capNames = _cbiCapNames(capHints);
  if (!nums.size && !capNames.size) return [];
  const rows = (_cbiTrace(assessment).rows || []).filter(r => {
    const n = _cbiArtNum(r.article); return (n != null && nums.has(n)) || (r.capability && capNames.has(r.capability));
  });
  const keys = new Set();
  rows.forEach(r => { if (r.objectiveId) keys.add(_cbiObjKey(r.article, r.objectiveId)); });
  return [...keys];
}

// ── evidence for exactly the mapped objectives ──
function _cbiEvidenceForObjectives(assessment, objKeys) {
  const keep = new Set(objKeys || []); if (!keep.size) return null;
  const rows = (_cbiTrace(assessment).rows || []).filter(r => r.objectiveId && keep.has(_cbiObjKey(r.article, r.objectiveId)));
  const objs = new Map(), stmts = new Map(), ctrls = new Map(), exc = new Map();
  rows.forEach(r => {
    if (r._oKey && !objs.has(r._oKey)) objs.set(r._oKey, { covered: r.covered });
    if (r._sKey && r.statementRef && !stmts.has(r._sKey)) stmts.set(r._sKey, { ref: r.statementRef, header: r.statementHeader, document: r.document, disposition: r.disposition });
    if (r._cKey && r.control && !ctrls.has(r._cKey)) ctrls.set(r._cKey, { name: r.control, status: r.controlStatus, eff: r.effectiveness });
    if (r._sKey && /^(E|WT|WP)\b/.test(r.disposition || '') && !exc.has(r._sKey)) exc.set(r._sKey, { ref: r.statementRef, disp: r.disposition });
  });
  const objsArr = [...objs.values()], ctrlsArr = [...ctrls.values()];
  return {
    objectives: objsArr.length, uncovered: objsArr.filter(o => o.covered !== 'Yes').length,
    statements: [...stmts.values()], controls: ctrlsArr,
    implemented: ctrlsArr.filter(c => c.status === 'Implemented').length,
    effective: ctrlsArr.filter(c => c.eff === 'Effective').length,
    exceptions: [...exc.values()],
  };
}

// ── page open + selectors ──
function showCbiView() {
  _cbiLoad();
  const list = _cbiAssessments();
  _cbiActiveId = list.length ? (list.find(a => a.id === _cbiActiveId) ? _cbiActiveId : list[0].id) : null;
  const asel = document.getElementById('cbi-assessment');
  if (asel) { asel.innerHTML = list.length ? list.map(a => `<option value="${_cbiEsc(a.id)}">${_cbiEsc(a.name || a.quarter || a.id)}</option>`).join('') : '<option value="">(no assessments — import or load demo data)</option>'; if (_cbiActiveId) asel.value = _cbiActiveId; }
  const csel = document.getElementById('cbi-category');
  if (csel) { csel.innerHTML = _cbiQ().categories.map((c, i) => `<option value="${i}">${_cbiEsc(c.id + ' ' + c.name)}</option>`).join(''); csel.value = String(_cbiCatIdx); }
  const out = document.getElementById('cbi-prompt'); if (out) out.value = '';
  _cbiFocusRef = null;
  renderCbiQuestions(); renderCbiMapTree();
  if (typeof showView === 'function') showView('cbi');
}
function setCbiAssessment() { const a = document.getElementById('cbi-assessment'); if (a) _cbiActiveId = a.value; renderCbiQuestions(); renderCbiMapTree(); }
function setCbiCategory() { const c = document.getElementById('cbi-category'); _cbiCatIdx = c ? (parseInt(c.value, 10) || 0) : 0; _cbiFocusRef = null; renderCbiQuestions(); renderCbiMapTree(); }

// ── left pane: questions ──
function _cbiChips(ref, objIdx) {
  const e = _cbiMapping()[ref];
  if (e && e.na) return '<span class="cbi-chip cbi-chip-na">Not applicable</span>';
  if (!e || !e.objectives || !e.objectives.length) return '<span class="cbi-chip cbi-chip-un">unmapped</span>';
  return e.objectives.map(k => { const o = objIdx[k]; const lbl = o ? (o.obligationId) : k.split(' ¦ ')[1]; return `<span class="cbi-chip" title="${_cbiEsc(o ? (o.article + ' — ' + o.requirement) : k)}">${_cbiEsc(lbl)}</span>`; }).join(' ');
}
function renderCbiQuestions() {
  const host = document.getElementById('cbi-questions'); if (!host) return;
  const cat = _cbiQ().categories[_cbiCatIdx]; const assessment = _cbiActive();
  if (!cat) { host.innerHTML = ''; return; }
  if (!assessment) { host.innerHTML = '<p class="policy-no-data" style="margin:.4rem">No assessment selected — import one or load demo data first.</p>'; return; }
  const objIdx = _cbiObjIndex(assessment);
  const q = ((document.getElementById('cbi-qsearch') || {}).value || '').toLowerCase().trim();
  const list = cat.questions.filter(x => !q || (x.ref + ' ' + x.text).toLowerCase().includes(q));
  host.innerHTML = list.map(x => {
    const st = _cbiState(x.ref);
    const focused = x.ref === _cbiFocusRef ? ' cbi-q-focus' : '';
    const badge = st === 'mapped' ? '<span class="cbi-st cbi-st-map">mapped</span>' : st === 'na' ? '<span class="cbi-st cbi-st-na">N/A</span>' : '<span class="cbi-st cbi-st-un">unmapped</span>';
    return `<div class="cbi-q${focused}">
      <input type="checkbox" class="cbi-q-cb" value="${_cbiEsc(x.ref)}"${st === 'unmapped' ? '' : ' checked'}>
      <div class="cbi-q-main" onclick="cbiFocusQuestion('${_cbiEsc(x.ref)}')">
        <div class="cbi-q-line"><span class="cbi-q-ref">${_cbiEsc(x.ref)}</span>${badge}<span class="cbi-q-art">${(x.articles && x.articles.length) ? 'cites Art ' + _cbiEsc(x.articles.join(', ')) : ''}</span></div>
        <span class="cbi-q-text">${_cbiEsc(x.text)}</span>
        <div class="cbi-q-chips">${_cbiChips(x.ref, objIdx)}</div>
      </div>
      <button class="btn-link cbi-q-suggest" onclick="cbiSuggestQuestion('${_cbiEsc(x.ref)}')" title="Pre-fill a best-guess mapping you can edit">✨ Suggest</button>
    </div>`;
  }).join('') || '<p class="policy-no-data" style="margin:.4rem">No questions match the filter.</p>';
}
function cbiFocusQuestion(ref) { _cbiFocusRef = ref; renderCbiQuestions(); renderCbiMapTree(); }
function cbiSelectAll(on) { document.querySelectorAll('#cbi-questions .cbi-q-cb').forEach(c => { c.checked = !!on; }); }

// ── right pane: DORA mapping tree for the focused question ──
function renderCbiMapTree() {
  const host = document.getElementById('cbi-maptree'); if (!host) return;
  const title = document.getElementById('cbi-map-title');
  const assessment = _cbiActive();
  if (!assessment) { host.innerHTML = '<p class="policy-no-data" style="margin:.4rem">No assessment selected.</p>'; return; }
  if (!_cbiFocusRef) { if (title) title.textContent = 'Map to DORA objectives'; host.innerHTML = '<p class="policy-no-data" style="margin:.4rem">Select a question on the left to map it to DORA objectives.</p>'; return; }
  if (title) title.textContent = 'Map question ' + _cbiFocusRef + ' to DORA objectives';
  const e = _cbiEntry(_cbiFocusRef);
  const sel = new Set(e.objectives);
  const arts = _cbiDoraObjectives(assessment);
  const f = ((document.getElementById('cbi-msearch') || {}).value || '').toLowerCase().trim();
  const naRow = `<label class="cbi-na"><input type="checkbox" ${e.na ? 'checked' : ''} onchange="cbiToggleNA()"> <b>Article/RTS not applicable</b> <span class="cbi-ev-dim">(this question does not apply)</span></label>`;
  if (!arts.length) { host.innerHTML = naRow + '<p class="policy-no-data" style="margin:.4rem">No DORA mapping in this assessment — run Import DORA Mapping first.</p>'; return; }
  const body = arts.map(a => {
    const matchObjs = a.objs.filter(o => !f || (a.article + ' ' + o.obligationId + ' ' + o.requirement).toLowerCase().includes(f));
    if (f && !matchObjs.length && !a.article.toLowerCase().includes(f)) return '';
    const objsToShow = (f && !a.article.toLowerCase().includes(f)) ? matchObjs : a.objs;
    const nSel = a.objs.filter(o => sel.has(o.key)).length;
    const open = _cbiExpanded[a.article] || !!f || nSel > 0;
    const objRows = objsToShow.map(o => `<label class="cbi-obj"><input type="checkbox" ${sel.has(o.key) ? 'checked' : ''} ${e.na ? 'disabled' : ''} onchange="cbiToggleObjective('${_cbiEsc(o.key).replace(/'/g, "\\'")}', this.checked)"> <span class="cbi-obj-ref">${_cbiEsc(o.obligationId)}</span> <span class="cbi-obj-req">${_cbiEsc(o.requirement)}</span></label>`).join('');
    return `<div class="cbi-art">
      <div class="cbi-art-hd" onclick="cbiToggleArt('${_cbiEsc(a.article).replace(/'/g, "\\'")}')"><span class="cbi-art-caret">${open ? '▾' : '▸'}</span><span class="cbi-art-name">${_cbiEsc(a.article)}</span><span class="cbi-art-n">${nSel ? nSel + '/' : ''}${a.objs.length}</span></div>
      <div class="cbi-art-objs"${open ? '' : ' hidden'}>${objRows}</div>
    </div>`;
  }).join('');
  host.innerHTML = naRow + (body || '<p class="policy-no-data" style="margin:.4rem">No articles / objectives match the filter.</p>');
}
function cbiToggleArt(article) { _cbiExpanded[article] = !_cbiExpanded[article]; renderCbiMapTree(); }
function cbiToggleObjective(objKey, checked) {
  if (!_cbiFocusRef) return;
  const e = _cbiEntry(_cbiFocusRef);
  const s = new Set(e.objectives);
  if (checked) { s.add(objKey); e.na = false; } else s.delete(objKey);
  e.objectives = [...s];
  _cbiSave(); renderCbiQuestions();
}
function cbiToggleNA() {
  if (!_cbiFocusRef) return;
  const e = _cbiEntry(_cbiFocusRef);
  e.na = !e.na; if (e.na) e.objectives = [];
  _cbiSave(); renderCbiQuestions(); renderCbiMapTree();
}

// ── Suggest (auto-match pre-fill) ──
function cbiSuggestQuestion(ref) {
  const assessment = _cbiActive(); const cat = _cbiQ().categories[_cbiCatIdx]; if (!assessment || !cat) return;
  const q = cat.questions.find(x => x.ref === ref); if (!q) return;
  const keys = _cbiAutoKeys(assessment, q.articleNums, cat.capHints);
  const e = _cbiEntry(ref);
  const s = new Set(e.objectives); keys.forEach(k => s.add(k));
  e.objectives = [...s]; if (e.objectives.length) e.na = false;
  _cbiSave(); if (_cbiFocusRef === ref) renderCbiMapTree(); renderCbiQuestions();
}
function cbiSuggestAll() {
  const assessment = _cbiActive(); const cat = _cbiQ().categories[_cbiCatIdx]; if (!assessment || !cat) return;
  cat.questions.forEach(q => { if (_cbiState(q.ref) === 'unmapped') cbiSuggestQuestion(q.ref); });
  renderCbiQuestions(); renderCbiMapTree();
}

// ── prompt ──
function _cbiQuestionBlock(cat, q, assessment) {
  const e = _cbiMapping()[q.ref] || { objectives: [], na: false };
  const artLine = (q.articles && q.articles.length) ? ('Article ' + q.articles.join(', Article ')) : 'none cited';
  if (e.na) return `### CBI ${q.ref} — ${cat.id} ${cat.name}\nQuestion: ${q.text}\nDORA article(s) cited: ${artLine}\nStatus: MARKED NOT APPLICABLE by the assessor — answer the maturity as N/A with a one-line reason; no evidence required.`;
  const ev = _cbiEvidenceForObjectives(assessment, e.objectives);
  const objIdx = _cbiObjIndex(assessment);
  const mapped = (e.objectives || []).map(k => { const o = objIdx[k]; return o ? `${o.article} / ${o.obligationId}` : k; });
  let body;
  if (!ev || (!ev.statements.length && !ev.controls.length)) {
    body = mapped.length ? `Mapped to: ${mapped.join('; ')}\nOur evidence: the mapped objective(s) have no statements/controls yet — treat as a gap.`
      : 'Not yet mapped to any DORA objective — treat as a gap / human judgement.';
  } else {
    const cap = (arr, n) => arr.length > n ? arr.slice(0, n) : arr;
    const stmts = cap(ev.statements, 25).map(s => `   - ${s.ref} — ${s.header}${s.document ? ' (' + s.document + ')' : ''}${/^(E|WT|WP)\b/.test(s.disposition || '') ? ' [exception: ' + s.disposition + ']' : ''}`).join('\n');
    const ctrls = cap(ev.controls, 25).map(c => `   - ${c.name} — ${c.status}${c.eff && c.eff !== '—' ? ', ' + c.eff : ''}`).join('\n');
    body = `Mapped to DORA objective(s): ${mapped.join('; ')}
Our evidence:
- Objectives: ${ev.objectives}${ev.uncovered ? ` (${ev.uncovered} uncovered — coverage gap)` : ' (all covered)'}
- Documented statements (${ev.statements.length}${ev.statements.length > 25 ? ', first 25' : ''}):
${stmts || '   - (none)'}
- Controls (${ev.controls.length}${ev.controls.length > 25 ? ', first 25' : ''}; ${ev.implemented} implemented, ${ev.effective} effective):
${ctrls || '   - (none)'}
- Disclosed exceptions: ${ev.exceptions.length ? ev.exceptions.map(x => `${x.ref} (${x.disp})`).join('; ') : 'none'}`;
  }
  return `### CBI ${q.ref} — ${cat.id} ${cat.name}\nQuestion: ${q.text}\nDORA article(s) cited: ${artLine}\n${body}`;
}
function generateCbiPrompt() {
  const out = document.getElementById('cbi-prompt'); if (!out) return;
  const cat = _cbiQ().categories[_cbiCatIdx]; const assessment = _cbiActive();
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
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(ta.value).then(() => done(true)).catch(() => { ta.select(); done(false); }); }
  else { ta.select(); try { document.execCommand('copy'); done(true); } catch (e) { done(false); } }
}

if (typeof window !== 'undefined') {
  window.showCbiView = showCbiView;
  window.setCbiAssessment = setCbiAssessment;
  window.setCbiCategory = setCbiCategory;
  window.renderCbiQuestions = renderCbiQuestions;
  window.renderCbiMapTree = renderCbiMapTree;
  window.cbiFocusQuestion = cbiFocusQuestion;
  window.cbiSelectAll = cbiSelectAll;
  window.cbiToggleArt = cbiToggleArt;
  window.cbiToggleObjective = cbiToggleObjective;
  window.cbiToggleNA = cbiToggleNA;
  window.cbiSuggestQuestion = cbiSuggestQuestion;
  window.cbiSuggestAll = cbiSuggestAll;
  window.generateCbiPrompt = generateCbiPrompt;
  window.copyCbiPrompt = copyCbiPrompt;
}
