import React, { useRef, useCallback } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import useGeoGame from '../hooks/useGeoGame';
import { getGoogleKey } from '../config/keys';
import GuessPanel from './GuessPanel';

const libraries = ['places'];

const getRandomCoordinate = (min, max) => Math.random() * (max - min) + min;

const getRandomStreetViewPosition = async () => {
  const streetViewService = new window.google.maps.StreetViewService();
  let position = null;
  while (!position) {
    const lat = getRandomCoordinate(-60, 60);
    const lng = getRandomCoordinate(-180, 180);
    position = await new Promise((resolve) => {
      streetViewService.getPanoramaByLocation({ lat, lng }, 50000, (data, status) => {
        resolve(status === window.google.maps.StreetViewStatus.OK ? data.location.latLng.toJSON() : null);
      });
    });
  }
  return position;
};

function GoogleGameInner() {
  const streetViewRef = useRef(null);

  const showPanorama = useCallback((position) => {
    new window.google.maps.StreetViewPanorama(streetViewRef.current, {
      position,
      pov: { heading: Math.random() * 360, pitch: 0 },
      showRoadLabels: false,
      disableDefaultUI: true,
      linksControl: true,
    });
  }, []);

  const loadNextLocation = useCallback(async () => {
    const position = await getRandomStreetViewPosition();
    showPanorama(position);
    return { target: position };
  }, [showPanorama]);

  const game = useGeoGame(loadNextLocation);
  const isResultMode = !!game.distancePath || game.summaryModalOpen;

  return (
    <div className={`game-container${isResultMode ? ' result-mode' : ''}`}>
      {/* Street View (fullscreen on mobile / left half on desktop) */}
      <div className="streetview-container" ref={streetViewRef} />
      <GuessPanel game={game} />
    </div>
  );
}

function GoogleGame() {
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: getGoogleKey(), libraries });
  if (loadError) return <div className="game-container loading-panorama">Error loading Google Maps</div>;
  if (!isLoaded) return <div className="game-container loading-panorama">Loading…</div>;
  return <GoogleGameInner />;
}

export default GoogleGame;
