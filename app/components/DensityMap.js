'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Map, { Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import darkOceanStyle from '../styles/dark-ocean-style.json';
import LocatorGlobe from './LocatorGlobe';
import { cloneMapStyle } from '../fish-farms-module/utils/mapStyle';

// Loads a salmon SVG icon for Mapbox symbol layers
const addSalmonIcons = (map) => {
  const img = new Image(32, 32);
  img.onload = () => {
    if (!map.hasImage('square-farm')) {
      map.addImage('square-farm', img);
    }
    if (!map.hasImage('square-office')) {
      map.addImage('square-office', img);
    }
  };
  img.src = '/salmon-icon.svg';
};

// Pan bounds for China region
const BOUNDS = [
  [70, 15],
  [135, 55],
];

// Multi-resolution hexbin levels - smaller hexagons at higher zoom for finer detail
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
const ZOOM_LEVELS = [
  { minZoom: 0, maxZoom: 5, file: `${BASE_PATH}/data/hexbin-density-level-0.json`, cellSize: 200 },
  { minZoom: 5, maxZoom: 7, file: `${BASE_PATH}/data/hexbin-density-level-1.json`, cellSize: 100 },
  { minZoom: 7, maxZoom: 9, file: `${BASE_PATH}/data/hexbin-density-level-2.json`, cellSize: 50 },
  { minZoom: 9, maxZoom: 11, file: `${BASE_PATH}/data/hexbin-density-level-3.json`, cellSize: 25 }
];

