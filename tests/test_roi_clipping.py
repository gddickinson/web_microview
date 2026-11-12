"""Regression tests: a ROI that starts left of / above the image, or misses it, is clipped correctly."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from image_utils import compute_roi_stats, extract_roi  # noqa: E402


def test_negative_origin_keeps_only_the_overlap():
    frame = np.arange(100, dtype=float).reshape(10, 10)
    # box covers x in [-5, 5) and y in [-2, 3): the overlap is columns 0-4, rows 0-2
    roi, w, h = extract_roi(frame, x0=-5, y0=-2, width=10, height=5)
    assert (w, h) == (5, 3)
    np.testing.assert_array_equal(roi, frame[0:3, 0:5])
    stats = compute_roi_stats(frame, x0=-5, y0=-2, width=10, height=5)
    assert stats["value"][0] == frame[0:3, 0:5].mean()


def test_roi_outside_image_gives_nan_not_an_exception():
    frame = np.ones((10, 10))
    roi, w, h = extract_roi(frame, x0=20, y0=20, width=5, height=5)
    assert (w, h) == (0, 0) and roi.size == 0
    stats = compute_roi_stats(frame, x0=20, y0=20, width=5, height=5)
    assert len(stats["value"]) == 5 and all(np.isnan(v) for v in stats["value"])
