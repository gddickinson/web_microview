// Viewer page: the Bokeh dashboard's Image View in the browser. Open a TIFF (or the demo stack), step or play through
// frames, set gamma and lookup table, draw a ROI box (zoom view, statistics, mean over frames) or a profile line.
import { $, app, isStatic, onLeave, route } from './core.js';
import { channel, display, range } from './image_math.js';
import { LUTS, createStage } from './viewer_canvas.js';
import { exportPng, exportProfileCsv, exportRoiCsv, meanSeries, panelsHtml, renderProfile, renderRoi, renderTime, summaryHtml } from './viewer_panels.js';
import { loadDemo, loadFile, onStack, state } from './state.js';

const ui = state.ui || (state.ui = { tool: 'roi', lut: 'grey', fixed: false, fps: 10 });

route('viewer', async () => {
  const root = app();
  root.innerHTML = `
  <h1 class="glow">Viewer</h1>
  <p class="lead">Open a TIFF image or stack. It is read in your browser (nothing is uploaded${isStatic() ? '' : '; only a file the browser reader cannot decode is passed to tifffile on this computer'}).
    Coordinates are pixels from the top-left corner of the image, as in ImageJ/Fiji.</p>
  <div class="side">
    <aside class="panel ctlpanel">
      <h3>Open</h3>
      <label for="file">TIFF file (.tif, .tiff, .ome.tif)</label>
      <input type="file" id="file" accept=".tif,.tiff,image/tiff">
      <button id="demo" class="alt">Load the demo stack</button>
      <p class="small mute">You can also drop a file on the image.</p>
      <div id="summary"></div>
      <div id="controls"></div>
    </aside>
    <section class="viewmain">
      <div class="stage" id="stage"></div>
      <p id="readout" class="mono small mute" aria-live="polite">&nbsp;</p>
      <p id="msg" class="err small" role="alert"></p>
      ${panelsHtml()}
    </section>
  </div>`;

  const stage = createStage($('#stage'), {
    tool: () => ui.tool,
    onHover: (x, y) => hover(x, y),
    onRoi: r => { state.roi = r; state.series = null; syncInputs(); refresh(); },
    onLine: l => { state.line = l.map(v => Math.round(v * 10) / 10); syncInputs(); refresh(); },
  });
  let timer = null, rangeCache = null;
  const stopPlay = () => { clearInterval(timer); timer = null; const b = $('#play'); if (b) b.textContent = 'Play'; };
  onLeave(() => { stopPlay(); stage.destroy(); off(); });

  const msg = t => { $('#msg').textContent = t || ''; };
  async function open(fn) {
    msg(''); stopPlay();
    try { await fn(); } catch (e) { console.warn(e); msg(`Could not open this file: ${e.message}`); }
  }
  $('#file').addEventListener('change', e => e.target.files[0] && open(() => loadFile(e.target.files[0])));
  $('#demo').addEventListener('click', () => open(loadDemo));
  const st = $('#stage');
  st.addEventListener('dragover', e => { e.preventDefault(); st.classList.add('drop'); });
  st.addEventListener('dragleave', () => st.classList.remove('drop'));
  st.addEventListener('drop', e => { e.preventDefault(); st.classList.remove('drop'); const f = e.dataTransfer.files[0]; if (f) open(() => loadFile(f)); });
  const off = onStack(() => { rangeCache = null; build(); });

  const cur = () => channel(state.stack.pages[state.view.frame], state.stack.samples, state.view.channel);

  function hover(x, y) {
    const s = state.stack, out = $('#readout');
    if (!s || x === null) { out.innerHTML = '&nbsp;'; return; }
    const v = cur()[y * s.width + x], um = s.pixel.um_per_px;
    out.textContent = `x ${x}, y ${y}${um ? ` (${(x * um).toFixed(2)}, ${(y * um).toFixed(2)} µm)` : ''} · value ${v} · frame ${state.view.frame}`;
  }

  function stackRange() {
    if (!rangeCache) {
      let lo = Infinity, hi = -Infinity;
      for (const p of state.stack.pages) { const [a, b] = range(channel(p, state.stack.samples, state.view.channel)); lo = Math.min(lo, a); hi = Math.max(hi, b); }
      rangeCache = [lo, hi];
    }
    return rangeCache;
  }

  function refresh() {
    const s = state.stack;
    if (!s) return;
    const f = cur(), g = state.view.gamma;
    let disp;
    if (ui.fixed) {
      const [lo, hi] = stackRange(), d = hi - lo || 1;
      disp = Float64Array.from(f, v => Math.pow((v - lo) / d, 1 / g));
    } else disp = display(f, g);
    stage.show(disp, s.width, s.height, ui.lut);
    stage.setShapes(state.roi, state.line);
    if (state.roi) {
      if (!state.series) state.series = meanSeries(s, state.view.channel, state.roi);
      renderRoi(app(), s, f, state.roi, ui.lut);
      renderTime(app(), s, state.series, state.view.frame);
    }
    if (state.line) renderProfile(app(), s, f, state.line);
    const fl = $('#frameLabel');
    if (fl) fl.textContent = `${state.view.frame} / ${s.pages.length - 1}`;
  }

  function syncInputs() {
    (state.roi || []).forEach((v, i) => { const el = $(`#roi${i}`); if (el) el.value = v; });
    (state.line || []).forEach((v, i) => { const el = $(`#ln${i}`); if (el) el.value = v; });
    for (const id of ['clearRoi', 'csvRoi']) { const b = $('#' + id); if (b) b.disabled = !state.roi; }
    for (const id of ['clearLine', 'csvLine']) { const b = $('#' + id); if (b) b.disabled = !state.line; }
  }

  function build() {
    const s = state.stack, host = $('#controls');
    $('#summary').innerHTML = s ? summaryHtml(state) : '';
    if (!s) { host.innerHTML = ''; return; }
    const n = s.pages.length;
    const num = (id, label, v) => `<div><label for="${id}">${label}</label><input type="number" id="${id}" value="${v ?? ''}" step="any"></div>`;
    host.innerHTML = `
      <h3>Display</h3>
      ${n > 1 ? `<label for="frame">Frame <b id="frameLabel"></b></label>
        <input type="range" id="frame" min="0" max="${n - 1}" step="1" value="${state.view.frame}">
        <div class="row tight"><button id="play" class="alt">Play</button>
          <div><label for="fps">Frames / s</label><select id="fps">${[2, 5, 10, 20, 30].map(f => `<option${f === ui.fps ? ' selected' : ''}>${f}</option>`).join('')}</select></div></div>` : ''}
      ${s.samples > 1 ? `<label for="chan">Channel (sample)</label><select id="chan">${Array.from({ length: s.samples }, (_, i) => `<option value="${i}"${i === state.view.channel ? ' selected' : ''}>${i}${s.samples === 3 ? ' (' + 'RGB'[i] + ')' : ''}</option>`).join('')}</select>` : ''}
      <label for="gamma">Gamma (contrast) <b id="gammaLabel">${state.view.gamma.toFixed(1)}</b></label>
      <input type="range" id="gamma" min="0.1" max="2" step="0.1" value="${state.view.gamma}">
      <label for="lut">Lookup table</label>
      <select id="lut">${Object.keys(LUTS).map(k => `<option${k === ui.lut ? ' selected' : ''}>${k}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" id="fixed"${ui.fixed ? ' checked' : ''}><span>Same intensity range for every frame
        <span class="mute">Off: each frame scaled to its own min-max, as in the Bokeh app.</span></span></label>
      <h3>Tool</h3>
      <div class="seg" role="group" aria-label="Drawing tool">${[['roi', 'ROI box'], ['line', 'Line profile'], ['inspect', 'Inspect']].map(([k, l]) =>
        `<button data-tool="${k}" class="${ui.tool === k ? 'on' : ''}" aria-pressed="${ui.tool === k}">${l}</button>`).join('')}</div>
      <p class="small mute">ROI box in pixels (x, y = top-left corner):</p>
      <div class="row nums">${['x', 'y', 'width', 'height'].map((l, i) => num(`roi${i}`, l, state.roi?.[i])).join('')}</div>
      <p class="small mute">Line from (x0, y0) to (x1, y1), pixels:</p>
      <div class="row nums">${['x0', 'y0', 'x1', 'y1'].map((l, i) => num(`ln${i}`, l, state.line?.[i])).join('')}</div>
      <button id="clearRoi" class="alt">Clear ROI</button><button id="clearLine" class="alt">Clear line</button>
      <h3>Export</h3>
      <button id="csvRoi" class="alt">ROI stats CSV (all frames)</button><button id="csvLine" class="alt">Profile CSV</button>
      <button id="png" class="alt">Frame PNG</button>
      <p class="small"><a href="#/metadata">File metadata →</a></p>`;

    const setFrame = i => { state.view.frame = (i + n) % n; const fr = $('#frame'); if (fr) fr.value = state.view.frame; refresh(); };
    $('#frame')?.addEventListener('input', e => { stopPlay(); setFrame(+e.target.value); });
    $('#play')?.addEventListener('click', e => {
      if (timer) { stopPlay(); return; }
      e.target.textContent = 'Pause';
      timer = setInterval(() => setFrame(state.view.frame + 1), 1000 / ui.fps);
    });
    $('#fps')?.addEventListener('change', e => { ui.fps = +e.target.value; if (timer) { stopPlay(); $('#play').click(); } });
    $('#chan')?.addEventListener('change', e => { state.view.channel = +e.target.value; state.series = null; rangeCache = null; refresh(); });
    $('#gamma').addEventListener('input', e => { state.view.gamma = +e.target.value; $('#gammaLabel').textContent = state.view.gamma.toFixed(1); refresh(); });
    $('#lut').addEventListener('change', e => { ui.lut = e.target.value; refresh(); });
    $('#fixed').addEventListener('change', e => { ui.fixed = e.target.checked; refresh(); });
    host.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
      ui.tool = b.dataset.tool;
      host.querySelectorAll('[data-tool]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    }));
    const readNums = (pre, k) => Array.from({ length: k }, (_, i) => parseFloat($(`#${pre}${i}`).value));
    host.querySelectorAll('[id^=roi]').forEach(el => el.addEventListener('change', () => {
      const v = readNums('roi', 4);
      if (v.every(Number.isFinite) && v[2] > 0 && v[3] > 0) { state.roi = v; state.series = null; syncInputs(); refresh(); }
    }));
    host.querySelectorAll('[id^=ln]').forEach(el => el.addEventListener('change', () => {
      const v = readNums('ln', 4);
      if (v.every(Number.isFinite)) { state.line = v; syncInputs(); refresh(); }
    }));
    $('#clearRoi').addEventListener('click', () => { state.roi = null; state.series = null; build(); resetPanels(); });
    $('#clearLine').addEventListener('click', () => { state.line = null; build(); resetPanels(); });
    $('#csvRoi').addEventListener('click', () => exportRoiCsv(state));
    $('#csvLine').addEventListener('click', () => exportProfileCsv(state));
    $('#png').addEventListener('click', () => exportPng(state, stage.canvas));
    stage.overlay.onkeydown = e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); stopPlay(); setFrame(state.view.frame + (e.key === 'ArrowRight' ? 1 : -1)); }
    };
    syncInputs();
    refresh();
  }

  function resetPanels() {
    const v = app().querySelector('.charts');
    if (v) v.outerHTML = panelsHtml();
    refresh();
  }

  if (!state.stack) await open(loadDemo); else build();
});

