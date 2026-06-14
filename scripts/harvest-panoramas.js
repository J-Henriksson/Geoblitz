#!/usr/bin/env node
/*
 * Harvests real, working CC-licensed equirectangular 360° panoramas from
 * Wikimedia Commons and writes them to src/data/locations.json for use as the
 * no-API static-panorama fallback.
 *
 * Pipeline:
 *   1. Discover file titles by recursively walking panorama category trees
 *      (cheap, titles only).
 *   2. Batch-fetch metadata; keep files that are geotagged, ~2:1 equirectangular,
 *      and expose a web-renderable thumbnail.
 *   3. Verify each thumbnail URL loads (ranged GET, with backoff for Wikimedia's
 *      rate-limited on-demand thumbnail generation).
 *
 * Run: npm run harvest:panoramas
 */
const fs = require('fs');
const path = require('path');

const API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'GeoBlitz-PanoramaHarvester/1.0 (https://github.com/J-Henriksson/Geoblitz)';
const TARGET = 100;
const THUMB_WIDTH = 1600; // modest size: cheaper to render, less likely to 429
const MAX_FILES = 4000; // discovery cap (flat pagination of root categories)
const CANDIDATE_CAP = 220; // metadata candidates to gather before verifying
const OUT_FILE = path.join(__dirname, '..', 'src', 'data', 'locations.json');

// Root categories rich in geotagged spherical panoramas; we recurse subcats.
const CATEGORIES = [
  'Category:Spherical panoramics',
  'Category:360° panoramas',
  'Category:Equirectangular panoramas',
  'Category:Photo spheres',
  'Category:360-degree panoramas',
  'Category:VR photographs',
  'Category:360 panoramas',
  'Category:Equirectangular projection',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s) => (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

// True-north heading of the panorama centre, from GPSImgDirection when present.
const parseRational = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.includes('/')) {
    const [n, d] = v.split('/').map(Number);
    return d ? n / d : NaN;
  }
  return Number(v);
};
const getNorthOffset = (info) => {
  if (!Array.isArray(info.metadata)) return undefined;
  const dir = info.metadata.find((x) => x.name === 'GPSImgDirection');
  if (!dir) return undefined;
  const deg = parseRational(dir.value);
  return Number.isFinite(deg) ? ((deg % 360) + 360) % 360 : undefined;
};

async function apiGet(params) {
  const url = `${API}?${new URLSearchParams({ ...params, format: 'json' })}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// --- Phase 1: discovery (titles only) ----------------------------------------

// Paginate a single category's direct file members (fast, flat). Deep
// subcategory walking was prohibitively slow and rate-limit prone; the big
// global categories (e.g. "360° panoramas") expose thousands of direct files,
// which is plenty for a varied title index.
async function* categoryFiles(category) {
  let cont;
  do {
    const data = await apiGet({
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmtype: 'file',
      cmlimit: '500',
      ...(cont ? { cmcontinue: cont } : {}),
    });
    for (const m of data?.query?.categorymembers || []) yield m.title;
    cont = data?.continue?.cmcontinue;
    await sleep(120);
  } while (cont);
}

async function discoverFileTitles() {
  const fileTitles = new Set();

  for (const root of CATEGORIES) {
    if (fileTitles.size >= MAX_FILES) break;
    console.log(`Discovering files in ${root} …`);
    try {
      for await (const title of categoryFiles(root)) {
        fileTitles.add(title);
        if (fileTitles.size >= MAX_FILES) break;
      }
    } catch (e) {
      console.warn(`  skipped ${root}: ${e.message}`);
    }
  }
  return [...fileTitles];
}

// --- Phase 2: metadata + filtering -------------------------------------------

const funnel = { files: 0, noCoord: 0, badRatio: 0, noThumb: 0, kept: 0 };

function toEntry(page) {
  funnel.files++;
  const info = page.imageinfo && page.imageinfo[0];
  const coord = page.coordinates && page.coordinates[0];
  if (!info || !coord) { funnel.noCoord++; return null; }

  const { width, height, thumburl, extmetadata } = info;
  if (!width || !height) { funnel.noThumb++; return null; }
  if (Math.abs(width / height - 2) > 0.04) { funnel.badRatio++; return null; } // true 2:1
  if (!thumburl) { funnel.noThumb++; return null; } // web-renderable raster only

  // Omit the author/uploader: their name often contains a place that would
  // give away the location.
  const license = stripHtml(extmetadata?.LicenseShortName?.value);
  const credit = `${license ? license + ' · ' : ''}Wikimedia Commons`;

  funnel.kept++;
  return { lat: coord.lat, lng: coord.lon, imageUrl: thumburl, credit, northOffset: getNorthOffset(info) };
}

async function gatherCandidates(titles) {
  const candidates = [];
  const seen = new Set();
  for (let i = 0; i < titles.length && candidates.length < CANDIDATE_CAP; i += 50) {
    const batch = titles.slice(i, i + 50);
    let data;
    try {
      data = await apiGet({
        action: 'query',
        titles: batch.join('|'),
        prop: 'imageinfo|coordinates',
        iiprop: 'url|size|extmetadata|metadata',
        iiurlwidth: String(THUMB_WIDTH),
        coprop: 'type',
      });
    } catch (e) {
      console.warn(`  metadata batch failed: ${e.message}`);
      continue;
    }
    for (const page of Object.values(data?.query?.pages || {})) {
      const entry = toEntry(page);
      if (entry && !seen.has(entry.imageUrl)) {
        seen.add(entry.imageUrl);
        candidates.push(entry);
      }
    }
    await sleep(120);
  }
  return candidates;
}

// --- Phase 3: verification ---------------------------------------------------

async function urlOk(url) {
  let lastStatus = 'err';
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-0' },
      });
      if (res.ok) return true;
      lastStatus = res.status;
      if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; } // backoff
      break; // non-retryable
    } catch (e) {
      lastStatus = e.message;
      await sleep(1000);
    }
  }
  if (process.env.DEBUG_VERIFY) console.log(`  FAIL [${lastStatus}] ${url}`);
  return false;
}

// --- main --------------------------------------------------------------------

async function main() {
  const titles = await discoverFileTitles();
  console.log(`Discovered ${titles.length} file titles.`);

  // Shuffle so we don't over-sample a single city's category.
  for (let i = titles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [titles[i], titles[j]] = [titles[j], titles[i]];
  }

  const candidates = await gatherCandidates(titles);
  console.log('Funnel:', JSON.stringify(funnel));
  console.log(`Collected ${candidates.length} candidates; verifying URLs…`);

  const verified = [];
  let checked = 0;
  for (const entry of candidates) {
    if (verified.length >= TARGET) break;
    checked++;
    if (await urlOk(entry.imageUrl)) {
      verified.push(entry);
      if (verified.length % 10 === 0) console.log(`  verified ${verified.length}/${checked} checked`);
    }
    await sleep(350); // pace requests to avoid rate limits
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(verified, null, 2) + '\n');
  console.log(`Wrote ${verified.length} verified panoramas to ${OUT_FILE}`);
  if (verified.length < TARGET) console.warn(`Note: ${verified.length}/${TARGET} entries found.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
