"""Web MicroView web interface (FastAPI + plain ES-module front end).

Contents:
    app.py      FastAPI app: static front end at /, JSON API under /api, STATIC_ENDPOINTS for the Pages export
    tiff_io.py  upload helpers around the repo's image_utils / tiff_meta (metadata, raw page decoding, demo check)
    static/     the browser viewer: pure-JS TIFF reader (tiff_*.js), image_math.js (port of image_utils.py),
                page modules, node tests (*.test.mjs) and the synthetic demo stack (static/demo/)
"""
