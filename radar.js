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
  buildDimensionFilter();
}

// ── Radar Dimension Filter ────────────────────────────────────
function buildDimensionFilter() {
  const container = document.getElementById("radar-dimension-checkboxes");
  if (!container) return;
  container.innerHTML = CONFIG.measures.map(m => `
    <label class="cap-filter-label">
      <input type="checkbox" class="radar-dimension-check" value="${m.id}" checked
        onchange="updateRadarFilter()" />
      <span>${m.icon}</span> ${m.name}
    </label>
  `).join("");
  updateDimensionFilterCount();
}

function updateDimensionFilterCount() {
  const total = CONFIG.measures.length;
  const checked = document.querySelectorAll(".radar-dimension-check:checked").length;
  const el = document.getElementById("dimension-filter-count");
  if (el) el.textContent = checked < total ? `${checked} / ${total}` : total;
}

function getSelectedDimensions() {
  const checked = new Set(
    [...document.querySelectorAll(".radar-dimension-check:checked")].map(el => el.value)
  );
  const selected = CONFIG.measures.filter(m => checked.has(m.id));
  return selected.length > 0 ? selected : CONFIG.measures;
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
  updateDimensionFilterCount();
  if (db.assessments.length === 0) return;
  renderRadar("radar-chart", null, getSelectedRadarCaps(), getSelectedAssessments(), { dimensions: getSelectedDimensions() });
}

// ── Theme colour helper ───────────────────────────────────────
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ── Radar HTML Legend ─────────────────────────────────────────
/*function injectRadarLegend(canvasId, group1, group2) {
  const old = document.getElementById(canvasId + '-legend');
  if (old) old.remove();
  const canvas = document.getElementById(canvasId);
  if (!canvas || !canvas.parentNode) return;

  function itemHtml(color, label, size) {
    return `<span class="radar-legend-item"><span class="radar-legend-swatch" style="width:${size}px;height:${size}px;background:${color}"></span>${label}</span>`;
  }

  const div = document.createElement('div');
  div.id = canvasId + '-legend';
  div.className = 'radar-legend';
  div.innerHTML =
    group1.map(it => itemHtml(it.color, it.label, 12)).join('') +
    group2.map(it => itemHtml(it.color, it.label, 10)).join('');
  canvas.parentNode.insertBefore(div, canvas.nextSibling);
}*/

function injectRadarLegend(canvasId, group1, group2) {
  const old = document.getElementById(canvasId + '-legend');
  if (old) old.remove();
  
  const canvas = document.getElementById(canvasId);
  // Target the specific container we created in the HTML
  const container = document.getElementById('radar-container'); 
  if (!canvas || !container) return;

  function itemHtml(color, label, size) {
    return `<div class="radar-legend-item" style="display:flex; align-items:center; margin-bottom:12px; color:#94a3b8; font-family:'DM Sans', sans-serif;">
              <span class="radar-legend-swatch" style="width:${size}px; height:${size}px; background:${color}; margin-right:10px; border-radius:2px; flex-shrink:0;"></span>
              <span style="font-size: 12px; white-space: nowrap;">${label}</span>
            </div>`;
  }

  const div = document.createElement('div');
  div.id = canvasId + '-legend';
  div.style.display = 'flex';
  div.style.flexDirection = 'column';
  div.style.marginRight = '40px'; // Space between legend and radar
  div.style.paddingLeft = '20px';

  div.innerHTML =
    group1.map(it => itemHtml(it.color, it.label, 12)).join('') +
    `<div style="height: 1px; background: rgba(255,255,255,0.1); margin: 15px 0; width: 80%;"></div>` +
    group2.map(it => itemHtml(it.color, it.label, 10)).join('');

  // Insert legend at the start of the container (the left side)
  container.insertBefore(div, canvas);
}


