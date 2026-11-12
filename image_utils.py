"""
Web MicroView - Image utility functions.

Handles TIFF loading, normalization, and ROI statistics computation.
"""

import numpy as np
import base64
import io
import tifffile


def decode_uploaded_file(data_string):
    """Decode a base64-encoded file upload string to a numpy stack.

    Parameters
    ----------
    data_string : str
        Base64-encoded data, optionally prefixed with a data-URI header.

    Returns
    -------
    stack : np.ndarray
        3D array (frames, height, width).
    metadata : dict
        Dictionary of TIFF metadata tags.

    Raises
    ------
    ValueError
        If the image has unsupported dimensions (not 2D or 3D).
    """
    if ',' not in data_string:
        binary_data = base64.b64decode(data_string)
    else:
        base64_data = data_string.split(',')[1]
        binary_data = base64.b64decode(base64_data)

    buf = io.BytesIO(binary_data)
    metadata = {}

    with tifffile.TiffFile(buf) as tif:
        stack = tif.asarray()

        # Basic image properties
        metadata['Dimensions'] = f"{stack.shape}"
        metadata['Data Type'] = f"{stack.dtype}"
        metadata['Value Range'] = f"{stack.min()} to {stack.max()}"

        # TIFF-specific metadata
        if hasattr(tif, 'pages'):
            page = tif.pages[0]
            if hasattr(page, 'tags'):
                for tag in page.tags.values():
                    metadata[tag.name] = str(tag.value)

    # Normalize to 3D
    if stack.ndim == 2:
        stack = np.array([stack])
    elif stack.ndim == 3:
        pass
    else:
        raise ValueError(f"Unsupported image dimensions: {stack.ndim}")

    return stack, metadata


def normalize_frame(frame):
    """Normalize a 2D frame to [0, 1] for display.

    Parameters
    ----------
    frame : np.ndarray
        2D image array.

    Returns
    -------
    normalized : np.ndarray
        Float array in [0, 1].
    """
    f_min = frame.min()
    f_max = frame.max()

    if f_max == f_min:
        return np.zeros_like(frame, dtype=float)
    return (frame - f_min) / (f_max - f_min)


def display_frame(frame, gamma=1.0):
    """Frame scaled to [0, 1] for display with a gamma (the dashboard's contrast slider).

    The frame is min-max normalised first and then raised to ``1 / gamma``, so data with
    negative values (int16, float) displays correctly and gamma 1 equals ``normalize_frame``.
    """
    if gamma <= 0:
        raise ValueError("gamma must be > 0")
    norm = normalize_frame(np.asarray(frame, dtype=float))
    return norm if gamma == 1 else np.power(norm, 1.0 / gamma)


def selection_to_roi(x0, x1, y0, y1, image_height):
    """Convert a box drawn on the Bokeh plot to (col0, row0, width, height) in image pixels.

    The dashboard shows the image flipped (``np.flipud``) so row 0 is at the top, as in
    ImageJ/Fiji; plot y therefore runs upwards from the bottom row: row = image_height - y.
    """
    left, right = min(x0, x1), max(x0, x1)
    bottom, top = min(y0, y1), max(y0, y1)
    return left, image_height - top, right - left, top - bottom


def clip_roi(frame_shape, x0, y0, width, height):
    """Clip a rectangle to the image and return integer (col0, row0, width, height).

    Coordinates are in pixels with the origin at the corner of pixel (0, 0): the box covers
    columns from x0 for ``width`` pixels and rows from y0 for ``height`` pixels. The part of
    the box left of / above the image is cut off first (so a box starting at x0 = -5 loses
    5 pixels of width), then the corner and size are truncated with ``int()`` and clipped
    to the far edges. A box that misses the image gives width or height 0.
    """
    rows, cols = frame_shape[0], frame_shape[1]
    if x0 < 0:
        width, x0 = width + x0, 0
    if y0 < 0:
        height, y0 = height + y0, 0
    c0 = min(int(x0), cols)
    r0 = min(int(y0), rows)
    w = max(0, int(min(cols - c0, width)))
    h = max(0, int(min(rows - r0, height)))
    return c0, r0, w, h


STAT_NAMES = ['Mean', 'Std Dev', 'Min', 'Max', 'Median']


def compute_roi_stats(frame, x0, y0, width, height):
    """Compute intensity statistics for a rectangular ROI.

    Parameters
    ----------
    frame : np.ndarray
        2D image array.
    x0, y0 : float
        Corner of the ROI (column, row), pixel-corner origin; may lie outside the image.
    width, height : float
        Dimensions of the ROI; only the part overlapping the image is used.

    Returns
    -------
    stats : dict
        Keys: 'stat' (list of names), 'value' (list of floats; NaN when the
        ROI does not overlap the image). Std Dev is the population value (ddof=0).
    """
    roi, _, _ = extract_roi(frame, x0, y0, width, height)
    if roi.size == 0:
        return {'stat': list(STAT_NAMES), 'value': [float('nan')] * len(STAT_NAMES)}
    return {
        'stat': list(STAT_NAMES),
        'value': [
            float(np.mean(roi)),
            float(np.std(roi)),
            float(np.min(roi)),
            float(np.max(roi)),
            float(np.median(roi)),
        ]
    }


def extract_roi(frame, x0, y0, width, height):
    """Extract a rectangular ROI from a frame.

    Returns the ROI sub-array and its actual dimensions (clipped to bounds,
    see ``clip_roi``).
    """
    c0, r0, w, h = clip_roi(frame.shape, x0, y0, width, height)
    roi = frame[r0:r0 + h, c0:c0 + w]
    return roi, w, h
