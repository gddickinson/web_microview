"""The Python-vs-JS fixtures are current: expected.json is what the repo's Python computes from tests/fixtures/*.tif,
and the demo stack is what scripts/make_demo.py makes (numbers compared with a tolerance, never as text)."""
import json
import sys
from pathlib import Path

import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import make_demo  # noqa: E402
import make_fixtures  # noqa: E402


def same(a, b, path="$"):
    if isinstance(a, dict):
        assert a.keys() == b.keys(), path
        for k in a:
            same(a[k], b[k], f"{path}.{k}")
    elif isinstance(a, list):
        assert len(a) == len(b), path
        for i, (x, y) in enumerate(zip(a, b)):
            same(x, y, f"{path}[{i}]")
    elif isinstance(a, float) or isinstance(b, float):
        assert np.isclose(a, b, rtol=1e-9, atol=1e-12), f"{path}: {a} != {b}"
    else:
        assert a == b, path


def test_expected_json_is_current():
    committed = json.loads((make_fixtures.FIX / "expected.json").read_text())
    same(json.loads(json.dumps(make_fixtures.expected())), committed)


def test_demo_stack_is_current():
    stored = tifffile.imread(make_demo.OUT)
    np.testing.assert_array_equal(stored, make_demo.make_stack())
