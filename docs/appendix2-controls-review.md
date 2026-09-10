# Review — Appendix 2: Controls (dual-lens alignment)

Reviewing the three controls in **Appendix 2** against (a) the **dual-lens** the
article sets out, (b) the **two gates** that rate the compliance risk, and
(c) the **three control-evidence pages** the app produces. The goal is to make
the article, the controls, and the evidence tell one consistent story.

---

## 1. What's out of sync (findings)

**F1 — Control 3 is undefined.** In Appendix 2, Control 3's *Control Objective*
and *Control Description* cells are **blank**. Only its Name, Type, Frequency and
Key Evidence are filled. A control with no objective/description can't be
evidenced or tested.

**F2 — Controls 2 and 3 are duplicates.** Control 2 ("Policy-statement
operationalised by controls") and Control 3 ("Annual statement-to-control
operationalisation") describe the *same* activity, and their **Key Evidence is
word-for-word identical** ("Mapping matrix of policy-statements to control
traceability"). As written, Control 3 adds nothing.

**F3 — The controls leak across the lens boundary.** The article is emphatic:
compliance evidence must stay "clean… without that picture being muddied by our
internal performance metrics," and effectiveness is tracked "separately against
the underlying ICT risks, not this compliance risk." But the app's **Control 3
evidence page** shows **effectiveness** (design/operating ratings). So the
compliance evidence is doing exactly what the article says it must not — mixing
the two lenses.

**F4 — The controls don't map to the two gates or the three evidence pages.**
The prose (§5) says: *Control 1 records the articles that apply; Control 2 records
that every article is covered and owned; Control 3 records how we operationalised
the statements with controls.* That is a clean three-way split — **but the
Appendix-2 definitions don't reflect it** (Control 1 already includes "map to a
statement", and Controls 2 and 3 both read as "operationalised by controls").

---

## 2. The correct framing (dual-lens)

The article already gives the answer; the controls just need to be written to
match it.

- **All three controls belong to the COMPLIANCE lens.** They are preventive /
  design controls that maintain the traceable SOA — *DORA article → objective →
  policy/GS statement → control* — and together they drive the **two gates** that
  rate the "Non-compliance with ICT regulation (DORA)" risk.
- **Effectiveness is the OTHER lens and is NOT one of these controls.** It is the
  business-as-usual **RCSA/CSA** cycle (§6), where the same controls are tested
  for design + operating effectiveness against the *underlying ICT risks*. It has
  its own evidence (the effectiveness table) and must be kept **out of** Controls
  1–3.

So the three controls line up 1:1 with the two gates and the three app evidence
pages:

| Model control | Lens | Gate it proves | App evidence page |
|---|---|---|---|
| Control 1 — completeness (SOA) | Compliance | Gate 1a — obligation universe identified & defined | **Control 1** (Regulatory SOA: obligations → owned statement) |
| Control 2 — coverage & ownership | Compliance | Gate 1b — every statement backed-or-excepted & owned | **Control 2** (statements backed by controls + owner) |
| Control 3 — operationalisation | Compliance | **Gate 2** — share of obligations with an *implemented* control | **Control 3** (statement → control with **implemented/live** status + exceptions) |
| *(Effectiveness)* | *Effectiveness* | *not this risk* | *Risk view — residual vs control effectiveness (RCSA)* |

The single most important change: **Control 3 = implementation coverage, not
effectiveness.** "Live vs draft" is compliance (Gate 2). "Effective vs not" is the
other lens. Move effectiveness out of Control 3's evidence and into the risk view.

---

## 3. Rewritten Appendix 2 (ready to paste)

### Control 1 — Regulatory completeness (Statement of Applicability)
- **Objective:** (a) identify the full population of applicable DORA articles/RTS;
  (b) break each into single-purpose objectives; (c) map every objective to an
  **owned** IT Policy or Group Standard statement, or log a disclosed exception —
  so nothing in scope is unidentified or unmapped.
- **Description:** Annually, and on material regulatory change, ICT Governance &
  Risk refreshes the authoritative in-scope DORA article/RTS list, derives the
  objectives, and maps each to a policy/GS statement with an accountable owner.
  Objectives with no statement are logged as exceptions (E / WT / WP) with
  rationale, approval and expiry.
- **Type:** Preventive, manual (tool-assisted). **Frequency:** Annual + on material regulatory change.
- **Key evidence:** the **DORA SOA** — every in-scope obligation and whether it is
  mapped to an owned policy/GS statement (Gate 1 completeness). *(App: Control 1 evidence page.)*

### Control 2 — Statement control-coverage & ownership
- **Objective:** ensure every mapped policy/GS statement is backed by at least one
  control that cites it (or a disclosed exception) **and** has a named accountable
  owner — so coverage of the SOA is complete and owned.
- **Description:** Annually each statement is linked to the control(s) that
  operationalise it via an explicit "control is linked to the following
  statements…" reference. New statements spawn controls; retired statements retire
  controls; duplicates are rationalised through a retained de-duplication working
  table; statements with no control are logged as exceptions; the control set is
  signed off as fully reflecting the current statements.
- **Type:** Preventive, manual. **Frequency:** Annual + on material change.
- **Key evidence:** the **statement → control mapping matrix** with owner and
  backed / not-backed status. *(App: Control 2 evidence page.)*

### Control 3 — Operationalisation (implementation coverage)
- **Objective:** ensure the controls backing our statements are actually
  **implemented and live** (not merely drafted), so obligations move from
  "covered" to "operationalised". This is what steps the compliance residual down
  under **Gate 2**.
- **Description:** Annually, the implementation status of each backing control is
  confirmed (implemented/live vs drafted/in-progress); the **share of obligations
  with an implemented control** is computed for the implementation-coverage gate;
  open exceptions are confirmed in-date. **Control effectiveness (design/operating
  testing) is explicitly out of scope of this control** — it is assured separately
  through the BAU RCSA against the underlying ICT risks (§6).
- **Type:** Preventive / detective, manual (tool-assisted). **Frequency:** Annual + on statement or control change.
- **Key evidence:** the **statement → control matrix with implementation status
  (live/draft) and in-date exceptions** — the implementation-coverage figure that
  feeds Gate 2. *(App: Control 3 evidence page — implementation, **not** effectiveness.)*

> **Effectiveness (the second lens) — for completeness, not a model control.**
> The same controls are integrated into the BAU **RCSA/CSA** cycle and tested for
> design + operating effectiveness against the underlying ICT risks (§6 table).
> Its evidence is the effectiveness/residual view, tracked **separately** and never
> folded into Controls 1–3.

---

## 4. Implication for the app (optional follow-up)

The app's **Control 3 evidence page** currently carries an **Effectiveness**
column and a "live & effective" headline. To honour the article's own rule
(don't muddy compliance with performance), that page should show **implementation
only** — implemented/live vs draft, plus in-date exceptions — and effectiveness
should live in the **risk view** (the residual-vs-effectiveness quadrant / risk
register in the exec report already does this).

Concretely, if you want the app to match this review:
1. Control 3 evidence page → drop the **Effectiveness** column; keep Status
   (Live/Draft), Provenance and Exception. Retitle to "operationalisation /
   implementation coverage".
2. Keep the effectiveness story where it belongs — the exec report's Control 3
   **risk quadrant** and risk-assurance table (that *is* the effectiveness lens).
3. Optionally rename the exec Control 3 donut back toward "implemented vs draft"
   (compliance) and let the quadrant carry "effective vs not" (effectiveness), so
   the two lenses are visually separate.

Say the word and I'll make those changes.
