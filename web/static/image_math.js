// Image arithmetic for the viewer, a line-for-line port of image_utils.py (normalize_frame, display_frame,
// clip_roi, compute_roi_stats, line_profile). Frames are flat arrays, row 0 first (top of the image), one sample per
// pixel. Coordinates use the pixel-corner origin: pixel (col, row) covers [col, col+1) x [row, row+1).
// image_math.test.mjs checks every function against the Python values in tests/fixtures/expected.json.

export const STAT_NAMES = ['Mean', 'Std Dev', 'Min', 'Max', 'Median'];

export function range(a) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < a.length; i++) { const v = a[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
}

export function normalize(a) {
  const [lo, hi] = range(a);
  const out = new Float64Array(a.length);
  if (hi === lo) return out;
  const d = hi - lo;
  for (let i = 0; i < a.length; i++) out[i] = (a[i] - lo) / d;
  return out;
}

// normalise, then ^(1/gamma) (the dashboard's gamma / contrast slider)
export function display(a, gamma = 1) {
  if (!(gamma > 0)) throw new Error('gamma must be > 0');
  const n = normalize(a);
  if (gamma === 1) return n;
  const e = 1 / gamma;
  for (let i = 0; i < n.length; i++) n[i] = Math.pow(n[i], e);
  return n;
}

// as image_utils.clip_roi: cut the off-image part, truncate with int(), clip to the far edges
export function clipRoi(rows, cols, x0, y0, width, height) {
  if (x0 < 0) { width += x0; x0 = 0; }
  if (y0 < 0) { height += y0; y0 = 0; }
  const c0 = Math.min(Math.trunc(x0), cols), r0 = Math.min(Math.trunc(y0), rows);
  const w = Math.max(0, Math.trunc(Math.min(cols - c0, width)));
  const h = Math.max(0, Math.trunc(Math.min(rows - r0, height)));
  return [c0, r0, w, h];
}

export function extractRoi(a, rows, cols, box) {
  const [c0, r0, w, h] = clipRoi(rows, cols, ...box);
  const out = new Float64Array(w * h);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) out[r * w + c] = a[(r0 + r) * cols + c0 + c];
  return { data: out, col0: c0, row0: r0, width: w, height: h };
}

// [mean, std (population), min, max, median]; NaNs when the ROI misses the image
export function roiStats(a, rows, cols, box) {
  const { data } = extractRoi(a, rows, cols, box);
  const n = data.length;
  if (!n) return STAT_NAMES.map(() => NaN);
  let s = 0;
  for (let i = 0; i < n; i++) s += data[i];
  const mean = s / n;
  let ss = 0;
  for (let i = 0; i < n; i++) { const d = data[i] - mean; ss += d * d; }
  const sorted = Float64Array.from(data).sort();
  const m = n >> 1, median = n % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
  return [mean, Math.sqrt(ss / n), sorted[0], sorted[n - 1], median];
}

// Python's round(): halves go to the even neighbour
export function roundHalfEven(x) {
  const f = Math.floor(x), d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

// Bilinear profile from (x0, y0) to (x1, y1): n = max(2, round(length) + 1) samples, clamped to the image.
export function lineProfile(a, rows, cols, x0, y0, x1, y1) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, roundHalfEven(length) + 1);
  const step = 1 / (n - 1);
  const distance = new Float64Array(n), values = new Float64Array(n);
  const clamp = (v, hi) => Math.min(Math.max(v, 0), hi);
  for (let i = 0; i < n; i++) {
    const t = i === n - 1 ? 1 : i * step;
    const u = clamp(x0 + t * (x1 - x0) - 0.5, cols - 1), v = clamp(y0 + t * (y1 - y0) - 0.5, rows - 1);
    const c0 = Math.min(Math.floor(u), cols - 1), r0 = Math.min(Math.floor(v), rows - 1);
    const c1 = Math.min(c0 + 1, cols - 1), r1 = Math.min(r0 + 1, rows - 1);
    const fu = u - c0, fv = v - r0;
    const top = a[r0 * cols + c0] * (1 - fu) + a[r0 * cols + c1] * fu;
    const bottom = a[r1 * cols + c0] * (1 - fu) + a[r1 * cols + c1] * fu;
    distance[i] = t * length;
    values[i] = top * (1 - fv) + bottom * fv;
  }
  return { distance, values };
}

// One sample channel of an interleaved page (samples > 1), or the page itself.
export function channel(page, samples, k) {
  if (samples === 1) return page;
  const out = new page.constructor(page.length / samples);
  for (let i = 0; i < out.length; i++) out[i] = page[i * samples + k];
  return out;
}

// Mean of a ROI over every frame (for the intensity-over-time chart).
export function roiMeanSeries(frames, rows, cols, box) {
  return frames.map(f => roiStats(f, rows, cols, box)[0]);
}
