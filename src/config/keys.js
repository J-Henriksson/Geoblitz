// Single source of truth for user-provided API keys.
// Google keys are entered in-app (see KeyManager) and persisted in localStorage.

const GOOGLE_KEY = 'geoblitz.googleMapsApiKey';
// Set once the user has seen the first-load prompt, so we don't nag every visit.
const ONBOARDED_KEY = 'geoblitz.onboarded';

export const getGoogleKey = () => localStorage.getItem(GOOGLE_KEY) || '';

export const hasOnboarded = () => localStorage.getItem(ONBOARDED_KEY) === 'true';

export const setKeys = (keys) => {
  const { googleMapsApiKey } = keys;
  const setOrRemove = (key, value) => {
    const trimmed = (value || '').trim();
    if (trimmed) localStorage.setItem(key, trimmed);
    else localStorage.removeItem(key);
  };
  if (Object.prototype.hasOwnProperty.call(keys, 'googleMapsApiKey')) {
    setOrRemove(GOOGLE_KEY, googleMapsApiKey);
  }
  localStorage.setItem(ONBOARDED_KEY, 'true');
};

export const clearGoogleKey = () => {
  localStorage.removeItem(GOOGLE_KEY);
  localStorage.setItem(ONBOARDED_KEY, 'true');
};

export const clearKeys = () => {
  localStorage.removeItem(GOOGLE_KEY);
  localStorage.setItem(ONBOARDED_KEY, 'true');
};

// Mode is decided purely by the presence of a Google key. Without one we fall
// back to the free Wikimedia Commons panorama mode.
export const getMode = () => (getGoogleKey() ? 'google' : 'no-api');
