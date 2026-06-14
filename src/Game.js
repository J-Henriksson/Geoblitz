import React from 'react';
import './mapstyles.css';
import { getMode } from './config/keys';
import GoogleGame from './components/GoogleGame';
import NoApiGame from './components/NoApiGame';

// Thin orchestrator: picks the panorama/map providers based on whether a Google
// Maps key is stored. Both modes share the same game loop, scoring, and UI.
function Game() {
  return getMode() === 'google' ? <GoogleGame /> : <NoApiGame />;
}

export default Game;