// ── Radar Chart ───────────────────────────────────────────────
// opts.noLegend — skip HTML legend injection (used during animation)
function renderRadar(canvasId, assessment, capsOverride, assessmentsOverride, opts) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const maxR = Math.min(cx, cy) - 48;
  const caps = capsOverride || CONFIG.capabilities;
  const N = caps.length;
  const angleStep = (2 * Math.PI) / N;
  const startAngle = -Math.PI / 2;

  const assessmentList = assessmentsOverride || (assessment ? [assessment] : []);
  const multiMode = assessmentList.length > 1;
  const measures = opts?.dimensions || CONFIG.measures;

  const COLORS = ["#94a3b8", "#a78bfa", "#34d399", "#fb923c", "#f472b6", "#60a5fa", "#fbbf24", "#f87171", "#4ade80", "#38bdf8"];

  // Read theme colours once per draw
  const C = {
    ring:    cssVar('--clr-radar-ring'),
    spoke:   cssVar('--clr-radar-spoke'),
    numeral: cssVar('--clr-radar-numeral'),
    label:   cssVar('--clr-radar-label'),
    legend:  cssVar('--clr-radar-legend'),
    textHi:  cssVar('--clr-radar-text-hi'),
    textLo:  cssVar('--clr-radar-text-lo'),
    avgFill: cssVar('--clr-radar-avg-fill'),
    avgLine: cssVar('--clr-radar-avg-line'),
  };

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
    ctx.strokeStyle = C.ring;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = C.numeral;
    ctx.font = "bold 10px DM Sans, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(lvl, cx + r * Math.cos(startAngle) + 3, cy + r * Math.sin(startAngle) - 3);
  }

  // Spokes
  for (let i = 0; i < N; i++) {
    const a = startAngle + i * angleStep;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + maxR * Math.cos(a), cy + maxR * Math.sin(a));
    ctx.strokeStyle = C.spoke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  let legendGroup1 = [];

  if (multiMode) {
    assessmentList.forEach((a, i) => {
      const isLatest = i === assessmentList.length - 1;
      const color = COLORS[i % COLORS.length];
      const avgScores = caps.map(c => {
        const vals = measures.map(m => getMeasureScore(a, c.id, m.id)).filter(v => v > 0);
        return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      });
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
      legendGroup1.push({ color, label: a.label.length > 22 ? a.label.slice(0, 21) + '…' : a.label });
    });

  } else {
    const a = assessmentList[0];
    if (!a) return;

    measures.forEach(m => {
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
      legendGroup1.push({ color: m.color, label: m.name });
    });

    const avgScores = caps.map(c => {
      const vals = measures.map(m => getMeasureScore(a, c.id, m.id)).filter(v => v > 0);
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    });
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const ang = startAngle + i * angleStep;
      const r = (avgScores[i] / 5) * maxR;
      i === 0 ? ctx.moveTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang))
              : ctx.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
    }
    ctx.closePath();
    ctx.fillStyle = C.avgFill;
    ctx.fill();
    ctx.strokeStyle = C.avgLine;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    for (let i = 0; i < N; i++) {
      const ang = startAngle + i * angleStep;
      const r = (avgScores[i] / 5) * maxR;
      const lv = levelForScore(avgScores[i]);
      ctx.beginPath();
      ctx.arc(cx + r * Math.cos(ang), cy + r * Math.sin(ang), 5, 0, 2 * Math.PI);
      ctx.fillStyle = lv ? lv.color : C.legend;
      ctx.fill();
    }
  }

  // Axis labels
  for (let i = 0; i < N; i++) {
    const a = startAngle + i * angleStep;
    const labelR = maxR + 28;
    const x = cx + labelR * Math.cos(a);
    const y = cy + labelR * Math.sin(a);
    ctx.fillStyle = C.label;
    ctx.font = "bold 10px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = shortName(caps[i].name).split(" ");
    words.forEach((w, wi) => {
      ctx.fillText(w, x, y + (wi - (words.length - 1) / 2) * 13);
    });
  }

  // HTML legend — skipped during animation frames
  if (!opts?.noLegend) {
    const legendGroup2 = CONFIG.levels.map(lv => ({ color: lv.color, label: `${lv.level}  ${lv.name}` }));
    injectRadarLegend(canvasId, legendGroup1, legendGroup2);
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
  const dimensions = getSelectedDimensions();
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
      renderRadar("radar-chart", null, caps, [curr], { noLegend: true, dimensions });
      drawAnimLabel(curr.label, formatDate(curr.date), 1);
    } else {
      const p = easeInOut((cycleT - HOLD_MS) / TRANS_MS);
      renderRadar("radar-chart", null, caps, [interpolateAssessment(curr, next, p)], { noLegend: true, dimensions });
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

// Redraw radar when theme changes
document.addEventListener('themechange', () => {
  if (db && db.assessments && db.assessments.length > 0) {
    updateRadarFilter();
  }
});
