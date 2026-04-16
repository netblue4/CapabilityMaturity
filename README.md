# ICT Capability Maturity Tracker

A lightweight web app for tracking the maturity of your ICT capabilities across three measures — hosted free on GitHub Pages.

**Live app:** https://netblue4.github.io/CapabilityMaturity/

---

## Capabilities Tracked

| Capability | Description |
|---|---|
| ICT Vulnerability Management | Identification, assessment and remediation of security vulnerabilities |
| ICT Performance & Capacity Management | Monitoring and planning of ICT resource performance and capacity |
| Incident Management | Restoration of normal service following unplanned disruptions |
| Change Management | Controlled management of changes to ICT services and infrastructure |
| Disaster Recovery | Plans and capabilities to recover ICT services following a major disruption |

---

## Three Measures Per Capability

Each capability is scored across **three measures**:

| Measure | Icon | What it tracks |
|---|---|---|
| **Governance** | ⚖️ | Policy statements associated with the capability and whether they have owners assigned |
| **ICT Risk** | 🛡️ | The residual risk score of the risks associated with the capability |
| **Reporting** | 📊 | Whether KPIs are defined for the capability and whether they are reported |

---

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

- ✅ Score each capability across **Governance, ICT Risk and Reporting** measures
- ✅ Set target levels per capability per measure
- ✅ Add notes per measure and per capability
- ✅ Radar chart showing measure polygons + overall average
- ✅ Measure summary cards with per-capability mini bar charts
- ✅ Assessment history table with full drill-down
- ✅ Export data as JSON (your portable database)
- ✅ Import previously saved JSON files
- ✅ Works entirely in the browser — no server, no login

---

## Configuration — config.json

All configuration lives in **`config.json`**. This is a plain JSON file — edit it in any text editor (Notepad, VS Code, etc.).

### Adding a new capability

Open `config.json` and add an entry to the `"capabilities"` array:

```json
{
  "id": "service_desk",
  "name": "Service Desk",
  "description": "Front-line support and user request fulfilment."
}
```

- `id` must be unique and contain no spaces (use underscores)
- `name` is displayed in the app
- `description` is shown on the assessment form

### Adding or editing a measure

Edit the `"measures"` array. Each measure has per-level labels that appear when scoring:

```json
{
  "id": "compliance",
  "name": "Compliance",
  "icon": "📋",
  "color": "#e67e22",
  "description": "Tracks compliance with relevant standards and regulations.",
  "levels": [
    { "level": 1, "label": "No compliance activity" },
    { "level": 2, "label": "Awareness only" },
    { "level": 3, "label": "Partially compliant" },
    { "level": 4, "label": "Fully compliant, evidence maintained" },
    { "level": 5, "label": "Continuous compliance monitoring" }
  ]
}
```

> ⚠️ If you change a measure `id` or capability `id`, existing assessment data using the old id will no longer match. Rename ids before recording assessments, or update your JSON database manually.

---

## Database

This app uses a **JSON file as its database**. Your data is:
- Stored in your **browser's localStorage** automatically as you work
- Exported as a `.json` file when you click **↓ Export**
- Re-imported using the **↑ Import** button (merges with existing data)

> **Tip:** Export regularly and save your JSON file to a safe location (OneDrive, your repo, email).

The `sample-data.json` file shows the expected format for assessments.

---

## Getting Started on GitHub Pages

1. **Push all files** to `github.com/netblue4/CapabilityMaturity`

2. **Enable GitHub Pages:**
   - Repo → **Settings** → **Pages**
   - Source: `main` branch, `/ (root)`
   - Click **Save**
   - Live at: `https://netblue4.github.io/CapabilityMaturity/`

3. **Open the app** and click **+ New Assessment**

4. Optionally **↑ Import** `sample-data.json` to see example data

---

## Important: Running Locally

Because `config.json` is loaded via `fetch()`, the app must be served over HTTP — it will not work if you open `index.html` directly as a `file://` URL.

**Easy options:**
- **VS Code:** Install the *Live Server* extension → right-click `index.html` → *Open with Live Server*
- **Python:** Run `python -m http.server 8080` in the project folder, then open `http://localhost:8080`
- **GitHub Pages:** Always works once deployed

---

## File Structure

```
CapabilityMaturity/
├── index.html          — Main app page
├── style.css           — Styling (dark industrial theme)
├── app.js              — All application logic
├── config.json         — Edit this to customise capabilities & measures
├── sample-data.json    — Example assessment data
└── README.md           — This file
```

---

## Tech Stack

- Plain HTML, CSS, and JavaScript — no frameworks, no build tools
- Hosted on GitHub Pages (free)
- No backend, no API keys, no dependencies
