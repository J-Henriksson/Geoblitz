import React, { useEffect, useState } from 'react';
import LeafletGuessMap from './LeafletGuessMap';
import { TOTAL_ROUNDS } from '../hooks/useGeoGame';

// The guess map + confirm/result UI, shared by both game modes. On desktop it's
// the right-hand half (and goes full-screen on a result). On mobile the map is
// hidden behind a bottom "Guess" button and slides up as a sheet, GeoGuessr-style.
function GuessPanel({ game }) {
  const inRoundResult = !!game.distancePath && !game.summaryModalOpen;
  const isLastRound = game.round >= TOTAL_ROUNDS;
  const isResultMode = inRoundResult || game.summaryModalOpen;

  const [mapOpen, setMapOpen] = useState(false);

  // (mobile) auto-open the map sheet to show a result, and close it again when a
  // fresh guessing round starts.
  useEffect(() => {
    if (isResultMode) setMapOpen(true);
    else if (!game.distancePath) setMapOpen(false);
  }, [isResultMode, game.distancePath]);

  return (
    <>
      {!isResultMode && !mapOpen && (
        <button className="map-toggle" onClick={() => setMapOpen(true)} aria-label="Open map to guess">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path
              fill="#111"
              d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"
            />
          </svg>
        </button>
      )}

      <div className={`map-container${mapOpen ? ' map-open' : ''}`}>
        {!isResultMode && mapOpen && (
          <button className="map-collapse" onClick={() => setMapOpen(false)} aria-label="Hide map">
            ⌄
          </button>
        )}

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
          <button className="confirm-btn" onClick={game.confirmGuess} disabled={!game.guessLocation}>
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
              {isLastRound ? 'Breakdown' : 'Next Round'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default GuessPanel;
