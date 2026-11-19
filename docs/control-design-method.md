# How to write a control — a field-by-field guide

A step-by-step guide to completing **every field** of a control and its CSA test, to the house standard. It is the method behind the **Operationalise** prompt (`docs/control-coverage-prompt.md`): the prompt automates it, this explains it.

> **The golden rule.** A control must be written with enough detail that a **brand-new control owner — who has never performed it before — can run it from the words alone.** The same goes for the test: a **fresh tester** must be able to perform it with no tacit knowledge. If a field assumes something only the author knows, it isn't finished — spell it out, or mark it as a placeholder for the owner to complete.

Every control is built from **two inputs**:

- **The mapped policy & group-standard statements** — *always* present. These are the obligations the control exists to satisfy.
- **The existing control** — present only when you're rewriting one. If you have it, you reuse its real specifics; if you don't, you design from the statements.

---

## Before you write — read your inputs

**Step 1 — Read the policy & group-standard statements.** For each statement, pull out *what must be assured* (the obligation in plain words — e.g. "P1 incidents are escalated within the agreed timeframe"). This set of obligations is what the control must cover, end to end, and what the Control Objective and Control Steps are written against.

**Step 2 — Read the existing control, if provided.** Pull out the **real specifics** — the systems, tools, URLs, documents, the owner's role and seniority, the frequency, the evidence it already produces. Then decide: is what's written the *control* (the checking) or the *process* (the doing)? Usually the "Description" is the process and the "Test" is the actual control — so you'll **swap them** (the checking becomes the control, the old test's checks become Control Steps).
*If there is no existing control,* design the control from the statements' intent instead, and carry every specific you can't source as a placeholder `[@snake_case_description]`. **Never invent a system, URL, threshold or path — mark it.**

---

## DOCUMENT A — the control (complete these fields, in order)

### 1. Control Name
**What:** a short, self-explanatory name that includes the **control type**.
**How:** name it by the assurance activity — *4-eye check, reconciliation, approval / sign-off, variance check, sample testing, dashboard monitoring* (or a plain review). E.g. *"Quarterly RCSA effectiveness-oversight review (Dashboard Monitoring)"*. The type tells the reader (and the tester) what kind of check this is.

### 2. Linked Policy & Group Standard statements — the control's opening line
**What:** the single most important line in the control. It is written as the **first line of the control**, naming every policy and group-standard statement the control satisfies. It stands on its own — not buried inside the description.
**How:** add it **exactly**, in the house wording:

> **Control is linked to following Policy & Group Standard statements: (`<refs>`)**

For example: *Control is linked to following Policy & Group Standard statements: (LP-26 PS02, LP-26 PS07, LP-26 PS01, LP-07 PS3)*.

**Why this matters:** this line **hard-links the control to the exact statements it satisfies**. It means (a) coverage can be proven end to end — statement → control; (b) an auditor or a new owner instantly sees *which regulatory obligation this control exists to discharge*; and (c) if a statement later changes, you can find every control linked to it. It is the thread that ties the control framework back to the policy.

### 3. Control Objective
**What:** one sentence stating the assurance the control gives.
**How:** **read the policy statements** and write the point of comfort — what a reader can rely on once this control has run. Objective, not activity: *"Provide ongoing oversight of the effectiveness of the risk-treatment-controls operationalising DORA,"* not *"review the dashboard."*

### 4. Control Description
**What:** a concise paragraph explaining **what the control checks**, naming the **systems/documents used** and the **seniority of the person** who performs it.
**How:** describe the checking activity (not the end-to-end business process). Name the real tools and the controller's role/seniority so a new owner knows *who* does it and *where*. Mark anything you don't know `[@…]` (e.g. `[@controller_seniority]`, `[@system_location]`).

### 5. Control Steps
**What:** the numbered actions the owner performs — the heart of the control.
**How:** one action per step, each a **real, observable check** a first-time owner can follow, written with the real system/document and the criterion checked (mark a missing criterion `[@exact_criteria_to_check]`). **Every evidence-producing step ends by saving a named artefact:**

> *…→ Save evidence of the `<thing>` as `"<Evidence Name> – <id>"` to the evidence location below.*

Use the **same evidence names** here, in the Evidence list (field 8) and in the test. The name is the join key.

### 6. Control Frequency
**What:** how often the control runs.
**How:** Daily / Weekly / Monthly / Quarterly / Ad hoc / Automated. This drives the test sample size later, so be exact.

