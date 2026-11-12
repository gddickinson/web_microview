// Metadata page: the Bokeh app's Metadata tab. With the local app the file is read by tifffile through the repo's
// image_utils.read_tiff_bytes (exactly what the Bokeh app shows); on the static site by the in-browser reader.
import { api, app, esc, isStatic, route } from './core.js';
import { loadDemo, state } from './state.js';

const BASIC = ['Dimensions', 'Data Type', 'Value Range'];

function table(meta) {
  const row = (k, v) => {
    const long = String(v).length > 160 || String(v).includes('\n');
    return `<tr><th>${esc(k)}</th><td>${long ? `<pre class="desc">${esc(v)}</pre>` : esc(v)}</td></tr>`;
  };
  return `<div class="scroll"><table class="meta"><tbody>
    <tr class="grp"><td colspan="2">Basic Properties</td></tr>${BASIC.filter(k => k in meta).map(k => row(k, meta[k])).join('')}
    <tr class="grp"><td colspan="2">TIFF Metadata</td></tr>${Object.keys(meta).filter(k => !BASIC.includes(k)).sort().map(k => row(k, meta[k])).join('')}
  </tbody></table></div>`;
}

route('metadata', async () => {
  const root = app();
  if (!state.stack) {
    root.innerHTML = `<h1 class="glow">Metadata</h1><p class="lead">No file open yet.</p>
      <a class="btn" href="#/viewer">Open a file in the viewer</a><button id="demo" class="alt">Use the demo stack</button>`;
    root.querySelector('#demo').addEventListener('click', async () => { await loadDemo(); window.dispatchEvent(new HashChangeEvent('hashchange')); });
    return;
  }
  root.innerHTML = `<h1 class="glow">Metadata</h1><p class="lead">${esc(state.name)}</p><div id="meta"><p class="mute">Reading...</p></div>`;
  const fd = new FormData();
  fd.append('file', state.file, state.file.name || state.name);
  let res;
  try {
    res = await api('/inspect', { body: fd });
  } catch (e) {
    root.querySelector('#meta').innerHTML = `<p class="err">${esc(e.message)}</p>`;
    return;
  }
  const px = res.pixel;
  root.querySelector('#meta').innerHTML = `
    <div class="tiles">
      <div class="tile"><b>${esc(res.metadata.Dimensions)}</b><span>shape</span></div>
      <div class="tile"><b>${esc(res.metadata['Data Type'])}</b><span>data type</span></div>
      <div class="tile"><b>${res.pages}</b><span>pages (IFDs)</span></div>
      <div class="tile"><b>${px.um_per_px ? +px.um_per_px.toPrecision(6) + ' µm' : 'n/a'}</b><span>pixel size: ${esc(px.source)}</span></div>
    </div>
    <p class="small mute">Read by ${esc(res.reader)}${res.axes ? ` · axes <span class="mono">${esc(res.axes)}</span>` : ''}.
      ${isStatic() ? 'With the local app the same table comes from tifffile via the repo\'s image_utils.read_tiff_bytes; tag values are formatted a little differently.' : ''}</p>
    ${table(res.metadata)}`;
});
