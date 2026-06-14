import React, { useEffect, useRef } from 'react';

// Renders a static equirectangular 360° panorama using Pannellum, which is
// loaded globally via a CDN <script> in public/index.html (window.pannellum).
function PannellumPanorama({ imageUrl, credit }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (!imageUrl || !window.pannellum) return;

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    viewerRef.current = window.pannellum.viewer(containerRef.current, {
      type: 'equirectangular',
      panorama: imageUrl,
      autoLoad: true,
      showControls: true,
      compass: false,
      yaw: Math.random() * 360,
    });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [imageUrl]);

  return (
    <div className="streetview-container">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {credit && <div className="panorama-credit">{credit}</div>}
    </div>
  );
}

export default PannellumPanorama;
