// Pure-JS TIFF reader for the viewer (no dependencies; runs in the browser and in node 22).
// Classic TIFF and BigTIFF, either byte order; strips or tiles; chunky or planar samples; 8/16/32-bit integers,
// 32/64-bit floats; no compression, PackBits, LZW, Deflate; horizontal and floating-point predictors; ImageJ
// stacks saved with a single IFD. Each page comes back as one typed array, row 0 first (the top of the image, as in
// ImageJ/Fiji), samples interleaved. Tested against tifffile in tiff_reader.test.mjs.
import { floatPredictor, inflate, lzw, packbits } from './tiff_codecs.js';
import { COMPRESSION, TAG_NAMES, frameInterval, pixelSize } from './tiff_tags.js';

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4, 16: 8, 17: 8, 18: 8 };
const DTYPES = { '1,8': ['uint8', Uint8Array], '1,16': ['uint16', Uint16Array], '1,32': ['uint32', Uint32Array],
  '2,8': ['int8', Int8Array], '2,16': ['int16', Int16Array], '2,32': ['int32', Int32Array],
  '3,32': ['float32', Float32Array], '3,64': ['float64', Float64Array] };

export class TiffError extends Error {}
// A valid TIFF this reader cannot decode (compression or sample type): the local app hands these to tifffile.
export class UnsupportedTiff extends TiffError {}

function readValues(dv, le, big, type, count, at) {
  const out = [];
  const u64 = p => Number(dv.getBigUint64(p, le)), i64 = p => Number(dv.getBigInt64(p, le));
  for (let i = 0; i < count; i++) {
    const s = TYPE_SIZE[type], p = at + i * s;
    switch (type) {
      case 1: case 7: case 2: out.push(dv.getUint8(p)); break;
      case 6: out.push(dv.getInt8(p)); break;
      case 3: out.push(dv.getUint16(p, le)); break;
      case 8: out.push(dv.getInt16(p, le)); break;
      case 4: case 13: out.push(dv.getUint32(p, le)); break;
      case 9: out.push(dv.getInt32(p, le)); break;
      case 5: { const r = [dv.getUint32(p, le), dv.getUint32(p + 4, le)]; r.rational = true; out.push(r); break; }
      case 10: { const r = [dv.getInt32(p, le), dv.getInt32(p + 4, le)]; r.rational = true; out.push(r); break; }
      case 11: out.push(dv.getFloat32(p, le)); break;
      case 12: out.push(dv.getFloat64(p, le)); break;
      case 16: case 18: out.push(u64(p)); break;
      case 17: out.push(i64(p)); break;
      default: return null;
    }
  }
  if (type === 2) return new TextDecoder('latin1').decode(new Uint8Array(out)).replace(/\0+$/, '');
  return out;
}

function readIfds(dv, le, big) {
  const ifds = [];
  let off = big ? Number(dv.getBigUint64(8, le)) : dv.getUint32(4, le);
  const seen = new Set();
  while (off && !seen.has(off) && off < dv.byteLength) {
    seen.add(off);
    const n = big ? Number(dv.getBigUint64(off, le)) : dv.getUint16(off, le);
    const entry = big ? 20 : 12, head = big ? 8 : 2, inline = big ? 8 : 4;
    const tags = new Map();
    for (let i = 0; i < n; i++) {
      const p = off + head + i * entry;
      const code = dv.getUint16(p, le), type = dv.getUint16(p + 2, le);
      const count = big ? Number(dv.getBigUint64(p + 4, le)) : dv.getUint32(p + 4, le);
      const size = (TYPE_SIZE[type] || 0) * count;
      if (!size) continue;
      const vp = p + (big ? 12 : 8);
      const at = size <= inline ? vp : (big ? Number(dv.getBigUint64(vp, le)) : dv.getUint32(vp, le));
      if (at + size > dv.byteLength) continue;
      const v = readValues(dv, le, big, type, count, at);
      if (v !== null) tags.set(code, (Array.isArray(v) && v.length === 1 && !(code === 273 || code === 279 || code === 324 || code === 325)) ? v[0] : v);
    }
    ifds.push(tags);
    const np = off + head + n * entry;
    off = big ? Number(dv.getBigUint64(np, le)) : dv.getUint32(np, le);
  }
  return ifds;
}

const first = v => (Array.isArray(v) && !v.rational ? v[0] : v);
const arr = v => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function layout(t) {
  const L = { width: t.get(256), height: t.get(257), bps: first(t.get(258) ?? 1), spp: t.get(277) ?? 1,
    compression: t.get(259) ?? 1, planar: t.get(284) ?? 1, predictor: t.get(317) ?? 1, format: first(t.get(339) ?? 1),
    photometric: t.get(262) };
  const dt = DTYPES[`${L.format},${L.bps}`];
  if (!dt) throw new UnsupportedTiff(`Unsupported sample type (SampleFormat ${L.format}, ${L.bps} bits)`);
  if (!(L.compression in COMPRESSION)) throw new UnsupportedTiff(`Unsupported compression ${L.compression} (supported: none, LZW, Deflate, PackBits)`);
  [L.dtype, L.ctor] = dt;
  L.bytes = L.bps / 8;
  L.tiled = t.has(322);
  if (L.tiled) {
    L.cw = t.get(322); L.ch = t.get(323); L.offsets = arr(t.get(324)); L.counts = arr(t.get(325));
  } else {
    L.cw = L.width; L.ch = Math.min(t.get(278) ?? L.height, L.height); L.offsets = arr(t.get(273)); L.counts = arr(t.get(279));
  }
  return L;
}

