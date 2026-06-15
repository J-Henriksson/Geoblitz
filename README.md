# GeoBlitz

GeoBlitz is a web-based game where players are dropped into a random street-level location with the goal of pinpointing where they are on a world map, using only the visual clues in their surroundings.

GeoBlitz can be played in one of two interchangeable ways:

* **Google mode**: classic Google Street View + Google Maps (requires a Google Maps API key).
* **Free / no-Google-key mode**: random geotagged 360° panoramas from Wikimedia Commons, rendered with [Pannellum](https://pannellum.org/), over a [Leaflet](https://leafletjs.com/) guess map.

**No keys are required to play free mode.** A Google key is optional for Google Street View mode.

Both modes follow the exact same game loop (5 rounds, distance scoring, summary).

### Features
* Randomized Wikimedia Commons panorama locations
* Works without a Google key
* Optional Google Street View with a Google Maps key
* Instant no-key rounds from a local Wikimedia Commons panorama dataset
* Haversine distance scoring with a 5-round summary

## Development Stack
* **Frontend:** React.js
* **Maps:** Google Maps API *or* Leaflet + OpenStreetMap
* **Panoramas:** Google Street View *or* Pannellum

## How to Play

### 1. Install dependencies
```bash
npm install
```

### 2. Run the app
```bash
npm start
```

### 3. (Optional) Add a Google Maps key
Open the settings gear (top-right corner) at any time to add, change, or clear it:

* **Google Maps API key**: enables Google Street View mode. Get one from the
  [Google Cloud Console](https://console.cloud.google.com/).

The Google key is stored in your browser's `localStorage`. Free mode uses the
bundled Wikimedia Commons panorama dataset and does not require any API key.

## Maintaining the static panorama library

The free-mode panoramas live in `src/data/locations.json` and are generated from
geotagged, CC-licensed equirectangular images on Wikimedia Commons:

```bash
npm run harvest:panoramas
```

The script discovers candidates, keeps only true 2:1 equirectangular images with
GPS coordinates, and verifies every image URL loads before writing the file.
