// The image stage: draws a frame through a lookup table at native resolution (shown pixelated, row 0 at the top),
// and an overlay canvas at screen resolution for the ROI box and the profile line. Pointer drags draw a ROI
// (snapped to pixel edges) or a line; hovering reports the pixel under the cursor.

export const LUTS = {
  grey: v => [v, v, v],
  inverted: v => [1 - v, 1 - v, 1 - v],
  green: v => [0, v, 0],
  magenta: v => [v, 0, v],
  hot: v => [Math.min(1, 3 * v), Math.min(1, Math.max(0, 3 * v - 1)), Math.max(0, 3 * v - 2)],
};

// Pixels in [0, 1] -> RGBA through a 256-entry table.
export function paint(ctx, disp, w, h, lut = 'grey') {
  const table = new Uint8ClampedArray(256 * 3), f = LUTS[lut] || LUTS.grey;
  for (let i = 0; i < 256; i++) { const c = f(i / 255); table.set(c.map(x => Math.round(x * 255)), i * 3); }
  const img = ctx.createImageData(w, h), d = img.data;
  for (let i = 0; i < w * h; i++) {
    const v = disp[i], k = (Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 255) : 0) * 3;
    d[i * 4] = table[k]; d[i * 4 + 1] = table[k + 1]; d[i * 4 + 2] = table[k + 2]; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function createStage(host, { onHover, onRoi, onLine, tool }) {
  host.innerHTML = `<canvas class="img" aria-label="Image frame (drag to draw a ROI box or a profile line)"></canvas>
    <canvas class="ovl" tabindex="0" aria-label="ROI and line overlay; arrow keys change frame"></canvas>`;
  const [img, ovl] = host.querySelectorAll('canvas');
  const ictx = img.getContext('2d'), octx = ovl.getContext('2d');
  let w = 1, h = 1, roi = null, line = null, drag = null;

  const toImage = e => {
    const r = ovl.getBoundingClientRect();
    return [Math.min(w, Math.max(0, (e.clientX - r.left) / r.width * w)), Math.min(h, Math.max(0, (e.clientY - r.top) / r.height * h))];
  };
  const boxFrom = (a, b) => {
    const x0 = Math.floor(Math.min(a[0], b[0])), y0 = Math.floor(Math.min(a[1], b[1]));
    return [x0, y0, Math.max(1, Math.ceil(Math.max(a[0], b[0])) - x0), Math.max(1, Math.ceil(Math.max(a[1], b[1])) - y0)];
  };

  function drawOverlay() {
    const r = ovl.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    ovl.width = Math.max(1, Math.round(r.width * dpr)); ovl.height = Math.max(1, Math.round(r.height * dpr));
    const sx = ovl.width / w, sy = ovl.height / h;
    octx.clearRect(0, 0, ovl.width, ovl.height);
    const css = getComputedStyle(document.documentElement);
    octx.lineWidth = 2 * dpr;
    if (roi) {
      octx.strokeStyle = css.getPropertyValue('--accent').trim() || '#4dff9a';
      octx.fillStyle = 'rgba(77,255,154,.08)';
      octx.fillRect(roi[0] * sx, roi[1] * sy, roi[2] * sx, roi[3] * sy);
      octx.strokeRect(roi[0] * sx, roi[1] * sy, roi[2] * sx, roi[3] * sy);
    }
    if (line) {
      octx.strokeStyle = css.getPropertyValue('--accent2').trim() || '#ff4fd8';
      octx.beginPath(); octx.moveTo(line[0] * sx, line[1] * sy); octx.lineTo(line[2] * sx, line[3] * sy); octx.stroke();
      octx.fillStyle = octx.strokeStyle;
      for (const [x, y] of [[line[0], line[1]], [line[2], line[3]]]) { octx.beginPath(); octx.arc(x * sx, y * sy, 3 * dpr, 0, 7); octx.fill(); }
    }
  }

  ovl.addEventListener('pointerdown', e => {
    if (tool() === 'inspect') return;
    ovl.setPointerCapture(e.pointerId);
    drag = toImage(e);
    e.preventDefault();
  });
  ovl.addEventListener('pointermove', e => {
    const p = toImage(e);
    onHover(Math.min(w - 1, Math.floor(p[0])), Math.min(h - 1, Math.floor(p[1])));
    if (!drag) return;
    if (tool() === 'roi') roi = boxFrom(drag, p); else line = [...drag, ...p];
    drawOverlay();
  });
  ovl.addEventListener('pointerleave', () => onHover(null, null));
  ovl.addEventListener('pointerup', e => {
    if (!drag) return;
    const p = toImage(e), a = drag;
    drag = null;
    if (tool() === 'roi') { roi = boxFrom(a, p); onRoi(roi); } else if (Math.hypot(p[0] - a[0], p[1] - a[1]) > 0.5) { line = [...a, ...p]; onLine(line); }
    drawOverlay();
  });
  const ro = new ResizeObserver(drawOverlay);
  ro.observe(host);

  return {
    canvas: img, overlay: ovl,
    show(disp, width, height, lut) {
      if (img.width !== width || img.height !== height) { img.width = width; img.height = height; }
      w = width; h = height;
      host.style.aspectRatio = `${width} / ${height}`;
      paint(ictx, disp, width, height, lut);
      drawOverlay();
    },
    setShapes(r, l) { roi = r; line = l; drawOverlay(); },
    destroy() { ro.disconnect(); },
  };
}
