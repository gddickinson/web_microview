// node web/static/tiff_reader.test.mjs: the JS TIFF reader returns exactly the pixels, shape, dtype and pixel size
// that tifffile + the repo's Python (image_utils.read_tiff_bytes, tiff_meta.pixel_size_um) get from 16 fixtures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readTiff, TiffError, UnsupportedTiff } from './tiff_reader.js';
import { range } from './image_math.js';

const FIX = new URL('../../tests/fixtures/', import.meta.url);
const expected = JSON.parse(readFileSync(new URL('expected.json', FIX)));
let n = 0;
for (const [name, e] of Object.entries(expected)) {
  const t = await readTiff(readFileSync(new URL(name, FIX)));
  const where = `${name}:`;
  assert.equal(t.pages.length, e.pages, `${where} pages`);
  assert.deepEqual([t.height, t.width, t.samples, t.dtype], [e.height, e.width, e.samples, e.dtype], `${where} layout`);
  t.pages.forEach((p, i) => {
    assert.equal(p.length, e.data[i].length, `${where} page ${i} length`);
    for (let k = 0; k < p.length; k++) if (p[k] !== e.data[i][k]) assert.fail(`${where} page ${i} pixel ${k}: ${p[k]} != ${e.data[i][k]}`);
  });
  assert.equal(t.pixel.source, e.px_source, `${where} pixel size source`);
  if (e.um_per_px === null) assert.equal(t.pixel.um_per_px, null);
  else assert.ok(Math.abs(t.pixel.um_per_px - e.um_per_px) <= 1e-12 * e.um_per_px, `${where} um_per_px ${t.pixel.um_per_px}`);
  if (e.meta) {
    assert.deepEqual(t.meta, e.meta, `${where} basic metadata`);
    let lo = Infinity, hi = -Infinity;
    for (const p of t.pages) { const [a, b] = range(p); lo = Math.min(lo, a); hi = Math.max(hi, b); }
    assert.deepEqual([lo, hi], e.range, `${where} value range`);
  }
  n++;
}
// ImageJ big-stack layout: one IFD, frames back to back. Cut the IFD chain of the ImageJ fixture after page 0.
{
  const b = new Uint8Array(readFileSync(new URL('imagej_um.tif', FIX)));
  const dv = new DataView(b.buffer), off = dv.getUint32(4, true), n = dv.getUint16(off, true);
  dv.setUint32(off + 2 + n * 12, 0, true);
  const t = await readTiff(b), e = expected['imagej_um.tif'];
  assert.equal(t.pages.length, 2, 'single-IFD ImageJ stack frames');
  assert.deepEqual(Array.from(t.pages[1]), e.data[1]);
}
// the demo stack shipped with the site (scripts/make_demo.py)
{
  const t = await readTiff(readFileSync(new URL('demo/demo_stack.tif', import.meta.url)));
  assert.deepEqual([t.pages.length, t.height, t.width, t.dtype, t.pixel.um_per_px, t.frameInterval], [24, 128, 128, 'uint16', 0.1, 0.05]);
}
await assert.rejects(readTiff(new Uint8Array(64)), TiffError);
{ // compression 34925 (LZMA) is a valid TIFF the browser reader does not decode
  const b = new Uint8Array(readFileSync(new URL('u8_2d.tif', FIX)));
  const dv = new DataView(b.buffer), off = dv.getUint32(4, true), n = dv.getUint16(off, true);
  for (let i = 0; i < n; i++) if (dv.getUint16(off + 2 + i * 12, true) === 259) dv.setUint16(off + 2 + i * 12 + 8, 34925, true);
  await assert.rejects(readTiff(b), UnsupportedTiff);
}
await assert.rejects(readTiff(new TextEncoder().encode('PNG not a tiff at all, sorry')), TiffError);
console.log(`tiff_reader: ${n} fixtures match tifffile`);
