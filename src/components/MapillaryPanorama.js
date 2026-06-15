import React, { useEffect, useRef, useState } from 'react';
import { Viewer } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';
import { MAPILLARY_TOKEN } from '../services/mapillary';

const STUCK_TIMEOUT_MS = 10000; // if no image renders within this, recover

// Renders a Mapillary street-level image with a custom GeoGuessr-style compass.
// `loading` (parent resolving the next round) plus the internal image-load state
// drive a fade overlay so switching locations doesn't expose the old view.
// `onReady` fires when an image renders; `onStuck` if the viewer stays frozen.
function MapillaryPanorama({ imageId, loading, onReady, onStuck }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const firstRender = useRef(true);
  const loadedRef = useRef(false);
  const cbRef = useRef({});
  cbRef.current = { onReady, onStuck };
  const [bearing, setBearing] = useState(0);
  const [imgLoading, setImgLoading] = useState(true);

  // Create the viewer once; subscribe to bearing + image-load events.
  useEffect(() => {
    const viewer = new Viewer({
      accessToken: MAPILLARY_TOKEN,
      container: containerRef.current,
      imageId,
      component: { cover: false, sequence: { visible: false }, bearing: false },
    });
    viewerRef.current = viewer;

    const onBearing = (e) => setBearing(e.bearing);
    const onImage = () => {
      loadedRef.current = true;
      setImgLoading(false);
      cbRef.current.onReady && cbRef.current.onReady();
    };
    viewer.on('bearing', onBearing);
    viewer.on('image', onImage);
    viewer.getBearing().then(setBearing).catch(() => {});

    return () => {
      viewer.off('bearing', onBearing);
      viewer.off('image', onImage);
      viewer.remove();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move to the new image on subsequent rounds (skip the initial render).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (viewerRef.current && imageId) viewerRef.current.moveTo(imageId).catch(() => {});
  }, [imageId]);

  // On each new image: fade in, start the watchdog; the 'image' event clears it.
  useEffect(() => {
    if (!imageId) return undefined;
    loadedRef.current = false;
    setImgLoading(true);
    const t = setTimeout(() => {
      if (!loadedRef.current && cbRef.current.onStuck) cbRef.current.onStuck();
    }, STUCK_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [imageId]);

  return (
    <div className="streetview-container">
      <div ref={containerRef} className="mly-viewer" />
      <div className="gg-compass" aria-hidden="true">
        <div className="gg-needle" style={{ transform: `rotate(${-bearing}deg)` }}>
          <span className="gg-needle-n" />
          <span className="gg-needle-s" />
        </div>
      </div>
      <div className={`pano-fade${loading || imgLoading ? ' show' : ''}`} aria-hidden="true">
        <div className="pano-spinner" />
      </div>
    </div>
  );
}

export default MapillaryPanorama;
