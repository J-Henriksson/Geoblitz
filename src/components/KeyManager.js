import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Modal from 'react-modal';
import { getGoogleKey, setKeys, clearKeys } from '../config/keys';

const GET_KEY_URL = 'https://developers.google.com/maps/documentation/javascript/get-api-key';

// Top-right entry point for Google Street View mode. On the home screen it's a
// labelled button; during a game it's a discreet cogwheel. Either opens the
// same modal to paste a Google Maps API key (or switch back to free mode).
function KeyManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [google, setGoogle] = useState(getGoogleKey());
  const hasKey = !!getGoogleKey();
  const onGamePage = useLocation().pathname === '/game';

  const useGoogle = () => {
    setKeys({ googleMapsApiKey: google });
    window.location.reload(); // reload so the game switches to Google mode
  };

  const useFree = () => {
    clearKeys();
    window.location.reload();
  };

  return (
    <>
      {onGamePage ? (
        <button className="settings-gear" onClick={() => setIsOpen(true)} aria-label="Settings" title="Settings">
          ⚙
        </button>
      ) : (
        <button className="gmaps-btn" onClick={() => setIsOpen(true)}>
          Use Google Maps API
        </button>
      )}

      <Modal
        isOpen={isOpen}
        onRequestClose={() => setIsOpen(false)}
        contentLabel="Use Google Maps API"
        className="modal settings-modal"
        overlayClassName="overlay"
      >
        <button className="modal-close" onClick={() => setIsOpen(false)} aria-label="Close">
          ×
        </button>
        <h3>Google Street View Mode</h3>
        <p className="settings-note">
          Paste a Google Maps API key to play with Google Street View instead of free mode.{' '}
          <a className="settings-link" href={GET_KEY_URL} target="_blank" rel="noreferrer">
            Get an API key →
          </a>
        </p>

        <label className="settings-label">
          Google Maps API key
          <input
            type="text"
            value={google}
            onChange={(e) => setGoogle(e.target.value)}
            placeholder="Paste your key here"
            autoFocus
          />
        </label>

        <div className="settings-actions">
          {hasKey && (
            <button className="settings-clear" onClick={useFree}>
              Switch to free mode
            </button>
          )}
          <button className="settings-save" onClick={useGoogle} disabled={!google.trim()}>
            Use Google Street View
          </button>
        </div>
      </Modal>
    </>
  );
}

export default KeyManager;
