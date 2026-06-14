#!/usr/bin/env node
/*
 * Harvests real Mapillary image IDs near a curated list of well-covered world
 * cities and writes them to src/data/mapillary.json — the primary panorama pool
 * for Free Mode. Random global points almost never hit Mapillary coverage, so
 * we seed from cities (and a few offset points per city, for spread) and resolve
 * a nearby image via the graph API's bbox search.
 *
 * Run: REACT_APP_MAPILLARY_TOKEN=... node scripts/harvest-mapillary.js
 */
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.REACT_APP_MAPILLARY_TOKEN;
if (!TOKEN) {
  console.error('Set REACT_APP_MAPILLARY_TOKEN in the environment.');
  process.exit(1);
}
const OUT = path.join(__dirname, '..', 'src', 'data', 'mapillary.json');
const GRAPH = 'https://graph.mapillary.com/images';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Curated, globally balanced cities with Mapillary coverage. [lat, lng]
const CITIES = [
  // Europe
  [51.507, -0.127], [48.857, 2.352], [40.416, -3.703], [41.385, 2.173], [41.902, 12.496],
  [52.370, 4.895], [48.208, 16.373], [50.075, 14.437], [38.722, -9.139], [47.376, 8.541],
  [59.329, 18.068], [60.169, 24.938], [59.913, 10.752], [52.229, 21.012], [47.497, 19.040],
  [37.983, 23.727], [53.349, -6.260], [50.846, 4.351], [45.464, 9.190], [50.110, 8.682],
  // North America
  [40.712, -74.006], [41.878, -87.629], [37.774, -122.419], [34.052, -118.243], [47.606, -122.332],
  [42.360, -71.058], [43.651, -79.347], [49.282, -123.120], [45.501, -73.567], [25.761, -80.191],
  [30.267, -97.743], [39.739, -104.990], [38.907, -77.036], [32.715, -117.161], [36.169, -115.139],
  // Latin America
  [-23.550, -46.633], [-22.906, -43.172], [-34.603, -58.381], [-33.448, -70.669], [-12.046, -77.042],
  [4.711, -74.072], [19.432, -99.133], [20.659, -103.349], [-34.901, -56.164], [6.244, -75.581],
  // Africa
  [-1.286, 36.817], [-33.924, 18.424], [-26.204, 28.047], [30.044, 31.235], [33.589, -7.603],
  [36.806, 10.181], [14.716, -17.467], [5.603, -0.187], [0.347, 32.582], [-4.043, 39.668],
  // Asia
  [35.681, 139.767], [34.693, 135.502], [37.566, 126.978], [13.756, 100.501], [1.352, 103.819],
  [3.139, 101.687], [-6.208, 106.846], [14.599, 120.984], [21.028, 105.804], [10.823, 106.630],
  [25.033, 121.565], [22.319, 114.169], [19.076, 72.877], [28.613, 77.209], [12.972, 77.595],
  [41.008, 28.978], [32.085, 34.781], [25.205, 55.271], [41.716, 44.827], [43.222, 76.851],
  // Oceania
  [-33.868, 151.209], [-37.814, 144.963], [-27.470, 153.021], [-36.848, 174.763], [-41.286, 174.776],
  [-31.950, 115.860],
];

// City centre plus a couple of ~5 km offsets, so we collect a few images spread
// across the metro rather than all in one block.
const OFFSETS = [[0, 0], [0.05, 0.05], [-0.05, -0.05]];

const bbox = (lat, lng, m) => {
  const dLat = m / 111000;
  const dLng = m / (111000 * Math.cos((lat * Math.PI) / 180));
  return `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
};

// Resolve images near a point, shrinking the box if the area is too dense.
// Fails fast (no retry loops) so the whole harvest stays quick. Returns the
// images array (possibly empty).
async function imagesNear(lat, lng) {
  for (const m of [800, 150]) {
    try {
      const url = `${GRAPH}?fields=id,computed_geometry&bbox=${bbox(lat, lng, m)}&limit=25&access_token=${encodeURIComponent(TOKEN)}`;
      const j = await (await fetch(url)).json();
      if (j.error) {
        if (/reduce the amount/i.test(j.error.message)) continue; // too dense → smaller box
        return []; // transient/other → skip this point
      }
      return j.data || [];
    } catch {
      return [];
    }
  }
  return [];
}

async function main() {
  const out = [];
  const seen = new Set();
  for (let c = 0; c < CITIES.length; c++) {
    const [clat, clng] = CITIES[c];
    let added = 0;
    for (const [dlat, dlng] of OFFSETS) {
      const imgs = await imagesNear(clat + dlat, clng + dlng);
      const img = imgs.find((i) => i.computed_geometry && !seen.has(i.id));
      if (img) {
        const [lng, lat] = img.computed_geometry.coordinates;
        seen.add(img.id);
        out.push({ lat, lng, imageId: img.id });
        added++;
      }
      await sleep(150);
    }
    console.log(`[${c + 1}/${CITIES.length}] ${clat},${clng} → +${added} (total ${out.length})`);
  }
  // Write once at the end so a watching dev server only reloads a single time.
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out) + '\n');
  console.log(`Wrote ${out.length} Mapillary locations to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
