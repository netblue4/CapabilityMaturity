# Risk Rationale & Tier Selection Prompt (Ratings-Led, Two Tabs)

## 1. Instructions for the Model
1. Read the six inputs provided in the placeholders in Section 2.
2. This assessment has two tabs: Inherent Risk and Residual Risk. Produce a complete, separate output for each tab, in the order: Inherent, then Residual.
3. For each tab, you are given a Likelihood rating (1–5) and an Impact rating (1–5):
   - Inherent tab uses {InherentLikelihoodRating} and {InherentImpactRating}.
   - Residual tab uses {ResidualLikelihoodRating} and {ResidualImpactRating}.
   - Do not recalculate or override these — generate a rationale that justifies the score as given, grounded in {RiskDescription} (and, for the Residual tab, also grounded in {ExistingControls} and their effectiveness). Each rationale must be 200–240 characters.
4. For each tab, rate the same five risk categories: Customer, Brand & Reputation, Regulatory & Legal, Internal Operational, Project. Do this in two steps, in order:
   - Step A — Independent assessment: For each of the five categories, read its full tier description in Section 3 and select the tier whose description most closely matches the facts in {RiskDescription} (and, for the Residual tab, {ExistingControls} and their effectiveness). Do this once per category, using only the tier text and the risk facts — do NOT reference the Likelihood or Impact rating at this step, and do not default to giving every category the same tier.
   - Step B — Consistency check: After Step A, check the five category tiers against that tab's Likelihood and Impact ratings:
     - No category tier may exceed the higher of that tab's Likelihood and Impact ratings. If Step A produced a category above this ceiling, lower only that category to the ceiling and revise its justification accordingly.
     - At least one of the five categories must equal that tab's Impact rating, and at least one must equal that tab's Likelihood rating (the same category may satisfy both if the two ratings are equal). If Step A's results don't already satisfy this, raise the single category whose Step-A tier is closest to the missing value, rather than changing multiple categories.
     - Do not set all five categories to the same tier as a way of satisfying Step B. Categories should show genuine variation reflecting their individual tier descriptions; identical tiers across all five categories are only acceptable if the risk description independently and clearly justifies that for every category, which should be rare. If your draft output has all five categories at the same tier, redo Step A more carefully before proceeding.
     - Provide a justification of 200–240 characters per category, referencing a) the specific tier description language that applies and b) a control that contributed to the tier selected.
5. Reminder: the back-rating/consistency rule in Step B is a ceiling and a minimum-coverage check applied after independent analysis — it is not a shortcut for assigning ratings.
6. Expand every abbreviation on first use (e.g. "Know Your Customer (KYC)"), then use the abbreviation in subsequent references.
7. Keep the tone objective and professional, consistent with Utmost Luxembourg S.A. policies.
8. Output only the sections shown in the Output Format in Section 5 — do not add unrequested fields, headers, or commentary.
9. Table format: present each tab's results as a single table with two columns — Category and Rating & Justification (or, where a row has both a Rating and separate Justification, use three columns: Category | Rating | Justification). Produce exactly two tables — one for Inherent Risk, one for Residual Risk — as shown in Section 5. Do not use bullet points for the ratings themselves; bullets are only acceptable inside the Control Gaps / Unrelated Controls rows.
10. Consistency Flags (review only, not a rating rule): after both tabs are complete, produce the third table shown in Section 5 comparing each category's Inherent tier to its Residual tier, and mark it "FLAG" if the Residual tier is higher than the Inherent tier for that same category, or "OK" otherwise. This table is purely informational — do not go back and change any Inherent or Residual rating to avoid a flag; ratings are decided by Steps A/B above, and flagged rows will be corrected manually by the reviewer.

## 2. Inputs
2.a) Read the risk data provided in the Risk Content section below. Note that the data is provided in a tabular format where one risk may have multiple rows representing different controls.

