"""
Web MicroView - physical pixel size and axes from TIFF metadata.

Reads the scale a file declares about itself (never a guessed default): OME-XML
PhysicalSizeX first, then the ImageJ description unit + XResolution tag. When neither is
present the result says so, and callers must report sizes in pixels.
"""

import re

UNIT_TO_UM = {'nm': 1e-3, 'µm': 1.0, 'um': 1.0, 'micron': 1.0, 'microns': 1.0,
              '\\u00B5m': 1.0, 'µm': 1.0, 'mm': 1e3, 'cm': 1e4, 'm': 1e6}


def pixel_size_um(tif):
    """Return {'um_per_px': float or None, 'source': str} for an open tifffile.TiffFile."""
    page = tif.pages[0]
    desc = page.description or ''
    if '<OME' in desc:
        m = re.search(r'PhysicalSizeX="([^"]+)"', desc)
        if m:
            unit = re.search(r'PhysicalSizeXUnit="([^"]+)"', desc)
            factor = UNIT_TO_UM.get(unit.group(1) if unit else 'µm')
            if factor is not None:
                return {'um_per_px': float(m.group(1)) * factor, 'source': 'OME-XML PhysicalSizeX'}
    if desc.startswith('ImageJ='):
        meta = dict(line.split('=', 1) for line in desc.splitlines() if '=' in line)
        factor = UNIT_TO_UM.get(meta.get('unit', '').strip())
        tag = page.tags.get('XResolution')
        if factor is not None and tag is not None:
            num, den = tag.value
            if num > 0:
                return {'um_per_px': den / num * factor, 'source': 'ImageJ unit + XResolution'}
    return {'um_per_px': None, 'source': 'not in file (sizes in pixels)'}
