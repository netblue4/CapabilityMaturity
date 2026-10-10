# MiCA primer — and how it fits the SOA / objective model

*Written to answer one question: can we build a MiCA **Statement of Applicability** and
**objective** structure the same way we build DORA's, and feed it through the same
policies → controls → risks spine? Short answer: **yes**, and in some ways MiCA fits the
model more naturally than DORA. This doc explains MiCA from zero, then maps it onto the
exact CSV schema you already use.*

---

## 1. What MiCA actually is (from zero)

**MiCA = the Markets in Crypto-Assets Regulation, Regulation (EU) 2023/1114.** It is the
EU's single rulebook for crypto. Before MiCA, crypto firms were regulated country by
country (or not at all); MiCA replaces that with one harmonised regime with a passport,
supervised by national competent authorities (the **CSSF** in Luxembourg, per your table)
with ESMA and the EBA setting the detailed technical rules.

It became **fully applicable on 30 December 2024** (the stablecoin titles came a bit
earlier, 30 June 2024).

### How MiCA differs in *nature* from DORA — this matters for the data model

| | **DORA** | **MiCA** |
|---|---|---|
| **Scope** | One subject: **ICT / operational resilience** | A **whole licensing regime**: prudential capital, governance, conduct, client-asset protection, disclosure, market integrity |
| **Applies to** | Almost all financial entities (incl. CASPs) | Crypto issuers and **crypto-asset service providers (CASPs)** |
| **Shape** | Homogeneous — nearly every obligation maps to an ICT control | Heterogeneous — obligations span capital, governance, conduct, custody, AML-adjacent, ICT |
| **"Applicability"** | Mostly *all applies* (you were marking RTS in/out) | **Strongly modular** — large chunks are N/A depending on *which licence/services* you hold. SOA earns its keep here. |
| **ICT rules** | This *is* the ICT rulebook | **Defers ICT resilience to DORA** (see §6) |

The headline consequence: **your single lowest-level control framework does not change.**
MiCA just adds a *second regulatory lens* that maps—through the same policy statements—onto
those same controls, exactly as you planned. What broadens is the *type* of control a MiCA
objective lands on (not only ICT controls — also governance, finance, client-asset,
conduct controls).

---

## 2. MiCA's structure (the Titles)

