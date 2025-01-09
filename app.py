from bokeh.layouts import column, row
from bokeh.plotting import figure, curdoc
from bokeh.models import (ColumnDataSource, Button, Slider, Select, FileInput,
                         Tabs, TabPanel, PreText, Div)
from bokeh.layouts import layout
import tifffile
import numpy as np
from pathlib import Path
import base64
import io

class MicroscopyDashboard:
    def __init__(self):
        self.current_stack = None
        self.current_frame = 0
        self.metadata = {}
        # Initialize with empty image
        self.empty_image = np.zeros((512, 512), dtype=np.uint16)  # Default size
        self.setup_data_sources()
        self.create_figures()
        self.create_controls()
        self.create_metadata_view()
        self.setup_layout()
        # Display empty image
        self.update_image_source(self.empty_image)

    def setup_data_sources(self):
        """Initialize data sources for the plots"""
        self.image_source = ColumnDataSource(data={'image': [], 'dw': [], 'dh': []})
        self.overlay_source = ColumnDataSource(data={'x': [], 'y': [], 'type': []})

    def create_figures(self):
        """Create the main figure for image display"""
        self.main_plot = figure(title='Microscopy View',
                              tools='pan,box_zoom,wheel_zoom,reset,save',
                              match_aspect=True)
        self.image_renderer = self.main_plot.image('image',
                                                 x=0, y=0,
                                                 dw='dw', dh='dh',
                                                 source=self.image_source,
                                                 palette="Greys256")

    def create_controls(self):
        """Create interactive controls"""
        self.frame_slider = Slider(start=0, end=1, value=0, step=1, title="Frame")
        self.frame_slider.on_change('value', self.update_frame)

        self.contrast_slider = Slider(start=0, end=2, value=1, step=0.1, title="Contrast")
        self.contrast_slider.on_change('value', self.update_contrast)

        # Replace button with FileInput widget
        self.file_input = FileInput(accept=".tif,.tiff", multiple=False)
        self.file_input.on_change('value', self.handle_file_upload)

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

    def setup_layout(self):
        """Organize the layout of the dashboard"""
        # Create control panel
        controls = column(self.file_input,
                         self.frame_slider,
                         self.contrast_slider,
                         width=400)

        # Create main image layout
        image_layout = row(controls, self.main_plot)

        # Create image panel
        image_panel = TabPanel(
            child=image_layout,
            title="Image View"
        )

        # Create metadata panel
        metadata_panel = TabPanel(
            child=column(self.metadata_div),
            title="Metadata"
        )

        # Create tabs
        tabs = Tabs(tabs=[image_panel, metadata_panel])

        # Set main layout
        self.layout = tabs

    def update_metadata_display(self):
        """Update the metadata display with current file information"""
        if not self.metadata:
            self.metadata_div.text = "<p>No file loaded</p>"
            return

        # Create HTML table for metadata
        html = ['<div style="max-height: 400px; overflow-y: auto;">']
        html.append('<table style="width:100%; border-collapse: collapse;">')
        html.append('<thead>')
        html.append('<tr style="position: sticky; top: 0; background-color: #f5f5f5;">')
        html.append('<th style="text-align:left; padding:8px; border:1px solid #ddd;">Property</th>')
        html.append('<th style="text-align:left; padding:8px; border:1px solid #ddd;">Value</th>')
        html.append('</tr>')
        html.append('</thead>')
        html.append('<tbody>')

        # Basic Properties Section
        html.append('<tr><td colspan="2" style="padding:8px; background-color:#e9ecef; font-weight:bold;">Basic Properties</td></tr>')
        basic_props = ['Dimensions', 'Data Type', 'Value Range']
        for key in basic_props:
            if key in self.metadata:
                html.append(f'<tr><td style="padding:8px; border:1px solid #ddd">{key}</td>')
                html.append(f'<td style="padding:8px; border:1px solid #ddd">{self.metadata[key]}</td></tr>')

        # TIFF Metadata Section
        html.append('<tr><td colspan="2" style="padding:8px; background-color:#e9ecef; font-weight:bold;">TIFF Metadata</td></tr>')
        for key, value in sorted(self.metadata.items()):
            if key not in basic_props:
                html.append(f'<tr><td style="padding:8px; border:1px solid #ddd">{key}</td>')
                html.append(f'<td style="padding:8px; border:1px solid #ddd">{value}</td></tr>')

        html.append('</tbody>')
        html.append('</table>')
        html.append('</div>')

        self.metadata_div.text = "\n".join(html)

    def handle_file_upload(self, attr, old, new):
        """Handle file upload from the FileInput widget"""
        if new:
            try:
                print(f"Received data format: {new[:100]}...")

                # Handle the binary data directly if no comma is present
                if ',' not in new:
                    binary_data = base64.b64decode(new)
                else:
                    # Handle data with base64 header
                    base64_data = new.split(',')[1]
                    binary_data = base64.b64decode(base64_data)

                # Create a bytes buffer
                buffer = io.BytesIO(binary_data)

                # Read TIFF with metadata
                with tifffile.TiffFile(buffer) as tif:
                    stack = tif.asarray()
                    print(f"Loaded stack with shape: {stack.shape}")

                    # Extract metadata
                    self.metadata = {}

                    # Basic image properties
                    self.metadata['Dimensions'] = f"{stack.shape}"
                    self.metadata['Data Type'] = f"{stack.dtype}"
                    self.metadata['Value Range'] = f"{stack.min()} to {stack.max()}"

                    # TIFF-specific metadata
                    if hasattr(tif, 'pages'):
                        page = tif.pages[0]
                        if hasattr(page, 'tags'):
                            for tag in page.tags.values():
                                self.metadata[tag.name] = str(tag.value)

                # Handle both single images and stacks
                if stack.ndim == 2:  # Single image
                    self.current_stack = np.array([stack])  # Convert to 3D array
                elif stack.ndim == 3:  # Image stack
                    self.current_stack = stack
                else:
                    raise ValueError(f"Unsupported image dimensions: {stack.ndim}")

                # Update the frame slider range
                num_frames = len(self.current_stack)
                if num_frames > 1:
                    self.frame_slider.start = 0
                    self.frame_slider.end = num_frames - 1
                    self.frame_slider.value = 0  # Reset to first frame
                    self.frame_slider.visible = True
                else:
                    self.frame_slider.visible = False

                # Display the first frame
                self.update_frame(None, None, 0)

                # Update metadata display
                self.update_metadata_display()

            except Exception as e:
                print(f"Error loading file: {str(e)}")
                print(f"Error type: {type(e)}")
                import traceback
                print(f"Traceback: {traceback.format_exc()}")
                # Reset to empty state
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
                print("No stack loaded or empty stack")
                self.update_image_source(self.empty_image)
        except Exception as e:
            print(f"Error in update_frame: {str(e)}")
            print(f"Stack shape: {self.current_stack.shape if self.current_stack is not None else 'None'}")
            print(f"Requested frame: {new}")

    def update_image_source(self, frame):
        """Update the image data source"""
        # Normalize frame for display with safeguards against division by zero
        f_min = frame.min()
        f_max = frame.max()

        if f_max == f_min:
            # Handle uniform intensity images
            normalized = np.zeros_like(frame, dtype=float)
        else:
            # Normal normalization
            normalized = (frame - f_min) / (f_max - f_min)

        self.image_source.data = {
            'image': [normalized],
            'dw': [frame.shape[1]],
            'dh': [frame.shape[0]]
        }

    def update_contrast(self, attr, old, new):
        """Update image contrast"""
        if self.current_stack is not None:
            frame = self.current_stack[self.frame_slider.value]
            frame = np.power(frame, 1/new)  # Simple gamma correction
            self.update_image_source(frame)

# Create and start the dashboard
dashboard = MicroscopyDashboard()
curdoc().add_root(dashboard.layout)
