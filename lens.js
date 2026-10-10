// ── Regulatory lens (add-on modules: DORA / MiCA / NIST CSF) ──────────
// A "lens" selects WHICH framework's Statement of Applicability + objective→
// statement mapping drives the obligation, traceability and coverage views.
// The policy statements, controls and risks — the single control framework at
// the lowest level — are SHARED across every lens. Only the regulatory overlay
// changes.
//
// DORA is the default. When DORA is active, every accessor resolves to the exact
// fields the app has always used (doraRows / doraSoa / …), so DORA behaviour is
// byte-for-byte identical to before the lens layer existed. MiCA and NIST are
// additive modules the user uploads into their own slots and switches on.

let activeLens = 'dora';

const FRAMEWORKS = {
  dora: {
    key: 'dora', label: 'DORA', short: 'DORA', icon: '🛡️',
    objLabel: 'Digital Resilience Objective', unitLabel: 'articles/RTS', groupLabel: 'DORA Pillar',
    rowsKey: 'doraRows', soaKey: 'doraSoa', metaKey: 'doraMeta', soaMetaKey: 'doraSoaMeta',
    csvRows: null, csvSoa: null,   // DORA keeps its dedicated wizards
  },
  mica: {
    key: 'mica', label: 'MiCA', short: 'MiCA', icon: '🪙',
    objLabel: 'MiCA Objective', unitLabel: 'articles', groupLabel: 'MiCA domain',
    rowsKey: 'micaRows', soaKey: 'micaSoa', metaKey: 'micaMeta', soaMetaKey: 'micaSoaMeta',
    csvRows: 'mica.csv', csvSoa: 'mica-soa.csv',
  },
  nist: {
    key: 'nist', label: 'NIST CSF', short: 'NIST', icon: '🔐',
    objLabel: 'NIST Outcome', unitLabel: 'subcategories', groupLabel: 'NIST Function',
    rowsKey: 'nistRows', soaKey: 'nistSoa', metaKey: 'nistMeta', soaMetaKey: 'nistSoaMeta',
    csvRows: 'nist.csv', csvSoa: 'nist-soa.csv',
  },
};
const LENS_ORDER = ['dora', 'mica', 'nist'];

function activeFramework() { return FRAMEWORKS[activeLens] || FRAMEWORKS.dora; }
function lensLabel() { return activeFramework().label; }
function lensObjLabel() { return activeFramework().objLabel; }
function lensGroupLabel() { return activeFramework().groupLabel; }
// The word for a single unit of the framework, qualified by lens:
// "DORA article" / "MiCA article" / "NIST subcategory".
function lensRefWord() { return activeLens === 'nist' ? 'subcategory' : 'article'; }
function lensRef() { return activeFramework().label + ' ' + lensRefWord(); }

// Active lens's objective-mapping rows for an assessment.
function lensRows(a) { return (a && a[activeFramework().rowsKey]) || []; }
// Active lens's SOA entries. DORA falls back to the seeded DORA_SOA snapshot
// (preserving today's behaviour); other lenses have no seed.
function lensSoa(a) {
  const f = activeFramework();
  const s = a && a[f.soaKey];
  if (s && s.length) return s;
  return f.key === 'dora' && typeof DORA_SOA !== 'undefined' ? DORA_SOA : [];
}
function lensMeta(a) { return a && a[activeFramework().metaKey]; }
function lensSoaMeta(a) { return a && a[activeFramework().soaMetaKey]; }
// Does the active lens have any data for this assessment?
function lensHasData(a) {
  const f = activeFramework();
  return ((a && a[f.rowsKey]) || []).length > 0 || ((a && a[f.soaKey]) || []).length > 0;
}

// Run fn with a specific lens active, then restore. Pins the named reports
// (DORA Forum / ROC) to DORA regardless of the on-screen lens.
function withLens(key, fn) {
  const prev = activeLens;
  activeLens = FRAMEWORKS[key] ? key : prev;
  try { return fn(); } finally { activeLens = prev; }
}