export default function DensityMap({ geojsonData, timeline, isSidebarCollapsed }) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapStyle = useMemo(() => cloneMapStyle(darkOceanStyle), []);
  const [hexbinDataCache, setHexbinDataCache] = useState({});
  const [maxCount, setMaxCount] = useState(0);
  const [showPoints, setShowPoints] = useState(false);
  const [iconsLoaded, setIconsLoaded] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: 104.75,
    latitude: 34.59,
    zoom: 2.5
  });
  const mapRef = useRef(null);
  const isTimelineFiltered = Boolean(timeline && timeline.value && timeline.maxYear && timeline.value < timeline.maxYear);

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    addSalmonIcons(map);
    setIconsLoaded(true);
  }, []);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    requestAnimationFrame(() => map.resize());
  }, [isSidebarCollapsed]);

  // Returns the zoom level index, or array length if beyond all levels (show points)
  const getCurrentLevel = (zoom) => {
    for (let i = 0; i < ZOOM_LEVELS.length; i++) {
      if (zoom >= ZOOM_LEVELS[i].minZoom && zoom < ZOOM_LEVELS[i].maxZoom) {
        return i;
      }
    }
    return ZOOM_LEVELS.length;
  };

  const lastLevelRef = useRef(getCurrentLevel(viewState.zoom));

  // Load hexbin data for a zoom level, caching for performance
  const loadHexbinLevel = async (level) => {
    if (level >= ZOOM_LEVELS.length) {
      setShowPoints(true);
      return;
    }

    const levelConfig = ZOOM_LEVELS[level];

    if (hexbinDataCache[level]) {
      return;
    }

    try {
      const response = await fetch(levelConfig.file);
      const data = await response.json();

      const max = Math.max(...data.features.map(f => f.properties.count));
      setMaxCount(max);

      setHexbinDataCache(prev => ({
        ...prev,
        [level]: data
      }));
    } catch (error) {
      console.error(`Error loading hexbin level ${level}:`, error);
    }
  };

  // Load initial hexbin level
  useEffect(() => {
    if (isTimelineFiltered) {
      setShowPoints(true);
      return;
    }

    const initialLevel = getCurrentLevel(viewState.zoom);
    setShowPoints(initialLevel >= ZOOM_LEVELS.length);
    loadHexbinLevel(initialLevel);
  }, [isTimelineFiltered, viewState.zoom]);

  // Switch hexbin resolution or show points when zoom changes
  const handleZoomEnd = (evt) => {
    const newZoom = evt.viewState.zoom;
    const newLevel = getCurrentLevel(newZoom);
    const oldLevel = lastLevelRef.current;

    if (isTimelineFiltered) {
      setShowPoints(true);
      return;
    }

    if (newLevel !== oldLevel) {
      if (newLevel >= ZOOM_LEVELS.length) {
        setShowPoints(true);
      } else {
        setShowPoints(false);
        loadHexbinLevel(newLevel);
      }
      lastLevelRef.current = newLevel;
    }
  };

  useEffect(() => {
    if (isTimelineFiltered) return;

    const level = getCurrentLevel(viewState.zoom);
    if (level < ZOOM_LEVELS.length && !hexbinDataCache[level]) {
      loadHexbinLevel(level);
      lastLevelRef.current = level;
    }
  }, [viewState.zoom, hexbinDataCache, isTimelineFiltered]);

  // Click hexagon to zoom into next detail level
  const handleHexClick = (e) => {
    if (!e.features || e.features.length === 0) return;

    const feature = e.features[0];
    const map = mapRef.current;

    if (!map) return;
    const mapInstance = map.getMap();
    if (!mapInstance) return;

    const coordinates = feature.geometry.coordinates[0];
    const lngs = coordinates.map(coord => coord[0]);
    const lats = coordinates.map(coord => coord[1]);
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;

    const liveZoom = mapInstance.getZoom();
    const currentLevel = getCurrentLevel(liveZoom);
    const targetLevel = Math.min(currentLevel + 1, ZOOM_LEVELS.length);
    const targetZoom = targetLevel >= ZOOM_LEVELS.length
      ? ZOOM_LEVELS[ZOOM_LEVELS.length - 1].maxZoom + 0.5
      : ZOOM_LEVELS[targetLevel].minZoom + 0.4;

    const newLevel = getCurrentLevel(targetZoom);
    if (newLevel >= ZOOM_LEVELS.length) {
      setShowPoints(true);
    } else if (newLevel !== currentLevel) {
      setShowPoints(false);
      loadHexbinLevel(newLevel);
      lastLevelRef.current = newLevel;
    }

    mapInstance.easeTo({
      center: [centerLng, centerLat],
      zoom: targetZoom,
      duration: 1000
    });
  };

  const currentLevel = getCurrentLevel(viewState.zoom);
  const currentHexbinData = hexbinDataCache[currentLevel];
  const effectiveShowPoints = showPoints || isTimelineFiltered;

  if (!effectiveShowPoints && !currentHexbinData) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontSize: '18px',
        color: '#6b7280'
      }}>
        Loading density map...
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        reuseMaps={false}
        viewState={viewState}
        minZoom={2.5}
        maxZoom={14}
        maxBounds={BOUNDS}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        interactiveLayerIds={effectiveShowPoints ? ['individual-points'] : ['hexbin-fill']}
        cursor="pointer"
        onLoad={handleMapLoad}
        onMoveEnd={(evt) => {
          setViewState(evt.viewState);
          handleZoomEnd(evt);
        }}
        onClick={effectiveShowPoints ? undefined : handleHexClick}
      >
        {!effectiveShowPoints && currentHexbinData && (
          <Source
            key={`hexbins-level-${currentLevel}`}
            id="hexbins"
            type="geojson"
            data={currentHexbinData}
          >
            <Layer
              id="hexbin-fill"
              type="fill"
              paint={{
                'fill-color': [
                  'interpolate',
                  ['exponential', 2],
                  ['get', 'count'],
                  1, 'rgb(254, 224, 210)',
                  maxCount * 0.05, 'rgb(252, 187, 161)',
                  maxCount * 0.1, 'rgb(252, 146, 114)',
                  maxCount * 0.2, 'rgb(251, 106, 74)',
                  maxCount * 0.4, 'rgb(222, 45, 38)',
                  maxCount * 0.6, 'rgb(165, 15, 21)',
                  maxCount, 'rgb(103, 0, 13)'
                ],
                'fill-opacity': 0.8
              }}
            />
            <Layer
              id="hexbin-outline"
              type="line"
              paint={{
                'line-color': '#ffffff',
                'line-width': 1,
                'line-opacity': 0.5
              }}
            />
          </Source>
        )}

        {effectiveShowPoints && iconsLoaded && (
          <Source
            id="individual-points"
            type="geojson"
            data={geojsonData}
          >
            <Layer
              id="individual-points"
              type="symbol"
              layout={{
                'icon-image': [
                  'match',
                  ['get', 'locationType'],
                  'office', 'square-office',
                  'square-farm'
                ],
                'icon-size': 1.5,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true
              }}
              paint={{
                'icon-opacity': 0.92
              }}
            />
          </Source>
        )}
      </Map>

      <LocatorGlobe
        currentCenter={{ longitude: viewState.longitude, latitude: viewState.latitude }}
        currentZoom={viewState.zoom}
      />

      <div style={{
        position: 'absolute',
        top: '18px',
        left: '18px',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        color: '#f8fafc',
        padding: '6px 10px',
        borderRadius: '8px',
        fontSize: '12px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        zIndex: 5
      }}>
        Zoom {viewState.zoom.toFixed(2)}
      </div>

      <div style={{
        position: 'absolute',
        bottom: '30px',
        right: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        minWidth: '180px'
      }}>
        <div style={{ marginBottom: '10px', fontWeight: '600', fontSize: '14px', textAlign: 'center', color: '#111827' }}>
          # of Farms
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: '#374151', fontWeight: '500' }}>FEWER</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {[
              'rgb(254, 224, 210)',
              'rgb(251, 106, 74)',
              'rgb(103, 0, 13)'
            ].map((color, i) => (
              <div key={i} style={{
                width: '28px',
                height: '28px',
                backgroundColor: color,
                border: '1px solid #ddd',
                borderRadius: '50%'
              }} />
            ))}
          </div>
          <span style={{ fontSize: '12px', color: '#374151', fontWeight: '500' }}>MORE</span>
        </div>
      </div>
    </div>
  );
}
