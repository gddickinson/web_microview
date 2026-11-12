// TIFF strip/tile codecs in plain JS: PackBits, LZW (TIFF variant, MSB-first, early change) and Deflate
// (via the platform DecompressionStream, so inflate() is async), plus the floating-point predictor (3).
// The horizontal predictor (2) is undone on typed values in tiff_reader.js.

export function packbits(src, outLen) {
  const out = new Uint8Array(outLen);
  let i = 0, o = 0;
  while (i < src.length && o < outLen) {
    const n = (src[i++] << 24) >> 24; // as int8
    if (n >= 0) {
      for (let k = 0; k <= n && o < outLen; k++) out[o++] = src[i++];
    } else if (n !== -128) {
      const v = src[i++];
      for (let k = 0; k < 1 - n && o < outLen; k++) out[o++] = v;
    }
  }
  return out;
}

export function lzw(src, outLen) {
  const out = new Uint8Array(outLen);
  const prefix = new Int32Array(4096), suffix = new Uint8Array(4096), len = new Int32Array(4096), first = new Uint8Array(4096);
  for (let i = 0; i < 256; i++) { prefix[i] = -1; suffix[i] = i; len[i] = 1; first[i] = i; }
  let next = 258, width = 9, bit = 0, old = -1, o = 0;
  const total = src.length * 8;
  const write = code => {
    const n = len[code];
    let p = o + n - 1, c = code;
    while (c >= 0) { if (p < outLen) out[p] = suffix[c]; p--; c = prefix[c]; }
    o += n;
  };
  const add = (pre, ch) => {
    if (next >= 4096) return;
    prefix[next] = pre; suffix[next] = ch; len[next] = len[pre] + 1; first[next] = first[pre]; next++;
  };
  while (bit + width <= total) {
    const b = bit >> 3;
    const word = (src[b] << 16) | ((src[b + 1] || 0) << 8) | (src[b + 2] || 0);
    const code = (word >>> (24 - (bit & 7) - width)) & ((1 << width) - 1);
    bit += width;
    if (code === 257) break;
    if (code === 256) { next = 258; width = 9; old = -1; continue; }
    if (old === -1) { write(code); old = code; continue; }
    if (code < next) { add(old, first[code]); write(code); } else { add(old, first[old]); write(next - 1); }
    old = code;
    if (next >= (1 << width) - 1 && width < 12) width++;
    if (o >= outLen) break;
  }
  return out;
}

export async function inflate(src) {
  const ds = new DecompressionStream('deflate');
  const stream = new Blob([src]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Floating-point predictor: per row, undo byte-wise differencing (stride = samples), then reassemble each value
// from its byte planes (most significant first). Returns a typed array of `ctor` values for the chunk.
export function floatPredictor(bytes, rows, rowSamples, samples, bytesPer, ctor) {
  const out = new ctor(rows * rowSamples);
  const rowBytes = rowSamples * bytesPer;
  const tmp = new Uint8Array(bytesPer), view = new DataView(tmp.buffer);
  for (let r = 0; r < rows; r++) {
    const b = bytes.subarray(r * rowBytes, (r + 1) * rowBytes);
    for (let i = samples; i < rowBytes; i++) b[i] = (b[i] + b[i - samples]) & 255;
    for (let k = 0; k < rowSamples; k++) {
      for (let j = 0; j < bytesPer; j++) tmp[j] = b[j * rowSamples + k];
      out[r * rowSamples + k] = bytesPer === 4 ? view.getFloat32(0, false) : view.getFloat64(0, false);
    }
  }
  return out;
}
