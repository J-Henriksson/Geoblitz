import React, { useCallback, useEffect, useRef } from 'react';
import useGeoGame from '../hooks/useGeoGame';
import PannellumPanorama from './PannellumPanorama';
import MapillaryPanorama from './MapillaryPanorama';
import GuessPanel from './GuessPanel';
import locations from '../data/locations.json';
import { fetchRandomCommonsPanorama, MIN_SEPARATION_KM } from '../services/commonsLive';
import {
  fetchRandomMapillaryLocation,
  getBundledMapillaryLocation,
  MAPILLARY_AVAILABLE,
} from '../services/mapillary';
import { getDistance } from '../utils/geo';

const QUEUE_CAP = 6; // max prefetched live panoramas held at once

const keyOf = (entry) => entry.imageId || entry.imageUrl;

const toProviderData = (entry) => ({
  target: { lat: entry.lat, lng: entry.lng },
  kind: entry.kind || 'static',
  imageId: entry.imageId, // Mapillary
  imageUrl: entry.imageUrl, // Commons
  credit: entry.credit,
});

// Instant pick from the bundled Commons pool, avoiding entries already shown or
// within MIN_SEPARATION_KM of one already used.
const pickStaticLocation = (usedSet, usedCoords) => {
  const fresh = locations.filter(
    (e) =>
      !usedSet.has(e.imageUrl) &&
      usedCoords.every((u) => getDistance(e.lat, e.lng, u.lat, u.lng) > MIN_SEPARATION_KM)
  );
  const pool = fresh.length ? fresh : locations;
  return { ...pool[Math.floor(Math.random() * pool.length)], kind: 'static' };
};

// Warm the browser cache with a queued location's image so it renders quickly
// when its round arrives (Mapillary thumbnail, or the Commons panorama).
const preloadImage = (entry) => {
  const url = entry.thumbUrl || entry.imageUrl;
  if (!url) return;
  const img = new Image();
  img.crossOrigin = 'anonymous'; // match how the viewers fetch (CORS textures)
  img.src = url;
};

function NoApiGame() {
  const queueRef = useRef([]);          // prefetched Commons panoramas (fallback)
  const usedRef = useRef(new Set());    // image ids/urls already shown
  const usedCoordsRef = useRef([]);     // {lat,lng} shown, for proximity dedup
  const inFlightRef = useRef(0);        // Commons fetches currently running

  // Record a location so later picks avoid it (by id/url and by proximity).
  // Kept in memory only: persists across games (Play Again) but a page refresh
  // starts fresh.
  const markUsed = useCallback((entry) => {
    usedRef.current.add(keyOf(entry));
    usedCoordsRef.current.push({ lat: entry.lat, lng: entry.lng });
  }, []);

  // Resolve one fresh location live: Mapillary first, Commons as fallback.
  const fetchNext = useCallback(async () => {
    if (MAPILLARY_AVAILABLE) {
      const m = await fetchRandomMapillaryLocation(usedRef.current, usedCoordsRef.current);
      if (m) return m;
    }
    const c = await fetchRandomCommonsPanorama(usedRef.current, usedCoordsRef.current);
    return c ? { ...c, kind: 'static' } : null;
  }, []);

  // Background-prefetch upcoming rounds (parallel, staggered, fire-and-forget).
  const fillQueue = useCallback(
    (n) => {
      const room = QUEUE_CAP - queueRef.current.length - inFlightRef.current;
      const count = Math.max(0, Math.min(n, room));
      for (let i = 0; i < count; i++) {
        inFlightRef.current++;
        const launch = () =>
          fetchNext()
            .then((entry) => {
              if (entry && !usedRef.current.has(keyOf(entry)) && queueRef.current.length < QUEUE_CAP) {
                markUsed(entry); // mark at queue time so parallel fetches avoid it
                preloadImage(entry); // warm the cache so it renders fast on its turn
                queueRef.current.push(entry);
              }
            })
            .finally(() => {
              inFlightRef.current--;
            });
        setTimeout(launch, i * 300);
      }
    },
    [fetchNext, markUsed]
  );

  // Start prefetching rounds 2+ while the player looks at round 1.
  useEffect(() => {
    fillQueue(4);
  }, [fillQueue]);

  const loadNextLocation = useCallback(async () => {
    // 1. Use a prefetched live location if one is ready (instant).
    if (queueRef.current.length > 0) {
      const entry = queueRef.current.shift(); // already marked used
      fillQueue(2);
      return toProviderData(entry);
    }
    // 2. Otherwise fetch a fresh live location now (e.g. round 1). This avoids
    //    always pulling round 1 from the small bundled pool, which repeats.
    const live = await fetchNext();
    if (live) {
      markUsed(live);
      preloadImage(live);
      fillQueue(2);
      return toProviderData(live);
    }
    // 3. Last resort (offline / live failed): instant bundled pick.
    const entry =
      (MAPILLARY_AVAILABLE && getBundledMapillaryLocation(usedRef.current, usedCoordsRef.current)) ||
      pickStaticLocation(usedRef.current, usedCoordsRef.current);
    markUsed(entry);
    fillQueue(2);
    return toProviderData(entry);
  }, [fetchNext, fillQueue, markUsed]);

  const game = useGeoGame(loadNextLocation);
  const { providerData, loading } = game;
  const isResultMode = !!game.distancePath || game.summaryModalOpen;

  // If a Mapillary image renders, reset the recovery guard; if the viewer gets
  // stuck (frozen black), reload this round with another location (verified
  // fetches make it rare, so cap consecutive retries to avoid any loop).
  const stuckRetriesRef = useRef(0);
  const onPanoReady = useCallback(() => {
    stuckRetriesRef.current = 0;
  }, []);
  const onPanoStuck = useCallback(() => {
    if (game.distancePath || stuckRetriesRef.current >= 4) return; // not while a guess is in
    stuckRetriesRef.current += 1;
    game.playAgain(); // reload the round with a fresh location
  }, [game]);

  return (
    <div className={`game-container${isResultMode ? ' result-mode' : ''}`}>
      {/* Panorama (fullscreen on mobile / left half on desktop). The viewer
          stays mounted across rounds and transitions via moveTo, so switching
          locations doesn't flash. The loader only shows before the first one. */}
      {providerData && providerData.kind === 'mapillary' ? (
        <MapillaryPanorama
          imageId={providerData.imageId}
          loading={loading}
          onReady={onPanoReady}
          onStuck={onPanoStuck}
        />
      ) : providerData && providerData.kind === 'static' ? (
        <PannellumPanorama imageUrl={providerData.imageUrl} credit={providerData.credit} />
      ) : (
        <div className="streetview-container loading-panorama">Finding a location…</div>
      )}

      <GuessPanel game={game} />
    </div>
  );
}

export default NoApiGame;
