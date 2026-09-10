# Sample upload data (anonymised)

Three internally-consistent demo files for populating a fresh assessment —
useful for screenshots, demos and article figures. All document names, control
names, control numbers and owners are generic; nothing organisation-specific.

## Load order (into a new assessment)

1. **Import Policy** → `demo-policy.csv`
2. **Import DORA Mapping** → `demo-dora.csv`
3. **Import Risk** → `demo-risk.csv`

Capability dropdowns auto-map (the files use the app's standard capability
names), so each step is just confirm → save.

## How they join

- Policy `Statement Ref` ↔ DORA `Statement Ref` (e.g. `LP-01 PS01`, `GS-01 SR01`).
- Each risk control carries its statement ref in the (anonymised) control name,
  e.g. `LocPol — Asset inventory completeness [LP-01 PS01]` — that bracketed ref
  is what links the control to its statement, so keep it if you edit a name.
  A `LocPol`/`GrpStd` name prefix marks a new DORA control; no prefix = a reused
  pre-DORA control.

## What the data demonstrates

- **Control 1 (coverage):** 6 articles, 14/16 objectives covered — a mix of
  policy-covered, group-standard-only, covered-by-both, and uncovered gaps.
- **Control 2 (operationalisation):** Approved and Partial document statuses, a
  spread of draft/implemented controls, plus one *invisible work* and one
  *stale waiver* flag.
- **Control 3 (effectiveness):** risks spread across the green, amber and red
  (danger) zones of the residual-vs-effectiveness quadrant, plus one
  not-yet-assessed risk that is excluded from the plot.

Regenerate or adjust via `docs/sample-data/gen-demo.js` is not committed; ask if
you want the generator added too.