### 7. Control Evidence location
**What:** where the saved evidence lives.
**How:** the folder / path / system location. If the existing control doesn't state it, mark `[@evidence_folder_path]`.

### 8. Control Evidence
**What:** the list of **named artefacts** the steps produce.
**How:** repeat, exactly, the names from the Control Steps (`"<Evidence Name> – <id>"`, …). This list is what the tester will go and retrieve.

### 9. Control Cost *(supplementary)*
**What:** the effort the control takes — typically **man-hours × frequency**.
**How:** e.g. *"0.5 day × quarterly"*; mark `[@man_hours]` if unknown.
**Why this matters:** cost lets **Risk run a cost-benefit analysis on the control** — weighing the assurance it provides against the effort it takes, to judge whether the control is **proportionate and efficient** (or whether a lighter or heavier control is warranted). Without it, efficacy can't be assessed.

---

## DOCUMENT B — the CSA test (how a tester proves the control works)

The test is a **separate document for CSA documentation**. It obtains the named evidence the control produced and checks it. Complete these fields:

### 1. Control Test Reviewer / Performer
**What:** who signs off (usually the Control Owner) and who performs the test (may differ; the owner stays accountable). Mark `[@reviewer]` / `[@performer]` if not set.

### 2. CT Frequency
**What:** how often the test runs — normally **Annually** (the RCSA cycle), regardless of how often the control itself runs.

### 3. Control Test Status / Result
**What:** Status = Pending; Result = Pending → **Pass / Pass with Observation / Fail**.
**How (rating):** *Fail* if >25% of samples aren't properly executed or evidenced; *Pass with Observation* if <25%; *Pass* if all are, or only minor documentation gaps.

### 4. Test Method
**What:** how the tester checks.
**How:** use the **strongest feasible** method on the ladder — *Inquiry < Observation < Inspection/Examination < Reperformance* — and say why. Prefer inspecting the named evidence, with reperformance on a sub-sample where possible.

### 5. Test Sample Size
**What:** how many occurrences to test.
**How:** read it from the RCSA table by the **control's frequency** (Daily = 15, Weekly = 6, Monthly = 3, Quarterly = 2, Annual = 1, Automated = 1 — Standard sizes). Reconcile with the control frequency: a *quarterly* control is sampled 2× a year, not once.

### 6. Test Purpose
**What:** one line — *"To confirm the adequacy of the execution and documentation of `<Control No>` based on the current control details."*

### 7. Test Steps
Two parts, mirroring the named evidence:

- **a. Obtain the evidence.** Confirm the population is complete (the full set of occurrences in the period), select the sample, and for each retrieve the named artefacts from the evidence location — **by the same names** the control saved them under.
- **b. Check compliance.** One check per Control Step, each reading a named artefact and tagged with the statement it proves:
  > *From `"<Evidence Name>"`: verify `<criterion>`.  `[verifies: <Statement Ref>]`*

  Add a reperformance sub-step where feasible.

---

## Finish: coverage check + readiness gate

- **Coverage check.** Confirm **every mapped statement is assured by at least one Control Step and tested by at least one check.** Anything not assured → add a step, or record it as not controlled.
- **Readiness gate (soft).** *Is the control clearly marked for a fresh **owner**? Is the test clearly marked for a fresh **tester**?* "Yes" means every gap is an explicit `[@…]` placeholder (clearly marked, ready to hand over) — **not** that every value is filled.

---

## One-page checklist

**The control**
1. Name carries the **control type**.
2. **"Control is linked to following Policy & Group Standard statements: (refs)"** — the opening line that links the control back to policy.
3. Objective states the **assurance**, read from the statements.
4. Description names **systems + controller seniority**.
5. Steps are **runnable by a new owner** and each **saves a named artefact**.
6. Frequency · 7. Evidence location · 8. named Evidence list.
9. **Cost** recorded (man-hours × frequency) so Risk can weigh cost vs benefit.

**The test**
1. Reviewer / Performer · 2. CT Frequency (Annually) · 3. Status/Result + rating rule.
4. Method = strongest feasible · 5. Sample size from the table (by control frequency).
6. Purpose · 7. **Obtain the named evidence → Check compliance** (each check `[verifies:]` a statement).

**Always true:** the control is the *checking*, the test *obtains and verifies* the named evidence, every field is detailed enough for a first-timer, and nothing is invented — unknowns are marked `[@…]` for the owner to complete.
