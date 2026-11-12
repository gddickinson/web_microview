// Static-site data layer: answers api() calls from the JSON exported by scripts/build_static.py, and runs the
// metadata reading in the browser (tiff_reader.js) where the local app would use tifffile. Decoding files the
// browser reader cannot handle needs the local app.
import { range } from './image_math.js';
import { readTiff } from './tiff_reader.js';
import { tagText } from './tiff_tags.js';

const files = new Map();
async function file(rel) {
  if (!files.has(rel)) files.set(rel, fetch('api/' + rel + '.json').then(r => { if (!r.ok) throw new Error(`${r.status} ${rel}`); return r.json(); }));
  return files.get(rel);
}

export const NEEDS_SERVER = 'needs the full app running locally (Python server): see the README, "Run the web app"';

export async function staticApi(path, body) {
  const clean = path.split('?')[0].replace(/^\/+/, '');
  if (clean === 'inspect') return inspect(body.get('file'));
  if (clean === 'stack') throw new Error('Decoding with tifffile ' + NEEDS_SERVER + '.');
  return file(clean);
}

// numpy prints the shortest repr of the scalar's own type: do the same for float32.
export function numText(v, dtype) {
  if (Number.isInteger(v) && !dtype.startsWith('float')) return String(v);
  if (dtype === 'float32') {
    for (let p = 1; p <= 9; p++) { const s = Number(v.toPrecision(p)); if (Math.fround(s) === v) return String(s); }
  }
  return String(v);
}

// Same fields as the server's /api/inspect, from the browser reader (tag values formatted by tiff_tags.tagText).
export async function inspectStack(t, name) {
  let lo = Infinity, hi = -Infinity;
  for (const p of t.pages) { const [a, b] = range(p); lo = Math.min(lo, a); hi = Math.max(hi, b); }
  const metadata = { ...t.meta, 'Value Range': `${numText(lo, t.dtype)} to ${numText(hi, t.dtype)}` };
  for (const tag of t.tags) metadata[tag.name] = tagText(tag.value);
  return { name, metadata, pixel: t.pixel, pages: t.pages.length, reader: 'in-browser reader (tiff_reader.js)' };
}

async function inspect(f) {
  return inspectStack(await readTiff(await f.arrayBuffer()), f.name);
}
