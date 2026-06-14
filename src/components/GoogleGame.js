import React, { useRef, useCallback } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import useGeoGame, { TOTAL_ROUNDS } from '../hooks/useGeoGame';
import { getGoogleKey } from '../config/keys';
import LeafletGuessMap from './LeafletGuessMap';

const libraries = ['places'];

const getRandomCoordinate = (min, max) => Math.random() * (max - min) + min;

const getRandomStreetViewPosition = async () => {
  const streetViewService = new window.google.maps.StreetViewService();
  let position = null;
  while (!position) {
    const lat = getRandomCoordinate(-60, 60);
    const lng = getRandomCoordinate(-180, 180);
    position = await new Promise((resolve) => {
      streetViewService.getPanoramaByLocation({ lat, lng }, 50000, (data, status) => {
        resolve(status === window.google.maps.StreetViewStatus.OK ? data.location.latLng.toJSON() : null);
      });
    });
  }
  return position;
};

function GoogleGameInner() {
  const streetViewRef = useRef(null);

  const showPanorama = useCallback((position) => {
    new window.google.maps.StreetViewPanorama(streetViewRef.current, {
      position,
      pov: { heading: Math.random() * 360, pitch: 0 },
      showRoadLabels: false,
      disableDefaultUI: true,
      linksControl: true,
    });
  }, []);

  const loadNextLocation = useCallback(async () => {
    const position = await getRandomStreetViewPosition();
    showPanorama(position);
    return { target: position };
  }, [showPanorama]);

  const game = useGeoGame(loadNextLocation);
  const inRoundResult = !!game.distancePath && !game.summaryModalOpen;
  const isLastRound = game.round >= TOTAL_ROUNDS;
  const isResultMode = inRoundResult || game.summaryModalOpen;

  return (
    <div className={`game-container${isResultMode ? ' result-mode' : ''}`}>
      {/* Left: Street View */}
      <div className="streetview-container" ref={streetViewRef} />

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
              <span>Final score</span>
              <small>Avg {Math.round(game.averageDistance)} km</small>
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

function GoogleGame() {
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: getGoogleKey(), libraries });
  if (loadError) return <div className="game-container loading-panorama">Error loading Google Maps</div>;
  if (!isLoaded) return <div className="game-container loading-panorama">Loading…</div>;
  return <GoogleGameInner />;
}

export default GoogleGame;
