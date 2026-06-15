import React from 'react';
import ReactDOM from 'react-dom/client';
import Modal from 'react-modal';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

Modal.setAppElement('#root'); // Avoid screen-reader issues with react-modal

const root = ReactDOM.createRoot(document.getElementById('root'));
// StrictMode intentionally double-mounts components in development, which
// rebuilds the Mapillary viewer and double-loads the first round (visible as a
// flash). It's a no-op in production, so we leave it off for a consistent feel.
root.render(<App />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();