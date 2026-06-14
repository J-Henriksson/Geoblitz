import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import guessMarkerUrl from '../assets/Guess-marker.png';

const guessIcon = L.icon({ iconUrl: guessMarkerUrl, iconSize: [28, 28], iconAnchor: [14, 28] });

// Gold star marking the true location of the round.
const actualIcon = L.divIcon({
  className: 'actual-star',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  html:
    '<svg viewBox="0 0 24 24" width="34" height="34">' +
    '<path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21l1.18-6.88-5-4.87 7.1-1.01z" ' +
    'fill="#ffcc00" stroke="#222" stroke-width="1.2" stroke-linejoin="round"/></svg>',
});

const lineRenderer = L.svg({ padding: 0.5 });

// Shift `lng` by whole turns so it lands within 180° of `refLng` — the nearest
// "copy" of that point. Used to keep guess↔target lines on the short path even
// across the antimeridian (e.g. 170° vs -170° → draws 20°, not 340°).
const nearLng = (refLng, lng) => {
  let out = lng;
  while (out - refLng > 180) out -= 360;
  while (out - refLng < -180) out += 360;
  return out;
};

// distancePath is [target, guess]. Anchor on the guess and pull the target to
// its nearest copy so the segment (and its fit-bounds) take the short path.
const shortPath = ([t, g]) => [
  [t.lat, nearLng(g.lng, t.lng)],
  [g.lat, g.lng],
];

function ClickHandler({ onMapClick, enabled }) {
  useMapEvents({
    click: (e) => {
      if (!enabled) return;
      // Wrap into [-180, 180]: on the zoomed-out world view a click can land on
      // a repeated map copy and return e.g. -342°, which breaks the distance
      // math and draws the line the long way around the globe.
      const { lat, lng } = e.latlng.wrap();
      onMapClick({ lat, lng });
    },
  });
  return null;
}

// react-leaflet only applies <MapContainer className> at mount, so toggle the
// guessing/result classes imperatively to keep the cursor in sync.
function CursorMode({ resultMode }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    el.classList.toggle('guess-map--result', resultMode);
    el.classList.toggle('guess-map--guessing', !resultMode);
  }, [resultMode, map]);
  return null;
}

// Drives the map view: recenters on the whole world for a fresh guessing round,
// and fits to the result/summary bounds once a guess is in.
function ViewController({ distancePath, summaryModalOpen, allPolylines, resultMode }) {
  const map = useMap();
  useEffect(() => {
    if (!distancePath && !summaryModalOpen) {
      // New round → snap back to the full, centered world view. invalidateSize
      // first (and again after the layout settles): leaving result mode resizes
      // the map panel, and a stale size makes setView land off-centre (Pacific).
      const recenter = () => {
        map.invalidateSize();
        map.setView([10, 0], 2, { animate: false });
      };
      recenter();
      const t = window.setTimeout(recenter, 150);
      return () => window.clearTimeout(t);
    }
    const paths = summaryModalOpen ? allPolylines : [distancePath];
    const latlngs = paths.flatMap(shortPath); // short-path coords for fit bounds
    if (latlngs.length === 0) return;

    const fit = () => {
      map.invalidateSize();
      map.fitBounds(latlngs, {
        paddingTopLeft: [72, 72],
        paddingBottomRight: [72, resultMode ? 150 : 72],
        animate: true,
        duration: 0.5,
      });
    };
    fit();
    const resizeTimer = window.setTimeout(fit, 120);
    return () => window.clearTimeout(resizeTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distancePath, summaryModalOpen, resultMode]);
  return null;
}

function LeafletGuessMap({
  guessLocation,
  target,
  distancePath,
  summaryModalOpen,
  allPolylines,
  onMapClick,
  resultMode = false,
}) {
  return (
    <MapContainer
      center={[10, 0]}
      zoom={2}
      minZoom={1}
      maxZoom={19}
      zoomControl
      className="guess-map guess-map--guessing"
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
        keepBuffer={4}
        updateWhenIdle={false}
        updateWhenZooming
        attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a>'
      />

      <CursorMode resultMode={resultMode} />
      <ClickHandler onMapClick={onMapClick} enabled={!distancePath && !summaryModalOpen} />
      <ViewController
        distancePath={distancePath}
        summaryModalOpen={summaryModalOpen}
        allPolylines={allPolylines}
        resultMode={resultMode}
      />

      {guessLocation && <Marker position={[guessLocation.lat, guessLocation.lng]} icon={guessIcon} />}
      {target && distancePath && (
        <Marker position={shortPath(distancePath)[0]} icon={actualIcon} />
      )}
      {distancePath && !summaryModalOpen && (
        <Polyline positions={shortPath(distancePath)} color="#e63946" weight={3} renderer={lineRenderer} />
      )}

      {summaryModalOpen &&
        allPolylines.map((path, i) => {
          const [targetLL, guessLL] = shortPath(path);
          return (
            <React.Fragment key={i}>
              <Marker position={guessLL} icon={guessIcon} />
              <Marker position={targetLL} icon={actualIcon} />
              <Polyline positions={[targetLL, guessLL]} color="#e63946" weight={3} renderer={lineRenderer} />
            </React.Fragment>
          );
        })}
    </MapContainer>
  );
}

export default LeafletGuessMap;
