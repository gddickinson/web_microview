"""Regression tests: an RGB / multi-sample TIFF is one colour image (frames, H, W, S), not H frames of W x S."""
import io
import os
import sys

import numpy as np
import tifffile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from image_utils import frame_channel, read_tiff_bytes  # noqa: E402

FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")


def read(name):
    with open(os.path.join(FIX, name), "rb") as f:
        return read_tiff_bytes(f.read())


def test_rgb_contig_is_one_colour_frame():
    stack, meta = read("rgb_contig.tif")
    assert stack.shape == (1, 9, 12, 3)
    assert meta["Dimensions"] == "(9, 12, 3)"  # tifffile's own shape, unchanged
    np.testing.assert_array_equal(stack[0], tifffile.imread(os.path.join(FIX, "rgb_contig.tif")))


def test_rgb_planar_samples_last():
    stack, _ = read("rgb_planar.tif")
    planes = tifffile.imread(os.path.join(FIX, "rgb_planar.tif"))  # (3, 9, 12)
    assert stack.shape == (1, 9, 12, 3)
    np.testing.assert_array_equal(stack[0], np.moveaxis(planes, 0, -1))


def test_rgb_stack():
    buf = io.BytesIO()
    data = np.random.default_rng(0).integers(0, 255, (4, 6, 5, 3)).astype(np.uint8)
    tifffile.imwrite(buf, data, photometric="rgb")
    stack, _ = read_tiff_bytes(buf.getvalue())
    assert stack.shape == (4, 6, 5, 3)
    np.testing.assert_array_equal(frame_channel(stack, 2, 1), data[2, :, :, 1])


def test_grayscale_unchanged():
    stack, _ = read("u16_be_stack.tif")
    assert stack.shape == (3, 9, 12)
    assert frame_channel(stack, 1, 0).shape == (9, 12)
