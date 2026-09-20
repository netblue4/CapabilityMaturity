// ── DORA Statement of Applicability (SOA) — seeded catalogue ──────────
// The DORA universe (articles + RTS/ITS) with an applicability decision and a
// one-line rationale. This is the completeness baseline for Governance-Control 1:
// auditors read it to confirm every part of DORA was considered and see which
// parts we deemed applicable, before diving into the coverage detail.
//
// SEEDED SAMPLE DATA — replace with your authoritative SOA. A future upload will
// populate assessment.doraSoa with this same shape, which then overrides this
// default (see evidenceControl1: a.doraSoa || DORA_SOA).
//
// Shape: { ref, chapter, applicable, rationale }
//   ref        — the DORA article/RTS label. For applicable items that are mapped
//                in the DORA upload, this MUST match the "DORA Article" value in
//                that upload so coverage joins to buildDoraObligations.
//   chapter    — DORA chapter (roman numeral) for grouping/sorting.
//   applicable — true = in scope for us; false = out of scope (with rationale).
//   rationale  — one line: why it is / isn't applicable to us.
const DORA_SOA = [
  // Chapter I — General provisions
  { ref: 'Articles 1–4 — Subject matter, scope & definitions', chapter: 'I', applicable: false, rationale: 'General provisions, scope and definitions — no operational control objective to own.' },

  // Chapter II — ICT Risk Management
  { ref: 'Article 5 — ICT governance & organisation',           chapter: 'II', applicable: true,  rationale: 'Management-body accountability for ICT risk applies to us.' },
  { ref: 'Article 6 — ICT risk management framework',           chapter: 'II', applicable: true,  rationale: 'We must maintain a documented ICT risk management framework.' },
  { ref: 'RTS 4 — ICT asset management policy',                 chapter: 'II', applicable: true,  rationale: 'ICT asset & configuration management applies.' },
  { ref: 'RTS 10 — Vulnerability and patch management',         chapter: 'II', applicable: true,  rationale: 'Vulnerability & patch management applies.' },
  { ref: 'RTS 17 — ICT change management',                      chapter: 'II', applicable: true,  rationale: 'ICT change management applies.' },
  { ref: 'RTS 21 — Access control',                             chapter: 'II', applicable: true,  rationale: 'Logical access control applies.' },

  // Chapter III — ICT-related Incident Management
  { ref: 'Article 17 — ICT incident management process',        chapter: 'III', applicable: true,  rationale: 'Incident detection, handling & classification applies.' },
  { ref: 'Article 19 — Reporting of major ICT-related incidents', chapter: 'III', applicable: true, rationale: 'Major-incident reporting to the competent authority applies.' },

  // Chapter IV — Digital Operational Resilience Testing
  { ref: 'Articles 24–26 — Resilience testing programme',       chapter: 'IV', applicable: false, rationale: 'Testing programme owned by InfoSec and evidenced there — out of scope for this SOA.' },
  { ref: 'Article 27 & TLPT RTS — Threat-led penetration testing', chapter: 'IV', applicable: false, rationale: 'Entity not designated for mandatory threat-led penetration testing.' },

  // Chapter V — ICT Third-Party Risk
  { ref: 'Article 28 — ICT third-party general principles',     chapter: 'V', applicable: true,  rationale: 'Use of ICT third-party providers applies.' },
  { ref: 'Article 29 — Concentration risk',                     chapter: 'V', applicable: true,  rationale: 'Provider concentration risk must be assessed.' },
  { ref: 'Article 30 — Key contractual provisions',             chapter: 'V', applicable: true,  rationale: 'Mandatory contractual terms with ICT providers apply.' },
  { ref: 'Articles 31–44 — Oversight of critical ICT third-party providers', chapter: 'V', applicable: false, rationale: 'Oversight framework addressed to the ESAs and designated critical TPPs, not to us as a financial entity.' },

  // Chapter VI — Information-sharing arrangements
  { ref: 'Article 45 — Information-sharing arrangements',       chapter: 'VI', applicable: false, rationale: 'Voluntary under Article 45; not adopted.' },

  // Chapters VII–IX — Competent authorities, supervision & final provisions
  { ref: 'Articles 46–64 — Competent authorities & final provisions', chapter: 'VII–IX', applicable: false, rationale: 'Supervisory, administrative and final provisions — no entity-level control objective.' },
];

if (typeof window !== 'undefined') window.DORA_SOA = DORA_SOA;
