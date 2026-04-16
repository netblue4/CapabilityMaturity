# ICT Capability Maturity Tracker

A lightweight web app for tracking the maturity of your ICT capabilities over time — hosted free on GitHub Pages.

**Live app:** https://netblue4.github.io/CapabilityMaturity/

---

## Capabilities Tracked

| Capability | Description |
|---|---|
| ICT Vulnerability Management | Identification, assessment, and remediation of security vulnerabilities |
| ICT Performance & Capacity Management | Monitoring and planning of ICT resource performance and capacity |
| Incident Management | Restoration of normal service following unplanned disruptions |
| Change Management | Controlled management of changes to ICT services and infrastructure |
| Disaster Recovery | Plans and capabilities to recover ICT services following a major disruption |

## Maturity Levels (ITIL 4 / CMMI inspired)

| Level | Name | Description |
|---|---|---|
| 1 | Initial | Ad-hoc and reactive. No formal processes. |
| 2 | Managed | Basic processes exist but inconsistently applied. |
| 3 | Defined | Standardised, documented processes applied org-wide. |
| 4 | Quantitative | Data-driven. KPIs tracked. Metrics guide decisions. |
| 5 | Optimising | Continuous improvement. Predictive analytics. Proactive. |

---

## Features

- ✅ Score each capability on a 1–5 maturity scale
- ✅ Set target levels per capability
- ✅ Add notes per capability and per assessment
- ✅ Radar / spider chart visualisation
- ✅ Assessment history with trend tracking
- ✅ Export data as JSON (your database)
- ✅ Import previously saved JSON files
- ✅ Works entirely in the browser — no server needed

---

## Database

This app uses a **JSON file as its database**. Your data is:
- Stored in your browser's `localStorage` automatically as you work
- Exported as a `.json` file when you click **↓ Export**
- Re-imported using the **↑ Import** button

> **Tip:** Export your JSON regularly and save it somewhere safe (e.g. your repo, OneDrive, or email it to yourself).

The `sample-data.json` file in this repo shows the expected format.

---

## Getting Started on GitHub Pages

1. **Fork or push this repo** to your GitHub account at `github.com/netblue4/CapabilityMaturity`

2. **Enable GitHub Pages:**
   - Go to your repo → **Settings** → **Pages**
   - Under *Source*, select `main` branch and `/ (root)` folder
   - Click **Save**
   - Your app will be live at: `https://netblue4.github.io/CapabilityMaturity/`

3. **Open the app** and click **+ New Assessment** to score your first assessment.

4. Optionally, **↑ Import** the `sample-data.json` to see example data.

---

## Customising Capabilities

Edit `config.js` to:
- Add or remove capabilities from the `capabilities` array
- Change the maturity level descriptions
- Update the app title

No other files need to change.

---

## File Structure

```
CapabilityMaturity/
├── index.html        — Main app page
├── style.css         — All styling (dark industrial theme)
├── app.js            — All application logic
├── config.js         — Capability definitions & level descriptions
├── sample-data.json  — Example JSON database
└── README.md         — This file
```

---

## Tech Stack

- Plain HTML, CSS, and JavaScript — no frameworks, no build tools
- Hosted on GitHub Pages (free)
- No backend, no API keys required
