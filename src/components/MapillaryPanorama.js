import React, { useEffect, useRef } from 'react';
import { Viewer } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';
import { MAPILLARY_TOKEN } from '../services/mapillary';

// Renders a Mapillary street-level image and lets the player navigate along the
// sequence. The viewer is created once and reused across rounds via moveTo().
function MapillaryPanorama({ imageId }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (!imageId) return;
    if (!viewerRef.current) {
      viewerRef.current = new Viewer({
        accessToken: MAPILLARY_TOKEN,
        container: containerRef.current,
        imageId,
        // cover: false → load immediately; sequence.visible: false → hide the
        // top playback bar. Turn arrows are hidden via CSS (no config for it),
        // leaving just the forward/back step arrows.
        component: { cover: false, sequence: { visible: false } },
      });
    } else {
      viewerRef.current.moveTo(imageId).catch(() => {});
    }
  }, [imageId]);

  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        viewerRef.current.remove();
        viewerRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} className="streetview-container" />;
}

export default MapillaryPanorama;
