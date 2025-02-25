# Web Microview

A web-based microscope image viewer built with Bokeh for interactive visualization of TIFF microscopy data.

![Microscope Image Viewer](https://via.placeholder.com/800x450)

## Overview

Web Microview is an interactive dashboard for visualizing and analyzing microscopy images. It provides a user-friendly interface for viewing TIFF files, navigating through image stacks, adjusting contrast, and performing basic region-of-interest (ROI) analysis.

### Features

- **TIFF File Support**: Load and view single images or multi-frame TIFF stacks
- **Interactive Visualization**: Pan, zoom, and navigate through image stacks
- **ROI Analysis**: Select regions of interest and view detailed statistics
- **Image Enhancement**: Adjust contrast with interactive controls
- **Metadata Viewer**: Examine TIFF metadata in an organized display
- **Intensity Profiling**: Visualize intensity profiles across the image (coming soon)

## Installation

### Prerequisites

- Python 3.7+
- pip

### Setup

1. Clone the repository
   ```bash
   git clone https://github.com/username/web_microview.git
   cd web_microview
   ```

2. Create and activate a virtual environment (recommended)
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. Install the required packages
   ```bash
   pip install bokeh tifffile numpy scipy
   ```

## Usage

### Running the Application

1. Start the Bokeh server:
   ```bash
   bokeh serve --show app.py
   ```

2. The application will open in your default web browser at http://localhost:5006/app

### Using the Interface

#### Loading Images
- Click the "Choose File" button and select a TIFF file (.tif or .tiff)
- The image will automatically load and display in the main view

#### Navigating Image Stacks
- Use the "Frame" slider to move through different frames in a multi-frame TIFF stack
- The slider will only appear when a multi-frame image is loaded

#### Adjusting Display
- Use the "Contrast" slider to enhance image visibility
- Higher values increase contrast, while lower values flatten it

#### ROI Analysis
1. Enable ROI mode by toggling the "Enable ROI" button
2. Draw a box on the image to select your region of interest
3. View the selected region in the ROI view panel
4. Examine statistics (mean, standard deviation, min, max, median) in the statistics panel

#### Viewing Metadata
- Click on the "Metadata" tab to view detailed information about the loaded image
- Metadata includes dimensions, data type, value range, and any TIFF-specific tags

## Architecture

The application follows a modular design with the main `MicroscopyDashboard` class handling:

- Image data management
- UI components and layout
- User interaction callbacks
- ROI analysis and statistics

The dashboard uses Bokeh's reactive programming model to update visualizations in response to user actions.

## Extending the Application

The modular structure makes it easy to add new features:

- Add new visualization types by creating additional figure objects
- Implement new analysis tools by adding corresponding UI controls and callback methods
- Extend metadata extraction for additional file formats

## Troubleshooting

Common issues:

- **Image doesn't load**: Ensure your TIFF file is properly formatted. The application supports standard TIFF formats.
- **Performance issues with large files**: Loading very large TIFF files may take time or cause memory constraints depending on your system.

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- Built with [Bokeh](https://bokeh.org/)
- Uses [tifffile](https://github.com/cgohlke/tifffile) for TIFF parsing
