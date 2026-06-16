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

// Seed from the same globally-balanced city list the live game uses, sampling a
// subset (the bundled pool is only an instant-start / offline fallback, so it
// doesn't need to cover all 10k). Random global points almost never hit
// Mapillary coverage, so we seed from cities and resolve a nearby image.
const SAMPLE_CITIES = 250;
const allCities = require('../src/data/mapillary-cities.json');
for (let i = allCities.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [allCities[i], allCities[j]] = [allCities[j], allCities[i]];
}
const CITIES = allCities.slice(0, SAMPLE_CITIES);

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
