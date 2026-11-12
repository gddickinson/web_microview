// TIFF tag names (tifffile's spelling) and the physical pixel size a file declares about itself.
// pixelSize() mirrors tiff_meta.pixel_size_um in Python: OME-XML PhysicalSizeX first, then the ImageJ description
// unit + XResolution; otherwise no scale (sizes stay in pixels). Tested against Python in tiff_reader.test.mjs.

export const TAG_NAMES = {
  254: 'NewSubfileType', 255: 'SubfileType', 256: 'ImageWidth', 257: 'ImageLength', 258: 'BitsPerSample',
  259: 'Compression', 262: 'PhotometricInterpretation', 266: 'FillOrder', 269: 'DocumentName',
  270: 'ImageDescription', 271: 'Make', 272: 'Model', 273: 'StripOffsets', 274: 'Orientation',
  277: 'SamplesPerPixel', 278: 'RowsPerStrip', 279: 'StripByteCounts', 280: 'MinSampleValue',
  281: 'MaxSampleValue', 282: 'XResolution', 283: 'YResolution', 284: 'PlanarConfiguration', 285: 'PageName',
  286: 'XPosition', 287: 'YPosition', 296: 'ResolutionUnit', 297: 'PageNumber', 305: 'Software', 306: 'DateTime',
  315: 'Artist', 316: 'HostComputer', 317: 'Predictor', 320: 'ColorMap', 322: 'TileWidth', 323: 'TileLength',
  324: 'TileOffsets', 325: 'TileByteCounts', 330: 'SubIFDs', 338: 'ExtraSamples', 339: 'SampleFormat',
  340: 'SMinSampleValue', 341: 'SMaxSampleValue', 33432: 'Copyright', 34665: 'ExifTag', 34853: 'GPSTag',
  50838: 'IJMetadataByteCounts', 50839: 'IJMetadata',
};

export const COMPRESSION = { 1: 'none', 5: 'LZW', 8: 'Deflate', 32946: 'Deflate', 32773: 'PackBits' };
export const PHOTOMETRIC = { 0: 'MINISWHITE', 1: 'MINISBLACK', 2: 'RGB', 3: 'PALETTE', 4: 'MASK', 5: 'SEPARATED' };

const UNIT_TO_UM = { nm: 1e-3, 'µm': 1, um: 1, micron: 1, microns: 1, '\\u00B5m': 1, 'µm': 1, mm: 1e3, cm: 1e4, m: 1e6 };

// tags: Map code -> value (XResolution as [num, den]). Returns { um_per_px, source } like the Python function.
export function pixelSize(description, tags) {
  const desc = description || '';
  if (desc.includes('<OME')) {
    const m = desc.match(/PhysicalSizeX="([^"]+)"/);
    if (m) {
      const unit = desc.match(/PhysicalSizeXUnit="([^"]+)"/);
      const factor = UNIT_TO_UM[unit ? unit[1] : 'µm'];
      if (factor !== undefined) return { um_per_px: parseFloat(m[1]) * factor, source: 'OME-XML PhysicalSizeX' };
    }
  }
  if (desc.startsWith('ImageJ=')) {
    const meta = {};
    for (const line of desc.split(/\r?\n/)) {
      const i = line.indexOf('=');
      if (i >= 0) meta[line.slice(0, i)] = line.slice(i + 1);
    }
    const factor = UNIT_TO_UM[(meta.unit || '').trim()];
    const res = tags.get(282);
    if (factor !== undefined && res) {
      const [num, den] = res;
      if (num > 0) return { um_per_px: den / num * factor, source: 'ImageJ unit + XResolution' };
    }
  }
  return { um_per_px: null, source: 'not in file (sizes in pixels)' };
}

// Frame interval declared in an ImageJ description (finterval, seconds), or null.
export function frameInterval(description) {
  const m = (description || '').match(/^finterval=([0-9.eE+-]+)$/m);
  return m ? parseFloat(m[1]) : null;
}

// Short display string for a tag value (long arrays are summarised).
export function tagText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (value.length === 2 && typeof value[0] === 'number' && value.rational) return `${value[0]}/${value[1]}`;
    if (value.length > 12) return `[${value.slice(0, 8).map(tagText).join(', ')}, ... ${value.length} values]`;
    return value.length === 1 ? tagText(value[0]) : `(${value.map(tagText).join(', ')})`;
  }
  return String(value);
}