2.b) Placeholder-to-column mapping — which column in the tabular format to use for each placeholder value:
1. Risk Description: {RiskDescription} = "Description"
2. Inherent Risk – Likelihood: {InherentLikelihoodRating} = "Inherent Likelihood"
3. Inherent Risk – Impact: {InherentImpactRating} = "Inherent Impact"
4. Existing Controls and Effectiveness Rating (a combination of 2 columns): {ExistingControls} = "Control: Control Name" and "Control Effectiveness Score"
5. Residual Risk – Likelihood: {ResidualLikelihoodRating} = "Residual Likelihood"
6. Residual Risk – Impact: {ResidualImpactRating} = "Residual Impact"

### Risk Content
<<--["Risk you need to assess"]-->>

## 3. Tier Descriptions per Risk Category
All five categories use the same 1–5 tier scale. Select the single most appropriate tier per category, subject to the back-rating rule in Section 1.

### Customer
- Tier 1 – Trivial or no impact on customer: Isolated incidents of minimal impact and no detriment. Limited impact on service delivery, unlikely to be visible to clients.
- Tier 2 – Some minor impacts but easily and quickly rectifiable: Low number of errors or issues resulting in some minor detriment (e.g. ≤ £20 per customer). Some services to clients interrupted for up to 6 hours. Likely visible to a small number of clients (<10%). Potential for isolated incidences of dissatisfaction.
- Tier 3 – Failure to meet some obligations, may take time to resolve: Errors or issues affecting multiple customers (<10%) but low value of detriment per customer; volume means rectification will take time (e.g. several weeks). Major interruption of multiple important or critical services for up to 12 hours. Likely visible to many clients (10–50%) and other stakeholders. Potential for increased dissatisfaction incidences.
- Tier 4 – Failure to meet key obligations to a subset of customers, will take time to resolve: Error or issue affecting large volume of customers (10–50%) requiring remediation taking up to six months. Important and critical services interrupted for up to 24 hours. Likely visible to most clients (>50%) and external stakeholders. Potentially reportable to regulator. Potential for serious complaints requiring compensation.
- Tier 5 – Significant failure to meet key obligations to a sector or many customers: Significant and complex failure representing a large proportion of customers (>50%) with varying degrees of detriment. Will take considerable time to fully rectify and remediate (longer than six months). Important and critical services interrupted for more than 24 hours. Likely visible to most clients (>50%) and other stakeholders. Potential for large volume of compensation. Business continuity measures invoked. Regulatory oversight also likely.

### Brand and Reputation
- Tier 1 – Negligible impact to both reputation and brand: Adverse local rumours and speculation limited to social media. Little or no engagement from customers or stakeholders with regards to environment or sustainability.
- Tier 2 – Minor impact on both reputation and brand: Adverse local media coverage via press and/or TV. Customer queries around Utmost position on environment and sustainability measures.
- Tier 3 – Potential for damage to reputation, potential to tarnish the brand: Adverse media coverage possible with some national media coverage or industry body interest, limited to the business entity. Lack of clarity on Utmost position on environmental and sustainability measures; small numbers of customer queries or expressions of dissatisfaction.
- Tier 4 – Potential for irrevocable damage to reputation, major impact to brand: Material adverse national media comment occurring or anticipated. Proactive management required to mitigate risk to Group. Increased interaction with customers and business partners in relation to environmentally friendly products and proposition with potential for loss of business or failure to attract new business.
- Tier 5 – Irrevocable damage to reputation, substantial damage to the brand: Widespread international material adverse media comment occurring or anticipated. Senior management focus required to mitigate the risk for the Group. Failure to attract new business or partnerships and/or lapses/surrenders due to lack of sustainable and environmentally friendly products/proposition.

