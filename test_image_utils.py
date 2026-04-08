"""
Smoke tests for web_microview image utility functions.
"""

import unittest
import numpy as np
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from image_utils import normalize_frame, compute_roi_stats, extract_roi


class TestNormalizeFrame(unittest.TestCase):
    """Test frame normalization."""

    def test_normal_image(self):
        """Test normalization of a standard image."""
        frame = np.array([[0, 50], [100, 200]], dtype=np.float64)
        result = normalize_frame(frame)
        self.assertAlmostEqual(result.min(), 0.0)
        self.assertAlmostEqual(result.max(), 1.0)

    def test_uniform_image(self):
        """Test normalization of a uniform (constant) image."""
        frame = np.ones((64, 64), dtype=np.float64) * 42.0
        result = normalize_frame(frame)
        self.assertTrue(np.all(result == 0.0))

    def test_output_shape(self):
        """Test that output shape matches input."""
        frame = np.random.rand(128, 128)
        result = normalize_frame(frame)
        self.assertEqual(result.shape, frame.shape)


class TestComputeROIStats(unittest.TestCase):
    """Test ROI statistics computation."""

    def test_basic_stats(self):
        """Test that stats contain expected keys."""
        frame = np.arange(100, dtype=np.float64).reshape(10, 10)
        stats = compute_roi_stats(frame, x0=2, y0=2, width=5, height=5)
        self.assertEqual(len(stats['stat']), 5)
        self.assertEqual(len(stats['value']), 5)
        self.assertIn('Mean', stats['stat'])
        self.assertIn('Max', stats['stat'])

    def test_clipped_roi(self):
        """Test that ROI is clipped to image bounds."""
        frame = np.ones((10, 10), dtype=np.float64) * 5.0
        stats = compute_roi_stats(frame, x0=8, y0=8, width=10, height=10)
        self.assertAlmostEqual(stats['value'][0], 5.0)  # mean


class TestExtractROI(unittest.TestCase):
    """Test ROI extraction."""

    def test_basic_extraction(self):
        """Test extracting a sub-region."""
        frame = np.arange(100, dtype=np.float64).reshape(10, 10)
        roi, w, h = extract_roi(frame, x0=2, y0=3, width=4, height=5)
        self.assertEqual(roi.shape, (5, 4))
        self.assertEqual(w, 4)
        self.assertEqual(h, 5)

    def test_clipped_extraction(self):
        """Test that extraction clips to image bounds."""
        frame = np.zeros((10, 10))
        roi, w, h = extract_roi(frame, x0=8, y0=8, width=5, height=5)
        self.assertEqual(w, 2)
        self.assertEqual(h, 2)


if __name__ == '__main__':
    unittest.main()
