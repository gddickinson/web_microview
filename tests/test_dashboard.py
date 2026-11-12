"""Regression tests for the Bokeh dashboard callbacks (skipped when bokeh is not installed).

Run with the desktop requirements: pip install -r requirements.txt pytest; python -m pytest -q tests
"""
import base64
import io
import os
import sys

import numpy as np
import pytest

bokeh = pytest.importorskip("bokeh")
tifffile = pytest.importorskip("tifffile")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from image_utils import display_frame  # noqa: E402


def upload(dash, stack):
    buf = io.BytesIO()
    tifffile.imwrite(buf, stack, photometric="minisblack")
    dash.handle_file_upload("value", None, base64.b64encode(buf.getvalue()).decode())


@pytest.fixture
def dash():
    import app
    return app.MicroscopyDashboard()


def shown(dash):
    return np.asarray(dash.image_source.data["image"][0])


def test_image_is_shown_with_row_0_at_the_top(dash):
    # Bokeh draws array row 0 at the bottom; the dashboard must flip so the image looks as in ImageJ/Fiji
    stack = np.zeros((1, 4, 6), np.uint16)
    stack[0, 0, :] = 100  # top row bright
    upload(dash, stack)
    img = shown(dash)
    assert img[-1].max() == 1.0 and img[0].max() == 0.0  # last array row = top of the plot


def test_gamma_kept_when_frame_changes(dash):
    rng = np.random.default_rng(0)
    stack = rng.integers(0, 1000, (3, 8, 8)).astype(np.uint16)
    upload(dash, stack)
    dash.contrast_slider.value = 2.0
    dash.update_contrast("value", 1.0, 2.0)
    dash.frame_slider.value = 2
    dash.update_frame("value", 0, 2)
    np.testing.assert_allclose(shown(dash), np.flipud(display_frame(stack[2], 2.0)))


def test_gamma_slider_cannot_reach_zero(dash):
    assert dash.contrast_slider.start > 0


def test_roi_selection_maps_to_image_rows(dash):
    stack = np.arange(48, dtype=np.float64).reshape(1, 6, 8)
    upload(dash, stack)
    dash.roi_toggle.active = True

    class Ev:  # a box over the top-left 2x2 pixels as drawn on the (flipped) plot
        geometry = {"x0": 0, "x1": 2, "y0": 4, "y1": 6}
    dash.update_roi(Ev)
    assert dash.roi_stats_source.data["value"][0] == stack[0, 0:2, 0:2].mean()


def test_roi_stats_follow_the_frame(dash):
    stack = np.stack([np.full((6, 6), 5.0), np.full((6, 6), 9.0)])
    upload(dash, stack)
    dash.roi_toggle.active = True

    class Ev:
        geometry = {"x0": 1, "x1": 4, "y0": 1, "y1": 4}
    dash.update_roi(Ev)
    dash.frame_slider.value = 1
    dash.update_frame("value", 0, 1)
    assert dash.roi_stats_source.data["value"][0] == 9.0


def test_single_frame_upload_after_a_stack(dash):
    upload(dash, np.ones((5, 6, 6), np.uint16))
    dash.frame_slider.value = 4
    dash.roi_toggle.active = True

    class Ev:
        geometry = {"x0": 1, "x1": 3, "y0": 1, "y1": 3}
    dash.update_roi(Ev)
    upload(dash, np.ones((6, 6), np.uint16))
    assert dash.frame_slider.value == 0
    dash.update_roi(Ev)  # used to raise IndexError (stale slider value 4)


def test_stats_axis_is_not_fixed_to_0_1(dash):
    upload(dash, np.full((1, 6, 6), 500, np.uint16))
    assert not (dash.stats_plot.y_range.start == 0 and dash.stats_plot.y_range.end == 1)


def test_rgb_upload_is_one_frame_with_channel_selector(dash):
    rgb = np.zeros((6, 8, 3), np.uint8)
    rgb[..., 1] = np.arange(8)  # green ramp across x
    buf = io.BytesIO()
    tifffile.imwrite(buf, rgb, photometric="rgb")
    dash.handle_file_upload("value", None, base64.b64encode(buf.getvalue()).decode())
    assert dash.current_stack.shape == (1, 6, 8, 3)
    assert dash.frame_slider.visible is False
    assert dash.channel_select.visible and dash.channel_select.options == ["0 (R)", "1 (G)", "2 (B)"]
    dash.channel_select.value = "1 (G)"
    np.testing.assert_allclose(shown(dash), np.flipud(display_frame(rgb[..., 1], 1.0)))
