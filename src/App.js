import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link} from 'react-router-dom';
import { AnimatePresence} from 'framer-motion'; // Import AnimatePresence and motion
import Game from './Game';
import './App.css'; // Import your CSS file for styling

function App() {
  return (
    <Router>
      <div className="App">
        <AnimatePresence>
          <Routes>
            <Route path="/" element={<Home />} /> {/* Render Home component */}
            <Route path="/game" element={<Game />} /> {/* Render Game component */}
          </Routes>
        </AnimatePresence>
      </div>
    </Router>
  );
}

function Home() {
  return (
    <header className="App-header">
      <h1>Welcome to GeoBlitz</h1>
      <p>Explore the world and test your geography knowledge</p>
      <Link to="/game" className="start-game-button">
        Start Game
      </Link>
    </header>
  );
}

export default App;

