# Alpha Mario — OSINT Intelligence Platform

Real-time open-source intelligence terminal featuring an interactive 3D globe, live signal feed, and multi-domain intelligence modules.

## Features

- **Interactive 3D Globe** — Rotating Earth with live arcs, signal nodes, and ring pulses (powered by globe.gl + Three.js)
- **Live Signal Feed** — Real-time simulated intelligence signals across CYBER, GEOINT, SIGINT, HUMINT, and FININT domains
- **Intelligence Modules** — Six specialized analysis modules with operational status indicators
- **Signal Guide** — Analytical methodology reference with confidence levels and core principles
- **Terminal Widget** — Animated command-line interface with typing effects
- **Dark Intelligence Theme** — CRT scanline overlay, glitch effects, HUD corners, and cyan accent glow
- **Fully Responsive** — Mobile-first design with collapsible navigation
- **Production Security Headers** — CSP, X-Frame-Options, HSTS via Netlify/Vercel configs
- **PWA Ready** — Web app manifest and SVG favicon included

## Tech Stack

- Vanilla HTML / CSS / JavaScript (no build step)
- [Three.js](https://threejs.org/) + [globe.gl](https://globe.gl/) via CDN
- Google Fonts (JetBrains Mono + Inter)

## Deploy

### Netlify
```bash
# Push to GitHub, connect repo in Netlify dashboard
# Publish directory: . (root)
```

### Vercel
```bash
vercel --prod
```

### GitHub Pages
Enable Pages in repo settings, set source to the branch root.

### Any Static Host
Upload the root directory — no build step needed.

## Project Structure

```
├── index.html          # Main page
├── styles.css          # Full stylesheet
├── app.js              # Globe, feed, animations
├── 404.html            # Custom error page
├── manifest.json       # PWA manifest
├── robots.txt          # Search engine directives
├── sitemap.xml         # Sitemap
├── netlify.toml        # Netlify deploy config
├── vercel.json         # Vercel deploy config
└── assets/
    ├── favicon.svg     # SVG favicon
    ├── img/            # Image assets
    └── data/           # Data files
```
