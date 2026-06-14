// Mapillary panorama source (primary for Free Mode).
//
// Random global points almost never hit Mapillary coverage, so we seed from a
// list of well-covered world cities and resolve a *fresh* image near a random
// one each round via the graph API — effectively unlimited variety. A bundled
// pool (src/data/mapillary.json, from scripts/harvest-mapillary.js) provides an
// instant round-1 start and an offline fallback when a live lookup fails.

import bundledPool from '../data/mapillary.json';
import CITIES from '../data/mapillary-cities.json';
import { getDistance } from '../utils/geo';
import { MIN_SEPARATION_KM } from './commonsLive';

// Baked-in token so visitors don't need their own (see .env.local).
export const MAPILLARY_TOKEN = process.env.REACT_APP_MAPILLARY_TOKEN || '';
export const MAPILLARY_AVAILABLE = !!MAPILLARY_TOKEN;

const GRAPH = 'https://graph.mapillary.com/images';

// CITIES: ~280 well-covered, globally balanced [lat, lng] seed points
// (src/data/mapillary-cities.json). Each round live-resolves a fresh image near
// a random one, so variety is the whole world's worth of imagery, not a fixed
// set of images.

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const bboxStr = (lat, lng, m) => {
  const dLat = m / 111000;
  const dLng = m / (111000 * Math.cos((lat * Math.PI) / 180));
  return `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
};

// Resolve images near a point, shrinking the box if the area is too dense.
async function imagesNear(lat, lng) {
  for (const m of [800, 150]) {
    try {
      const url = `${GRAPH}?fields=id,computed_geometry,thumb_2048_url&bbox=${bboxStr(lat, lng, m)}&limit=25&access_token=${encodeURIComponent(MAPILLARY_TOKEN)}`;
      const j = await (await fetch(url)).json();
      if (j.error) {
        if (/reduce the amount/i.test(j.error.message)) continue; // too dense → smaller box
        return [];
      }
      return j.data || [];
    } catch {
      return [];
    }
  }
  return [];
}

const farEnough = (lat, lng, usedCoords) =>
  usedCoords.every((u) => getDistance(lat, lng, u.lat, u.lng) > MIN_SEPARATION_KM);

// LIVE primary: resolve a fresh image near a random seed city. Tries several
// cities (with a few km of jitter so repeat visits land on different streets).
// Returns { lat, lng, kind, imageId } or null.
export async function fetchRandomMapillaryLocation(usedSet = new Set(), usedCoords = []) {
  if (!MAPILLARY_TOKEN) return null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const [clat, clng] = randomChoice(CITIES);
    const jLat = clat + (Math.random() - 0.5) * 0.06; // ~±3 km
    const jLng = clng + (Math.random() - 0.5) * 0.06;
    const imgs = await imagesNear(jLat, jLng);
    const candidates = shuffle(
      imgs
        .filter((im) => im.computed_geometry && !usedSet.has(im.id))
        .map((im) => ({
          imageId: im.id,
          lng: im.computed_geometry.coordinates[0],
          lat: im.computed_geometry.coordinates[1],
          thumbUrl: im.thumb_2048_url, // for cache pre-warming
        }))
        .filter((c) => farEnough(c.lat, c.lng, usedCoords))
    );
    if (candidates.length) {
      const c = candidates[0];
      return { lat: c.lat, lng: c.lng, kind: 'mapillary', imageId: c.imageId, thumbUrl: c.thumbUrl };
    }
  }
  return null;
}

// Instant pick from the bundled pool (round-1 start / offline fallback).
export function getBundledMapillaryLocation(usedSet = new Set(), usedCoords = []) {
  if (!MAPILLARY_TOKEN || bundledPool.length === 0) return null;
  const fresh = bundledPool.filter(
    (e) => !usedSet.has(e.imageId) && farEnough(e.lat, e.lng, usedCoords)
  );
  const pool = fresh.length ? fresh : bundledPool;
  const e = pool[Math.floor(Math.random() * pool.length)];
  return { lat: e.lat, lng: e.lng, kind: 'mapillary', imageId: e.imageId };
}
