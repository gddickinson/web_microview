// Python vs JS: the demo stack's ROI statistics and line profiles from image_utils.py (computed by the server, or
// exported at build time) next to the browser's image_math.js values, with the largest relative difference.
import { api, app, esc, route } from './core.js';
import { STAT_NAMES, lineProfile, roiStats } from './image_math.js';
import { readTiff } from './tiff_reader.js';
import { DEMO_URL } from './state.js';
import { fmtNum } from './viewer_panels.js';

const rel = (a, b) => (b === null ? (Number.isNaN(a) ? 0 : Infinity) : Math.abs(a - b) / Math.max(1, Math.abs(b)));

route('check', async () => {
  const root = app();
  root.innerHTML = '<h1 class="glow">Python vs JS</h1><p class="mute">Computing...</p>';
  const [py, t] = await Promise.all([api('/demo/check'), fetch(DEMO_URL).then(r => r.arrayBuffer()).then(readTiff)]);
  let worst = 0, n = 0;
  const rows = [], profs = [];
  for (const fr of py.frames) {
    const f = t.pages[fr.frame];
    for (const s of fr.roi_stats) {
      const js = roiStats(f, t.height, t.width, s.box);
      const d = Math.max(...js.map((v, i) => rel(v, s.value[i])));
      worst = Math.max(worst, d); n += 5;
      rows.push(`<tr><td>${fr.frame}</td><td class="mono">${s.box.join(', ')}</td>${STAT_NAMES.map((_, i) =>
        `<td class="mono">${fmtNum(s.value[i])}<br><span class="mute">${fmtNum(js[i])}</span></td>`).join('')}<td class="mono ${d < 1e-9 ? 'ok' : 'err'}">${d.toExponential(1)}</td></tr>`);
    }
    for (const p of fr.profiles) {
      const js = lineProfile(f, t.height, t.width, ...p.line).values;
      const d = Math.max(...p.values.map((v, i) => rel(js[i], v)));
      worst = Math.max(worst, d); n += p.values.length;
      profs.push(`<tr><td>${fr.frame}</td><td class="mono">${p.line.join(', ')}</td><td>${p.values.length}</td><td class="mono ${d < 1e-9 ? 'ok' : 'err'}">${d.toExponential(1)}</td></tr>`);
    }
  }
  const meta = t.meta, same = meta.Dimensions === py.metadata.Dimensions && meta['Data Type'] === py.metadata['Data Type'];
  const pxSame = t.pixel.um_per_px === py.pixel.um_per_px;
  root.innerHTML = `
    <h1 class="glow">Python vs JS</h1>
    <p class="lead">The viewer's numbers come from <span class="mono">image_math.js</span>, a port of the repo's
      <span class="mono">image_utils.py</span>. Here the demo stack is read in your browser and measured in JS, and compared
      with the Python values (${esc(py.python)}).</p>
    <div class="tiles">
      <div class="tile"><b class="${worst < 1e-9 ? 'ok' : 'err'}">${worst.toExponential(1)}</b><span>largest relative difference</span></div>
      <div class="tile"><b>${n}</b><span>values compared</span></div>
      <div class="tile"><b class="${same ? 'ok' : 'err'}">${same ? 'same' : 'differs'}</b><span>shape and dtype ${esc(py.metadata.Dimensions)} ${esc(py.metadata['Data Type'])}</span></div>
      <div class="tile"><b class="${pxSame ? 'ok' : 'err'}">${fmtNum(t.pixel.um_per_px)} µm</b><span>pixel size (${esc(py.pixel.source)})</span></div>
    </div>
    <h2>ROI statistics</h2><p class="small mute">Top: Python, below: JS. Boxes are x, y, width, height in pixels; one starts outside the image and one has fractional edges.</p>
    <div class="scroll"><table><thead><tr><th>Frame</th><th>Box</th>${STAT_NAMES.map(s => `<th>${s}</th>`).join('')}<th>Max rel. diff</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
    <h2>Line profiles</h2>
    <div class="scroll"><table><thead><tr><th>Frame</th><th>Line x0, y0, x1, y1</th><th>Samples</th><th>Max rel. diff</th></tr></thead><tbody>${profs.join('')}</tbody></table></div>
    <p class="small mute">The node tests (<span class="mono">web/static/*.test.mjs</span>) make the same comparison on 16 small TIFF fixtures
      (byte orders, integer and float types, LZW/Deflate/PackBits, tiles, BigTIFF, RGB, ImageJ and OME files).</p>`;
});
