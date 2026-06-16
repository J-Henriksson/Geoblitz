// Resolves the city for a coordinate (reverse geocode) and returns that city's
// Wikipedia summary, for the "what's here?" card shown when you click the star.
// Articles are validated to have coordinates near the point, which rejects
// same-named people/disambiguations (e.g. "Fremont" -> John C. Frémont).

import { getDistance } from '../utils/geo';

const REVERSE = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const MAX_KM = 35; // article coords must be within this of the actual point

// Cache by coordinate so duplicate stars (world-copies, preview + click) and
// re-renders share a single lookup.
const cache = new Map();

export function fetchWikiSummary(lat, lng) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (!cache.has(key)) cache.set(key, lookup(lat, lng));
  return cache.get(key);
}

async function summaryFor(title) {
  try {
    return await (await fetch(WIKI_SUMMARY + encodeURIComponent(title))).json();
  } catch {
    return null;
  }
}

// A real place near our point: has geo coordinates within MAX_KM and isn't a
// disambiguation page.
function isNearPlace(s, lat, lng) {
  return (
    s &&
    s.type !== 'disambiguation' &&
    s.coordinates &&
    getDistance(lat, lng, s.coordinates.lat, s.coordinates.lon) <= MAX_KM
  );
}

function toResult(s, title) {
  return {
    title: s.title || title,
    extract: s.extract || '',
    thumbnail: s.thumbnail?.source || null,
    url:
      s.content_urls?.desktop?.page ||
      `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  };
}

async function lookup(lat, lng) {
  try {
    const rev = await (
      await fetch(`${REVERSE}?latitude=${lat}&longitude=${lng}&localityLanguage=en`)
    ).json();
    const state = rev.principalSubdivision;
    const country = rev.countryName;

    // The reverse geocoder's `city` is sometimes the metro and `locality` the
    // actual town (or vice-versa), so try both. Each candidate is validated by
    // coordinate distance, so the wrong one (a far metro) is rejected.
    const titles = [];
    const addTitles = (name) => {
      if (!name) return;
      if (state && state !== name) titles.push(`${name}, ${state}`);
      if (country) titles.push(`${name}, ${country}`);
      titles.push(name);
    };
    addTitles(rev.city);
    addTitles(rev.locality);
    if (!titles.length) addTitles(rev.principalSubdivision);

    for (const t of [...new Set(titles)]) {
      const s = await summaryFor(t);
      if (isNearPlace(s, lat, lng)) return toResult(s, t);
    }

    // Fallback 1: text search, validated by coordinates.
    const name = rev.city || rev.locality || rev.principalSubdivision;
    if (name) {
      const sr = await (
        await fetch(
          `${WIKI_API}?action=query&format=json&origin=*&list=search&srlimit=5&srsearch=${encodeURIComponent(
            `${name} ${country || ''}`.trim()
          )}`
        )
      ).json();
      for (const hit of sr.query?.search || []) {
        const s = await summaryFor(hit.title);
        if (isNearPlace(s, lat, lng)) return toResult(s, hit.title);
      }
    }

    // Fallback 2: nearest geotagged article, preferring a settlement over a
    // landmark. Ensures we show *something* whenever a place exists nearby.
    const geo = await (
      await fetch(
        `${WIKI_API}?action=query&format=json&origin=*&list=geosearch&gscoord=${lat}%7C${lng}&gsradius=10000&gslimit=15`
      )
    ).json();
    const hits = geo.query?.geosearch || [];
    const summaries = await Promise.all(hits.map((h) => summaryFor(h.title)));
    const SETTLEMENT = /\b(capital|cit(y|ies)|town|village|municipalit|settlement|commune|borough|prefecture|district|county)\b/i;
    let nearest = null;
    for (let i = 0; i < hits.length; i++) {
      const s = summaries[i];
      if (!isNearPlace(s, lat, lng)) continue;
      if (SETTLEMENT.test(s.description || '')) return toResult(s, hits[i].title);
      if (!nearest) nearest = toResult(s, hits[i].title); // nearest valid article
    }
    return nearest;
  } catch {
    return null;
  }
}
