// ── Radar Cap Filter ─────────────────────────────────────────
function buildRadarFilter() {
  const container = document.getElementById("radar-cap-checkboxes");
  if (!container) return;
  container.innerHTML = CONFIG.capabilities.map(cap => `
    <label class="cap-filter-label">
      <input type="checkbox" class="radar-cap-check" value="${cap.id}" checked
        onchange="updateRadarFilter()" />
      ${cap.name}
    </label>
  `).join("");
  updateCapFilterCount();
}

function updateCapFilterCount() {
  const total = CONFIG.capabilities.length;
  const checked = document.querySelectorAll(".radar-cap-check:checked").length;
  const el = document.getElementById("cap-filter-count");
  if (el) el.textContent = checked < total ? `${checked} / ${total}` : total;
}

function getSelectedRadarCaps() {
  const checked = new Set(
    [...document.querySelectorAll(".radar-cap-check:checked")].map(el => el.value)
  );
  const selected = CONFIG.capabilities.filter(cap => checked.has(cap.id));
  return selected.length > 0 ? selected : CONFIG.capabilities;
}

function buildAssessmentFilter() {
  const container = document.getElementById("radar-assessment-checkboxes");
  if (!container) return;
  const prev = new Set(
    [...document.querySelectorAll(".radar-assessment-check:checked")].map(el => el.value)
  );
  const hasPrev = document.querySelectorAll(".radar-assessment-check").length > 0;
  container.innerHTML = db.assessments.map(a => {
    const checked = !hasPrev || prev.has(a.id);
    const d = new Date(a.date + "T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    return `
      <label class="cap-filter-label">
        <input type="checkbox" class="radar-assessment-check" value="${a.id}" ${checked ? "checked" : ""}
          onchange="updateRadarFilter()" />
        ${a.label} <span class="assessment-filter-date">${d}</span>
      </label>`;
  }).join("");
  updateAssessmentFilterCount();
}

function updateAssessmentFilterCount() {
  const total = db.assessments.length;
  const checked = document.querySelectorAll(".radar-assessment-check:checked").length;
  const el = document.getElementById("assessment-filter-count");
  if (el) el.textContent = checked < total ? `${checked} / ${total}` : total;
}

function getSelectedAssessments() {
  const checked = new Set(
    [...document.querySelectorAll(".radar-assessment-check:checked")].map(el => el.value)
  );
  const selected = db.assessments.filter(a => checked.has(a.id));
  return selected.length > 0 ? selected : [db.assessments[db.assessments.length - 1]];
}

function updateRadarFilter() {
  updateCapFilterCount();
  updateAssessmentFilterCount();
  if (db.assessments.length === 0) return;
  renderRadar("radar-chart", null, getSelectedRadarCaps(), getSelectedAssessments());
}

// ── Radar Chart ───────────────────────────────────────────────
function renderRadar(canvasId, assessment, capsOverride, assessmentsOverride) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const maxR = Math.min(cx, cy) - 52;
  const caps = capsOverride || CONFIG.capabilities;
  const N = caps.length;
  const angleStep = (2 * Math.PI) / N;
  const startAngle = -Math.PI / 2;

  const assessmentList = assessmentsOverride || (assessment ? [assessment] : []);
  const multiMode = assessmentList.length > 1;

  ctx.clearRect(0, 0, W, H);

  // Grid rings
  for (let lvl = 1; lvl <= 5; lvl++) {
    const r = (lvl / 5) * maxR;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = startAngle + i * angleStep;
      i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
              : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "9px Space Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText(lvl, cx + r * Math.cos(startAngle) + 3, cy + r * Math.sin(startAngle) - 3);
  }

  // Spokes
  for (let i = 0; i < N; i++) {
    const a = startAngle + i * angleStep;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + maxR * Math.cos(a), cy + maxR * Math.sin(a));
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (multiMode) {
    const COLORS = ["#94a3b8", "#a78bfa", "#34d399", "#fb923c", "#f472b6", "#60a5fa", "#fbbf24", "#f87171", "#4ade80", "#38bdf8"];
    assessmentList.forEach((a, i) => {
      const isLatest = i === assessmentList.length - 1;
      const color = COLORS[i % COLORS.length];
      const avgScores = caps.map(c => capAvgScore(a, c.id));
      ctx.beginPath();
      for (let j = 0; j < N; j++) {
        const ang = startAngle + j * angleStep;
        const r = (avgScores[j] / 5) * maxR;
        j === 0 ? ctx.moveTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang))
                : ctx.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
      }
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, isLatest ? 0.15 : 0.07);
      ctx.fill();
      ctx.strokeStyle = isLatest ? color : hexToRgba(color, 0.65);
      ctx.lineWidth = isLatest ? 2.5 : 1.5;
      ctx.stroke();
      for (let j = 0; j < N; j++) {
        const ang = startAngle + j * angleStep;
        const r = (avgScores[j] / 5) * maxR;
        ctx.beginPath();
        ctx.arc(cx + r * Math.cos(ang), cy + r * Math.sin(ang), isLatest ? 5 : 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      }
    });
    const legendX = 8, legendY = H - assessmentList.length * 16 - 8;
    assessmentList.forEach((a, i) => {
      const color = COLORS[i % COLORS.length];
      const isLatest = i === assessmentList.length - 1;
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY + i * 16, 10, 10);
      ctx.fillStyle = isLatest ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.5)";
      ctx.font = `${isLatest ? "bold " : ""}9px DM Sans, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const label = a.label.length > 22 ? a.label.slice(0, 21) + "…" : a.label;
      ctx.fillText(label, legendX + 14, legendY + i * 16);
    });

  } else {
    const a = assessmentList[0];
    if (!a) return;

    CONFIG.measures.forEach(m => {
      const scores = caps.map(c => getMeasureScore(a, c.id, m.id) || 0);
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const ang = startAngle + i * angleStep;
        const r = (scores[i] / 5) * maxR;
        i === 0 ? ctx.moveTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang))
                : ctx.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
      }
      ctx.closePath();
      ctx.fillStyle = hexToRgba(m.color, 0.1);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(m.color, 0.6);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    const avgScores = caps.map(c => capAvgScore(a, c.id));
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const ang = startAngle + i * angleStep;
      const r = (avgScores[i] / 5) * maxR;
      i === 0 ? ctx.moveTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang))
              : ctx.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(52,152,219,0.15)";
    ctx.fill();
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    for (let i = 0; i < N; i++) {
      const ang = startAngle + i * angleStep;
      const r = (avgScores[i] / 5) * maxR;
      const lv = levelForScore(avgScores[i]);
      ctx.beginPath();
      ctx.arc(cx + r * Math.cos(ang), cy + r * Math.sin(ang), 5, 0, 2 * Math.PI);
      ctx.fillStyle = lv ? lv.color : "#888";
      ctx.fill();
    }

    const legendX = 8, legendY = H - CONFIG.measures.length * 16 - 8;
    CONFIG.measures.forEach((m, i) => {
      ctx.fillStyle = m.color;
      ctx.fillRect(legendX, legendY + i * 16, 10, 10);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "9px DM Sans, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(m.name, legendX + 14, legendY + i * 16);
    });
  }

  // Labels
  for (let i = 0; i < N; i++) {
    const a = startAngle + i * angleStep;
    const labelR = maxR + 28;
    const x = cx + labelR * Math.cos(a);
    const y = cy + labelR * Math.sin(a);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "bold 10px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = shortName(caps[i].name).split(" ");
    words.forEach((w, wi) => {
      ctx.fillText(w, x, y + (wi - (words.length - 1) / 2) * 13);
    });
  }
}

