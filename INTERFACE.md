# Web MicroView -- Interface Map

## Project Structure

| File | Purpose |
|------|---------|
| `app.py` | Bokeh server app -- `MicroscopyDashboard` class, layout, callbacks |
| `image_utils.py` | TIFF loading, normalization, ROI statistics, ROI extraction |
| `roi_tools.py` | ROI `BoxAnnotation` creation |
| `test_image_utils.py` | Unit tests for image utility functions |

## Key Classes and Functions

### app.py
- `MicroscopyDashboard` -- main Bokeh dashboard
  - `.handle_file_upload()` -- decodes uploaded TIFF via `image_utils.decode_uploaded_file`
  - `.update_frame()` / `.update_image_source()` -- frame display
  - `.update_roi_view()` / `.update_roi_stats()` -- ROI analysis using `image_utils`
  - `.setup_layout()` -- assembles Bokeh widgets into tabs

### image_utils.py
- `decode_uploaded_file(data_string)` -- base64 decode + tifffile read -> (stack, metadata)
- `normalize_frame(frame)` -- normalize 2D array to [0, 1]
- `compute_roi_stats(frame, x0, y0, w, h)` -- mean, std, min, max, median
- `extract_roi(frame, x0, y0, w, h)` -- clip and extract sub-array

### roi_tools.py
- `create_roi_box()` -- returns a Bokeh `BoxAnnotation`

## Module Connections
- `app.py` imports from `image_utils` and `roi_tools`
- Launch: `bokeh serve app.py`
