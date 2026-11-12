"""FastAPI web app for Web MicroView: serves the front end in static/ and the JSON API under /api.

Run with `python run_web.py` (http://127.0.0.1:8136, local only). `scripts/build_static.py` exports every path in
STATIC_ENDPOINTS to JSON for the GitHub Pages site, so keep that list in step with the GET routes below.

The viewer itself runs in the browser (pure-JS TIFF reader + image_math.js, a tested port of image_utils.py), so the
static site is the full viewer. The server adds tifffile's reading of uploads: the same metadata the Bokeh app shows
(/api/inspect) and decoding of files the browser reader does not support (/api/stack).
"""
import json
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from .tiff_io import DEMO, demo_check, inspect_bytes, pages_bytes

STATIC = Path(__file__).resolve().parent / "static"
TITLE = "Web MicroView"
MAX_UPLOAD = 2 * 1024 ** 3

app = FastAPI(title=TITLE)
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/api/info")
def info():
    """Project summary for the home page: the demo stack and what the reader supports."""
    check = demo_check()
    return {
        "title": TITLE,
        "version": "1",
        "demo": {"file": check["file"], "metadata": check["metadata"], "pixel": check["pixel"],
                 "size_kb": round(DEMO.stat().st_size / 1024),
                 "description": "Synthetic stack made by scripts/make_demo.py (seeded): a dim cell outline and six "
                                "diffusing Gaussian spots, one bleaching. Pixel size 0.1 µm and 0.05 s per frame are "
                                "declared in the file for the demo, not measured."},
        "reader": {"compression": ["none", "LZW", "Deflate", "PackBits"],
                   "types": ["uint8", "uint16", "uint32", "int8", "int16", "int32", "float32", "float64"],
                   "layouts": ["classic TIFF and BigTIFF", "strips or tiles", "chunky or planar samples",
                               "ImageJ hyperstacks, OME-TIFF (pages read in file order)"],
                   "fixtures": len(json.loads((STATIC.parent.parent / "tests" / "fixtures" / "expected.json").read_text()))},
    }


@app.get("/api/demo/check")
def demo_values():
    """Python (image_utils) values on the demo stack, for the in-browser Python-vs-JS check."""
    return demo_check()


async def _read(file: UploadFile) -> bytes:
    data = await file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "File too large (limit 2 GB).")
    return data


@app.post("/api/inspect")
async def inspect(file: UploadFile = File(...)):
    """Metadata of an uploaded TIFF as the Bokeh app reads it (image_utils.read_tiff_bytes) + pixel size."""
    try:
        res = inspect_bytes(await _read(file))
    except HTTPException:
        raise
    except Exception as e:  # tifffile raises many types for bad files
        raise HTTPException(400, f"Could not read this TIFF with tifffile: {e}")
    res["name"] = Path(file.filename or "upload").name
    return res


@app.post("/api/stack")
async def stack(file: UploadFile = File(...)):
    """All pages decoded by tifffile as little-endian bytes; the layout is in the X-Stack header (JSON)."""
    try:
        head, raw = pages_bytes(await _read(file))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Could not decode this TIFF with tifffile: {e}")
    return Response(raw, media_type="application/octet-stream", headers={"X-Stack": json.dumps(head)})


# GET paths (without the /api prefix) written to the static site as api/<path>.json.
STATIC_ENDPOINTS = ["/info", "/demo/check"]
