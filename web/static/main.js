// Entry point: lazy page modules, the mode label, a subtle drifting-spots background, then the router.
import { $, app, isStatic, lazy, route, start } from './core.js';

const PAGES = { 'home.js': ['home'], 'viewer.js': ['viewer'], 'metadata.js': ['metadata'], 'check.js': ['check'], 'about.js': ['about'] };
lazy(Object.fromEntries(Object.entries(PAGES).flatMap(([file, names]) => names.map(n => [n, () => import('./' + file)]))));
route('notfound', () => { app().innerHTML = '<h1>Not found</h1><p><a href="#/">Back to the start</a></p>'; });

$('#mode').textContent = isStatic()
  ? 'static site: files are read and measured in your browser'
  : 'local app: in-browser viewer + tifffile on this computer';

// Background: a few soft fluorescent spots drifting slowly. Off under prefers-reduced-motion.
function background(canvas) {
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const g = canvas.getContext('2d');
  const fit = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  fit(); addEventListener('resize', fit);
  const cols = ['77,255,154', '255,79,216', '92,200,255'];
  const spots = Array.from({ length: 16 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: 20 + Math.random() * 40, c: cols[i % 3] }));
  let last = 0;
  const tick = t => {
    requestAnimationFrame(tick);
    if (document.hidden || t - last < 80) return;
    last = t;
    g.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of spots) {
      s.x = (s.x + (Math.random() - 0.5) * 0.002 + 1) % 1; s.y = (s.y + (Math.random() - 0.5) * 0.002 + 1) % 1;
      const x = s.x * canvas.width, y = s.y * canvas.height, gr = g.createRadialGradient(x, y, 0, x, y, s.r);
      gr.addColorStop(0, `rgba(${s.c},.35)`); gr.addColorStop(1, `rgba(${s.c},0)`);
      g.fillStyle = gr; g.fillRect(x - s.r, y - s.r, 2 * s.r, 2 * s.r);
    }
  };
  requestAnimationFrame(tick);
}
background($('#bg'));
start();