### Regulatory and Legal Impact
- Tier 1 – Little to no concern: Minor interest possible; speedy resolution likely; censure highly unlikely. Incidents or accidents of a minor nature involving employees or visitors, not requiring first aid, but requiring recording in the Accident Book. Singular breach of confidentiality and/or data protection obligations that is recorded but not reported, with no identifiable impact on parties concerned. No legal impact; maximum exposure < 0.1% of Own Funds.
- Tier 2 – Minor concern leading to minimal intervention or action: Although considered, regulator not notified; censure unlikely. Incidents or accidents involving employees or visitors likely to require first aid and recording in the Accident Book. Singular breach of confidentiality and/or data protection obligations reportable to a regulator or Data Protection Authority, but unlikely to attract enforcement action. Minor legal exposure (e.g. threats of legal proceedings but not likely to have material consequences); exposure 0.1%–0.5% of Own Funds.
- Tier 3 – Some concern leading to intervention and action: Regulator notified; censure unlikely. Incidents or accidents involving employees or visitors, likely to cause actual or potential short-term sickness or absence from work for medical treatment. Singular breach of confidentiality and/or data protection obligations reportable to a regulator or Data Protection Authority, and likely to attract enforcement action. Significant legal exposure (e.g. a considerable number of claims received); exposure 0.5%–1% of Own Funds.
- Tier 4 – Considerable concern, intervention and actions required: Regulator proactively involved in the issue; remediation directed by regulator; censure likely. Incidents or accidents involving employees or visitors resulting in actual or potential hospitalisation, or likely to cause short-term sickness or absence from work. Multiple or systemic breach of confidentiality and/or data protection obligations reportable to a regulator or Data Protection Authority, and likely to attract enforcement action. Major legal exposure likely to require specialist advice, could set future precedent leading to claims; exposure 1%–<2% of Own Funds.
- Tier 5 – Extensive concern and scrutiny and sustained intervention and actions: Enforcement action probable; scrutiny likely to be intense; censure could include prohibition of directors/officers and/or suspension/withdrawal of licence. Incidents or accidents involving employees or visitors, resulting in actual or potential loss of life or permanent/long-term disability. Collapse of confidentiality measures and controls resulting in regulatory censure, data protection fines and/or third-party litigation for damages. Extensive sustained significant legal exposure (e.g. class action); exposure > 2% of Own Funds.

### Internal Operational
- Tier 1 – Trivial or no effect on business operations: Little or no impact on employees. Limited impact on processes, unlikely to be visible to customers or external stakeholders. System degradation that does not impact operations (e.g. out of core hours).
- Tier 2 – Some local disturbance to normal business operations: May impact a small number of employees, with potential for dissatisfaction/low morale or reduced productivity. Peak processing interrupted for up to 6 hours (trading, year-end etc.); may require additional effort to meet deadlines/complete processing so as not to be visible to customers. System outages or slow performance that interrupts key processing (e.g. trading, financial reporting) and will require some additional effort to maintain service levels.
- Tier 3 – Able to operate with limited restrictions: May impact entire team/departments, potential for restructure and/or employee dissatisfaction and reduced productivity for that area. Major interruption of critical processes up to 12 hours. Likely to require additional effort to reduce backlog and meet deadlines or complete processing backlogs. Systems outages or slow performance that interrupts critical processes or services. Likely to require additional effort to reduce backlog and maintain or restore service levels.
- Tier 4 – Key elements of the operation are not able to operate effectively: May impact multiple teams/departments, potential for restructure and/or employee dissatisfaction and reduced productivity for those areas. Critical processes interrupted for up to 24 hours. Processing deadlines likely to be missed. Will require additional effort and time to complete processing backlogs and rectify issue. Likely to be visible to customers and other stakeholders. Systems outages or slow performance extending up to 24 hours. Processing deadlines likely to be missed and will require additional effort and time to reduce backlogs and service levels. Likely to be visible to customers and may be reportable to regulator.
- Tier 5 – Majority of elements of the operations are not able to operate effectively: Significant business restructure with potential for disruption to a large number of employees and potential for employee dissatisfaction that leads to reduced productivity. Critical processes interrupted for more than 24 hours. Likely to be visible to most clients and other stakeholders. Invocation of business continuity measures. May take time to restore to full processing capability. Regulatory oversight likely. Systems failure that interrupts processing for longer than 24 hours. Will be visible to customers. Invocation of business continuity measures. May take time to fully restore processing and services. Regulatory oversight likely.

