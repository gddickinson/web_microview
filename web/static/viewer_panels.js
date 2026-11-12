// Analysis panels under the image: ROI zoom view, ROI statistics (table + bar chart), ROI mean over frames and the
// line profile, plus CSV/PNG exports. All numbers come from image_math.js (tested against image_utils.py).
import { download, esc } from './core.js';
import { barChart, lineChart } from './charts.js';
import { STAT_NAMES, channel, extractRoi, lineProfile, normalize, roiStats } from './image_math.js';
import { paint } from './viewer_canvas.js';

export const fmtNum = v => (Number.isFinite(v) ? (Number.isInteger(v) ? String(v) : (+v.toPrecision(6)).toString()) : '–');

export function panelsHtml() {
  return `<div class="charts">
    <div class="panel"><h3>ROI view</h3><div id="roiView" class="roiview"><p class="mute small">Draw a box on the image (ROI tool).</p></div></div>
    <div class="panel"><h3>ROI statistics</h3><div id="roiStats"><p class="mute small">No ROI yet.</p></div></div>
    <div class="panel"><h3>ROI mean over frames</h3><div id="roiTime"><p class="mute small">No ROI yet.</p></div></div>
    <div class="panel"><h3>Intensity profile</h3><div id="profile"><p class="mute small">Draw a line on the image (Line tool).</p></div></div>
  </div>`;
}

const frameOf = (s, i, ch) => channel(s.pages[i], s.samples, ch);

// roi = [x0, y0, w, h] in pixels; returns the per-frame mean series (cached by the caller)
export function meanSeries(s, ch, roi) {
  return s.pages.map((_, i) => roiStats(frameOf(s, i, ch), s.height, s.width, roi)[0]);
}

export function renderRoi(root, s, f, roi, lut) {
  const view = root.querySelector('#roiView'), stats = root.querySelector('#roiStats');
  if (!roi) return;
  const r = extractRoi(f, s.height, s.width, roi);
  if (!r.width || !r.height) {
    view.innerHTML = stats.innerHTML = '<p class="mute small">The ROI does not overlap the image.</p>';
    return;
  }
  view.innerHTML = '<canvas aria-label="Zoomed view of the ROI"></canvas>';
  const c = view.querySelector('canvas');
  c.width = r.width; c.height = r.height;
  c.style.aspectRatio = `${r.width} / ${r.height}`;
  paint(c.getContext('2d'), normalize(r.data), r.width, r.height, lut);
  const v = roiStats(f, s.height, s.width, roi), um = s.pixel.um_per_px;
  const area = r.width * r.height;
  stats.innerHTML = `<table class="kvt"><tbody>${STAT_NAMES.map((n, i) => `<tr><th>${n}</th><td>${fmtNum(v[i])}</td></tr>`).join('')}
    <tr><th>Box</th><td>x ${r.col0}, y ${r.row0}, ${r.width} × ${r.height} px</td></tr>
    <tr><th>Area</th><td>${area} px${um ? ` = ${fmtNum(area * um * um)} µm²` : ''}</td></tr></tbody></table>
    ${barChart(STAT_NAMES, v, { title: 'ROI statistics bar chart' })}`;
}

export function renderTime(root, s, series, frame) {
  const host = root.querySelector('#roiTime');
  if (!series) return;
  if (s.pages.length < 2) { host.innerHTML = '<p class="mute small">Single image: no time series.</p>'; return; }
  const dt = s.frameInterval;
  const xs = series.map((_, i) => (dt ? i * dt : i));
  host.innerHTML = lineChart(xs, series, { xlab: dt ? 'time (s)' : 'frame', ylab: 'ROI mean', title: 'ROI mean intensity over frames',
    marker: dt ? frame * dt : frame });
}

export function renderProfile(root, s, f, line) {
  const host = root.querySelector('#profile');
  if (!line) return;
  const p = lineProfile(f, s.height, s.width, ...line), um = s.pixel.um_per_px;
  const xs = Array.from(p.distance, d => (um ? d * um : d));
  host.innerHTML = `${lineChart(xs, Array.from(p.values), { xlab: um ? 'distance (µm)' : 'distance (px)', title: 'Line intensity profile' })}
    <p class="small mute mono">(${line.slice(0, 2).map(v => v.toFixed(1)).join(', ')}) → (${line.slice(2).map(v => v.toFixed(1)).join(', ')}) ·
      ${fmtNum(p.distance.at(-1))} px${um ? ` = ${fmtNum(p.distance.at(-1) * um)} µm` : ''} · ${p.values.length} samples</p>`;
}

const stem = s => (s.name || 'stack').replace(/\.(ome\.)?tiff?$/i, '').replace(/[^\w.-]+/g, '_');

export function exportRoiCsv(st) {
  const s = st.stack, ch = st.view.channel, roi = st.roi, um = s.pixel.um_per_px;
  const rows = [`# file: ${s.name || st.name}; ROI x=${roi[0]} y=${roi[1]} w=${roi[2]} h=${roi[3]} px (corner origin, row 0 at top)` +
    `; pixel size: ${um ? um + ' um (' + s.pixel.source + ')' : 'not in file'}; std = population (ddof=0)`,
    'frame,mean,std,min,max,median'];
  s.pages.forEach((_, i) => rows.push([i, ...roiStats(frameOf(s, i, ch), s.height, s.width, roi)].join(',')));
  download(`${stem(st)}_roi_stats.csv`, rows.join('\n') + '\n', 'text/csv');
}

export function exportProfileCsv(st) {
  const s = st.stack, f = frameOf(s, st.view.frame, st.view.channel), um = s.pixel.um_per_px;
  const p = lineProfile(f, s.height, s.width, ...st.line);
  const rows = [`# file: ${st.name}; frame ${st.view.frame}; line (${st.line.join(', ')}) px, corner origin; bilinear`,
    um ? 'distance_px,distance_um,value' : 'distance_px,value'];
  p.distance.forEach((d, i) => rows.push((um ? [d, d * um, p.values[i]] : [d, p.values[i]]).join(',')));
  download(`${stem(st)}_profile_f${st.view.frame}.csv`, rows.join('\n') + '\n', 'text/csv');
}

export function exportPng(st, canvas) {
  canvas.toBlob(b => download(`${stem(st)}_frame${st.view.frame}.png`, b, 'image/png'));
}

export const summaryHtml = st => {
  const s = st.stack, um = s.pixel.um_per_px;
  return `<p class="small"><b>${esc(st.name)}</b><br>
    <span class="mono">${esc(s.meta.Dimensions)} ${esc(s.dtype)}</span> · ${s.pages.length} frame${s.pages.length > 1 ? 's' : ''}
    ${s.samples > 1 ? ` · ${s.samples} samples/pixel` : ''} · compression: ${esc(s.compression || 'n/a')}<br>
    Pixel size: ${um ? `<b>${fmtNum(um)} µm</b> <span class="mute">(${esc(s.pixel.source)})</span>` : `<span class="mute">${esc(s.pixel.source)}</span>`}
    ${s.frameInterval ? `<br>Frame interval: ${fmtNum(s.frameInterval)} s <span class="mute">(ImageJ finterval)</span>` : ''}
    ${st.source === 'server' ? '<br><span class="tag c">decoded by tifffile on the server</span>' : ''}</p>`;
};
