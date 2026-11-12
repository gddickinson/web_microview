# Web MicroView -- Interface Map

Two front ends share the same image functions: the original Bokeh dashboard (`app.py`) and a FastAPI web app
with a browser viewer (`web/`), whose JS port of `image_utils.py` is tested against the Python values.

## Project Structure

| File | Purpose |
|------|---------|
| `app.py` | Bokeh server app -- `MicroscopyDashboard` class, layout, callbacks (`bokeh serve app.py`) |
| `image_utils.py` | TIFF loading, normalisation, gamma display, ROI clipping/statistics/extraction, line profile |
| `tiff_meta.py` | `pixel_size_um(tif)`: physical pixel size declared in OME-XML or ImageJ metadata |
| `roi_tools.py` | ROI `BoxAnnotation` creation (Bokeh) |
| `run_web.py` | Starts the web app on 127.0.0.1:8136 |
| `web/app.py` | FastAPI: `/` front end, `/api/info`, `/api/demo/check`, `POST /api/inspect`, `POST /api/stack`; `STATIC_ENDPOINTS` |
| `web/tiff_io.py` | Upload helpers on image_utils/tiff_meta: `inspect_bytes`, `pages_bytes`, `demo_check` |
| `web/static/` | Browser viewer (see below) |
| `scripts/make_demo.py` | Writes the synthetic demo stack `web/static/demo/demo_stack.tif` |
| `scripts/make_fixtures.py` | Writes `tests/fixtures/*.tif` (`--write-tifs`) and `expected.json` (Python values for the JS tests) |
| `scripts/build_static.py` | Exports the static GitHub Pages site to `site/` |
| `scripts/screenshots.py` | Playwright smoke test (console errors, phone width) and README images in `docs/img/` |
| `tests/` | pytest: image utils, ROI clipping, Bokeh dashboard (skips without bokeh), web API, fixtures current |

## Browser viewer (`web/static/`)

| File | Purpose |
|------|---------|
| `index.html`, `style.css`, `core.js` | Shared web-kit shell, theme, hash router and `api()` |
| `style_app.css`, `icon.svg` | Project colours and page styles |
| `main.js` | Registers the lazy pages, mode label, background |
| `state.js` | Current stack (`loadDemo`, `loadFile`; server fallback via `/api/stack` for `UnsupportedTiff`) |
| `tiff_reader.js` | `readTiff(buffer)`: classic/BigTIFF, strips/tiles, chunky/planar, 8-64 bit, ImageJ single-IFD stacks |
| `tiff_codecs.js` | PackBits, LZW, Deflate (`DecompressionStream`), floating-point predictor |
| `tiff_tags.js` | Tag names, `pixelSize()` (mirrors `tiff_meta.pixel_size_um`), `frameInterval()` |
| `image_math.js` | Port of `image_utils.py`: `normalize`, `display`, `clipRoi`, `roiStats`, `lineProfile`, ... |
| `viewer.js` | Viewer page: controls, frames/playback, gamma, LUT, tools |
| `viewer_canvas.js` | Image stage: LUT painting, ROI/line overlay, pointer interaction |
| `viewer_panels.js` | ROI view, ROI statistics, mean over frames, profile, CSV/PNG export, file summary |
| `charts.js` | Small SVG bar and line charts |
| `metadata.js`, `check.js`, `home.js`, `about.js` | Metadata, Python-vs-JS check, home and about pages |
| `static_api.js` | Static site: answers `api()` from exported JSON; `/inspect` via the JS reader |
| `*.test.mjs` | node tests against `tests/fixtures/expected.json` and the demo stack |

## Key Classes and Functions

### app.py
- `MicroscopyDashboard` -- main Bokeh dashboard
  - `.handle_file_upload()` -- decodes uploaded TIFF via `image_utils.decode_uploaded_file`
  - `.update_frame()` / `.update_image_source()` -- frame display (gamma via `display_frame`, flipped so row 0 is on top)
  - `.frame_at()` / `.update_channel()` -- channel selector for RGB / multi-sample files
  - `.update_roi()` -- box selection -> image pixels via `selection_to_roi`
  - `.update_roi_view()` / `.update_roi_stats()` -- ROI analysis using `image_utils`
  - `.setup_layout()` -- assembles Bokeh widgets into tabs

### image_utils.py
- `decode_uploaded_file(data_string)` -- base64 decode -> `read_tiff_bytes`
- `read_tiff_bytes(binary)` -- tifffile read -> (stack, metadata); stack (frames, H, W) or (frames, H, W, samples) for RGB
- `frame_channel(stack, index, channel)` -- 2D frame (one channel of a multi-sample frame)
- `normalize_frame(frame)` / `display_frame(frame, gamma)` -- [0, 1] scaling for display
- `selection_to_roi(x0, x1, y0, y1, image_height)` -- Bokeh plot box -> image pixels
- `clip_roi`, `extract_roi`, `compute_roi_stats(frame, x0, y0, w, h)` -- mean, std, min, max, median
- `line_profile(frame, x0, y0, x1, y1)` -- bilinear intensity profile

## Module Connections
- `app.py` imports from `image_utils` and `roi_tools`
- `web/app.py` -> `web/tiff_io.py` -> `image_utils`, `tiff_meta`
- `web/static/image_math.js` and `tiff_tags.pixelSize` mirror `image_utils` / `tiff_meta` (checked by node tests)
- Launch: `bokeh serve app.py` (Bokeh) or `python run_web.py` (web)
