// ── DORA pillar reference + obligation→pillar resolver ────────────────
// Derived from the firm's DORA article/RTS applicability mapping (the
// DORA_Chapter column is the pillar; the two "applicable" flags mark scope).
// Kept as bundled reference data so the pillar cards work from the existing
// Policy / DORA / Risk uploads with no extra import.
//
// Mapping rules (per the applicability CSV):
//   · Every RTS (RTS 2–27) sits under Chapter II — ICT risk management.
//   · MIC / MIR technical standards sit under Chapter III — incident mgmt.
//   · Articles map to their chapter by number range.
//   · Chapters IV (testing) and VI (information-sharing) have no applicable
//     article/RTS for us → rendered as out-of-scope.
const DORA_PILLARS = [
  { id: 'riskmgmt',    chapter: 'II',  name: 'ICT Risk Management',                                   short: 'Risk Management',    icon: '🛡️', inScope: true },
  { id: 'incident',    chapter: 'III', name: 'ICT Incident Management, Classification & Reporting',    short: 'Incident Management', icon: '🚨', inScope: true },
  { id: 'testing',     chapter: 'IV',  name: 'Digital Operational Resilience Testing',                 short: 'Resilience Testing', icon: '🧪', inScope: false, outNote: 'Owned by InfoSec — no applicable articles or RTS for our scope.' },
  { id: 'thirdparty',  chapter: 'V',   name: 'ICT Third-Party Risk Management',                        short: 'Third-Party Risk',   icon: '🤝', inScope: true },
  { id: 'infosharing', chapter: 'VI',  name: 'Information-Sharing Arrangements',                       short: 'Information Sharing', icon: '🔗', inScope: false, outNote: 'Not applicable (Article 45 is voluntary and not adopted).' },
];

// Article number → pillar id (by DORA chapter ranges).
function doraPillarForArticle(n) {
  if (n >= 1  && n <= 16) return 'riskmgmt';      // Chapter II
  if (n >= 17 && n <= 23) return 'incident';      // Chapter III
  if (n >= 24 && n <= 27) return 'testing';       // Chapter IV
  if (n >= 28 && n <= 44) return 'thirdparty';    // Chapter V
  if (n === 45)           return 'infosharing';   // Chapter VI
  return null;                                    // 46+ = administrative
}

// Resolve an obligation to a pillar id from its DORA-article label and/or its
// paragraph reference. RTS → risk-management; MIC/MIR → incident; else article.
function doraPillarOf(articleText, obligationId) {
  const hay = `${articleText || ''} ${obligationId || ''}`;
  if (/\bmi[cr][\s\-_]?\d+/i.test(hay)) return 'incident';   // MIC / MIR
  if (/\brts[\s\-_]?\d+/i.test(hay))    return 'riskmgmt';   // any RTS
  const m = /\b(?:article|art)[\s\-_]?(\d+)/i.exec(hay);
  if (m) return doraPillarForArticle(parseInt(m[1], 10));
  return null;
}

if (typeof window !== 'undefined') {
  window.DORA_PILLARS = DORA_PILLARS;
  window.doraPillarForArticle = doraPillarForArticle;
  window.doraPillarOf = doraPillarOf;
}
