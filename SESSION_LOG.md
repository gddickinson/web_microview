# Session log

## 2026-11-11/12 -- web interface + bug fixes (Claude, branch `web-interface`)

Bug fixes in existing code (each with regression tests, separate commits):
- ROI clipping: a box starting left of / above the image measured pixels outside the box; a box missing the
  image raised ValueError. Now clipped correctly / NaN stats. In-bounds boxes give the same pixels as before.
- Bokeh dashboard: images were shown upside down (Bokeh draws row 0 at the bottom); contrast slider could hit
  0 (ZeroDivisionError) and was lost on frame change (now a gamma 0.1-2 applied after normalisation, so
  negative-valued data no longer turn NaN); ROI stats did not follow the frame; single-frame upload after a
  stack left a stale slider index (IndexError); stats chart y-axis fixed at 0-1.
- README claimed crosshair tools (none) and Python 3.7+ (Bokeh 3.2 needs 3.9).

Web interface (port 8136): FastAPI app (`web/`), browser viewer with a pure-JS TIFF reader (16 fixture TIFFs match
tifffile) and `image_math.js` (matches `image_utils.py` to < 1e-9 relative), synthetic demo stack, static
GitHub Pages export. Tests moved to `tests/`. Added `tiff_meta.py` (pixel size from OME/ImageJ metadata) and
`image_utils.line_profile`.

Verified: the Bokeh app still serves (`bokeh serve app.py`, bokeh 3.10.2, numpy 1.26 from requirements.txt) and
its tests pass in that environment.

Open questions for George:
- RGB/multi-sample TIFFs: `decode_uploaded_file` treats an (H, W, 3) image as H frames of W x 3 in the Bokeh app.
  The web viewer shows such files with a channel selector; how should the Bokeh app handle them?
