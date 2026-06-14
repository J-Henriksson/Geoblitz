import React, { useEffect, useRef, useState } from 'react';
import { Viewer } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';
import { MAPILLARY_TOKEN } from '../services/mapillary';

// Renders a Mapillary street-level image with navigation. Mapillary's built-in
// bearing widget is disabled in favour of a custom GeoGuessr-style needle
// compass (below) driven by the viewer's `bearing` event.
function MapillaryPanorama({ imageId }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const firstRender = useRef(true);
  const [bearing, setBearing] = useState(0); // camera heading, degrees CW from N

  // Create the viewer once and subscribe to bearing changes.
  useEffect(() => {
    const viewer = new Viewer({
      accessToken: MAPILLARY_TOKEN,
      container: containerRef.current,
      imageId,
      // cover:false → load immediately; sequence.visible:false → hide the top
      // playback bar; bearing:false → use our own compass. (Turn arrows are
      // hidden via CSS.)
      component: { cover: false, sequence: { visible: false }, bearing: false },
    });
    viewerRef.current = viewer;

    const onBearing = (e) => setBearing(e.bearing);
    viewer.on('bearing', onBearing);
    viewer.getBearing().then(setBearing).catch(() => {});

    return () => {
      viewer.off('bearing', onBearing);
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

  return (
    <div className="streetview-container">
      <div ref={containerRef} className="mly-viewer" />
      {/* North points to true north relative to where you're facing. */}
      <div className="gg-compass" aria-hidden="true">
        <div className="gg-needle" style={{ transform: `rotate(${-bearing}deg)` }}>
          <span className="gg-needle-n" />
          <span className="gg-needle-s" />
        </div>
      </div>
    </div>
  );
}

export default MapillaryPanorama;
