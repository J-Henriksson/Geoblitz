import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Game from './Game';
import KeyManager from './components/KeyManager';
import { getGoogleKey, setKeys, clearGoogleKey } from './config/keys';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <KeyManager />
        <AnimatePresence>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/game" element={<Game />} />
          </Routes>
        </AnimatePresence>
      </div>
    </Router>
  );
}

function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // 'google' | 'free' | null
  const [googleKey, setGoogleKey] = useState(getGoogleKey());

  const playGoogle = () => {
    setKeys({ googleMapsApiKey: googleKey });
    navigate('/game');
  };

  const playFree = () => {
    clearGoogleKey();
    navigate('/game');
  };

  return (
    <header className="App-header">
      <h1>GeoBlitz</h1>
      <p>Explore the world. Guess where you are.</p>

      {mode === null && (
        <div className="mode-cards">
          <button className="mode-card" onClick={() => setMode('google')}>
            <div className="mode-title">Google Street View Mode</div>
            <div className="mode-desc">Requires a Google Maps API key</div>
          </button>
          <button className="mode-card" onClick={playFree}>
            <div className="mode-title">Free Mode</div>
          </button>
        </div>
      )}

      {mode === 'google' && (
        <div className="mode-setup">
          <label>
            Google Maps API key
            <input
              type="text"
              value={googleKey}
              onChange={(e) => setGoogleKey(e.target.value)}
              placeholder="Paste your API key here"
              autoFocus
            />
          </label>
          <button className="play-btn" onClick={playGoogle} disabled={!googleKey.trim()}>
            Play
          </button>
          <button className="back-btn" onClick={() => setMode(null)}>← Back</button>
        </div>
      )}
    </header>
  );
}

export default App;
