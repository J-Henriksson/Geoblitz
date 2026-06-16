# GeoBlitz

GeoBlitz is a web-based game where players are dropped into a random street-level location with the goal of pinpointing where they are on a world map, using only the visual clues in their surroundings.

GeoBlitz can be played in one of two interchangeable ways:

* **Free mode (default, no key needed):** live street-level imagery from [Mapillary](https://www.mapillary.com/), drawn each round from a random one of ~10,000 globally-distributed cities. If a live lookup fails, it falls back to a bundled set of Mapillary images, then to geotagged 360° panoramas from Wikimedia Commons (rendered with [Pannellum](https://pannellum.org/)).
* **Google Street View mode (optional):** classic Google Street View, enabled by entering your own Google Maps API key in-app.

Both modes share the same guess map ([Leaflet](https://leafletjs.com/) + OpenStreetMap) and the same game loop: 5 rounds, Haversine distance scoring, and a summary.

### Features
* Effectively unlimited, globally-spread locations via live Mapillary
* Plays instantly with no API key
* Optional Google Street View by adding a Google Maps key in-app
* Mobile layout: fullscreen street view with a slide-up guess map
* GeoGuessr-style compass, distance scoring, and 5-round summary

## Development Stack
* **Frontend:** React.js (Create React App)
* **Guess map:** Leaflet + OpenStreetMap
* **Panoramas:** Mapillary (mapillary-js) / Pannellum, or Google Street View

## Running locally

### 1. Install dependencies
```bash
npm install
```

### 2. (Optional) Set the Mapillary token
Free mode uses a Mapillary access token, baked in at build time. Create a `.env.local` file:
```
REACT_APP_MAPILLARY_TOKEN=MLY|your|token
```
Get a free token at the [Mapillary developer dashboard](https://www.mapillary.com/dashboard/developers). Without a token, free mode falls back to the bundled Wikimedia Commons panoramas. (`.env.local` is gitignored; restart the dev server after changing it.)

### 3. Run the app
```bash
npm start
```

### 4. (Optional) Use Google Street View
Click **Use Google Maps API** (or the in-game cogwheel), paste a Google Maps API key, and the game switches to Google Street View mode. Get a key from the [Google Cloud Console](https://console.cloud.google.com/). The key is stored only in your browser's `localStorage`.

## Deploying to GitHub Pages

```bash
npm run deploy
```

This builds the app (using your local `.env.local` token) and pushes the output to the `gh-pages` branch. In the repo's **Settings → Pages**, set the source to **Deploy from a branch → `gh-pages` → `/ (root)`**. The live URL is configured via the `homepage` field in `package.json`.

Note: the Mapillary token is a public client token, so it is visible in the deployed JavaScript. This is expected and carries no billing risk; regenerate it in the Mapillary dashboard if it is ever abused.

## Regenerating the location data

Two bundled datasets back the live sources (both are committed, so you only need to regenerate them to refresh the pools):

* **`src/data/mapillary-cities.json`** is the ~10,000 seed cities the live game samples from.
* **`src/data/mapillary.json`** is a bundled set of verified Mapillary images for an instant first round and offline fallback. Regenerate it (samples a subset of the seed cities) with:
  ```bash
  REACT_APP_MAPILLARY_TOKEN=MLY|your|token npm run harvest:mapillary
  ```
* **`src/data/locations.json`** is the Wikimedia Commons panorama fallback (geotagged, 2:1 equirectangular, every URL verified). Regenerate with:
  ```bash
  npm run harvest:panoramas
  ```

Run the harvest scripts with the dev server stopped (they rewrite data files, which would otherwise trigger hot reloads).
