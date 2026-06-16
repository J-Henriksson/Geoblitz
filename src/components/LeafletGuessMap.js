import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import guessMarkerUrl from '../assets/Guess-marker.png';
import { fetchWikiSummary } from '../services/wiki';

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
// "copy" of that point. Keeps guess↔target lines on the short path even across
// the antimeridian (e.g. 170° vs -170° → draws 20°, not 340°).
const nearLng = (refLng, lng) => {
  let out = lng;
  while (out - refLng > 180) out -= 360;
  while (out - refLng < -180) out += 360;
  return out;
};

// distancePath is [target, guess]. Anchor on the guess, pull the target to its
// nearest copy. Returns [[lat,lng],[lat,lng]].
const shortPath = ([t, g]) => [
  [t.lat, nearLng(g.lng, t.lng)],
  [g.lat, g.lng],
];

const shift = ([lat, lng], d) => [lat, lng + d];

// The true-location star. For the round result (`preview`), it eagerly fetches
// the city's Wikipedia info and shows a small photo bubble above the star as a
// hint that it's clickable; clicking the photo or star opens the full card.
// `position` is the (possibly world-shifted) render position; lat/lng are the
// real coordinates used for the lookup.
function ActualStar({ position, lat, lng, preview = false }) {
  const markerRef = useRef(null);
  const [info, setInfo] = useState(undefined); // undefined = not fetched, null = none

  useEffect(() => {
    if (!preview) return undefined;
    let alive = true;
    fetchWikiSummary(lat, lng).then((d) => alive && setInfo(d || null));
    return () => {
      alive = false;
    };
  }, [preview, lat, lng]);

  const ensureInfo = () => {
    if (info === undefined) fetchWikiSummary(lat, lng).then((d) => setInfo(d || null));
  };

  return (
    <Marker position={position} icon={actualIcon} ref={markerRef} eventHandlers={{ click: ensureInfo }}>
      {preview && info && info.thumbnail && (
        <Tooltip permanent direction="top" offset={[0, -14]} interactive className="star-preview">
          <img
            className="star-preview-img"
            src={info.thumbnail}
            alt={info.title}
            onClick={() => markerRef.current && markerRef.current.openPopup()}
          />
        </Tooltip>
      )}
      <Popup className="wiki-popup" minWidth={230} maxWidth={250}>
        {info === undefined ? (
          <div className="wiki-msg">Looking up this place…</div>
        ) : info ? (
          <div className="wiki-card">
            {info.thumbnail && <img className="wiki-thumb" src={info.thumbnail} alt="" />}
            <div className="wiki-title">{info.title}</div>
            {info.extract && <div className="wiki-extract">{info.extract}</div>}
            <a className="wiki-link" href={info.url} target="_blank" rel="noreferrer">
              Read more on Wikipedia →
            </a>
          </div>
        ) : (
          <div className="wiki-msg">No Wikipedia info for this place.</div>
        )}
      </Popup>
    </Marker>
  );
}

function ClickHandler({ onMapClick, enabled }) {
  useMapEvents({
    click: (e) => {
      if (!enabled) return;
      // Wrap into [-180, 180]: on a repeated world copy a click returns e.g.
      // -342°, which would break the distance math.
      const { lat, lng } = e.latlng.wrap();
      onMapClick({ lat, lng });
    },
  });
  return null;
}

function CursorMode({ resultMode }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    el.classList.toggle('guess-map--result', resultMode);
    el.classList.toggle('guess-map--guessing', !resultMode);
  }, [resultMode, map]);
  return null;
}

function ViewController({ distancePath, summaryModalOpen, allPolylines, resultMode }) {
  const map = useMap();
  useEffect(() => {
    if (!distancePath && !summaryModalOpen) {
      const recenter = () => {
        map.invalidateSize();
        map.setView([10, 0], 2, { animate: false });
      };
      recenter();
      const t = window.setTimeout(recenter, 150);
      return () => window.clearTimeout(t);
    }
    const paths = summaryModalOpen ? allPolylines : [distancePath];
    const latlngs = paths.flatMap(shortPath);
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

// The world repeats horizontally, so markers/lines must be drawn on every
// visible copy. Returns the longitude offsets (multiples of 360) currently in
// view, recomputed as the map pans.
function useWorldOffsets() {
  const map = useMap();
  const compute = () => {
    const b = map.getBounds();
    const kMin = Math.floor((b.getWest() + 180) / 360);
    const kMax = Math.floor((b.getEast() + 180) / 360);
    const arr = [];
    for (let k = kMin; k <= kMax; k++) arr.push(k * 360);
    return arr.length ? arr : [0];
  };
  const [offsets, setOffsets] = useState(compute);
  useMapEvents({
    move: () =>
      setOffsets((prev) => {
        const next = compute();
        const same =
          next.length === prev.length &&
          next[0] === prev[0] &&
          next[next.length - 1] === prev[prev.length - 1];
        return same ? prev : next;
      }),
  });
  return offsets;
}

// Renders the guess pin, target star and lines — duplicated across every
// visible world copy so they stay on screen no matter how far you pan.
function Overlays({ guessLocation, target, distancePath, summaryModalOpen, allPolylines }) {
  const offsets = useWorldOffsets();
  return (
    <>
      {offsets.map((d) => (
        <React.Fragment key={d}>
          {guessLocation && !summaryModalOpen && (
            <Marker position={[guessLocation.lat, guessLocation.lng + d]} icon={guessIcon} />
          )}
          {target && distancePath && !summaryModalOpen && (
            <ActualStar
              position={shift(shortPath(distancePath)[0], d)}
              lat={distancePath[0].lat}
              lng={distancePath[0].lng}
              preview
            />
          )}
          {distancePath && !summaryModalOpen && (
            <Polyline
              positions={shortPath(distancePath).map((p) => shift(p, d))}
              color="#e63946"
              weight={3}
              renderer={lineRenderer}
            />
          )}
          {summaryModalOpen &&
            allPolylines.map((path, i) => {
              const [tLL, gLL] = shortPath(path);
              return (
                <React.Fragment key={i}>
                  <Marker position={shift(gLL, d)} icon={guessIcon} />
                  <ActualStar position={shift(tLL, d)} lat={path[0].lat} lng={path[0].lng} preview />
                  <Polyline
                    positions={[shift(tLL, d), shift(gLL, d)]}
                    color="#e63946"
                    weight={3}
                    renderer={lineRenderer}
                  />
                </React.Fragment>
              );
            })}
        </React.Fragment>
      ))}
    </>
  );
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
      <Overlays
        guessLocation={guessLocation}
        target={target}
        distancePath={distancePath}
        summaryModalOpen={summaryModalOpen}
        allPolylines={allPolylines}
      />
    </MapContainer>
  );
}

export default LeafletGuessMap;
