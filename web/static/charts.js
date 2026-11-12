// Small SVG charts (no library): bar chart for ROI statistics and line chart for profiles / intensity over time.
import { esc } from './core.js';

const W = 360, H = 200, M = { l: 52, r: 10, t: 10, b: 34 };
const fmt = v => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(1) : +v.toPrecision(4)).toString();

function ticks(lo, hi, n = 4) {
  if (!(hi > lo)) { hi = lo + 1; }
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(k => k * mag).find(s => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
  return out;
}

function frame(lo, hi, xlab, ylab) {
  const ys = ticks(lo, hi);
  const y = v => M.t + (H - M.t - M.b) * (1 - (v - lo) / (hi - lo || 1));
  const grid = ys.map(v => `<line class="axis" x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}" opacity=".5"/>
    <text x="${M.l - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`).join('');
  return { y, svg: `${grid}<text x="${(W + M.l) / 2}" y="${H - 4}" text-anchor="middle">${esc(xlab)}</text>
    <text transform="translate(12 ${(H - M.b + M.t) / 2}) rotate(-90)" text-anchor="middle">${esc(ylab)}</text>` };
}

export function barChart(labels, values, { ylab = 'intensity', title = '' } = {}) {
  const ok = values.filter(Number.isFinite);
  if (!ok.length) return `<p class="mute small">No values.</p>`;
  const lo = Math.min(0, ...ok), hi = Math.max(...ok) * 1.08 || 1;
  const f = frame(lo, hi, '', ylab), bw = (W - M.l - M.r) / labels.length;
  const bars = labels.map((l, i) => {
    const v = values[i], x = M.l + i * bw + bw * 0.15;
    const top = Number.isFinite(v) ? Math.min(f.y(v), f.y(0)) : f.y(0), h = Number.isFinite(v) ? Math.abs(f.y(v) - f.y(0)) : 0;
    return `<rect class="bar" x="${x}" y="${top}" width="${bw * 0.7}" height="${h}"><title>${esc(l)}: ${fmt(v)}</title></rect>
      <text x="${x + bw * 0.35}" y="${H - M.b + 14}" text-anchor="middle">${esc(l)}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${f.svg}${bars}</svg>`;
}

export function lineChart(xs, ys, { xlab = '', ylab = 'intensity', title = '', marker = null } = {}) {
  const ok = ys.filter(Number.isFinite);
  if (xs.length < 2 || !ok.length) return `<p class="mute small">No values.</p>`;
  let lo = Math.min(...ok), hi = Math.max(...ok);
  const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.05 || 1; lo -= pad; hi += pad;
  const f = frame(lo, hi, xlab, ylab);
  const x0 = xs[0], x1 = xs[xs.length - 1] || 1;
  const x = v => M.l + (W - M.l - M.r) * ((v - x0) / (x1 - x0 || 1));
  const pts = xs.map((v, i) => Number.isFinite(ys[i]) ? `${x(v).toFixed(1)},${f.y(ys[i]).toFixed(1)}` : '').filter(Boolean).join(' ');
  const xt = ticks(x0, x1).map(v => `<text x="${x(v)}" y="${H - M.b + 14}" text-anchor="middle">${fmt(v)}</text>`).join('');
  const mk = marker === null ? '' : `<line class="thr" x1="${x(marker)}" x2="${x(marker)}" y1="${M.t}" y2="${H - M.b}"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${f.svg}${xt}${mk}
    <polyline class="ln" fill="none" points="${pts}"/></svg>`;
}
