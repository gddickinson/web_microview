// Home: hero, real counts (demo stack, reader coverage) and cards to the pages.
import { api, app, esc, isStatic, route } from './core.js';

route('home', async () => {
  const info = await api('/info');
  const d = info.demo, r = info.reader;
  app().innerHTML = `
  <section class="hero">
    <p class="kicker">Microscopy · TIFF stacks · ROI analysis</p>
    <h1 class="glow">Web MicroView</h1>
    <p class="lead">A microscope image viewer for the browser. Open a TIFF image or stack, step or play through the frames,
      adjust gamma, draw a region of interest for its zoomed view and intensity statistics (mean, standard deviation,
      min, max, median), and draw a line for an intensity profile. Physical units are used when the file declares a pixel size.</p>
    <a class="btn" href="#/viewer">Open the viewer</a><a class="btn alt" href="#/check">Python vs JS check</a><a class="btn alt" href="#/about">About</a>
  </section>
  <div class="tiles">
    <div class="tile"><b>${r.types.length}</b><span>pixel types read (8-64 bit, integer and float)</span></div>
    <div class="tile"><b>${r.compression.length}</b><span>compression modes: ${esc(r.compression.join(', '))}</span></div>
    <div class="tile"><b>${r.fixtures}</b><span>test TIFFs where the JS reader matches tifffile</span></div>
    <div class="tile"><b>${esc(d.metadata.Dimensions)}</b><span>demo stack (frames, rows, columns), ${d.size_kb} kB</span></div>
  </div>
  ${isStatic() ? `<div class="callout">This static site is the full viewer: files are read and measured in your browser and never uploaded.
    The local app (see About) adds tifffile's reading of a file's metadata, exactly as the original Bokeh dashboard shows it,
    and decodes files the browser reader does not support.</div>` : ''}
  <h2>Pages</h2>
  <div class="grid">
    <a class="card" href="#/viewer"><b>Viewer</b><span>Frames, playback, gamma, lookup tables; ROI box with zoom view, statistics and mean over frames; line profile; CSV and PNG export.</span></a>
    <a class="card" href="#/metadata"><b>Metadata</b><span>Shape, data type, value range, pixel size and every TIFF tag of the open file.</span></a>
    <a class="card" href="#/check"><b>Python vs JS</b><span>The demo stack measured in your browser next to the repo's Python image_utils values.</span></a>
    <a class="card" href="#/about"><b>About</b><span>What this is, the original Bokeh dashboard, how to run both, conventions and credits.</span></a>
  </div>
  <h2>Demo stack</h2>
  <div class="card"><b>${esc(d.file.split('/').pop())}</b><small>${esc(d.metadata.Dimensions)} ${esc(d.metadata['Data Type'])} · values ${esc(d.metadata['Value Range'])} · ${d.pixel.um_per_px} µm/px</small>
    <span>${esc(d.description)}</span></div>`;
});
