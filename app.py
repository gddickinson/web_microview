"""
Web MicroView - Bokeh server application for microscopy TIFF stack viewing.

Main dashboard class that assembles the UI. Image processing and ROI logic
are delegated to image_utils and roi_tools modules.

Launch with:  bokeh serve app.py
"""

from bokeh.layouts import column, row
from bokeh.plotting import figure, curdoc
from bokeh.models import (ColumnDataSource, Slider, FileInput,
                         Tabs, TabPanel, Div, Toggle,
                         BoxSelectTool)
import numpy as np

from image_utils import decode_uploaded_file, normalize_frame, compute_roi_stats, extract_roi
from roi_tools import create_roi_box

# Default empty image dimensions
DEFAULT_IMAGE_SIZE = 512


class MicroscopyDashboard:
    def __init__(self):
        # Initialize instance variables
        self.current_stack = None
        self.current_frame = 0
        self.metadata = {}
        self.empty_image = np.zeros(
            (DEFAULT_IMAGE_SIZE, DEFAULT_IMAGE_SIZE), dtype=np.uint16
        )

        # Setup components
        self.setup_data_sources()
        self.roi_box = create_roi_box()
        self.create_figures()
        self.create_controls()
        self.create_metadata_view()
        self.setup_layout()

        # Display empty image
        self.update_image_source(self.empty_image)

    def setup_data_sources(self):
        """Initialize data sources for the plots"""
        self.image_source = ColumnDataSource(data={'image': [], 'dw': [], 'dh': []})
        self.roi_source = ColumnDataSource(data={'x': [], 'y': [], 'width': [], 'height': []})
        self.line_profile_source = ColumnDataSource(data={'x': [], 'y': [], 'distance': []})
        self.roi_stats_source = ColumnDataSource(data={
            'stat': ['Mean', 'Std Dev', 'Min', 'Max', 'Median'],
            'value': [0, 0, 0, 0, 0]
        })

    def toggle_roi(self, attr, old, new):
        """Toggle ROI selection mode"""
        if new:
            self.roi_box.visible = True
            self.main_plot.toolbar.active_drag = self.box_select
        else:
            self.roi_box.visible = False
            self.main_plot.toolbar.active_drag = None

    def toggle_line_profile(self, attr, old, new):
        """Toggle line profile mode"""
        pass  # Planned for next iteration

    def create_figures(self):
        """Create the main figure and ROI-related plots"""
        self.main_plot = figure(title='Microscopy View',
                              tools='pan,box_zoom,wheel_zoom,reset,save',
                              match_aspect=True,
                              width=500, height=500)

        self.box_select = BoxSelectTool(persistent=True)
        self.main_plot.add_tools(self.box_select)

        self.image_renderer = self.main_plot.image('image',
                                                 x=0, y=0,
                                                 dw='dw', dh='dh',
                                                 source=self.image_source,
                                                 palette="Greys256")

        self.main_plot.add_layout(self.roi_box)

        # ROI zoomed view
        self.roi_plot = figure(title='ROI View',
                             tools='pan,wheel_zoom,reset,save',
                             match_aspect=True,
                             width=250, height=250)
        self.roi_image_source = ColumnDataSource(data={'image': [], 'dw': [], 'dh': []})
        self.roi_image_renderer = self.roi_plot.image('image',
                                                    x=0, y=0,
                                                    dw='dw', dh='dh',
                                                    source=self.roi_image_source,
                                                    palette="Greys256")

        # Line profile plot
        self.profile_plot = figure(title='Intensity Profile',
                                 tools='pan,wheel_zoom,reset,save',
                                 width=250, height=250)
        self.profile_plot.line('distance', 'y', source=self.line_profile_source)

        # ROI statistics bar chart
        self.stats_plot = figure(title='ROI Statistics',
                               tools='',
                               width=250, height=250,
                               x_range=['Mean', 'Std Dev', 'Min', 'Max', 'Median'],
                               y_range=(0, 1))
        self.stats_plot.vbar(x='stat', top='value', source=self.roi_stats_source,
                            width=0.8)

    def create_controls(self):
        """Create interactive controls"""
        self.frame_slider = Slider(start=0, end=1, value=0, step=1, title="Frame")
        self.frame_slider.on_change('value', self.update_frame)

        self.contrast_slider = Slider(start=0, end=2, value=1, step=0.1, title="Contrast")
        self.contrast_slider.on_change('value', self.update_contrast)

        self.file_input = FileInput(accept=".tif,.tiff", multiple=False)
        self.file_input.on_change('value', self.handle_file_upload)

        self.roi_toggle = Toggle(label="Enable ROI", button_type="success")
        self.roi_toggle.on_change('active', self.toggle_roi)

        self.line_profile_toggle = Toggle(label="Enable Line Profile", button_type="success")
        self.line_profile_toggle.on_change('active', self.toggle_line_profile)

    def create_metadata_view(self):
        """Create the metadata display panel"""
        self.metadata_div = Div(
            text="<p>No file loaded</p>",
            width=400,
            height=400,
            styles={
                'font-family': 'monospace',
                'overflow-y': 'auto',
                'height': '400px'
            }
        )

    def update_roi(self, event):
        """Update ROI when box selection changes"""
        if not self.roi_toggle.active:
            return

        if event.geometry['x0'] is None:
            return

        x0, x1 = event.geometry['x0'], event.geometry['x1']
        y0, y1 = event.geometry['y0'], event.geometry['y1']

        self.roi_box.left = x0
        self.roi_box.right = x1
        self.roi_box.bottom = y0
        self.roi_box.top = y1

        self.roi_source.data = {
            'x': [x0], 'y': [y0],
            'width': [x1 - x0], 'height': [y1 - y0]
        }

        self.update_roi_view()
        self.update_roi_stats()

    def update_roi_view(self):
        """Update the ROI zoomed view"""
        if self.current_stack is None or not self.roi_source.data['x']:
            return

        frame = self.current_stack[self.frame_slider.value]
        x0 = self.roi_source.data['x'][0]
        y0 = self.roi_source.data['y'][0]
        w = self.roi_source.data['width'][0]
        h = self.roi_source.data['height'][0]

        roi, width, height = extract_roi(frame, x0, y0, w, h)
        self.roi_image_source.data = {
            'image': [roi],
            'dw': [width],
            'dh': [height]
        }

    def update_roi_stats(self):
        """Update ROI statistics"""
        if self.current_stack is None or not self.roi_source.data['x']:
            return

        frame = self.current_stack[self.frame_slider.value]
        x0 = self.roi_source.data['x'][0]
        y0 = self.roi_source.data['y'][0]
        w = self.roi_source.data['width'][0]
        h = self.roi_source.data['height'][0]

        stats = compute_roi_stats(frame, x0, y0, w, h)
        self.roi_stats_source.data = stats

    def setup_layout(self):
        """Organize the layout of the dashboard"""
        controls = column(
            self.file_input,
            self.frame_slider,
            self.contrast_slider,
            self.roi_toggle,
            self.line_profile_toggle,
            width=400
        )

        analysis_plots = column(
            row(self.roi_plot, self.profile_plot),
            self.stats_plot
        )

        image_layout = row(
            controls,
            column(self.main_plot, analysis_plots)
        )

        image_panel = TabPanel(child=image_layout, title="Image View")
        metadata_panel = TabPanel(child=column(self.metadata_div), title="Metadata")
        tabs = Tabs(tabs=[image_panel, metadata_panel])

        self.main_plot.on_event('selection_geometry', self.update_roi)
        self.layout = tabs

    def handle_file_upload(self, attr, old, new):
        """Handle file upload from the FileInput widget"""
        if new:
            try:
                print(f"Received data format: {new[:100]}...")
                self.current_stack, self.metadata = decode_uploaded_file(new)
                print(f"Loaded stack with shape: {self.current_stack.shape}")

                # Update empty_image size to match uploaded data
                h, w = self.current_stack.shape[1], self.current_stack.shape[2]
                self.empty_image = np.zeros((h, w), dtype=np.uint16)

                num_frames = len(self.current_stack)
                if num_frames > 1:
                    self.frame_slider.start = 0
                    self.frame_slider.end = num_frames - 1
                    self.frame_slider.value = 0
                    self.frame_slider.visible = True
                else:
                    self.frame_slider.visible = False

                self.update_frame(None, None, 0)
                self.update_metadata_display()

            except Exception as e:
                print(f"Error loading file: {str(e)}")
                import traceback
                print(f"Traceback: {traceback.format_exc()}")
                self.current_stack = None
                self.metadata = {}
                self.update_image_source(self.empty_image)
                self.frame_slider.visible = False
                self.update_metadata_display()

    def update_frame(self, attr, old, new):
        """Update the displayed frame"""
        try:
            if self.current_stack is not None and len(self.current_stack) > 0:
                if new < 0 or new >= len(self.current_stack):
                    print(f"Invalid frame index: {new}, stack size: {len(self.current_stack)}")
                    return
                frame = self.current_stack[new]
                self.update_image_source(frame)
            else:
                self.update_image_source(self.empty_image)
        except Exception as e:
            print(f"Error in update_frame: {str(e)}")

    def update_image_source(self, frame):
        """Update the image data source"""
        normalized = normalize_frame(frame)
        self.image_source.data = {
            'image': [normalized],
            'dw': [frame.shape[1]],
            'dh': [frame.shape[0]]
        }

    def update_contrast(self, attr, old, new):
        """Update image contrast"""
        if self.current_stack is not None:
            frame = self.current_stack[self.frame_slider.value]
            frame = np.power(frame, 1/new)
            self.update_image_source(frame)

    def update_metadata_display(self):
        """Update the metadata display with current file information"""
        if not self.metadata:
            self.metadata_div.text = "<p>No file loaded</p>"
            return

        html = ['<div style="max-height: 400px; overflow-y: auto;">']
        html.append('<table style="width:100%; border-collapse: collapse;">')
        html.append('<thead>')
        html.append('<tr style="position: sticky; top: 0; background-color: #f5f5f5;">')
        html.append('<th style="text-align:left; padding:8px; border:1px solid #ddd;">Property</th>')
        html.append('<th style="text-align:left; padding:8px; border:1px solid #ddd;">Value</th>')
        html.append('</tr>')
        html.append('</thead>')
        html.append('<tbody>')

        html.append('<tr><td colspan="2" style="padding:8px; background-color:#e9ecef; font-weight:bold;">Basic Properties</td></tr>')
        basic_props = ['Dimensions', 'Data Type', 'Value Range']
        for key in basic_props:
            if key in self.metadata:
                html.append(f'<tr><td style="padding:8px; border:1px solid #ddd">{key}</td>')
                html.append(f'<td style="padding:8px; border:1px solid #ddd">{self.metadata[key]}</td></tr>')

        html.append('<tr><td colspan="2" style="padding:8px; background-color:#e9ecef; font-weight:bold;">TIFF Metadata</td></tr>')
        for key, value in sorted(self.metadata.items()):
            if key not in basic_props:
                html.append(f'<tr><td style="padding:8px; border:1px solid #ddd">{key}</td>')
                html.append(f'<td style="padding:8px; border:1px solid #ddd">{value}</td></tr>')

        html.append('</tbody>')
        html.append('</table>')
        html.append('</div>')

        self.metadata_div.text = "\n".join(html)


# Create and start the dashboard
dashboard = MicroscopyDashboard()
curdoc().add_root(dashboard.layout)
