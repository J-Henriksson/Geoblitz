import React, { useState } from 'react';
import Modal from 'react-modal';
import { getGoogleKey, setKeys, clearKeys } from '../config/keys';

// In-game settings gear: lets the user update or clear their Google Maps key.
function KeyManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [google, setGoogle] = useState(getGoogleKey());

  const save = () => {
    setKeys({ googleMapsApiKey: google });
    window.location.reload();
  };

  const clear = () => {
    clearKeys();
    window.location.reload();
  };

  return (
    <>
      <button
        className="settings-gear"
        onClick={() => setIsOpen(true)}
        aria-label="Settings"
        title="Settings"
      >
        ⚙
      </button>

      <Modal
        isOpen={isOpen}
        onRequestClose={() => setIsOpen(false)}
        contentLabel="Settings"
        className="modal settings-modal"
        overlayClassName="overlay"
      >
        <h3>Settings</h3>
        <p className="settings-note">
          Add a <strong>Google Maps API key</strong> to switch to Google Street View mode.
          Without one, the game uses Wikimedia Commons panoramas.
        </p>

        <label className="settings-label">
          Google Maps API key
          <input
            type="text"
            value={google}
            onChange={(e) => setGoogle(e.target.value)}
            placeholder="Leave blank for free mode"
          />
        </label>

        <div className="settings-actions">
          <button className="settings-save" onClick={save}>Save & reload</button>
          <button className="settings-clear" onClick={clear}>Clear</button>
        </div>
      </Modal>
    </>
  );
}

export default KeyManager;
