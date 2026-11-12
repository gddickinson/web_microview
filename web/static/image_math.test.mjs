// node web/static/image_math.test.mjs: normalize/display/ROI statistics/line profiles match image_utils.py
// (values in tests/fixtures/expected.json, computed from the last frame of each grayscale fixture).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readTiff } from './tiff_reader.js';
import { clipRoi, display, lineProfile, normalize, roiStats, roundHalfEven } from './image_math.js';

const FIX = new URL('../../tests/fixtures/', import.meta.url);
const expected = JSON.parse(readFileSync(new URL('expected.json', FIX)));
const close = (a, b, what) => {
  if (b === null) { assert.ok(Number.isNaN(a), `${what}: ${a} should be NaN`); return; }
  assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
};
const closeAll = (a, b, what) => { assert.equal(a.length, b.length, `${what} length`); b.forEach((v, i) => close(a[i], v, `${what}[${i}]`)); };

let checks = 0;
for (const [name, e] of Object.entries(expected)) {
  if (!e.analysis) continue;
  const t = await readTiff(readFileSync(new URL(name, FIX)));
  const f = Float64Array.from(t.pages.at(-1)), A = e.analysis, R = t.height, C = t.width;
  closeAll(normalize(f), A.normalize, `${name} normalize`);
  for (const [g, v] of Object.entries(A.display)) closeAll(display(f, +g), v, `${name} display gamma ${g}`);
  for (const s of A.roi_stats) closeAll(roiStats(f, R, C, s.box), s.value, `${name} roi ${s.box}`);
  for (const p of A.profiles) {
    const r = lineProfile(f, R, C, ...p.line);
    closeAll(r.distance, p.distance, `${name} profile distance ${p.line}`);
    closeAll(r.values, p.values, `${name} profile values ${p.line}`);
  }
  checks++;
}
assert.deepEqual(clipRoi(10, 10, -5, -2, 10, 5), [0, 0, 5, 3]);
assert.deepEqual([0.5, 1.5, 2.5, 3.2].map(roundHalfEven), [0, 2, 2, 3]);
assert.throws(() => display(new Float64Array(4), 0));
console.log(`image_math: ${checks} frames match image_utils.py`);
