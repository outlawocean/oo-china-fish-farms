'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import darkOceanStyle from '../styles/dark-ocean-style.json';
import satelliteWesternStyle from '../styles/satellite-western-style.json';
import { cloneMapStyle } from '../fish-farms-module/utils/mapStyle';
import { useIsMobileWithLoading } from '../hooks/useIsMobile';

// Creates a square icon for Mapbox symbol layers
const createSquareIcon = (color, size = 10, strokeWidth = 1) => {
  const totalSize = size + strokeWidth * 2;
  const canvas = document.createElement('canvas');
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalSize, totalSize);
  ctx.fillStyle = color;
  ctx.fillRect(strokeWidth, strokeWidth, size, size);

  return { width: totalSize, height: totalSize, data: ctx.getImageData(0, 0, totalSize, totalSize).data };
};

const addSquareIcons = (map) => {
  if (!map.hasImage('square-farm')) {
    map.addImage('square-farm', createSquareIcon('#d61313'));
  }
};

// Western hexbin level for density visualization
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
const WESTERN_HEXBIN_LEVELS = [
  { minZoom: 0, maxZoom: 7, file: `${BASE_PATH}/data/hexbin-density-western-level-0.json`, cellSize: 75 },
];

// Hint marker locations
const HINT_HEXAGON_CENTER = [86.9374609812344, 44.3];
const HINT_POINT_CENTER = [82.1993368, 43.8656922];

// localStorage keys for tracking hint display
const HINT_STORAGE_KEY_HEXAGON = 'fish-farms-hint-hexagon-seen';
const HINT_STORAGE_KEY_POINTS = 'fish-farms-hint-points-seen';
const INTRO_ANIMATION_STORAGE_KEY = 'fish-farms-intro-animation-seen';

// Map bounds for panning constraints
const BOUNDS_WESTERN = [
  [65, 18],
  [115, 58],
];

const BOUNDS_ALL = [
  [63.91, 5.46],
  [158.56, 55.70],
];

// Fishmeal plant marker color — the gold from the app palette (--color-uyg),
// distinct in both hue and shape (circle) from the red square farm markers
const FISHMEAL_COLOR = '#e8b30c';

// Case Stroke border style - bright line on dark casing for maximum visibility
// "Sandwich" of lines visible over both light deserts and dark forests
// Reduced 25% from original
const BORDER_STYLE = {
  // Dark outer casing
  outer: {
    color: 'rgba(20, 20, 20, 0.85)',
    width: [2, 1.875, 6, 3, 12, 4.5]
  },
  // Bright center line
  inner: {
    color: 'rgba(255, 250, 205, 0.95)',
    width: [2, 0.75, 6, 1.35, 12, 2.1]
  }
};

