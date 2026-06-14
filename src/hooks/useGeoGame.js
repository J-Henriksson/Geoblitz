import { useCallback, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { getDistance } from '../utils/geo';

export const TOTAL_ROUNDS = 5;
const CONFETTI_THRESHOLD_KM = 5; // celebrate a guess this close to the target

// Provider-agnostic game loop shared by the Google and no-API modes.
//
// `loadNextLocation` is an async function supplied by the caller that resolves
// the next round's panorama. It must return:
//   { target: { lat, lng }, ...providerData }
// where `target` is the true location used for scoring and `providerData` is
// whatever the panorama component needs to render, such as a static imageUrl.
export default function useGeoGame(loadNextLocation) {
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState(null);
  const [providerData, setProviderData] = useState(null);
  const [guessLocation, setGuessLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [distances, setDistances] = useState([]);
  const [distancePath, setDistancePath] = useState(null);
  const [allMarkers, setAllMarkers] = useState([]);
  const [allPolylines, setAllPolylines] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRound = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadNextLocation();
      const { target: nextTarget, ...rest } = result;
      setTarget(nextTarget);
      setProviderData(rest);
    } catch (error) {
      console.error('Failed to load next location:', error);
    } finally {
      setLoading(false);
    }
  }, [loadNextLocation]);

  // Load the first round on mount.
  useEffect(() => {
    loadRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Place / move the guess pin. Blocked while a result/summary modal is open.
  const setGuess = useCallback(
    (latlng) => {
      if (isModalOpen || summaryModalOpen) return;
      setGuessLocation(latlng);
      setDistancePath(null);
    },
    [isModalOpen, summaryModalOpen]
  );

  const confirmGuess = useCallback(() => {
    if (!guessLocation || !target) return;

    const dist = getDistance(target.lat, target.lng, guessLocation.lat, guessLocation.lng);
    if (dist <= CONFETTI_THRESHOLD_KM) {
      // High z-index so it draws above the fullscreen panorama/map and modals.
      confetti({ particleCount: 140, spread: 75, origin: { y: 0.6 }, zIndex: 3000 });
    }
    const path = [
      { lat: target.lat, lng: target.lng },
      { lat: guessLocation.lat, lng: guessLocation.lng },
    ];
    const nextRound = round + 1;

    setDistance(dist);
    setDistancePath(path);
    setDistances((prev) => [...prev, dist]);
    setAllPolylines((prev) => [...prev, path]);
    setAllMarkers((prev) => [...prev, { guessLocation, target }]);
    setRound(nextRound);

    // Show the per-round result for every round (including the last). The
    // summary is only opened later, via showSummary (the "Breakdown" button).
    setIsModalOpen(true);
  }, [guessLocation, target, round]);

  const showSummary = useCallback(() => setSummaryModalOpen(true), []);

  const playAgain = useCallback(() => {
    setIsModalOpen(false);
    setGuessLocation(null);
    setDistancePath(null);
    setDistance(null);
    loadRound();
  }, [loadRound]);

  // Start a fresh 5-round game without reloading the page, so any in-memory
  // history kept by the caller (e.g. shown-location dedup) survives Play Again
  // but is still cleared by a real browser refresh.
  const resetGame = useCallback(() => {
    setRound(0);
    setGuessLocation(null);
    setDistance(null);
    setDistances([]);
    setDistancePath(null);
    setAllMarkers([]);
    setAllPolylines([]);
    setIsModalOpen(false);
    setSummaryModalOpen(false);
    loadRound();
  }, [loadRound]);

  const averageDistance =
    distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0;

  return {
    round,
    target,
    providerData,
    guessLocation,
    distance,
    distances,
    distancePath,
    allMarkers,
    allPolylines,
    isModalOpen,
    summaryModalOpen,
    loading,
    averageDistance,
    setGuess,
    confirmGuess,
    showSummary,
    playAgain,
    resetGame,
  };
}