// Raw sample bytes -> typed values in host order.
function toTyped(bytes, n, L, le) {
  const out = new L.ctor(n);
  if (L.bytes === 1) { out.set(new L.ctor(bytes.buffer, bytes.byteOffset, n)); return out; }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, n * L.bytes));
  const get = { int16: 'getInt16', uint16: 'getUint16', int32: 'getInt32', uint32: 'getUint32', float32: 'getFloat32', float64: 'getFloat64' }[L.dtype];
  const m = Math.min(n, Math.floor(dv.byteLength / L.bytes));
  for (let i = 0; i < m; i++) out[i] = dv[get](i * L.bytes, le);
  return out;
}

async function decodeChunk(src, L, le, rows, rowSamples, lspp) {
  const need = rows * rowSamples * L.bytes;
  let b;
  if (L.compression === 1) b = src.slice(0, need);
  else if (L.compression === 32773) b = packbits(src, need);
  else if (L.compression === 5) b = lzw(src, need);
  else b = await inflate(src);
  if (L.predictor === 3) return floatPredictor(b, rows, rowSamples, lspp, L.bytes, L.ctor);
  const v = toTyped(b, rows * rowSamples, L, le);
  if (L.predictor === 2) {
    for (let r = 0; r < rows; r++) for (let i = r * rowSamples + lspp, end = (r + 1) * rowSamples; i < end; i++) v[i] += v[i - lspp];
  }
  return v;
}

async function readPage(u8, L, le) {
  const { width: w, height: h, spp, cw, ch } = L;
  const out = new L.ctor(w * h * spp);
  const lspp = L.planar === 2 ? 1 : spp;
  const across = Math.ceil(w / cw), down = Math.ceil(h / ch);
  const perPlane = across * down;
  for (let i = 0; i < L.offsets.length; i++) {
    const plane = L.planar === 2 ? Math.floor(i / perPlane) : 0;
    const k = i % perPlane, r0 = Math.floor(k / across) * ch, c0 = (k % across) * cw;
    const rows = L.tiled ? ch : Math.min(ch, h - r0);
    const src = u8.subarray(L.offsets[i], L.offsets[i] + (L.counts[i] ?? 0));
    const v = await decodeChunk(src, L, le, rows, cw * lspp, lspp);
    const rmax = Math.min(rows, h - r0), cmax = Math.min(cw, w - c0);
    for (let r = 0; r < rmax; r++) {
      for (let c = 0; c < cmax; c++) {
        const o = ((r0 + r) * w + c0 + c) * spp + plane, s = (r * cw + c) * lspp;
        for (let q = 0; q < lspp; q++) out[o + q] = v[s + q];
      }
    }
  }
  return out;
}

// Shape string as numpy prints tifffile's array shape, e.g. "(3, 9, 12)".
function shapeText(n, h, w, s) {
  const dims = [...(n > 1 ? [n] : []), h, w, ...(s > 1 ? [s] : [])];
  return `(${dims.join(', ')})`;
}

export async function readTiff(buffer, { maxBytes = 2e9 } = {}) {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (u8.length < 16) throw new TiffError('Not a TIFF file (too short)');
  const bo = String.fromCharCode(u8[0], u8[1]);
  if (bo !== 'II' && bo !== 'MM') throw new TiffError('Not a TIFF file (no II/MM byte-order mark)');
  const le = bo === 'II', magic = dv.getUint16(2, le);
  if (magic !== 42 && magic !== 43) throw new TiffError(`Not a TIFF file (magic number ${magic})`);
  const big = magic === 43;
  const ifds = readIfds(dv, le, big).filter(t => !(Number(t.get(254) ?? 0) & 1)); // skip reduced-resolution pages
  if (!ifds.length) throw new TiffError('No images in this TIFF');
  const L = layout(ifds[0]);
  const description = typeof ifds[0].get(270) === 'string' ? ifds[0].get(270) : '';
  const frameBytes = L.width * L.height * L.spp * L.bytes;
  const pages = [];
  const ij = description.startsWith('ImageJ=') ? +((description.match(/^images=(\d+)$/m) || [])[1] || 0) : 0;
  if (ifds.length === 1 && ij > 1 && L.compression === 1 && !L.tiled && L.planar === 1) {
    // ImageJ writes one IFD for big stacks: the frames follow each other from the first strip.
    const start = L.offsets[0];
    const n = Math.min(ij, Math.floor((u8.length - start) / frameBytes));
    if (n * frameBytes > maxBytes) throw new TiffError('Stack too large for the browser');
    for (let i = 0; i < n; i++) pages.push(toTyped(u8.subarray(start + i * frameBytes, start + (i + 1) * frameBytes), frameBytes / L.bytes, L, le));
  } else {
    if (ifds.length * frameBytes > maxBytes) throw new TiffError('Stack too large for the browser');
    for (const t of ifds) {
      const P = layout(t);
      if (P.width !== L.width || P.height !== L.height || P.spp !== L.spp || P.dtype !== L.dtype) break; // other series
      pages.push(await readPage(u8, P, le));
    }
  }
  const tags = [...ifds[0].entries()].map(([code, value]) => ({ code, name: TAG_NAMES[code] || `Tag ${code}`, value }));
  return {
    width: L.width, height: L.height, samples: L.spp, dtype: L.dtype, pages, littleEndian: le, bigTiff: big,
    compression: COMPRESSION[L.compression], photometric: L.photometric, description, tags,
    pixel: pixelSize(description, ifds[0]), frameInterval: frameInterval(description),
    meta: { Dimensions: shapeText(pages.length, L.height, L.width, L.spp), 'Data Type': L.dtype },
  };
}
