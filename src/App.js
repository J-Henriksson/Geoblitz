import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Game from './Game';
import KeyManager from './components/KeyManager';
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
  // Play starts free mode by default. Adding a Google Maps key in the settings
  // gear (KeyManager) switches the game to Google Street View mode.
  return (
    <header className="App-header">
      <h1>GeoBlitz</h1>
      <p>Explore the world and guess where you are</p>
      <button className="play-btn" onClick={() => navigate('/game')}>
        Play
      </button>
    </header>
  );
}

export default App;