export default function MapViewer({ geojsonData, datasetType = 'all', isSidebarCollapsed, timelineYear, timelineMaxYear, hasActiveFilters = false, viewMode = 'points', onViewModeChange, onViewStateChange, searchTerm = '', showFishmealPlants = false, fishmealData = null }) {
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [iconsLoaded, setIconsLoaded] = useState(false);
  const [hoverInfo, setHoverInfo] = useState(null);
  // Check localStorage on init to only show hints once per user lifetime
  const [showHint, setShowHint] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !localStorage.getItem(HINT_STORAGE_KEY_HEXAGON);
  });
  const [showPointsHint, setShowPointsHint] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !localStorage.getItem(HINT_STORAGE_KEY_POINTS);
  });
  const mobileIntroCompleteRef = useRef(false);
  const shouldShowIntroAnimation = useRef(
    typeof window === 'undefined' ? false : !localStorage.getItem(INTRO_ANIMATION_STORAGE_KEY)
  );
  const [hoveredHexbinId, setHoveredHexbinId] = useState(null);
  const [hexbinData, setHexbinData] = useState({});
  const [hexbinMaxCount, setHexbinMaxCount] = useState(100);
  const [coordsHovered, setCoordsHovered] = useState(false);
  const mapRef = useRef(null);
  const { isMobile, isLoaded: isMobileLoaded } = useIsMobileWithLoading();
  const isMobileRef = useRef(isMobile);
  const hasInitializedRef = useRef(false);

  // Keep ref in sync but don't trigger re-renders for map calculations
  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  // Track if we should show search result highlights (when < 5 results from search)
  const [searchHighlightActive, setSearchHighlightActive] = useState(false);
  const prevFeatureCountRef = useRef(null);


  const setViewMode = onViewModeChange || (() => {});

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Auto-dismiss hints after 8 seconds and persist to localStorage
  useEffect(() => {
    if (!showHint || viewMode !== 'density') return;
    const timer = setTimeout(() => {
      setShowHint(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem(HINT_STORAGE_KEY_HEXAGON, 'true');
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [showHint, viewMode]);

  useEffect(() => {
    if (!showPointsHint || viewMode !== 'points') return;
    const timer = setTimeout(() => {
      setShowPointsHint(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem(HINT_STORAGE_KEY_POINTS, 'true');
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [showPointsHint, viewMode]);

  // Load hexbin data for western view
  useEffect(() => {
    if (datasetType !== 'western') return;

    const loadHexbinLevel = async (levelIndex) => {
      if (hexbinData[levelIndex]) return;

      const level = WESTERN_HEXBIN_LEVELS[levelIndex];
      try {
        const response = await fetch(level.file);
        const data = await response.json();
        const maxCount = Math.max(...data.features.map(f => f.properties.count));

        setHexbinData(prev => ({ ...prev, [levelIndex]: data }));
        setHexbinMaxCount(prev => Math.max(prev, maxCount));
      } catch (error) {
        console.error(`Error loading hexbin level ${levelIndex}:`, error);
      }
    };

    WESTERN_HEXBIN_LEVELS.forEach((_, index) => loadHexbinLevel(index));
  }, [datasetType]);

  const isWestern = datasetType === 'western';

  // Initial view settings per dataset - use ref to capture initial mobile state
  // to prevent re-renders when viewport changes
  const getMapCenter = useCallback((mobile) => ({
    western: {
      longitude: mobile ? 85 : 91.099,  // Shift west on mobile to show more Xinjiang
      latitude: mobile ? 42 : 39.237,   // Shift north on mobile to center Xinjiang
      zoom: mobile ? 3.5 : 4.13,
      pitch: mobile ? 0 : 2,
      bearing: mobile ? 0 : -13.6
    },
    all: {
      longitude: 111.2374,
      latitude: 34.1822,
      zoom: mobile ? 2.5 : 3.15,
      pitch: 0,
      bearing: 0
    }
  }), []);

  const handleMapLoad = useCallback((event) => {
    const map = event?.target;
    if (!map) return;

    addSquareIcons(map);
    setIconsLoaded(true);

    // Re-add icons after style changes (style changes clear custom images)
    const handleStyleData = () => {
      if (!map.hasImage('square-farm')) {
        addSquareIcons(map);
      }
      setIconsLoaded(true);
    };
    map.on('styledata', handleStyleData);

    // Mobile intro animation: fly in from globe view to target zoom (once per user)
    if (isMobileRef.current && shouldShowIntroAnimation.current) {
      setTimeout(() => {
        const centers = getMapCenter(true);
        const target = isWestern ? centers.western : centers.all;
        map.flyTo({
          center: [target.longitude, target.latitude],
          zoom: target.zoom,
          pitch: target.pitch,
          bearing: target.bearing,
          duration: 2400,
          curve: 1.2,
          easing: (t) => t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2  // ease-in-out cubic
        });
        map.once('moveend', () => {
          mobileIntroCompleteRef.current = true;
          map.setMinZoom(isWestern ? 2 : 2);
          localStorage.setItem(INTRO_ANIMATION_STORAGE_KEY, 'true');
        });
      }, 400);
    } else {
      mobileIntroCompleteRef.current = true;
    }
  }, [getMapCenter, isWestern]);

  // Compute initial view only once on mount
  const initialView = useMemo(() => {
    const centers = getMapCenter(isMobileRef.current);
    return isWestern ? centers.western : centers.all;
  }, [isWestern, getMapCenter]);

  const [viewState, setViewStateInternal] = useState(() => {
    const centers = getMapCenter(isMobileRef.current);
    return isWestern ? centers.western : centers.all;
  });

  const setViewState = useCallback((vs) => {
    setViewStateInternal(vs);
    if (onViewStateChange) {
      onViewStateChange(vs);
    }
  }, [onViewStateChange]);

  // Report initial viewState to parent on mount
  useEffect(() => {
    if (onViewStateChange && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      onViewStateChange(initialView);
    }
  }, [onViewStateChange, initialView]);

  // Reset view when dataset type changes (not when mobile state changes)
  useEffect(() => {
    const centers = getMapCenter(isMobileRef.current);
    const newView = isWestern ? centers.western : centers.all;
    setViewStateInternal(newView);
    if (onViewStateChange) {
      onViewStateChange(newView);
    }
    setSelectedFarm(null);
  }, [isWestern, getMapCenter, onViewStateChange]);

  // Fishmeal plants sit mostly on China's east coast, outside the western map
  // bounds — widen the view when the layer turns on, ease back when it turns off
  const prevShowFishmealRef = useRef(showFishmealPlants);
  const pendingBoundsRestoreRef = useRef(null);
  useEffect(() => {
    if (prevShowFishmealRef.current === showFishmealPlants) return;
    prevShowFishmealRef.current = showFishmealPlants;

    const map = mapRef.current?.getMap();
    if (!map || !isWestern) return;

    // Update bounds imperatively: passing a changed maxBounds prop through
    // react-map-gl crashes mapbox-gl with infinite _calcMatrices recursion.
    // Widening is safe immediately; narrowing waits until the camera is back
    // west so the constraint doesn't snap the view mid-flight.
    if (pendingBoundsRestoreRef.current) {
      map.off('moveend', pendingBoundsRestoreRef.current);
      pendingBoundsRestoreRef.current = null;
    }
    if (showFishmealPlants) {
      map.setMaxBounds(BOUNDS_ALL);
    } else {
      const restoreBounds = () => {
        pendingBoundsRestoreRef.current = null;
        map.setMaxBounds(BOUNDS_WESTERN);
      };
      pendingBoundsRestoreRef.current = restoreBounds;
      map.once('moveend', restoreBounds);
    }

    const centers = getMapCenter(isMobileRef.current);
    const target = showFishmealPlants ? centers.all : centers.western;
    map.easeTo({
      center: [target.longitude, target.latitude],
      zoom: target.zoom,
      pitch: target.pitch,
      bearing: target.bearing,
      duration: 1200
    });
  }, [showFishmealPlants, isWestern, getMapCenter]);

  // Use Mapbox layers for large datasets (>2000 features), React markers for small
  const useLayers = geojsonData.features.length > 2000 || isWestern;

  // Western view uses satellite imagery, all China uses dark ocean theme
  // Apply case stroke border style for western view
  const mapStyle = useMemo(() => {
    const baseStyle = isWestern
      ? cloneMapStyle(satelliteWesternStyle)
      : cloneMapStyle(darkOceanStyle);

    if (isWestern && baseStyle.layers) {
      // Find the country-borders layer
      const borderLayerIndex = baseStyle.layers.findIndex(l => l.id === 'country-borders');
      if (borderLayerIndex !== -1) {
        const borderLayer = baseStyle.layers[borderLayerIndex];
        const { source, filter, layout } = borderLayer;
        const sourceLayer = borderLayer['source-layer'];

        // Helper to create width interpolation
        const makeWidth = (widthArr) => [
          'interpolate',
          ['exponential', 1.5],
          ['zoom'],
          ...widthArr
        ];

        // Case Stroke: dark casing + bright center
        // Outer dark casing layer
        const outerLayer = {
          id: 'country-borders-outer',
          type: 'line',
          source,
          'source-layer': sourceLayer,
          layout: { ...layout },
          paint: {
            'line-color': BORDER_STYLE.outer.color,
            'line-width': makeWidth(BORDER_STYLE.outer.width)
          },
          filter
        };
        baseStyle.layers.splice(borderLayerIndex, 0, outerLayer);

        // Update main border layer as bright inner line
        borderLayer.paint['line-color'] = BORDER_STYLE.inner.color;
        borderLayer.paint['line-width'] = makeWidth(BORDER_STYLE.inner.width);
        delete borderLayer.paint['line-blur'];
      }
    }

    return baseStyle;
  }, [isWestern]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    requestAnimationFrame(() => map.resize());
  }, [isSidebarCollapsed]);

  // Auto-zoom and highlight when search results are fewer than 5
  useEffect(() => {
    const hasSearch = searchTerm && searchTerm.trim().length > 0;

    // Early exit: no search active, skip all work
    if (!hasSearch) {
      setSearchHighlightActive(false);
      prevFeatureCountRef.current = geojsonData?.features?.length ?? 0;
      return;
    }

    const featureCount = geojsonData?.features?.length ?? 0;
    const shouldHighlight = featureCount > 0 && featureCount < 5;

    setSearchHighlightActive(shouldHighlight);

    // Only zoom if the feature count changed due to search and we have < 5 results
    if (shouldHighlight && prevFeatureCountRef.current !== featureCount) {
      const map = mapRef.current?.getMap();
      if (map && geojsonData.features.length > 0) {
        // Calculate bounds for all features
        const coordinates = geojsonData.features.map(f => f.geometry.coordinates);
        // Use ref for mobile check to avoid dependency issues
        const mobile = isMobileRef.current;

        if (coordinates.length === 1) {
          // Single point - zoom to it
          map.easeTo({
            center: coordinates[0],
            zoom: mobile ? 7 : 8,
            duration: 800
          });
        } else {
          // Multiple points - fit bounds
          const lngs = coordinates.map(c => c[0]);
          const lats = coordinates.map(c => c[1]);
          const bounds = [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)]
          ];

          map.fitBounds(bounds, {
            padding: mobile ? { top: 60, bottom: 60, left: 40, right: 40 } : { top: 100, bottom: 100, left: 100, right: 100 },
            maxZoom: mobile ? 9 : 10,
            duration: 800
          });
        }
      }
    }

    prevFeatureCountRef.current = featureCount;
  }, [geojsonData, searchTerm]);

  const timelineFilter = useMemo(() => {
    if (!timelineYear || !timelineMaxYear || timelineYear >= timelineMaxYear) {
      return null;
    }
    return [
      'case',
      ['has', 'establishedYear'],
      ['<=', ['get', 'establishedYear'], timelineYear],
      false
    ];
  }, [timelineYear, timelineMaxYear]);

  const filteredMarkerData = useMemo(() => {
    if (!geojsonData || !timelineFilter) return geojsonData;
    const features = geojsonData.features.filter((feature) => {
      const year = feature.properties?.establishedYear;
      return Number.isFinite(year) && year <= timelineYear;
    });
    return {
      ...geojsonData,
      features
    };
  }, [geojsonData, timelineFilter, timelineYear]);

  const getCurrentHexbinLevel = useCallback((zoom) => {
    for (let i = 0; i < WESTERN_HEXBIN_LEVELS.length; i++) {
      if (zoom >= WESTERN_HEXBIN_LEVELS[i].minZoom && zoom < WESTERN_HEXBIN_LEVELS[i].maxZoom) {
        return i;
      }
    }
    return -1;
  }, []);

  const currentHexbinLevel = getCurrentHexbinLevel(viewState.zoom);
  const currentHexbinData = hexbinData[currentHexbinLevel];

  // Show hexbins when: western view, density mode, zoom in range, data loaded, no timeline/filters
  const isTimelineActive = timelineYear && timelineMaxYear && timelineYear < timelineMaxYear;
  const showHexbins = isWestern && viewMode === 'density' && currentHexbinLevel >= 0 && currentHexbinData && !isTimelineActive && !hasActiveFilters;
  const showPoints = !showHexbins || viewMode === 'points';

  // Use refs for values accessed in memoized callbacks to avoid dependency churn
  const showHexbinsRef = useRef(showHexbins);
  showHexbinsRef.current = showHexbins;
  const currentHexbinLevelRef = useRef(currentHexbinLevel);
  currentHexbinLevelRef.current = currentHexbinLevel;
  const showHintRef = useRef(showHint);
  showHintRef.current = showHint;
  const showPointsHintRef = useRef(showPointsHint);
  showPointsHintRef.current = showPointsHint;
  const selectedFarmRef = useRef(selectedFarm);
  selectedFarmRef.current = selectedFarm;

  // Close detail panel when clicking outside on mobile
  const handleMapClick = useCallback((e) => {
    if (!e.features || e.features.length === 0) {
      // Clicked on empty area - close panel on mobile
      if (isMobileRef.current && selectedFarmRef.current) {
        setSelectedFarm(null);
      }
      return;
    }

    const feature = e.features[0];
    const layerId = feature.layer?.id;

    // Hexbin click - zoom to next level
    if (layerId === 'hexbin-fill' && showHexbinsRef.current) {
      const map = mapRef.current?.getMap();
      if (map) {
        const coordinates = feature.geometry.coordinates[0];
        const lngs = coordinates.map(coord => coord[0]);
        const lats = coordinates.map(coord => coord[1]);
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;

        const nextLevel = currentHexbinLevelRef.current + 1;
        const targetZoom = nextLevel >= WESTERN_HEXBIN_LEVELS.length
          ? WESTERN_HEXBIN_LEVELS[WESTERN_HEXBIN_LEVELS.length - 1].maxZoom + 0.5
          : WESTERN_HEXBIN_LEVELS[nextLevel].minZoom + 0.4;

        map.easeTo({
          center: [centerLng, centerLat],
          zoom: targetZoom,
          duration: 800
        });
      }
      if (showHintRef.current) {
        setShowHint(false);
        if (typeof window !== 'undefined') {
          localStorage.setItem(HINT_STORAGE_KEY_HEXAGON, 'true');
        }
      }
      return;
    }

    // Point click
    setSelectedFarm(feature);
    if (showPointsHintRef.current) {
      setShowPointsHint(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem(HINT_STORAGE_KEY_POINTS, 'true');
      }
    }

    // Contextual zoom for western view
    if (isWestern) {
      const map = mapRef.current?.getMap();
      if (map) {
        const currentZoom = map.getZoom();
        const mobile = isMobileRef.current;
        const TARGET_ZOOM = mobile ? 6 : 6.5;
        const MAX_AUTO_ZOOM = mobile ? 7 : 8;

        if (currentZoom < TARGET_ZOOM) {
          map.easeTo({
            center: feature.geometry.coordinates,
            zoom: Math.min(TARGET_ZOOM, MAX_AUTO_ZOOM),
            duration: 800
          });
        } else if (currentZoom < MAX_AUTO_ZOOM) {
          map.easeTo({
            center: feature.geometry.coordinates,
            duration: 500
          });
        }
      }
    }
  }, [isWestern]);

  const handleMoveEnd = useCallback((evt) => setViewState(evt.viewState), [setViewState]);

  const handleMouseMove = useCallback((e) => {
    if (isMobileRef.current) return;
    if (isWestern && e.features && e.features.length > 0) {
      const feature = e.features[0];
      setHoverInfo({ feature });
      if (feature.layer?.id === 'hexbin-fill') {
        setHoveredHexbinId(feature.id);
      } else {
        setHoveredHexbinId(null);
      }
    } else if (isWestern) {
      setHoverInfo(null);
      setHoveredHexbinId(null);
    }
  }, [isWestern]);

  const handleMouseLeave = useCallback(() => {
    if (isWestern) {
      setHoverInfo(null);
      setHoveredHexbinId(null);
    }
  }, [isWestern]);

  // Don't render map until we know the mobile state to prevent re-initialization
  if (!isMobileLoaded) {
    return (
      <div style={{ height: '100%', width: '100%', position: 'relative', backgroundColor: 'var(--color-black)' }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'var(--color-white)',
          fontSize: '14px'
        }}>
          Loading map...
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <Map
        key={`${isWestern ? 'western' : 'all'}-${isMobile ? 'mobile' : 'desktop'}`}
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        reuseMaps={false}
        initialViewState={{
          longitude: initialView.longitude,
          latitude: initialView.latitude,
          zoom: (isMobile && shouldShowIntroAnimation.current) ? 1 : initialView.zoom,
          pitch: initialView.pitch,
          bearing: initialView.bearing
        }}
        {...(isWestern ? {
          minZoom: (isMobile && shouldShowIntroAnimation.current) ? 1 : (isMobile ? 2 : 2.5),
          maxZoom: 12.5,
          ...((isMobile && shouldShowIntroAnimation.current) ? {} : { maxBounds: BOUNDS_WESTERN })
        } : {
          minZoom: (isMobile && shouldShowIntroAnimation.current) ? 1 : (isMobile ? 2 : 3),
          ...((isMobile && shouldShowIntroAnimation.current) ? {} : { maxBounds: BOUNDS_ALL })
        })}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        interactiveLayerIds={[
          ...(useLayers ? (showHexbins ? ['hexbin-fill', 'all-points-layer'] : ['all-points-layer']) : []),
          ...(showFishmealPlants && fishmealData ? ['fishmeal-plants-layer'] : [])
        ]}
        cursor={isWestern ? (hoverInfo ? 'pointer' : 'grab') : undefined}
        onLoad={handleMapLoad}
        onMoveEnd={handleMoveEnd}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleMapClick}
      >
        {/* Hexbin density layer */}
        {showHexbins && currentHexbinData && (
          <Source
            key={`hexbins-level-${currentHexbinLevel}`}
            id="hexbins"
            type="geojson"
            data={currentHexbinData}
            generateId={true}
          >
            <Layer
              id="hexbin-fill"
              type="fill"
              beforeId={isWestern ? "china-city-labels" : undefined}
              paint={{
                'fill-color': [
                  'interpolate',
                  ['exponential', 1.5],
                  ['get', 'count'],
                  1, 'rgba(252, 187, 161, 0.85)',
                  hexbinMaxCount * 0.1, 'rgba(252, 146, 114, 0.88)',
                  hexbinMaxCount * 0.3, 'rgba(239, 59, 44, 0.9)',
                  hexbinMaxCount * 0.6, 'rgba(203, 24, 29, 0.92)',
                  hexbinMaxCount, 'rgba(153, 0, 13, 0.95)'
                ],
                'fill-opacity': 0.95
              }}
            />
            <Layer
              id="hexbin-outline"
              type="line"
              beforeId={isWestern ? "china-city-labels" : undefined}
              paint={{
                'line-color': 'rgba(255, 255, 255, 0.4)',
                'line-width': 1
              }}
            />
            <Layer
              id="hexbin-hover-glow"
              type="line"
              beforeId={isWestern ? "china-city-labels" : undefined}
              filter={hoveredHexbinId !== null ? ['==', ['id'], hoveredHexbinId] : ['==', ['id'], -1]}
              paint={{
                'line-color': 'rgba(255, 255, 255, 0.9)',
                'line-width': 6,
                'line-blur': 4.5
              }}
            />
            {showHint && !isMobile && (
              <Layer
                id="hint-hexagon-halo"
                type="line"
                beforeId={isWestern ? "china-city-labels" : undefined}
                filter={['==', ['get', 'count'], 48]}
                paint={{
                  'line-color': '#ffffff',
                  'line-width': 3,
                  'line-opacity': 0.9
                }}
              />
            )}
          </Source>
        )}

        {/* Hint popup for hexbin view - hidden on mobile */}
        {isWestern && showHint && showHexbins && !isMobile && (
          <Marker
            longitude={HINT_HEXAGON_CENTER[0]}
            latitude={HINT_HEXAGON_CENTER[1] + 0.9}
            anchor="bottom"
          >
            <div style={{
              backgroundColor: 'rgba(11, 15, 20, 0.95)',
              padding: '10px 14px',
              borderRadius: '8px',
              color: '#e5e7eb',
              fontSize: '13px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              animation: 'fadeIn 0.3s ease',
              whiteSpace: 'nowrap',
              position: 'relative'
            }}>
              Click a hexagon to explore
              <div style={{
                position: 'absolute',
                bottom: '-8px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid rgba(11, 15, 20, 0.95)'
              }} />
            </div>
          </Marker>
        )}

        {/* Hint popup for points view - hidden on mobile */}
        {isWestern && showPointsHint && showPoints && viewMode === 'points' && !isMobile && (
          <Marker
            longitude={HINT_POINT_CENTER[0]}
            latitude={HINT_POINT_CENTER[1] + 0.6}
            anchor="bottom"
          >
            <div style={{
              backgroundColor: 'rgba(11, 15, 20, 0.95)',
              padding: '10px 14px',
              borderRadius: '8px',
              color: '#e5e7eb',
              fontSize: '13px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              animation: 'fadeIn 0.3s ease',
              whiteSpace: 'nowrap',
              position: 'relative'
            }}>
              Click a point to see details
              <div style={{
                position: 'absolute',
                bottom: '-8px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid rgba(11, 15, 20, 0.95)'
              }} />
            </div>
          </Marker>
        )}

        {/* Selected point indicator */}
        {isWestern && selectedFarm && showPoints && (
          <Marker
            longitude={selectedFarm.geometry.coordinates[0]}
            latitude={selectedFarm.geometry.coordinates[1]}
            anchor="center"
          >
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Outer glow */}
              <div style={{
                position: 'absolute',
                width: isMobile ? '48px' : '56px',
                height: isMobile ? '48px' : '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                filter: 'blur(4px)',
                animation: 'pulse 2s ease-in-out infinite'
              }} />
              {/* Inner glow */}
              <div style={{
                position: 'absolute',
                width: isMobile ? '32px' : '40px',
                height: isMobile ? '32px' : '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                filter: 'blur(2px)'
              }} />
              {/* Ring */}
              <div style={{
                position: 'absolute',
                width: isMobile ? '24px' : '30px',
                height: isMobile ? '24px' : '30px',
                borderRadius: '50%',
                border: '2px solid rgba(255, 255, 255, 0.7)',
                boxShadow: '0 0 4px rgba(255, 255, 255, 0.2)'
              }} />
            </div>
          </Marker>
        )}

        {useLayers ? (
          <Source id="all-points" type="geojson" data={geojsonData}>
            {/* Search result highlight - shows glow on all points when < 5 results */}
            {isWestern && searchHighlightActive && showPoints && (
              <Layer
                id="search-highlight-glow"
                type="circle"
                beforeId={isWestern ? "china-city-labels" : undefined}
                paint={{
                  'circle-radius': isMobile ? 14 : 18,
                  'circle-color': 'rgba(255, 255, 255, 0.25)',
                  'circle-blur': 0.6,
                  'circle-opacity': 1
                }}
              />
            )}
            {isWestern && searchHighlightActive && showPoints && (
              <Layer
                id="search-highlight-ring"
                type="circle"
                beforeId={isWestern ? "china-city-labels" : undefined}
                paint={{
                  'circle-radius': isMobile ? 10 : 14,
                  'circle-color': 'transparent',
                  'circle-stroke-width': 2.5,
                  'circle-stroke-color': 'rgba(255, 255, 255, 0.9)',
                  'circle-stroke-opacity': 1
                }}
              />
            )}
            {isWestern && hoverInfo && showPoints && !isMobile && (
              <Layer
                id="hover-glow"
                type="circle"
                beforeId={isWestern ? "china-city-labels" : undefined}
                filter={['==', ['get', 'name'], hoverInfo.feature.properties.name]}
                paint={{
                  'circle-radius': 12,
                  'circle-color': 'transparent',
                  'circle-opacity': 1,
                  'circle-stroke-width': 2,
                  'circle-stroke-color': 'rgba(255, 255, 255, 0.85)',
                  'circle-stroke-opacity': 1
                }}
              />
            )}
            {isWestern && showPointsHint && showPoints && viewMode === 'points' && !isMobile && (
              <Layer
                id="hint-point-halo"
                type="circle"
                beforeId={isWestern ? "china-city-labels" : undefined}
                filter={['==', ['get', 'name'], 'Xinjiang Tianyun Organic Agriculture Company Ltd']}
                paint={{
                  'circle-radius': 16,
                  'circle-color': '#ffffff',
                  'circle-opacity': 0.9,
                  'circle-blur': 0.4
                }}
              />
            )}
            {iconsLoaded && (showPoints || !isWestern) && (
              <Layer
                id="all-points-layer"
                type="symbol"
                beforeId={isWestern ? "china-city-labels" : undefined}
                {...(timelineFilter ? { filter: timelineFilter } : {})}
                layout={{
                  'icon-image': 'square-farm',
                  'icon-size': isMobile ? 1.2 : 1,
                  'icon-allow-overlap': true,
                  'icon-ignore-placement': true
                }}
                paint={{
                  'icon-opacity': 0.76
                }}
              />
            )}
          </Source>
        ) : (
          filteredMarkerData.features.map((farm, index) => {
            return (
              <Marker
                key={index}
                longitude={farm.geometry.coordinates[0]}
                latitude={farm.geometry.coordinates[1]}
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelectedFarm(farm);
                }}
              >
                <div
                  style={{
                    width: isMobile ? '14px' : '10px',
                    height: isMobile ? '14px' : '10px',
                    borderRadius: '2px',
                    backgroundColor: '#d61313',
                    border: '1px solid white',
                    opacity: 0.76,
                    cursor: 'pointer'
                  }}
                />
              </Marker>
            );
          })
        )}

        {/* Fishmeal plants overlay */}
        {showFishmealPlants && fishmealData && (
          <Source id="fishmeal-plants" type="geojson" data={fishmealData}>
            <Layer
              id="fishmeal-plants-layer"
              type="circle"
              beforeId={isWestern ? "china-city-labels" : undefined}
              paint={{
                'circle-radius': isMobile ? 5.5 : 4.5,
                'circle-color': FISHMEAL_COLOR,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.9
              }}
            />
            {hoverInfo?.feature?.layer?.id === 'fishmeal-plants-layer' && !isMobile && (
              <Layer
                id="fishmeal-hover-ring"
                type="circle"
                beforeId={isWestern ? "china-city-labels" : undefined}
                filter={['==', ['get', 'id'], hoverInfo.feature.properties.id]}
                paint={{
                  'circle-radius': 12,
                  'circle-color': 'transparent',
                  'circle-stroke-width': 2,
                  'circle-stroke-color': 'rgba(255, 255, 255, 0.85)',
                  'circle-stroke-opacity': 1
                }}
              />
            )}
          </Source>
        )}
      </Map>


      {/* Detail panel - responsive bottom sheet on mobile, side panel on desktop */}
      {selectedFarm && (
        isMobile ? (
          // Mobile bottom sheet with Reset View button positioned above
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInFromBottom 0.3s ease forwards'
          }}>
            {/* Reset View button - positioned just above the card */}
            {isWestern && (viewState.zoom > 4.5 || viewMode === 'density') && (
              <button
                onClick={() => {
                  const map = mapRef.current?.getMap();
                  if (map) {
                    const centers = getMapCenter(isMobileRef.current);
                    map.easeTo({
                      center: [centers.western.longitude, centers.western.latitude],
                      zoom: centers.western.zoom,
                      pitch: centers.western.pitch,
                      bearing: centers.western.bearing,
                      duration: 1000
                    });
                    setSelectedFarm(null);
                    setViewMode('points');
                  }
                }}
                style={{
                  alignSelf: 'flex-start',
                  marginLeft: '16px',
                  marginBottom: '8px',
                  backgroundColor: 'rgba(11, 15, 20, 0.95)',
                  color: '#e5e7eb',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Reset View
              </button>
            )}
            {/* Card container */}
            <div style={{
              maxHeight: '60vh',
              backgroundColor: '#fafafa',
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative'
            }}>
            {/* Drag handle indicator */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '12px',
              flexShrink: 0
            }}>
              <div style={{
                width: '40px',
                height: '4px',
                backgroundColor: '#d1d5db',
                borderRadius: '2px'
              }} />
            </div>

            {/* Close button */}
            <button
              onClick={() => setSelectedFarm(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '36px',
                height: '36px',
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                border: 'none',
                borderRadius: '50%',
                color: '#666',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
              aria-label="Close panel"
            >
              ×
            </button>

            <div
              className="mobile-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0 20px 20px',
                paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))'
              }}
            >
              {selectedFarm.properties.kind === 'fishmeal_plant' && (
                <div style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#9c7a08',
                  marginBottom: '6px'
                }}>
                  Fishmeal Plant
                </div>
              )}
              <h2 style={{
                margin: '0 0 8px 0',
                fontSize: '20px',
                fontWeight: '600',
                color: '#1a1a1a',
                lineHeight: '1.3',
                paddingRight: '40px'
              }}>
                {selectedFarm.properties.name}
              </h2>

              <div style={{
                fontSize: '14px',
                color: '#666',
                marginBottom: '20px',
                paddingBottom: '16px',
                borderBottom: '1px solid #e0e0e0'
              }}>
                {selectedFarm.properties.chineseName && (
                  <div style={{ marginBottom: '4px' }}>{selectedFarm.properties.chineseName}</div>
                )}
                <button
                  onClick={() => {
                    const lat = selectedFarm.geometry.coordinates[1];
                    const lng = selectedFarm.geometry.coordinates[0];
                    window.open(`https://www.google.com/maps?q=${lat},${lng}&t=k`, '_blank');
                  }}
                  style={{
                    color: '#c41e1e',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '14px',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  {selectedFarm.geometry.coordinates[1].toFixed(3)}, {selectedFarm.geometry.coordinates[0].toFixed(3)} →
                </button>
                {selectedFarm.properties.locationPrecision === 'Approximate' && (
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#999' }}>
                    Location is approximate
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h3 style={{
                    margin: '0 0 8px 0',
                    fontSize: '11px',
                    fontWeight: '600',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#c41e1e'
                  }}>
                    Location
                  </h3>
                  <div style={{ fontSize: '15px', color: '#333', lineHeight: '1.5' }}>
                    {selectedFarm.properties.district && (
                      <div>{selectedFarm.properties.district}</div>
                    )}
                    {selectedFarm.properties.city && (
                      <div>{selectedFarm.properties.city}</div>
                    )}
                    <div>{selectedFarm.properties.province || '—'}</div>
                  </div>
                </div>

                {selectedFarm.properties.kind === 'fishmeal_plant' ? (
                  selectedFarm.properties.address && (
                    <div>
                      <h3 style={{
                        margin: '0 0 6px 0',
                        fontSize: '11px',
                        fontWeight: '600',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#c41e1e'
                      }}>
                        Address
                      </h3>
                      <div style={{ fontSize: '15px', color: '#333', lineHeight: '1.5' }}>
                        {selectedFarm.properties.address}
                      </div>
                    </div>
                  )
                ) : (
                  <div>
                    <h3 style={{
                      margin: '0 0 6px 0',
                      fontSize: '11px',
                      fontWeight: '600',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#c41e1e'
                    }}>
                      Established
                    </h3>
                    <div style={{ fontSize: '15px', color: '#333' }}>
                      {selectedFarm.properties.established || '—'}
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        ) : (
          // Desktop side panel
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '160px',
            width: '340px',
            maxHeight: 'calc(100% - 180px)',
            backgroundColor: '#fafafa',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.3s ease',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => setSelectedFarm(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '28px',
                height: '28px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#666',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s ease',
                zIndex: 10
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#333'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
              aria-label="Close panel"
            >
              ×
            </button>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '32px 28px'
            }}>
              {selectedFarm.properties.kind === 'fishmeal_plant' && (
                <div style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#9c7a08',
                  marginBottom: '8px'
                }}>
                  Fishmeal Plant
                </div>
              )}
              <h2 style={{
                margin: '0 0 8px 0',
                fontSize: '24px',
                fontWeight: '600',
                color: '#1a1a1a',
                lineHeight: '1.3'
              }}>
                {selectedFarm.properties.name}
              </h2>

              <div style={{
                fontSize: '14px',
                color: '#666',
                marginBottom: '24px',
                paddingBottom: '20px',
                borderBottom: '1px solid #e0e0e0'
              }}>
                {selectedFarm.properties.chineseName && (
                  <span style={{ marginRight: '12px' }}>{selectedFarm.properties.chineseName}</span>
                )}
                <span
                  style={{
                    color: coordsHovered ? '#c41e1e' : '#999',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={() => setCoordsHovered(true)}
                  onMouseLeave={() => setCoordsHovered(false)}
                  onClick={() => {
                    const lat = selectedFarm.geometry.coordinates[1];
                    const lng = selectedFarm.geometry.coordinates[0];
                    window.open(`https://www.google.com/maps?q=${lat},${lng}&t=k`, '_blank');
                  }}
                >
                  {selectedFarm.geometry.coordinates[1].toFixed(3)}, {selectedFarm.geometry.coordinates[0].toFixed(3)}
                  {coordsHovered && (
                    <span style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: '6px',
                      padding: '4px 8px',
                      backgroundColor: '#333',
                      color: '#fff',
                      fontSize: '11px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      zIndex: 10
                    }}>
                      Open in Google Maps
                    </span>
                  )}
                </span>
                {selectedFarm.properties.locationPrecision === 'Approximate' && (
                  <span style={{ marginLeft: '10px', fontSize: '12px', color: '#999' }}>
                    approximate location
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <h3 style={{
                    margin: '0 0 12px 0',
                    fontSize: '12px',
                    fontWeight: '600',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#c41e1e'
                  }}>
                    Location
                  </h3>
                  <div style={{ fontSize: '15px', color: '#333', lineHeight: '1.6' }}>
                    {selectedFarm.properties.district && (
                      <div>{selectedFarm.properties.district}</div>
                    )}
                    {selectedFarm.properties.city && (
                      <div>{selectedFarm.properties.city}</div>
                    )}
                    <div>{selectedFarm.properties.province || '—'}</div>
                  </div>
                </div>

                {selectedFarm.properties.kind === 'fishmeal_plant' ? (
                  selectedFarm.properties.address && (
                    <div>
                      <h3 style={{
                        margin: '0 0 8px 0',
                        fontSize: '12px',
                        fontWeight: '600',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#c41e1e'
                      }}>
                        Address
                      </h3>
                      <div style={{ fontSize: '15px', color: '#333', lineHeight: '1.6' }}>
                        {selectedFarm.properties.address}
                      </div>
                    </div>
                  )
                ) : (
                  <div>
                    <h3 style={{
                      margin: '0 0 8px 0',
                      fontSize: '12px',
                      fontWeight: '600',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#c41e1e'
                    }}>
                      Established
                    </h3>
                    <div style={{ fontSize: '15px', color: '#333' }}>
                      {selectedFarm.properties.established || '—'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {/* Reset View button - desktop or mobile without card */}
      {isWestern && (viewState.zoom > 4.5 || viewMode === 'density') && !(isMobile && selectedFarm) && (
        <button
          onClick={() => {
            const map = mapRef.current?.getMap();
            if (map) {
              const centers = getMapCenter(isMobileRef.current);
              map.easeTo({
                center: [centers.western.longitude, centers.western.latitude],
                zoom: centers.western.zoom,
                pitch: centers.western.pitch,
                bearing: centers.western.bearing,
                duration: 1000
              });
              setSelectedFarm(null);
              setViewMode('points');
            }
          }}
          style={{
            position: 'absolute',
            top: isMobile ? 'auto' : '18px',
            bottom: isMobile ? '16px' : 'auto',
            left: isMobile ? '16px' : (isSidebarCollapsed ? '70px' : '18px'),
            backgroundColor: 'rgba(11, 15, 20, 0.95)',
            color: '#e5e7eb',
            padding: isMobile ? '12px 16px' : '8px 14px',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '13px',
            fontWeight: '500',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            cursor: 'pointer',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'background-color 0.2s ease, bottom 0.3s ease'
          }}
          onMouseEnter={(e) => !isMobile && (e.currentTarget.style.backgroundColor = 'rgba(11, 15, 20, 1)')}
          onMouseLeave={(e) => !isMobile && (e.currentTarget.style.backgroundColor = 'rgba(11, 15, 20, 0.95)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Reset View
        </button>
      )}

    </div>
  );
}
