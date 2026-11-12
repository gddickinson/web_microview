"""Project-specific web API tests: upload inspection and server-side decoding match the repo's Python readers."""
import json
import sys
from pathlib import Path

import numpy as np
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from image_utils import compute_roi_stats, read_tiff_bytes  # noqa: E402
from web.app import app  # noqa: E402
from web.tiff_io import DEMO, DEMO_BOXES  # noqa: E402

client = TestClient(app)
FIX = ROOT / "tests" / "fixtures"


def post(path, name):
    return client.post("/api" + path, files={"file": (name, (FIX / name).read_bytes(), "image/tiff")})


def test_inspect_matches_bokeh_metadata():
    r = post("/inspect", "imagej_um.tif")
    assert r.status_code == 200, r.text
    js = r.json()
    _, meta = read_tiff_bytes((FIX / "imagej_um.tif").read_bytes())
    assert js["metadata"] == meta
    assert js["pixel"] == {"um_per_px": 0.16, "source": "ImageJ unit + XResolution"}
    assert js["name"] == "imagej_um.tif" and js["pages"] == 2


def test_inspect_rejects_non_tiff():
    r = client.post("/api/inspect", files={"file": ("x.tif", b"not a tiff at all", "image/tiff")})
    assert r.status_code == 400


def test_stack_bytes_match_fixture_pixels():
    expected = json.loads((FIX / "expected.json").read_text())
    for name in ("u16_be_stack.tif", "rgb_planar.tif", "f32_zlib_fpred.tif"):
        r = post("/stack", name)
        assert r.status_code == 200, r.text
        head, e = json.loads(r.headers["X-Stack"]), expected[name]
        assert (head["pages"], head["height"], head["width"], head["samples"], head["dtype"]) == \
            (e["pages"], e["height"], e["width"], e["samples"], e["dtype"])
        arr = np.frombuffer(r.content, dtype=np.dtype(head["dtype"]).newbyteorder("<"))
        np.testing.assert_array_equal(arr, np.concatenate([np.array(d) for d in e["data"]]))


def test_demo_check_uses_image_utils():
    c = client.get("/api/demo/check").json()
    stack, _ = read_tiff_bytes(DEMO.read_bytes())
    want = compute_roi_stats(stack[11].astype(float), *DEMO_BOXES[0])["value"]
    assert c["frames"][1]["frame"] == 11 and c["frames"][1]["roi_stats"][0]["value"] == want
    assert c["pixel"]["um_per_px"] == 0.1