function loadActiveLens() {
  try { const k = localStorage.getItem('ict_active_lens'); if (k && FRAMEWORKS[k]) activeLens = k; } catch (e) {}
}
function setActiveLens(key) {
  if (!FRAMEWORKS[key] || key === activeLens) { if (typeof updateLensSwitchUI === 'function') updateLensSwitchUI(); return; }
  activeLens = key;
  try { localStorage.setItem('ict_active_lens', key); } catch (e) {}
  if (typeof updateLensSwitchUI === 'function') updateLensSwitchUI();
  if (typeof rerenderActiveView === 'function') rerenderActiveView();
}

// ── Pillar models per lens ────────────────────────────────────────────
// DORA uses the existing DORA_PILLARS (capability-name → pillar). MiCA and NIST
// carry their group directly on each objective row (the "Pillar" column), so the
// group id IS the pillar and the resolver is identity.
const MICA_PILLARS = [
  { id: 'Governance & Organisation',    name: 'Governance & Organisation',          short: 'Governance',     icon: '🏛️', inScope: true },
  { id: 'Prudential',                   name: 'Prudential (own funds)',             short: 'Prudential',     icon: '💰', inScope: true },
  { id: 'Client-Asset Safeguarding',    name: 'Client-Asset Safeguarding',          short: 'Client Assets',  icon: '🔒', inScope: true },
  { id: 'Conduct & Investor Protection',name: 'Conduct & Investor Protection',      short: 'Conduct',        icon: '⚖️', inScope: true },
  { id: 'Operational Resilience',       name: 'Operational Resilience (ICT / DORA)', short: 'Op. Resilience', icon: '🛡️', inScope: true },
  { id: 'Market Integrity',             name: 'Market Integrity',                   short: 'Market Integrity', icon: '📈', inScope: true },
];
const NIST_PILLARS = [
  { id: 'Govern',   name: 'Govern',   short: 'Govern',   icon: '🏛️', inScope: true },
  { id: 'Identify', name: 'Identify', short: 'Identify', icon: '🔎', inScope: true },
  { id: 'Protect',  name: 'Protect',  short: 'Protect',  icon: '🛡️', inScope: true },
  { id: 'Detect',   name: 'Detect',   short: 'Detect',   icon: '📡', inScope: true },
  { id: 'Respond',  name: 'Respond',  short: 'Respond',  icon: '🚨', inScope: true },
  { id: 'Recover',  name: 'Recover',  short: 'Recover',  icon: '♻️', inScope: true },
];
const LENS_OTHER_PILLAR = { id: '__other', name: 'Unmapped statements', short: 'Unmapped', icon: '•', inScope: true };

function activePillars() {
  return activeLens === 'mica' ? MICA_PILLARS
       : activeLens === 'nist' ? NIST_PILLARS
       : (typeof DORA_PILLARS !== 'undefined' ? DORA_PILLARS : []);
}
function pillarDefById(id) {
  return (activePillars() || []).concat([LENS_OTHER_PILLAR]).find(x => x.id === id) || null;
}
function pillarShortById(id) { const p = pillarDefById(id); return p ? p.short : (id || ''); }

// Lens-aware pillar id for a traceability row: DORA uses the capability-name
// rule (unchanged); MiCA/NIST use the objective's group, else the Unmapped bucket.
function lensPillarId(rowCap, objGroup) {
  if (activeLens === 'dora') return (typeof doraPillarForCapabilityName === 'function') ? doraPillarForCapabilityName(rowCap) : '';
  return (objGroup && objGroup.trim()) ? objGroup.trim() : '__other';
}

if (typeof window !== 'undefined') {
  window.FRAMEWORKS = FRAMEWORKS;
  window.activeFramework = activeFramework;
  window.lensRows = lensRows; window.lensSoa = lensSoa; window.lensMeta = lensMeta; window.lensSoaMeta = lensSoaMeta;
  window.lensLabel = lensLabel; window.lensObjLabel = lensObjLabel; window.lensGroupLabel = lensGroupLabel;
  window.lensRefWord = lensRefWord; window.lensRef = lensRef;
  window.lensHasData = lensHasData; window.withLens = withLens;
  window.setActiveLens = setActiveLens; window.loadActiveLens = loadActiveLens;
  window.activePillars = activePillars; window.pillarShortById = pillarShortById; window.pillarDefById = pillarDefById;
  window.lensPillarId = lensPillarId;
}
