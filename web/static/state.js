// The stack being viewed, shared by the Viewer and Metadata pages. Files are read in the browser (tiff_reader.js);
// with the local server, files the browser reader cannot decode are decoded by tifffile (/api/stack) instead.
import { isStatic } from './core.js';
import { readTiff, UnsupportedTiff } from './tiff_reader.js';

const CTORS = { uint8: Uint8Array, uint16: Uint16Array, uint32: Uint32Array, int8: Int8Array, int16: Int16Array,
  int32: Int32Array, float32: Float32Array, float64: Float64Array };
export const DEMO_URL = 'static/demo/demo_stack.tif';

export const state = { stack: null, file: null, name: '', source: '', view: { frame: 0, gamma: 1, channel: 0 } };
const listeners = new Set();
export const onStack = fn => { listeners.add(fn); return () => listeners.delete(fn); };
function set(stack, file, name, source) {
  Object.assign(state, { stack, file, name, source, view: { frame: 0, gamma: state.view.gamma, channel: 0 } });
  state.roi = null; state.line = null;
  listeners.forEach(fn => fn(state));
}

export async function loadDemo() {
  const r = await fetch(DEMO_URL);
  if (!r.ok) throw new Error(`demo stack: ${r.status}`);
  const buf = await r.arrayBuffer();
  set(await readTiff(buf), new File([buf], 'demo_stack.tif'), 'demo_stack.tif (synthetic)', 'demo');
}

export async function loadFile(file) {
  const buf = await file.arrayBuffer();
  try {
    set(await readTiff(buf), file, file.name, 'browser');
  } catch (e) {
    if (!(e instanceof UnsupportedTiff) || isStatic()) throw e;
    set(await serverStack(file), file, file.name, 'server');  // let tifffile try
  }
}

async function serverStack(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('api/stack', { method: 'POST', body: fd });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `server: ${r.status}`);
  const h = JSON.parse(r.headers.get('X-Stack'));
  const buf = await r.arrayBuffer(), C = CTORS[h.dtype];
  const n = h.height * h.width * h.samples, pages = [];
  for (let i = 0; i < h.pages; i++) pages.push(new C(buf.slice(i * n * C.BYTES_PER_ELEMENT, (i + 1) * n * C.BYTES_PER_ELEMENT)));
  return { width: h.width, height: h.height, samples: h.samples, dtype: h.dtype, pages, compression: 'decoded by tifffile',
    description: '', tags: [], pixel: { um_per_px: h.um_per_px, source: h.px_source }, frameInterval: null,
    meta: { Dimensions: `(${[h.pages > 1 ? h.pages : null, h.height, h.width, h.samples > 1 ? h.samples : null].filter(x => x).join(', ')})`, 'Data Type': h.dtype } };
}
