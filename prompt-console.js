// Hidden Prompt Console.
// All AI-prompt generators are reachable only from here (the ✨ buttons were
// removed from the cards), so nothing about prompts shows in the normal UI
// during a demo. The console is opened by clicking the unlabelled header
// hotspot 4 times in quick succession.

var _pcClicks = 0, _pcTimer = null;
function promptHotspot() {
  _pcClicks++;
  if (_pcTimer) clearTimeout(_pcTimer);
  _pcTimer = setTimeout(() => { _pcClicks = 0; }, 1200);
  if (_pcClicks >= 4) { _pcClicks = 0; if (_pcTimer) clearTimeout(_pcTimer); showPromptConsole(); }
}

function _pcEsc(s) { return (typeof escHtml === 'function') ? escHtml(s) : String(s == null ? '' : s); }
function _pcAssessments() {
  const list = (typeof db !== 'undefined' && db.assessments) ? db.assessments.slice() : [];
  return list.sort((a, b) => String(b.date || b.quarter || b.id).localeCompare(String(a.date || a.quarter || a.id)));
}
function _pcActive() { const s = document.getElementById('pc-assessment'); const list = _pcAssessments(); return (s && list.find(a => a.id === s.value)) || list[0] || null; }
function _pcLens() { const s = document.getElementById('pc-lens'); return (s && s.value) || 'dora'; }

// Set the shared context, then open a popup. DORA-authoring prompts always use
// the DORA lens; the risk prompts use the lens picked in the console.
function _pcLaunch(fn, forceDora) {
  const a = _pcActive();
  if (!a) { alert('No assessment yet — import one or load demo data first.'); return; }
  if (typeof setPromptContext === 'function') setPromptContext(a, forceDora ? 'dora' : _pcLens());
  if (typeof fn === 'function') fn();
}
function pcRiskPrompts() { _pcLaunch(window.openPromptsModal, false); }
function pcMapArticle() { _pcLaunch(window.openArticleMapModal, true); }
function pcLinkControls() { _pcLaunch(window.openLinkCtrlModal, true); }
function pcOperationalise() { _pcLaunch(window.openCtrlDescModal, true); }
function pcCbi() { if (typeof showCbiView === 'function') showCbiView(); }

function showPromptConsole() {
  const list = _pcAssessments();
  const asel = document.getElementById('pc-assessment');
  if (asel) asel.innerHTML = list.length ? list.map(a => `<option value="${_pcEsc(a.id)}">${_pcEsc(a.name || a.quarter || a.id)}</option>`).join('') : '<option value="">(no assessments — import or load demo data)</option>';
  renderPromptIndex();
  if (typeof showView === 'function') showView('prompts');
}

function renderPromptIndex() {
  const host = document.getElementById('pc-index'); if (!host) return;
  const card = (title, desc, onclick, note) => `<div class="pc-item">
    <div class="pc-item-main"><div class="pc-item-title">${_pcEsc(title)}</div><div class="pc-item-desc">${_pcEsc(desc)}</div></div>
    <button class="btn btn-primary pc-open" onclick="${onclick}">Open</button>
    ${note ? `<div class="pc-item-note">${_pcEsc(note)}</div>` : ''}
  </div>`;
  host.innerHTML = `
    <div class="pc-group"><div class="pc-group-hd">Risk prompts — one risk at a time (Risk Oversight extract)</div>
      ${card('AI prompts — DORA risks', 'Validate the risk · Control coverage · Reduce controls · Rewrite to CSA standard · Risk rationale & tier. Pick a risk inside the popup.', 'pcRiskPrompts()')}
    </div>
    <div class="pc-group"><div class="pc-group-hd">DORA authoring (traceability)</div>
      ${card('✨ Map a new article', 'Paste a new DORA article/RTS, pick documents → objectives mapped to your statements in the Import DORA Mapping columns.', 'pcMapArticle()')}
      ${card('✨ Link controls', 'Pick risks + policies/standards → map your controls to statements by intent.', 'pcLinkControls()')}
      ${card('✨ Operationalise controls', 'Expand a policy/standard, tick controls → reason through the rewrite, then build operational control(s) + control test(s) to the CSA standard.', 'pcOperationalise()')}
    </div>
    <div class="pc-group"><div class="pc-group-hd">CBI self-assessment</div>
      ${card('📝 CBI evidence-pack generator', 'Map CBI Section-4 questions to your DORA objectives, then generate the Strengths / Weaknesses / maturity table for Excel.', 'pcCbi()', 'Has its own assessment picker.')}
    </div>`;
}

if (typeof window !== 'undefined') {
  window.promptHotspot = promptHotspot;
  window.showPromptConsole = showPromptConsole;
  window.renderPromptIndex = renderPromptIndex;
  window.pcRiskPrompts = pcRiskPrompts;
  window.pcMapArticle = pcMapArticle;
  window.pcLinkControls = pcLinkControls;
  window.pcOperationalise = pcOperationalise;
  window.pcCbi = pcCbi;
}
