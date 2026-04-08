# Web MicroView -- Roadmap

## Current State
Single-file Bokeh server application (`app.py`) implementing a web-based microscopy TIFF stack viewer. `MicroscopyDashboard` class handles: image display with ColumnDataSource, ROI box selection with intensity statistics, frame navigation via slider, file upload via base64 decoding, crosshair tools, and metadata display. All logic (data sources, figures, controls, layout, callbacks) lives in one class. No tests, no packaging, no configuration.

## Short-term Improvements
- [x] Split `app.py` into modules: `dashboard.py` (main class), `roi_tools.py` (ROI logic), `image_utils.py` (TIFF loading, statistics)
- [x] Add `requirements.txt` with pinned versions (bokeh, tifffile, numpy, scipy)
- [x] Add error handling for corrupt TIFF files and unsupported formats in file upload callback
- [ ] Add support for multi-channel TIFF stacks (currently assumes single channel)
- [x] Fix duplicate `ColumnDataSource` import in `app.py` (imported twice on line 3 and line 5)
- [ ] Add configurable color maps (currently likely hardcoded)
- [ ] Add a loading indicator during TIFF stack processing

## Feature Enhancements
- [ ] Add line profile tool (draw a line, plot intensity along it)
- [ ] Add z-projection modes (max intensity, mean, sum) for 3D stacks
- [ ] Add measurement tools (distance, angle) with pixel-to-physical unit conversion
- [ ] Add histogram equalization and contrast adjustment controls
- [ ] Implement multi-ROI support (define several ROIs, compare statistics)
- [ ] Add frame animation/playback with adjustable speed
- [ ] Add overlay support for particle localizations (CSV import)
- [ ] Add image export (current frame as PNG, ROI crop)

## Long-term Vision
- [ ] Migrate to Panel or HoloViews for richer interactive widgets
- [ ] Add user authentication and session management for multi-user deployment
- [ ] Support remote file loading (S3, HTTP URLs) for cloud-based microscopy data
- [ ] Add real-time streaming from microscope acquisition software
- [ ] Integrate wavelet denoising (`wavelet_denoise/WBNS.py`) as a processing option
- [ ] Deploy as a Docker container for easy lab-wide installation

## Technical Debt
- [x] Entire application in one file (~300+ lines) -- needs modularization
- [ ] No configuration for server settings (port, host, allowed origins)
- [x] `empty_image` hardcoded to 512x512 -- should match uploaded image dimensions
- [ ] ROI statistics computed synchronously -- could block UI on large images
- [ ] No caching for computed statistics or processed frames
- [ ] Missing `bokeh serve` launch instructions in a `Makefile` or script
