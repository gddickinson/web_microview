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


def compute_roi_stats(frame, x0, y0, width, height):
    """Compute intensity statistics for a rectangular ROI.

    Parameters
    ----------
    frame : np.ndarray
        2D image array.
    x0, y0 : int
        Top-left corner of the ROI.
    width, height : int
        Dimensions of the ROI.

    Returns
    -------
    stats : dict
        Keys: 'stat' (list of names), 'value' (list of floats).
    """
    x0 = int(max(0, x0))
    y0 = int(max(0, y0))
    width = int(min(frame.shape[1] - x0, width))
    height = int(min(frame.shape[0] - y0, height))

    roi = frame[y0:y0 + height, x0:x0 + width]

    return {
        'stat': ['Mean', 'Std Dev', 'Min', 'Max', 'Median'],
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

    Returns the ROI sub-array and its actual dimensions (clipped to bounds).
    """
    x0 = int(max(0, x0))
    y0 = int(max(0, y0))
    width = int(min(frame.shape[1] - x0, width))
    height = int(min(frame.shape[0] - y0, height))

    roi = frame[y0:y0 + height, x0:x0 + width]
    return roi, width, height
