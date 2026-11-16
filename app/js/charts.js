/* ------------------------------------------------------------------
   charts.js — tiny inline-SVG chart builders (no libraries, offline).
   Thin marks, rounded data-ends, hairline grid, text in text tokens.
   ------------------------------------------------------------------ */

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const compact = n => Math.abs(n) >= 1000 ? (n < 0 ? "−" : "") + "$" + (Math.abs(n) / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K" : money(n);

function niceTicks(min, max, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}

const CHART_HOVER = {};

/* Horizontal bars: label | bar | value. Each row is labelled, so no legend. */
function barChartH(items, { width = 334, rowH = 28, labelW = 92, valueW = 58 } = {}) {
  const max = Math.max(...items.map(i => i.value), 1);
  const barW = width - labelW - valueW - 8;
  const h = items.length * rowH;
  let s = `<svg class="chart-svg" viewBox="0 0 ${width} ${h}" width="100%" role="img" aria-label="Spending by category">`;
  items.forEach((it, i) => {
    const y = i * rowH + rowH / 2;
    const w = Math.max(4, (it.value / max) * barW);
    const x = labelW;
    s += `<text x="${labelW - 8}" y="${y + 4}" text-anchor="end" class="t-sec">${esc(it.label)}</text>`;
    s += `<path d="M${x},${y - 6} h${w - 4} a4,4 0 0 1 4,4 v4 a4,4 0 0 1 -4,4 h${-(w - 4)} z" fill="${it.color}"><title>${esc(it.label)}: ${money(it.value)} a month</title></path>`;
    s += `<text x="${x + w + 6}" y="${y + 4}" class="t-val">${money(it.value)}</text>`;
  });
  return s + `</svg>`;
}

/* Columns for monthly totals; the last one can be "so far". Single series, no legend. */
function columnChart(cols, { width = 334, height = 150, color = "#2a78d6" } = {}) {
  const pad = { t: 22, b: 22, l: 8, r: 8 };
  const max = Math.max(...cols.map(c => c.value), 1);
  const slot = (width - pad.l - pad.r) / cols.length;
  const bw = Math.min(24, slot * 0.5);
  const base = height - pad.b;
  let s = `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Monthly spending">`;
  s += `<line x1="${pad.l}" x2="${width - pad.r}" y1="${base}" y2="${base}" class="grid"/>`;
  cols.forEach((c, i) => {
    const x = pad.l + slot * i + slot / 2 - bw / 2;
    const h = Math.max(4, ((base - pad.t) * c.value) / max);
    const y = base - h;
    s += `<path d="M${x},${base} v${-(h - 4)} a4,4 0 0 1 4,-4 h${bw - 8} a4,4 0 0 1 4,4 v${h - 4} z" fill="${color}" ${c.partial ? 'opacity="0.45"' : ""}><title>${esc(c.label)}: ${money(c.value)}</title></path>`;
    s += `<text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" class="t-val">${compact(c.value)}</text>`;
    s += `<text x="${x + bw / 2}" y="${height - 6}" text-anchor="middle" class="t-sec">${esc(c.label)}${c.partial ? "*" : ""}</text>`;
  });
  return s + `</svg>`;
}

/* Multi-series line chart with crosshair tooltip. series: [{name,color,values}] */
function lineChart({ id, series, xLabel, yMin = 0, width = 334, height = 180, refLine, zeroLine = false, tooltip }) {
  const pad = { t: 14, r: 44, b: 24, l: 42 };
  const n = series[0].values.length;
  const all = series.flatMap(s => s.values).concat(refLine ? [refLine.value] : []);
  const t = niceTicks(Math.min(yMin, ...all), Math.max(...all), 4);
  const X = i => pad.l + (i / (n - 1)) * (width - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - t.lo) / (t.hi - t.lo || 1)) * (height - pad.t - pad.b);
  let s = `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(series.map(x => x.name).join(" vs "))}">`;
  for (const v of t.ticks) {
    s += `<line x1="${pad.l}" x2="${width - pad.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid ${v === 0 && zeroLine ? "zero" : ""}"/>`;
    s += `<text x="${pad.l - 6}" y="${Y(v) + 3}" text-anchor="end" class="t-mut">${compact(v)}</text>`;
  }
  if (refLine) {
    s += `<line x1="${pad.l}" x2="${width - pad.r}" y1="${Y(refLine.value)}" y2="${Y(refLine.value)}" class="ref"/>`;
    s += `<text x="${width - pad.r}" y="${Y(refLine.value) - 4}" text-anchor="end" class="t-mut">${esc(refLine.label)}</text>`;
  }
  // x labels
  const xl = xLabel || (() => null);
  for (let i = 0; i < n; i++) { const l = xl(i); if (l) s += `<text x="${X(i)}" y="${height - 6}" text-anchor="middle" class="t-sec">${esc(l)}</text>`; }
  // series
  series.forEach(sr => {
    if (sr.area) {
      s += `<path d="M${X(0)},${Y(Math.max(t.lo, 0))} ` + sr.values.map((v, i) => `L${X(i)},${Y(v)}`).join(" ") + ` L${X(n - 1)},${Y(Math.max(t.lo, 0))} z" fill="${sr.color}" opacity="0.1"/>`;
    }
    s += `<path d="${sr.values.map((v, i) => (i ? "L" : "M") + X(i) + "," + Y(v)).join(" ")}" fill="none" stroke="${sr.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last = sr.values[n - 1];
    s += `<circle cx="${X(n - 1)}" cy="${Y(last)}" r="4" fill="${sr.color}" stroke="#fff" stroke-width="2"/>`;
    s += `<text x="${X(n - 1) + 7}" y="${Y(last) + 4}" class="t-val">${compact(last)}</text>`;
  });
  // markers
  series.forEach(sr => (sr.markers || []).forEach(m => {
    s += `<circle cx="${X(m.i)}" cy="${Y(sr.values[m.i])}" r="5" fill="${m.color || sr.color}" stroke="#fff" stroke-width="2"/>`;
    s += `<text x="${X(m.i)}" y="${Y(sr.values[m.i]) + (m.below ? 16 : -9)}" text-anchor="middle" class="t-val">${esc(m.label)}</text>`;
  }));
  // hover layer
  s += `<line class="xhair" x1="0" x2="0" y1="${pad.t}" y2="${height - pad.b}" style="display:none"/>`;
  series.forEach((sr, k) => { s += `<circle class="hdot hdot-${k}" r="4" fill="${sr.color}" stroke="#fff" stroke-width="2" style="display:none"/>`; });
  s += `<rect class="hit" x="${pad.l}" y="${pad.t}" width="${width - pad.l - pad.r}" height="${height - pad.t - pad.b}" fill="transparent"/>`;
  s += `</svg>`;
  CHART_HOVER[id] = { xs: Array.from({ length: n }, (_, i) => X(i)), ys: series.map(sr => sr.values.map(Y)), width, tooltip };
  const legend = series.length > 1 ? `<div class="legend">${series.map(sr => `<span><i style="background:${sr.color}"></i>${esc(sr.name)}</span>`).join("")}</div>` : "";
  return `<div class="chart" data-chart="${id}">${s}<div class="tip" style="display:none"></div></div>${legend}`;
}

/* Attach crosshair tooltips to every chart inside root. */
function wireCharts(root) {
  root.querySelectorAll(".chart[data-chart]").forEach(box => {
    const meta = CHART_HOVER[box.dataset.chart];
    if (!meta) return;
    const svg = box.querySelector("svg"), tip = box.querySelector(".tip");
    const xhair = svg.querySelector(".xhair"), dots = svg.querySelectorAll(".hdot");
    const move = e => {
      const r = svg.getBoundingClientRect();
      const px = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) * (meta.width / r.width);
      let i = 0, best = Infinity;
      meta.xs.forEach((x, k) => { const d = Math.abs(x - px); if (d < best) { best = d; i = k; } });
      xhair.setAttribute("x1", meta.xs[i]); xhair.setAttribute("x2", meta.xs[i]); xhair.style.display = "";
      dots.forEach((d, k) => { d.setAttribute("cx", meta.xs[i]); d.setAttribute("cy", meta.ys[k][i]); d.style.display = ""; });
      tip.innerHTML = meta.tooltip(i); tip.style.display = "";
      const left = (meta.xs[i] / meta.width) * r.width;
      tip.style.left = Math.min(r.width - tip.offsetWidth - 4, Math.max(4, left - tip.offsetWidth / 2)) + "px";
    };
    const leave = () => { xhair.style.display = "none"; dots.forEach(d => d.style.display = "none"); tip.style.display = "none"; };
    svg.addEventListener("mousemove", move); svg.addEventListener("touchstart", move, { passive: true }); svg.addEventListener("touchmove", move, { passive: true });
    svg.addEventListener("mouseleave", leave);
  });
}

/* Progress ring */
function ring(progress, { size = 64, stroke = 7, color = "#2a78d6", track = "#e6e6e3", label = "" } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = clamp(progress, 0, 1);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="ring"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${track}" stroke-width="${stroke}" fill="none"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="54%" text-anchor="middle" class="ring-label">${esc(label)}</text></svg>`;
}
