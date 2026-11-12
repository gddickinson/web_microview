"""Python-vs-JS fixtures: small TIFFs in many layouts plus the values the Python code gets from them.

tests/fixtures/*.tif are written once with tifffile (--write-tifs); tests/fixtures/expected.json holds
what the repo's Python reads and computes from them (tifffile pixels, image_utils.read_tiff_bytes
basic metadata, tiff_meta.pixel_size_um, and normalize/display/ROI statistics/line profiles from
image_utils). The node tests (web/static/*.test.mjs) assert the JS reader and image_math.js give the
same; tests/test_fixtures.py checks expected.json is still what the Python code produces.

Run: python scripts/make_fixtures.py [--write-tifs]
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
FIX = ROOT / "tests" / "fixtures"

from image_utils import (compute_roi_stats, display_frame, line_profile,  # noqa: E402
                         normalize_frame, read_tiff_bytes)
from tiff_meta import pixel_size_um  # noqa: E402

MB = dict(photometric="minisblack")


def write_tifs():
    rng = np.random.default_rng(42)
    FIX.mkdir(parents=True, exist_ok=True)
    u16 = rng.integers(0, 4000, (3, 9, 12)).astype(np.uint16)
    w = lambda name, data, **kw: tifffile.imwrite(FIX / name, data, **kw)  # noqa: E731
    w("u8_2d.tif", rng.integers(0, 256, (9, 12)).astype(np.uint8), **MB)
    w("u16_be_stack.tif", u16, byteorder=">", **MB)
    w("i16_stack.tif", rng.integers(-3000, 3000, (2, 7, 5)).astype(np.int16), **MB)
    w("u32_2d.tif", rng.integers(0, 2**31, (6, 7)).astype(np.uint32), **MB)
    w("f32_stack.tif", rng.normal(0, 5, (2, 9, 12)).astype(np.float32), **MB)
    w("f64_2d.tif", rng.normal(100, 20, (5, 6)), **MB)
    w("u16_zlib_tiled.tif", rng.integers(0, 60000, (2, 24, 40)).astype(np.uint16), compression="zlib", tile=(16, 16), **MB)
    w("u16_lzw_pred.tif", rng.integers(0, 60000, (2, 23, 17)).astype(np.uint16), compression="lzw", predictor=True, rowsperstrip=5, **MB)
    w("f32_zlib_fpred.tif", rng.normal(0, 1, (2, 11, 13)).astype(np.float32), compression="zlib", predictor=True, **MB)
    w("u8_packbits.tif", np.repeat(rng.integers(0, 256, (10, 4)), 5, axis=1).astype(np.uint8), compression="packbits", **MB)
    w("u16_bigtiff.tif", u16[:2], bigtiff=True, **MB)
    w("rgb_contig.tif", rng.integers(0, 256, (9, 12, 3)).astype(np.uint8), photometric="rgb")
    w("rgb_planar.tif", rng.integers(0, 256, (3, 9, 12)).astype(np.uint8), photometric="rgb", planarconfig="separate")
    w("imagej_um.tif", u16[:2], imagej=True, resolution=(1 / 0.16, 1 / 0.16), metadata={"axes": "TYX", "unit": "um"})
    w("imagej_micro.tif", u16[:1], imagej=True, resolution=(1 / 0.2125, 1 / 0.2125), metadata={"axes": "TYX", "unit": r"\u00B5m"})  # as ImageJ writes µm
    w("ome.ome.tif", u16, ome=True, metadata={"axes": "TYX", "PhysicalSizeX": 65.0, "PhysicalSizeXUnit": "nm"}, **MB)


def pages_of(path):
    """Each page as tifffile reads it, samples last (planar-separate pages are transposed)."""
    out = []
    with tifffile.TiffFile(path) as tif:
        for p in tif.pages:
            a = p.asarray()
            if p.planarconfig == 2 and p.samplesperpixel > 1:
                a = np.moveaxis(a, 0, -1)
            out.append(a)
        px = pixel_size_um(tif)
    return out, px


def num(v):
    return None if v is None or (isinstance(v, float) and np.isnan(v)) else float(v)


ROIS = [(2, 1, 5, 4), (2.7, 3.1, 3.6, 4.9), (-3, -2, 6, 5), (8, 6, 10, 10), (20, 20, 3, 3), (0, 0, 12, 9)]
LINES = [(0.5, 0.5, 11.5, 8.5), (3.2, 7.9, 9.4, 1.1), (6.5, 4.5, 6.5, 4.5), (-2, 3, 15, 3), (1, 0, 1, 9)]
GAMMAS = [0.5, 1.0, 1.7]


def analysis(frame):
    f = frame.astype(float)
    res = {"normalize": normalize_frame(f).ravel().tolist(),
           "display": {str(g): display_frame(f, g).ravel().tolist() for g in GAMMAS},
           "roi_stats": [{"box": list(b), "value": [num(v) for v in compute_roi_stats(f, *b)["value"]]} for b in ROIS],
           "profiles": []}
    for ln in LINES:
        d, v = line_profile(f, *ln)
        res["profiles"].append({"line": list(ln), "distance": d.tolist(), "values": v.tolist()})
    return res


def expected():
    out = {}
    for path in sorted(FIX.glob("*.tif")):
        pages, px = pages_of(path)
        p0 = pages[0]
        entry = {"pages": len(pages), "height": p0.shape[0], "width": p0.shape[1],
                 "samples": p0.shape[2] if p0.ndim == 3 else 1, "dtype": str(p0.dtype),
                 "data": [p.ravel().tolist() for p in pages], "um_per_px": px["um_per_px"], "px_source": px["source"]}
        if entry["samples"] == 1:
            stack, meta = read_tiff_bytes(path.read_bytes())
            entry["meta"] = {k: meta[k] for k in ("Dimensions", "Data Type")}
            entry["range"] = [float(stack.min()), float(stack.max())]
            entry["analysis"] = analysis(stack[-1])  # last frame
        out[path.name] = entry
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write-tifs", action="store_true")
    if ap.parse_args().write_tifs:
        write_tifs()
    (FIX / "expected.json").write_text(json.dumps(expected(), separators=(",", ":")))
    print(f"wrote {len(list(FIX.glob('*.tif')))} fixtures + expected.json")


if __name__ == "__main__":
    main()
