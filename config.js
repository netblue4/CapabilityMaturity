// ============================================================
// config.js — ICT Capability Maturity Tracker Configuration
// Edit this file to add, remove, or rename capabilities.
// ============================================================

const CONFIG = {

  // App title shown in the header
  appTitle: "ICT Capability Maturity Tracker",

  // ── Maturity Level Definitions (1–5) ──────────────────────
  // These follow the ITIL 4 / CMMI inspired 5-level scale.
  levels: [
    {
      level: 1,
      name: "Initial",
      color: "#e74c3c",
      description: "Ad-hoc and reactive. No formal processes. Issues addressed as they arise."
    },
    {
      level: 2,
      name: "Managed",
      color: "#e67e22",
      description: "Basic processes exist but are inconsistently applied. Dependent on individuals."
    },
    {
      level: 3,
      name: "Defined",
      color: "#f1c40f",
      description: "Standardised, documented processes applied organisation-wide."
    },
    {
      level: 4,
      name: "Quantitative",
      color: "#2ecc71",
      description: "Data-driven. KPIs tracked. Management uses metrics to drive decisions."
    },
    {
      level: 5,
      name: "Optimising",
      color: "#3498db",
      description: "Continuous improvement culture. Predictive analytics. Proactive excellence."
    }
  ],

  // ── ICT Capabilities to Track ─────────────────────────────
  // Add or remove capabilities here.
  // Each has an id, name, description, and optional guiding questions.
  capabilities: [
    {
      id: "vulnerability_mgmt",
      name: "ICT Vulnerability Management",
      description: "Identification, assessment, and remediation of security vulnerabilities across ICT infrastructure.",
      questions: [
        "Are vulnerabilities identified and tracked systematically?",
        "Is there a defined remediation SLA based on risk?",
        "Are vulnerability scans automated and scheduled?",
        "Is reporting and trending available to management?"
      ]
    },
    {
      id: "performance_capacity",
      name: "ICT Performance & Capacity Management",
      description: "Monitoring and planning of ICT resource performance and capacity to meet current and future demands.",
      questions: [
        "Are performance baselines defined for key systems?",
        "Is capacity planning performed proactively?",
        "Are thresholds and alerts configured?",
        "Are capacity reports produced for management?"
      ]
    },
    {
      id: "incident_mgmt",
      name: "Incident Management",
      description: "Restoration of normal service operation as quickly as possible following unplanned disruptions.",
      questions: [
        "Is there a formal incident logging and classification process?",
        "Are incidents prioritised by impact and urgency?",
        "Are SLAs defined and measured for resolution times?",
        "Is there a post-incident review process?"
      ]
    },
    {
      id: "change_mgmt",
      name: "Change Management",
      description: "Controlled management of changes to ICT services and infrastructure to minimise risk.",
      questions: [
        "Is there a formal change request and approval process?",
        "Is a Change Advisory Board (CAB) in operation?",
        "Are change success rates tracked?",
        "Is there a rollback plan for all significant changes?"
      ]
    },
    {
      id: "disaster_recovery",
      name: "Disaster Recovery",
      description: "Plans, procedures and capabilities to recover ICT services following a major disruption or disaster.",
      questions: [
        "Is a Disaster Recovery Plan (DRP) documented and approved?",
        "Are RTOs and RPOs defined for critical systems?",
        "Is the DRP tested regularly?",
        "Are DR test results reviewed and improvements actioned?"
      ]
    }
  ]
};
