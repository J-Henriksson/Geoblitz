import React, { useEffect, useRef, useState } from 'react';
import './mapstyles.css';
import api from './config/api';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from "@react-google-maps/api";
import Modal from 'react-modal';

const libraries = ["places"];
Modal.setAppElement('#root'); // To avoid screen reader issues with the modal

function Game() {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: api.googleMapsApiKey,
    libraries,
  });

  const streetViewRef = useRef();
  const [guessLocation, setGuessLocation] = useState(null);
  const [streetViewPosition, setStreetViewPosition] = useState(null);
  const [distancePath, setDistancePath] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [distance, setDistance] = useState(null);
  const [round, setRound] = useState(0);
  const [distances, setDistances] = useState([]);
  const [allPolylines, setAllPolylines] = useState([]);
  const [allMarkers, setAllMarkers] = useState([]);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const polylineRef = useRef(null); // Reference to the polyline

  // Variables for saving the map view so that it doesn't reset when it updates
  const mapRef = useRef(null);
  const mapCenter = useRef({ lat: 0, lng: 0 });
  const mapZoom = useRef(2);

  useEffect(() => {
    if (isLoaded) {
      getRandomStreetViewPosition()
        .then((position) => {
          setStreetViewPosition(position);
          new window.google.maps.StreetViewPanorama(streetViewRef.current, {
            position: position,
            pov: { heading: Math.random() * 360, pitch: 0 },
            showRoadLabels: false,
            disableDefaultUI: true,
            linksControl: true,
          });
        })
        .catch((error) => console.error("Failed to get random street view position:", error));
    }
  }, [isLoaded]);

  const onMapClick = (e) => {
    if (!isModalOpen && !summaryModalOpen) {
      setGuessLocation({
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      });
      setDistancePath(null); // Resets the path when a new guess is made
      if (polylineRef.current) {
        polylineRef.current.setMap(null); // Removes the existing polyline from the map (if there is one)
        polylineRef.current = null;
      }
    }
  };

  const confirmGuess = () => {
    if (guessLocation) {
      const distance = getDistance(
        streetViewPosition.lat,
        streetViewPosition.lng,
        guessLocation.lat,
        guessLocation.lng
      );
      setDistance(distance);
      const path = [
        { lat: streetViewPosition.lat, lng: streetViewPosition.lng },
        { lat: guessLocation.lat, lng: guessLocation.lng }
      ];
      setDistancePath(path);
      if (polylineRef.current) {
        polylineRef.current.setMap(null); // Removes the existing polyline from the map
      }
      // Creates a new polyline and draws it on the map
      polylineRef.current = new window.google.maps.Polyline({
        path,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2,
      });
      polylineRef.current.setMap(mapRef.current);

      setDistances([...distances, distance]);
      setAllPolylines([...allPolylines, path]);
      setAllMarkers([...allMarkers, { guessLocation, streetViewPosition }]);
      setRound(round + 1);

      if (round + 1 === 5) {
        setSummaryModalOpen(true);
      } else {
        setIsModalOpen(true);
      }
    }
  };

  const playAgain = () => {
    setIsModalOpen(false);
    setGuessLocation(null);
    setDistancePath(null); 
    setDistance(null);
    if (polylineRef.current) {
      polylineRef.current.setMap(null); // Removes the existing polyline from the map
      polylineRef.current = null;
    }
    getRandomStreetViewPosition()
      .then((position) => {
        setStreetViewPosition(position);
        new window.google.maps.StreetViewPanorama(streetViewRef.current, {
          position: position,
          pov: { heading: Math.random() * 360, pitch: 0 },
          showRoadLabels: false,
          disableDefaultUI: true,
          linksControl: true,
        });
      })
      .catch((error) => console.error("Failed to get random street view position:", error));
  };

  const resetGame = () => {
    window.location.reload();
  };

  const getRandomCoordinate = (min, max) => {
    return Math.random() * (max - min) + min;
  };

  const getRandomStreetViewPosition = async () => {
    const streetViewService = new window.google.maps.StreetViewService();
    let position = null;

    const landLatRange = { min: -60, max: 60 };
    const landLngRange = { min: -180, max: 180 };

    while (!position) {
      const randomLat = getRandomCoordinate(landLatRange.min, landLatRange.max);
      const randomLng = getRandomCoordinate(landLngRange.min, landLngRange.max);
      position = await new Promise((resolve, reject) => {
        streetViewService.getPanoramaByLocation(
          { lat: randomLat, lng: randomLng },
          50000, // Search within a 50 km radius
          (data, status) => {
            if (status === window.google.maps.StreetViewStatus.OK) {
              resolve(data.location.latLng.toJSON());
            } else {
              resolve(null);
            }
          }
        );
      });
    }

    return position;
  };

  // Haversine formula (essentially) to calculate distance between two points
  const getDistance = (lat1, lng1, lat2, lng2) => {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // Radius of the Earth
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  if (loadError) return "Error loading maps";

  const averageDistance = distances.reduce((a, b) => a + b, 0) / distances.length;

  return (
    <div className="game-container">
      <div className="streetview-container" ref={streetViewRef} />
      <div className="map-container">
        <GoogleMap
          mapContainerClassName="map-container-inner"
          zoom={mapZoom.current} // Use the saved zoom level
          center={mapCenter.current} // Use the saved center position
          onClick={onMapClick}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            gestureHandling: 'auto', 
            draggableCursor: 'crosshair',
          }}
          onLoad={(map) => {
            mapRef.current = map;
          }}
          onCenterChanged={() => {
            if (mapRef.current) {
              mapCenter.current = mapRef.current.getCenter().toJSON();
              mapZoom.current = mapRef.current.getZoom();
            }
          }}
        >
          {guessLocation && (
            <Marker position={guessLocation} icon={{
              url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
            }} />
          )}
          {streetViewPosition && distancePath && (
            <>
              <Marker position={streetViewPosition} icon={{
                url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
              }} />
            </>
          )}
          {summaryModalOpen && (
            <>
              {allMarkers.map((marker, index) => (
                <React.Fragment key={index}>
                  <Marker position={marker.guessLocation} icon={{
                    url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                  }} />
                  <Marker position={marker.streetViewPosition} icon={{
                    url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                  }} />
                </React.Fragment>
              ))}
              {allPolylines.map((path, index) => (
                <Polyline
                  key={index}
                  path={path}
                  options={{
                    strokeColor: '#FF0000',
                    strokeOpacity: 1.0,
                    strokeWeight: 2,
                  }}
                />
              ))}
            </>
          )}
        </GoogleMap>
        <button className="button" onClick={confirmGuess}>
          Confirm Guess
        </button>
      </div>
      <Modal
        isOpen={isModalOpen}
        onRequestClose={playAgain}
        contentLabel="Guess Result"
        className="modal"
        overlayClassName="overlay"
      >
        <h3>You are {Math.round(distance && distance.toFixed(2))} km away</h3>
        <button className="next-round-button" onClick={playAgain}>Next</button>
      </Modal>
      <Modal
        isOpen={summaryModalOpen}
        onRequestClose={resetGame}
        contentLabel="Summary Result"
        className="modal"
        overlayClassName="overlay"
      >
        <h3>5 round summary</h3>
        <h3 class="summary-header">Average Distance: {Math.round(averageDistance.toFixed(2))} km</h3>
        <button className="play-again-button" onClick={resetGame}>Play Again</button>
      </Modal>
    </div>
  );
}

export default Game;