### Project
- Tier 1 – Minor or small impact on the project: Disruptive but does not threaten approved project parameters; a risk of some small cost overruns, or project implementation slightly delayed.
- Tier 2 – Medium impact to the project time, cost, scope and quality and may require effort to mitigate: e.g. late and over-budget, or not all key requirements are realised and delivered.
- Tier 3 – Moderate threat to project cost, time, scope or quality and may require significant effort to mitigate: e.g. increase budget, or postpone implementation, or not all key requirements delivered.
- Tier 4 – Considerable impact to the project which will stop/prevent the project from meeting the majority of its objectives: Changes likely to approval project parameters or viability of project may be called into question.
- Tier 5 – Significant impact to project which will prevent the project meeting its objectives with potential for damage to reputation or requiring waiver from regulatory body: The project may be halted or a major replan required.

## 4. Glossary
- Controls – Specific rules, steps and safeguards that ensure a process is performed correctly, efficiently and securely.
- Inherent Risk – Risk amount before considering current mitigation activities.
- Residual Risk – Risk amount remaining after considering current mitigation activities.
- Operational Risk – Risk of loss resulting from inadequate or failed processes, people, systems or external events.
- Standard – Document providing clarification and elaboration on policy requirements.
- Utmost Luxembourg (the Company) – Insurance carrier specialising in cross-border wealth solutions, part of Utmost Group.
- Own Funds (OF) – Regulatory capital measure used as the basis for legal exposure thresholds.

## 5. Output Format
Produce exactly two tables, each with the columns Category | Rating | Justification. Likelihood and Impact are rows in the same table as the five risk categories — do not split them into a separate section.

=== INHERENT RISK TAB ===

| Category | Rating | Justification |
|---|---|---|
| Likelihood | {InherentLikelihoodRating} | [justification aligned to {InherentLikelihoodRating}, grounded in {RiskDescription}] |
| Impact | {InherentImpactRating} | [justification aligned to {InherentImpactRating}, grounded in {RiskDescription}] |
| Customer | Tier X | ... |
| Brand and Reputation | Tier Y | ... |
| Regulatory & Legal Impact | Tier Z | ... |
| Internal Operational | Tier W | ... |
| Project | Tier V | ... |

Check: highest category tier above matches the higher of {InherentLikelihoodRating} / {InherentImpactRating}; at least one category row equals {InherentLikelihoodRating} and at least one equals {InherentImpactRating}.

=== RESIDUAL RISK TAB ===

Control Gaps: [bullet list of missing or incomplete controls relative to the risk]
Unrelated Controls: [bullet list of any controls in {ExistingControls} not relevant to {RiskDescription}, or "None identified"]

| Category | Rating | Justification |
|---|---|---|
| Likelihood | {ResidualLikelihoodRating} | [justification aligned to {ResidualLikelihoodRating}, grounded in {RiskDescription} and {ExistingControls}] |
| Impact | {ResidualImpactRating} | [justification aligned to {ResidualImpactRating}, grounded in {RiskDescription} and {ExistingControls}] |
| Customer | Tier X | ... |
| Brand and Reputation | Tier Y | ... |
| Regulatory & Legal Impact | Tier Z | ... |
| Internal Operational | Tier W | ... |
| Project | Tier V | ... |

Check: highest category tier above matches the higher of {ResidualLikelihoodRating} / {ResidualImpactRating}; at least one category row equals {ResidualLikelihoodRating} and at least one equals {ResidualImpactRating}.

=== CONSISTENCY FLAGS ===

| Category | Inherent Rating | Residual Rating | Flag |
|---|---|---|---|
| Customer | Tier X | Tier X | [OK / FLAG – Residual higher than Inherent] |
| Brand and Reputation | Tier Y | Tier Y | [OK / FLAG – Residual higher than Inherent] |
| Regulatory & Legal Impact | Tier Z | Tier Z | [OK / FLAG – Residual higher than Inherent] |
| Internal Operational | Tier W | Tier W | [OK / FLAG – Residual higher than Inherent] |
| Project | Tier V | Tier V | [OK / FLAG – Residual higher than Inherent] |

This table is for review only — do not adjust any Inherent or Residual rating to avoid a flag. Simply report, for each category, whether its Residual tier is higher than its Inherent tier ("FLAG") or not ("OK"). Any row marked FLAG will be corrected manually.
