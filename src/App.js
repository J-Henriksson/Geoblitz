import React, { useMemo } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Game from './Game';
import KeyManager from './components/KeyManager';
import globe from './assets/globe.png';
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
  // Random twinkling stars for the space behind the planet (generated once).
  const stars = useMemo(
    () =>
      Array.from({ length: 55 }, () => ({
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 1.6 + 1,
        delay: Math.random() * 4,
        duration: 2 + Math.random() * 3,
      })),
    []
  );

  return (
    <header className="App-header">
      <div className="home-stars" aria-hidden="true">
        {stars.map((s, i) => (
          <span
            key={i}
            className="star"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}
      </div>
      <img className="home-globe" src={globe} alt="" aria-hidden="true" />
      <h1>GeoBlitz</h1>
      <p>Explore the world and guess where you are</p>
      <button className="play-btn" onClick={() => navigate('/game')}>
        Play
      </button>
    </header>
  );
}

export default App;
