// Live random Wikimedia Commons panorama fetcher.
//
// Each call queries the live "360° panoramas" category sorted by filename,
// starting at a random alphabet prefix (a single generator=categorymembers
// request that returns the files *with* their imageinfo + coordinates), then
// keeps the geotagged 2:1 panoramas and verifies one loads. Sorting by name and
// jumping to a random prefix spreads sampling evenly across the whole category;
// sampling by upload date instead heavily over-returned the oldest batch,
// because the category only filled up in recent years.

import { getDistance } from '../utils/geo';

const API = 'https://commons.wikimedia.org/w/api.php';
const THUMB_WIDTH = 1920;
const MAX_ATTEMPTS = 4;
// Contributors upload big batches of the same spot, so reject any candidate
// within this distance of one already used this game — enough to drop duplicate
// shots of one place without over-restricting genuinely nearby locations.
export const MIN_SEPARATION_KM = 5;
// Commons' main global panorama category. It holds thousands of files directly
// (most other panorama categories nest everything in sub-categories), so a
// random window reliably contains several usable, geotagged panoramas.
const CATEGORY = 'Category:360° panoramas';

// A random 2-character sort-key prefix. Listing the category by filename from a
// random prefix gives an even, well-distributed slice of the world each call.
const PREFIX_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const randomChar = () => PREFIX_CHARS[Math.floor(Math.random() * PREFIX_CHARS.length)];
const randomPrefix = () => randomChar() + randomChar();

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const stripHtml = (s) => (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

// EXIF rationals come as "num/den" strings (e.g. "341271/1000" → 341.271).
const parseRational = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.includes('/')) {
    const [n, d] = v.split('/').map(Number);
    return d ? n / d : NaN;
  }
  return Number(v);
};

// True-north heading of the panorama centre, from GPSImgDirection when present.
// Used as Pannellum's northOffset so the compass points to real north.
const getNorthOffset = (info) => {
  if (!Array.isArray(info.metadata)) return undefined;
  const dir = info.metadata.find((x) => x.name === 'GPSImgDirection');
  if (!dir) return undefined;
  const deg = parseRational(dir.value);
  return Number.isFinite(deg) ? ((deg % 360) + 360) % 360 : undefined;
};

async function apiGet(params) {
  const url = `${API}?${new URLSearchParams({ ...params, format: 'json', origin: '*' })}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); // back off and retry
      continue;
    }
    throw new Error(`Commons API ${res.status}`);
  }
  throw new Error('Commons API 429 (gave up)');
}

function toEntry(page, usedSet) {
  const info = page.imageinfo && page.imageinfo[0];
  const coord = page.coordinates && page.coordinates[0];
  if (!info || !coord) return null;

  const { width, height, thumburl, extmetadata } = info;
  if (!width || !height) return null;
  if (Math.abs(width / height - 2) > 0.04) return null; // true 2:1 equirectangular
  if (!thumburl || usedSet.has(thumburl)) return null;

  // Deliberately omit the author/uploader: their name often contains a place
  // (e.g. "Herbert Weber, Hildesheim") that would give away the location.
  const license = stripHtml(extmetadata?.LicenseShortName?.value);
  const credit = `${license ? license + ' · ' : ''}Wikimedia Commons`;

  return { lat: coord.lat, lng: coord.lon, imageUrl: thumburl, credit, northOffset: getNorthOffset(info) };
}

// Confirm the thumbnail actually loads. We use an Image() rather than a fetch
// with a Range header: a Range request isn't CORS-safelisted, so the browser
// would send a preflight that upload.wikimedia.org doesn't answer, making every
// check fail. Loading via Image() avoids that entirely and pre-warms the cache
// (with the same crossOrigin Pannellum uses) so the panorama renders instantly.
function imageLoads(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false); // 404 / 429 / decode error → try next
    img.src = url;
  });
}

// The category is ~74% Europe / ~12% North America, so without help you rarely
// see anywhere else. Rank candidates by how under-represented their region is
// and try the rarest first, surfacing Africa/Asia/etc. far more often than
// their raw share while still falling back to common regions when a window has
// nothing else. Lower rank = rarer = preferred.
const inBox = (la, lo, latMin, latMax, lngMin, lngMax) =>
  la > latMin && la < latMax && lo > lngMin && lo < lngMax;
const regionRank = ({ lat, lng }) => {
  if (inBox(lat, lng, 34, 72, -12, 45)) return 2; // Europe (most common)
  if (inBox(lat, lng, 15, 72, -170, -50)) return 1; // North America
  return 0; // everywhere else (rarest) — prefer
};

// Returns { lat, lng, imageUrl, credit, northOffset } or null on failure.
// `usedCoords` is a list of {lat,lng} already shown, used to reject nearby
// duplicates (batch uploads of the same place).
export async function fetchRandomCommonsPanorama(usedSet = new Set(), usedCoords = []) {
  const farEnough = (c) =>
    usedCoords.every((u) => getDistance(c.lat, c.lng, u.lat, u.lng) > MIN_SEPARATION_KM);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const data = await apiGet({
        action: 'query',
        generator: 'categorymembers',
        gcmtitle: CATEGORY,
        gcmtype: 'file',
        gcmsort: 'sortkey',
        gcmstartsortkeyprefix: randomPrefix(),
        gcmlimit: '50',
        prop: 'imageinfo|coordinates',
        iiprop: 'url|size|extmetadata|metadata',
        iiurlwidth: String(THUMB_WIDTH),
        coprop: 'type',
      });

      // Shuffle for randomness within a region, then stable-sort so the rarest
      // regions are tried first.
      const candidates = shuffle(
        Object.values(data?.query?.pages || {})
          .map((p) => toEntry(p, usedSet))
          .filter(Boolean)
          .filter(farEnough)
      ).sort((a, b) => regionRank(a) - regionRank(b));

      for (const candidate of candidates) {
        if (await imageLoads(candidate.imageUrl)) return candidate;
      }
      // Nothing usable in this window (sparse prefix / all too close) → retry.
    } catch (e) {
      console.error('Commons live fetch failed:', e);
    }
  }
  return null;
}
