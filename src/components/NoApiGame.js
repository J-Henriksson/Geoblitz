import React, { useCallback, useEffect, useRef } from 'react';
import useGeoGame, { TOTAL_ROUNDS } from '../hooks/useGeoGame';
import PannellumPanorama from './PannellumPanorama';
import MapillaryPanorama from './MapillaryPanorama';
import LeafletGuessMap from './LeafletGuessMap';
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
    let entry;
    if (queueRef.current.length > 0) {
      entry = queueRef.current.shift(); // fresh live location (already marked used)
    } else {
      // Queue not ready (e.g. round 1, or a slow network): instant bundled pick.
      entry =
        (MAPILLARY_AVAILABLE && getBundledMapillaryLocation(usedRef.current, usedCoordsRef.current)) ||
        pickStaticLocation(usedRef.current, usedCoordsRef.current);
      markUsed(entry);
    }
    fillQueue(2); // keep the queue topped up
    return toProviderData(entry);
  }, [fillQueue, markUsed]);

  const game = useGeoGame(loadNextLocation);
  const { providerData, loading } = game;
  const inRoundResult = !!game.distancePath && !game.summaryModalOpen;
  const isLastRound = game.round >= TOTAL_ROUNDS;
  const isResultMode = inRoundResult || game.summaryModalOpen;

  return (
    <div className={`game-container${isResultMode ? ' result-mode' : ''}`}>
      {/* Left: fullscreen panorama */}
      {loading || !providerData ? (
        <div className="streetview-container loading-panorama">Finding a location…</div>
      ) : providerData.kind === 'mapillary' ? (
        <MapillaryPanorama imageId={providerData.imageId} />
      ) : (
        <PannellumPanorama imageUrl={providerData.imageUrl} credit={providerData.credit} />
      )}

      {/* Right: map panel */}
      <div className="map-container">
        <LeafletGuessMap
          guessLocation={game.guessLocation}
          target={game.target}
          distancePath={game.distancePath}
          summaryModalOpen={game.summaryModalOpen}
          allMarkers={game.allMarkers}
          allPolylines={game.allPolylines}
          onMapClick={game.setGuess}
          resultMode={isResultMode}
        />
        {!isResultMode && (
          <button
            className="confirm-btn"
            onClick={game.confirmGuess}
            disabled={!game.guessLocation}
          >
            Confirm Guess
          </button>
        )}
        {game.summaryModalOpen && (
          <div className="result-bar">
            <div className="result-distance">
              <span className="final-avg">{Math.round(game.averageDistance)} km</span>
              <small>average distance</small>
            </div>
            <button className="result-action-button" onClick={game.resetGame}>
              Play Again
            </button>
          </div>
        )}
        {inRoundResult && (
          <div className="result-bar">
            <div className="result-distance">
              <span>{Math.round(game.distance ?? 0)} km away</span>
            </div>
            <button
              className="result-action-button"
              onClick={isLastRound ? game.showSummary : game.playAgain}
            >
              {isLastRound ? `Breakdown` : `Next Round`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default NoApiGame;
