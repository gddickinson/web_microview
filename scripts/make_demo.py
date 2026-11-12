"""Write the synthetic demo stack used by the web viewer (web/static/demo/demo_stack.tif).

The stack is SYNTHETIC (not a recording): a dim elliptical "cell" on a noisy background with
six diffusing Gaussian spots, one of which bleaches. Seeded, so it is reproducible. It is saved
as an ImageJ hyperstack with a declared pixel size of 0.1 µm and 0.05 s per frame so the
viewer's physical-unit display can be demonstrated; those numbers are chosen, not measured.

Run: python scripts/make_demo.py
"""
from pathlib import Path

import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "static" / "demo" / "demo_stack.tif"
SHAPE = (24, 128, 128)  # frames, rows, cols
UM_PER_PX = 0.1
FRAME_S = 0.05
SEED = 7


def make_stack(seed=SEED):
    rng = np.random.default_rng(seed)
    n, rows, cols = SHAPE
    yy, xx = np.mgrid[0:rows, 0:cols] + 0.5
    cell = (((xx - 60) / 44) ** 2 + ((yy - 66) / 30) ** 2 < 1) * 60.0
    pos = rng.uniform([30, 45], [95, 85], size=(6, 2))  # (x, y) inside the cell
    amp = np.array([900, 700, 650, 500, 450, 400], float)
    frames = []
    for t in range(n):
        img = 100.0 + cell
        for k, (x, y) in enumerate(pos):
            a = amp[k] * (np.exp(-t / 8.0) if k == 0 else 1.0)  # spot 0 bleaches
            img = img + a * np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (2 * 1.6 ** 2))
        frames.append(rng.poisson(img))
        pos = pos + rng.normal(0, 0.6, pos.shape)
    return np.clip(np.array(frames), 0, 65535).astype(np.uint16)


def main():
    stack = make_stack()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tifffile.imwrite(OUT, stack, imagej=True, resolution=(1 / UM_PER_PX, 1 / UM_PER_PX),
                     metadata={"axes": "TYX", "unit": "um", "finterval": FRAME_S})
    print(f"wrote {OUT.relative_to(ROOT)}: {stack.shape} {stack.dtype}, {OUT.stat().st_size / 1e3:.0f} kB")


if __name__ == "__main__":
    main()
