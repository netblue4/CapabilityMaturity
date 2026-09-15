// ── DORA pillar reference + capability→pillar resolver ────────────────
// The AUTHORITATIVE pillar rule is by OWNING CAPABILITY (see
// doraPillarForCapabilityName at the bottom): everything the app groups into a
// pillar — the pillar cards, every table's DORA Pillar column and the full
// traceability table — uses that one rule, so their numbers reconcile exactly.
//   · capability name contains "incident"    → Incident Management (Ch III)
//   · capability name contains "third party" → Third-Party Risk (Ch V)
//   · everything else                         → ICT Risk Management (Ch II)
// No capability maps to Resilience Testing or Information-Sharing, so those
// pillars stay out of scope.
//
// The article/RTS resolver below (doraPillarOf) is retained for reference only
// and is no longer used to assign pillars.
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

// ── Capability → pillar (the authoritative mapping) ──────────────────
// The forum groups everything by the OWNING CAPABILITY, not the DORA article:
//   · capability name contains "incident"     → Incident Management (Ch III)
//   · capability name contains "third party"  → Third-Party Risk (Ch V)
//   · everything else                          → ICT Risk Management (Ch II)
// (No capability maps to Resilience Testing or Information-Sharing, so those
// pillars stay out of scope.) This is the single source of truth for the
// pillar cards, every table's DORA Pillar column, and the traceability table,
// so their numbers reconcile exactly.
function doraPillarForCapabilityName(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('incident')) return 'incident';
  if (n.replace(/[^a-z]/g, '').includes('thirdparty')) return 'thirdparty';
  return 'riskmgmt';
}

if (typeof window !== 'undefined') {
  window.DORA_PILLARS = DORA_PILLARS;
  window.doraPillarForArticle = doraPillarForArticle;
  window.doraPillarOf = doraPillarOf;
  window.doraPillarForCapabilityName = doraPillarForCapabilityName;
}
