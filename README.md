# Web MicroView

A web-based microscopy image viewer and analysis dashboard built with Bokeh. Provides interactive TIFF stack visualization with ROI tools, intensity analysis, and metadata display.

## Features

- **TIFF stack viewer** with frame-by-frame navigation
- **ROI (Region of Interest) tools** -- box selection for intensity measurement
- **Intensity analysis** with statistical summaries (mean, std, min, max, median) and a zoomed ROI view
- **Gamma (contrast) slider**; the line-profile toggle is a placeholder in the Bokeh app (not implemented yet)
- **Metadata viewer** for TIFF file properties
- **Interactive controls** -- sliders, buttons, file upload
- **Web-based** -- runs in any modern browser via Bokeh server

## Requirements

- Python 3.9+ (Bokeh 3.2+)
- bokeh, tifffile, numpy, scipy (versions in `requirements.txt`)

```bash
pip install -r requirements.txt
```

## Usage

```bash
bokeh serve app.py
```

Then open `http://localhost:5006/app` in your browser. Upload a TIFF stack using the file input widget.

## Project Structure

```
web_microview/
├── app.py          # MicroscopyDashboard class and Bokeh server app
├── image_utils.py  # TIFF loading, normalisation/gamma, ROI clipping and statistics
├── roi_tools.py    # ROI BoxAnnotation
└── tests/          # pytest tests (python -m pytest -q tests)
```

Coordinates: pixels from the top-left corner of the image (row 0 at the top), as in ImageJ/Fiji.


---
*Built with AI assistance from [Claude (Anthropic)](https://claude.com/).*
