# Web MicroView

A web-based microscopy image viewer and analysis dashboard built with Bokeh. Provides interactive TIFF stack visualization with ROI tools, intensity analysis, and metadata display.

## Features

- **TIFF stack viewer** with frame-by-frame navigation
- **ROI (Region of Interest) tools** -- box selection for intensity measurement
- **Intensity analysis** with statistical summaries
- **Crosshair tools** for precise measurement
- **Metadata viewer** for TIFF file properties
- **Interactive controls** -- sliders, buttons, file upload
- **Web-based** -- runs in any modern browser via Bokeh server

## Requirements

- Python 3.7+
- bokeh, tifffile, numpy, scipy

```bash
pip install bokeh tifffile numpy scipy
```

## Usage

```bash
bokeh serve app.py
```

Then open `http://localhost:5006/app` in your browser. Upload a TIFF stack using the file input widget.

## Project Structure

```
web_microview/
└── app.py    # MicroscopyDashboard class and Bokeh server app
```
