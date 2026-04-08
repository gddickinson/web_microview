"""
Web MicroView - ROI (Region of Interest) tools.

Provides ROI box annotation creation and toggle logic for the Bokeh dashboard.
"""

from bokeh.models import BoxAnnotation


def create_roi_box():
    """Create a BoxAnnotation for ROI display.

    Returns
    -------
    roi_box : BoxAnnotation
        Pre-configured annotation (hidden by default).
    """
    return BoxAnnotation(
        fill_alpha=0.1,
        fill_color='blue',
        line_color='blue',
        line_width=2,
        visible=False,
    )