MiCA is organised into **Titles** (the top-level unit, like DORA's Chapters). This is your
**top SOA level** — the equivalent of `DORA_Chapter` / `DORA_Article`.

| Title | Subject | Relevant to Robinhood? |
|---|---|---|
| **I** | Subject matter, scope, definitions (incl. the Annex I service list) | Reference only |
| **II** | **Other crypto-assets** (utility tokens): public offer + admission to trading, white-paper rules | Only if Robinhood *issues/offers* tokens — likely **N/A** |
| **III** | **Asset-referenced tokens (ARTs)** — issuer authorisation, reserves, own funds | Only if it *issues* ARTs — likely **N/A** |
| **IV** | **E-money tokens (EMTs)** — stablecoin issuers | Only if it *issues* EMTs — likely **N/A** |
| **V** | **Crypto-asset service providers (CASPs)** — authorisation + operating conditions | **★ This is Robinhood's Title.** |
| **VI** | **Market abuse** involving crypto-assets (insider dealing, manipulation) | **Applies** to anyone operating a platform / executing orders |
| **VII** | Competent authorities, ESMA, EBA, supervision & penalties | Reference / reporting obligations |
| **VIII–IX** | Delegated acts, transitional & final provisions | Reference |

**The punchline for a broker like Robinhood:** Titles II, III and IV are almost entirely
**Not Applicable** (it provides *services*, it doesn't *issue* tokens). That is exactly the
kind of scoping an SOA is built to record — "this whole Title is N/A, justification:
entity does not issue asset-referenced or e-money tokens." Your SOA's `Article Applicable
= N` flag already does this; MiCA just makes that column do a lot more work.

---

## 3. The part that matters: Title V — CASP operating conditions

This is where MiCA becomes a list of concrete, control-mappable obligations — the direct
analogue of your DORA articles/RTS. Title V splits into **authorisation** (getting the
licence) and **operating conditions** (how you must run once licensed). The operating
conditions are the obligation-rich seam.

**Which services you're authorised for drives applicability.** MiCA's **Annex I** lists
**10 crypto-asset services**; a CASP is licensed for a named subset, and the
*service-specific* obligations (Art. 75–82) only apply to the services on your licence:

1. Custody & administration of crypto-assets on behalf of clients
2. Operation of a trading platform
3. Exchange of crypto-assets for funds
4. Exchange of crypto-assets for other crypto-assets
5. Execution of orders on behalf of clients
6. Placing of crypto-assets
7. Reception & transmission of orders (RTO)
8. Advice on crypto-assets
9. Portfolio management of crypto-assets
10. Transfer services for crypto-assets

*A retail crypto broker like Robinhood is typically authorised for something like:
execution, RTO, custody & administration, exchange for funds, and possibly operation of a
trading platform — so those service-specific articles switch **on**, and advice /
portfolio management / placing may be **off**. You decide this per entity in the SOA.*

### Title V obligations (your objective seam)

These are the **general operating conditions** that apply to *every* CASP regardless of
service (approximate article numbers — verify each against the Official Journal when you
capture its EUR-Lex URL in the SOA, exactly like you did for DORA):

| ~Art. | Obligation | Nature of control it maps to |
|---|---|---|
| 59 | Authorisation required to provide services | Governance / licensing |
| 66 | Act honestly, fairly, professionally in clients' best interest; fair, clear, not-misleading communications | Conduct |
| 67 | **Prudential own-funds** requirement (Annex IV minimum capital / fixed-overheads) | Finance / capital |
| 68 | **Governance arrangements** — fit-and-proper management body, org structure, **sound security/ICT systems**, BCP | Governance (+ ICT → see §6) |
| 69 | Information to the competent authority (incl. changes) | Regulatory reporting |
| 70 | **Safekeeping of clients' crypto-assets and funds** — segregation, insolvency protection | Client-asset protection |
| 71 | **Complaints-handling** procedure | Conduct / operations |
| 72 | **Conflicts of interest** — identify, prevent, manage, disclose | Governance / conduct |
| 73 | **Outsourcing** — must not impair operational resilience; due diligence & oversight | Third-party / outsourcing |
| 74 | **Orderly wind-down** plan | Recovery / continuity |

And the **service-specific** obligations (apply only to services on the licence):

| ~Art. | Service | Examples of obligations |
|---|---|---|
| 75 | Custody & administration | Segregation, register of positions, liability for loss, clients can withdraw same asset type |
| 76 | Operation of a trading platform | Operating rules, admission-to-trading criteria, no anonymised coins, market-surveillance |
| 77 | Exchange for funds / crypto | Non-discriminatory commercial policy, firm price quotes |
| 78 | Execution of orders | Best execution for clients |
| 79 | Placing | Conflicts, disclosure to offeror |
| 80 | Reception & transmission of orders | No misuse of client-order information |
| 81 | Advice & portfolio management | Suitability assessment, competence |
| 82 | Transfer services | Procedures & security for transfers |

**Title VI (market abuse)** adds a smaller set: insider-dealing controls, prohibition of
market manipulation, and an obligation to detect & report suspicious orders/transactions
— these map to surveillance / monitoring controls.

---

## 4. The "RTS equivalent" — MiCA Level 2 & Level 3

DORA gave you a two-level SOA (the **Article** + the **RTS** that refines it — your
`DORA_Article_Index` + `RTS_Article_Index` columns). **MiCA has exactly the same two-level
shape:**

- **Level 1** — the MiCA articles above (the Regulation itself).
- **Level 2** — **RTS / ITS** adopted by the Commission on the back of ESMA/EBA drafts
  (e.g. RTS on conflicts of interest, on business-continuity/governance content, on
  complaints handling, ITS on authorisation application forms). These are your
  objective-level granularity, the direct analogue of your `RTS 2`, `RTS 4`… rows.
- **Level 3** — ESMA/EBA **Guidelines** (e.g. suitability, MiCA/MiFID boundary). Optional
  to capture; good for objective wording.

So the SOA stays two-level and the objectives hang off the Level-2 item, identically to
DORA.

---

## 5. Can we build the SOA + objectives the same way? Yes — here's the column-for-column map

Your DORA data is three files. MiCA reuses all three schemas unchanged; you just produce a
MiCA-flavoured copy of each.

### 5a. The SOA — `mica-soa.csv` (same schema as `demo-soa.csv`)

Your DORA SOA columns map straight across — only the *vocabulary* changes:

| Your DORA SOA column | MiCA equivalent |
|---|---|
| `DORA_Chapter` | **MiCA Title** (e.g. "Title V — Crypto-asset service providers") |
| `DORA_Section` | MiCA Chapter/Section within the Title |
| `DORA_Article_Index` / `DORA_Title` | **MiCA article** + its heading (e.g. "Article 70 — Safekeeping of clients' crypto-assets and funds") |
| `DORA_URL` | EUR-Lex deep-link to that article (`…CELEX:32023R1114#art_70`) |
| `Article Applicable` (Y/N) | **Same** — but now does the heavy scoping (whole Titles II–IV = N) |
| `RTS_*` columns | **MiCA RTS/ITS** that refine the article |
| `RTS Applicable` | Same |

Illustrative rows (what you'd upload):

```
DisplayOrder,MiCA_Title,MiCA_Section,MiCA_URL,MiCA_Article_Index,MiCA_Title_Heading,Article Applicable,RTS_Title,...,RTS Applicable
10.00,Title V - Crypto-asset service providers,Ch.2 Obligations,…#art_66,article 66,Acting honestly fairly and professionally,Y,…,
11.00,Title V - Crypto-asset service providers,Ch.2 Obligations,…#art_67,article 67,Prudential requirements (own funds),Y,…,
12.00,Title V - Crypto-asset service providers,Ch.2 Obligations,…#art_68,article 68,Governance arrangements,Y,RTS on business continuity & governance,…,Y
13.00,Title V - Crypto-asset service providers,Ch.2 Obligations,…#art_70,article 70,Safekeeping of clients' crypto-assets and funds,Y,RTS on safekeeping,…,Y
40.00,Title III - Asset-referenced tokens,,…#art_16,article 16,Authorisation to issue ARTs,N,,,     <- whole Title N/A: entity issues no ARTs
```

### 5b. The objectives + statement mapping — `mica.csv` (same schema as `demo-dora.csv`)

This is the file that carries the **objective** and maps it to a **policy statement** and
**capability**. Your DORA header is:

```
DORA Article, Paragraph Reference, Digital Resilience Objective, Statement Ref, Statement Header, Document, Capability
```

MiCA's is identical with one renamed column — your "Digital Resilience Objective" becomes a
generic **Regulatory Objective** (or "MiCA Objective"):

```
MiCA Article, Paragraph Reference, MiCA Objective, Statement Ref, Statement Header, Document, Capability
```

Illustrative rows:

```
Article 70 — Safekeeping,Art70-3,Segregate client crypto-assets from the firm's own holdings,LP-20 PS01,Client asset segregation enforced,Client Asset Protection Policy,Client Asset Safeguarding
Article 70 — Safekeeping,Art70-1,Hold client crypto so it is insolvency-remote,LP-20 PS02,Omnibus wallet structure insolvency-remote,Client Asset Protection Policy,Client Asset Safeguarding
Article 72 — Conflicts,Art72-1,Identify and manage conflicts of interest,GS-07 SR03,Conflicts register maintained & reviewed,Group Conflicts Standard,Governance & Conduct
Article 78 — Execution,Art78-1,Take all reasonable steps for best execution,LP-22 PS01,Best-execution policy applied per order,Order Execution Policy,Trading & Execution
Article 68 — Governance,Art68-7,Maintain sound ICT security & resilience,—(mapped via DORA),—,—,ICT Risk Management   <- see §6, don't double-map
```

**Nothing else changes.** `demo-policy.csv` (policy statements) and your GRC controls stay
one shared set; a statement can be referenced by a DORA objective *and* a MiCA objective —
that's the whole point of a single control framework with multiple regulatory lenses.

---

## 6. The one trap: MiCA ↔ DORA overlap (don't double-count ICT)

MiCA Art. 68 requires CASPs to have "sound" security and ICT systems and business
continuity — but MiCA **explicitly defers the detail of ICT operational resilience to
DORA** (DORA is *lex specialis* for ICT for all financial entities, CASPs included).

Practically, in your model:

- Keep **ICT-resilience objectives under the DORA lens** (where they already live).
- Under the **MiCA lens**, represent Art. 68's ICT limb as a *single pointer* ("ICT
  resilience — satisfied via the DORA control set") rather than re-deriving all the ICT
  objectives. This avoids a MiCA module that silently re-counts the same controls and
  inflates your numbers.
- The genuinely *new* MiCA control surface is the **non-ICT** material: own funds,
  client-asset segregation, conflicts, complaints, best execution, market-abuse
  surveillance, wind-down. That's where MiCA earns its own objectives.

This is also why the module switch is the right architecture: with **DORA on / MiCA off**
you see today's ICT-only picture; flip **MiCA on** and the same controls light up under a
second, broader regulatory lens without contaminating the DORA view.

---

## 7. How this lands in the "switch on a module" architecture

Your instinct is correct and the architecture genuinely doesn't need to change — only the
data is keyed by lens:

- **One** control framework, **one** set of policy statements, **one** risk register (all
  unchanged).
- Each regulatory lens (DORA / MiCA / NIST CSF) is just **its own SOA file + its own
  objective→statement mapping file**, tagged with the framework name.
- The three switches choose *which lens's SOA + objectives* drive the traceability,
  coverage and reporting views. **DORA-only = byte-for-byte today's behaviour** (so your
  current-employer use is untouched).
- Data stays manageable because the modules are **additive and isolated**: adding MiCA
  adds two MiCA files; it never edits the DORA files or the shared control layer.

*(NIST CSF is the easiest of the three — it's already a ready-made objective tree: 6
Functions → Categories → Subcategories. Each Subcategory (e.g. `PR.AC-01`) is literally an
objective; the "SOA" is just marking subcategories in/out of scope. It drops into the same
two files with almost no interpretation work.)*

---

## 8. Suggested way to get started (data first, no code yet)

1. **Confirm Robinhood's licence scope** — which Annex I services, and confirm it issues no
   ARTs/EMTs. This decides nearly all the `Article Applicable` flags in one pass.
2. **Build `mica-soa.csv`** from Title V (+ Title VI market abuse, + the Title VII
   reporting duties), marking Titles II–IV N/A with justifications. Capture EUR-Lex URLs as
   you go — that's also your verification of the exact article numbers above.
3. **Draft the MiCA objectives** (`mica.csv`) — one objective per article/paragraph (or per
   Level-2 RTS requirement), in the same "verb + outcome" style as your Digital Resilience
   Objectives.
4. **Map objectives → existing policy statements**; where no statement exists yet, mark
   "No matching policy" (your model already shows these as gaps — that *is* the value).
5. **Point ICT objectives back at DORA** (§6) rather than re-deriving them.
6. Only **then** add the three-way lens switch in the webapp, loading the MiCA files as a
   module alongside DORA.

---

### Sources

- ESMA — MiCA implementation & Q&A: https://www.esma.europa.eu/
- MFSA — *Implementation of the MiCA Regulation and its Guidelines* (Title V notification /
  Art. 60 investment-firm route): https://mfsa.mt/wp-content/uploads/2024/12/Implementation-of-the-MiCA-Regulation-and-Its-Corresponding-Guidelines.pdf
- Dechert — *Application of the Second Part of MiCA: Regulation of CASPs*: https://www.dechert.com/knowledge/onpoint/2025/1/application-of-second-part-of-mica---regulation-of-casps-and-oth.html
- Sedric — *MiCA Authorisation Checklist for CASPs* (Annex I services, operating
  conditions): https://www.sedric.ai/blog/mica-authorisation-checklist
- Primary text to verify article numbers/URLs against: **Regulation (EU) 2023/1114**,
  EUR-Lex CELEX `32023R1114`.
