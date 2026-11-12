"""Upload helpers for the web app, built on the repo's own image_utils and tiff_meta.

- inspect_bytes: what the Bokeh app's Metadata tab shows (image_utils.read_tiff_bytes) plus the
  physical pixel size (tiff_meta.pixel_size_um) and tifffile's series axes.
- pages_bytes: every page decoded by tifffile, for files the in-browser reader cannot decode
  (e.g. JPEG-compressed, if imagecodecs is installed); samples last, row 0 at the top.
- demo_check: the Python values the browser's "Python vs JS" page compares against.
"""
import io
import sys
from pathlib import Path

import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from image_utils import compute_roi_stats, line_profile, read_tiff_bytes  # noqa: E402
from tiff_meta import pixel_size_um  # noqa: E402

DEMO = Path(__file__).resolve().parent / "static" / "demo" / "demo_stack.tif"
JS_DTYPES = {"uint8", "uint16", "uint32", "int8", "int16", "int32", "float32", "float64"}

# boxes (x0, y0, width, height) and lines (x0, y0, x1, y1) in pixels, corner origin, row 0 at the top
DEMO_BOXES = [(40, 50, 30, 20), (0, 0, 128, 128), (-10, 100, 40, 40), (52.5, 61.2, 7.7, 9.4)]
DEMO_LINES = [(10.0, 66.0, 118.0, 66.0), (30.5, 20.25, 90.0, 110.75)]
DEMO_FRAMES = [0, 11, 23]


def _clean(v):
    return None if isinstance(v, float) and np.isnan(v) else v


def inspect_bytes(data: bytes) -> dict:
    stack, meta = read_tiff_bytes(data)
    with tifffile.TiffFile(io.BytesIO(data)) as tif:
        px = pixel_size_um(tif)
        series = tif.series[0]
        axes, shape = series.axes, list(series.shape)
        pages = len(tif.pages)
    return {"metadata": meta, "pixel": px, "axes": axes, "series_shape": shape, "pages": pages,
            "stack_shape": list(stack.shape), "reader": f"tifffile {tifffile.__version__}"}


def pages_bytes(data: bytes):
    """(header dict, raw little-endian bytes) for all pages with the first page's shape and dtype."""
    with tifffile.TiffFile(io.BytesIO(data)) as tif:
        first = tif.pages[0]
        out = []
        for p in tif.pages:
            if p.shape != first.shape or p.dtype != first.dtype:
                break
            a = p.asarray()
            if p.planarconfig == 2 and p.samplesperpixel > 1:
                a = np.moveaxis(a, 0, -1)
            out.append(a)
        px = pixel_size_um(tif)
    arr = np.stack(out)
    if arr.ndim == 3:
        arr = arr[..., None]
    if str(arr.dtype) not in JS_DTYPES:
        arr = arr.astype(np.float64)
    arr = np.ascontiguousarray(arr, dtype=arr.dtype.newbyteorder("<"))
    head = {"pages": arr.shape[0], "height": arr.shape[1], "width": arr.shape[2], "samples": arr.shape[3],
            "dtype": str(arr.dtype.newbyteorder("=")), "um_per_px": px["um_per_px"], "px_source": px["source"]}
    return head, arr.tobytes()


def demo_check() -> dict:
    data = DEMO.read_bytes()
    stack, meta = read_tiff_bytes(data)
    with tifffile.TiffFile(io.BytesIO(data)) as tif:
        px = pixel_size_um(tif)
    frames = []
    for i in DEMO_FRAMES:
        f = stack[i].astype(float)
        frames.append({
            "frame": i,
            "roi_stats": [{"box": list(b), "value": [_clean(v) for v in compute_roi_stats(f, *b)["value"]]}
                          for b in DEMO_BOXES],
            "profiles": [{"line": list(ln), "values": line_profile(f, *ln)[1].tolist()} for ln in DEMO_LINES],
        })
    return {"file": "static/demo/demo_stack.tif", "metadata": {k: meta[k] for k in ("Dimensions", "Data Type", "Value Range")},
            "pixel": px, "frames": frames, "python": f"numpy {np.__version__}, tifffile {tifffile.__version__}"}
