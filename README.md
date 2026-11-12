# Oilsjt — Aalst Free Roam

A low-poly browser city simulator based on OpenStreetMap and public elevation data for Aalst, Belgium. Work in progress.

## Play

https://vdmkenny.github.io/aalst-free-roam/

## Run locally

Serve `dist` with any static HTTP server, for example `python3 -m http.server 4173 --directory dist`, then open http://localhost:4173.

The browser runs rendering and simulation. No application backend is required. Station departure boards optionally fetch live iRail data; multiplayer is not implemented.

## Deployment

Every push to `main` validates JavaScript syntax and publishes `dist` through GitHub Actions to GitHub Pages. The workflow can also be started manually.

## Data and assets

See [sources and attribution](dist/sources.txt). Map data © OpenStreetMap contributors (ODbL); bundled geographic data is in `dist/city.js`. Elevation data: Digitaal Vlaanderen. Three.js uses the MIT license; selected Kenney models are CC0. Brand marks retain their respective owners' rights. This repository does not relicense third-party data or assets.