// ── Radar Animation ───────────────────────────────────────────
function toggleRadarAnimation() {
  if (animationFrameId) {
    stopRadarAnimation();
  } else {
    startRadarAnimation();
  }
}

function startRadarAnimation() {
  if (db.assessments.length < 2) return;
  const btn = document.getElementById("btn-animate-radar");
  if (btn) { btn.textContent = "⏹ Stop"; btn.classList.add("active"); }

  const caps = getSelectedRadarCaps();
  const assessments = db.assessments;
  const HOLD_MS = 1500;
  const TRANS_MS = 700;
  const CYCLE_MS = HOLD_MS + TRANS_MS;
  let startTime = null;

  function frame(ts) {
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    const total = assessments.length * CYCLE_MS;
    const t = elapsed % total;
    const idx = Math.floor(t / CYCLE_MS);
    const cycleT = t % CYCLE_MS;
    const curr = assessments[idx];
    const next = assessments[(idx + 1) % assessments.length];

    if (cycleT < HOLD_MS) {
      renderRadar("radar-chart", null, caps, [curr]);
      drawAnimLabel(curr.label, formatDate(curr.date), 1);
    } else {
      const p = easeInOut((cycleT - HOLD_MS) / TRANS_MS);
      renderRadar("radar-chart", null, caps, [interpolateAssessment(curr, next, p)]);
      if (p < 0.5) {
        drawAnimLabel(curr.label, formatDate(curr.date), 1 - p * 2);
      } else {
        drawAnimLabel(next.label, formatDate(next.date), (p - 0.5) * 2);
      }
    }
    animationFrameId = requestAnimationFrame(frame);
  }
  animationFrameId = requestAnimationFrame(frame);
}

function stopRadarAnimation() {
  if (!animationFrameId) return;
  cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  const btn = document.getElementById("btn-animate-radar");
  if (btn) { btn.textContent = "▶ All"; btn.classList.remove("active"); }
  const lbl = document.getElementById("radar-anim-label");
  if (lbl) { lbl.style.display = "none"; lbl.innerHTML = ""; }
}

function interpolateAssessment(fromA, toA, t) {
  const measureScores = {};
  CONFIG.capabilities.forEach(cap => {
    measureScores[cap.id] = {};
    CONFIG.measures.forEach(m => {
      const f = getMeasureScore(fromA, cap.id, m.id) || 0;
      const s = getMeasureScore(toA, cap.id, m.id) || 0;
      measureScores[cap.id][m.id] = f + (s - f) * t;
    });
  });
  return { id: "_anim", measureScores };
}

function drawAnimLabel(label, date, opacity) {
  const el = document.getElementById("radar-anim-label");
  if (!el) return;
  if (opacity <= 0) {
    el.style.opacity = 0;
    return;
  }
  el.style.display = "flex";
  el.style.opacity = opacity;
  el.innerHTML = `<span class="radar-anim-title">${label}</span><span class="radar-anim-date">${date}</span>`;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
