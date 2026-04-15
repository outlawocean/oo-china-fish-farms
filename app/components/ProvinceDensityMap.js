'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Layer, Popup, Source } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import darkOceanStyle from '../styles/dark-ocean-style.json';
import LocatorGlobe from './LocatorGlobe';
import { cloneMapStyle } from '../fish-farms-module/utils/mapStyle';

/**
 * Loads salmon SVG icons to the map for use in symbol layers.
 */
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

const BOUNDS = [
  [70, 15],
  [135, 55],
];

const PROVINCE_ALIASES = {
  Hubei: 'Hubei Province'
};

const normalizeProvinceName = (value, provinceNames) => {
  if (!value) return null;
  const trimmed = value.trim();
  const aliased = PROVINCE_ALIASES[trimmed] || trimmed;

  if (!provinceNames || provinceNames.size === 0) {
    return aliased;
  }

  if (provinceNames.has(aliased)) {
    return aliased;
  }

  const withProvince = `${aliased} Province`;
  if (provinceNames.has(withProvince)) {
    return withProvince;
  }

  return aliased;
};

const COLOR_CLASSES = [
  '#ffffff',
  '#fee2e2',
  '#fecaca',
  '#fca5a5',
  '#f87171',
  '#ef4444',
  '#b91c1c'
];

const buildQuantileStops = (values, steps) => {
  if (!values.length || steps <= 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const stops = [];

  for (let i = 1; i <= steps; i += 1) {
    const quantile = i / (steps + 1);
    const index = Math.floor(quantile * (sorted.length - 1));
    let value = sorted[index];
    const lastStop = stops[stops.length - 1];
    if (lastStop !== undefined && value <= lastStop) {
      value = lastStop + 1;
    }
    stops.push(value);
  }

  return stops;
};

const getFeatureBounds = (feature) => {
  if (!feature?.geometry?.coordinates) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const visit = (coords) => {
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const [lng, lat] = coords;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    coords.forEach(visit);
  };

  visit(feature.geometry.coordinates);

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
    return null;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat]
  ];
};

const getPolygonCentroid = (feature) => {
  if (!feature?.geometry?.coordinates) return null;
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;

  const visit = (coords) => {
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      sumLng += coords[0];
      sumLat += coords[1];
      count += 1;
      return;
    }
    coords.forEach(visit);
  };

  visit(feature.geometry.coordinates);

  if (count === 0) return null;
  return [sumLng / count, sumLat / count];
};

const getDataBounds = (features) => {
  if (!features?.length) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  features.forEach((f) => {
    const [lng, lat] = f.geometry.coordinates;
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  });

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
    return null;
  }

  return [[minLng, minLat], [maxLng, maxLat]];
};

export default function ProvinceDensityMap({ geojsonData, isSidebarCollapsed }) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapStyle = useMemo(() => {
    const style = cloneMapStyle(darkOceanStyle);
    // Hide city/town/village labels at low zoom to reduce clutter on choropleth
    const labelsToHide = ['place-other', 'place-village', 'place-town', 'place-city'];
    style.layers = style.layers.map((layer) => {
      if (labelsToHide.includes(layer.id)) {
        return { ...layer, minzoom: 6 };
      }
      // Reduce admin-state boundaries since choropleth provides province context
      if (layer.id === 'admin-state') {
        return {
          ...layer,
          paint: {
            ...layer.paint,
            'line-opacity': 0.3,
            'line-width': {
              base: 1.3,
              stops: [[3, 0.2], [22, 5]]
            }
          }
        };
      }
      return layer;
    });
    return style;
  }, []);
  const mapRef = useRef(null);
  const hoveredIdRef = useRef(null);

  const [provinceData, setProvinceData] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [iconsLoaded, setIconsLoaded] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: 104.75,
    latitude: 34.59,
    zoom: 3.2
  });
  const isDetailView = Boolean(selectedProvince);
  const showProvinceLayer = viewState.zoom <= 5 && !selectedProvince;
  const selectionJustMadeRef = useRef(false);

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    addSalmonIcons(map);
    setIconsLoaded(true);
  }, []);

  useEffect(() => {
    if (geojsonData) {
      console.log('ProvinceDensityMap received geojsonData with', geojsonData.features?.length, 'features');
    }
  }, [geojsonData]);

  useEffect(() => {
    let isMounted = true;

    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/data/china-provinces.geojson`)
      .then((response) => response.json())
      .then((data) => {
        if (isMounted) {
          setProvinceData(data);
        }
      })
      .catch((error) => {
        console.error('Error loading province boundaries:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    requestAnimationFrame(() => map.resize());
  }, [isSidebarCollapsed]);

  const provinceNameSet = useMemo(() => {
    if (!provinceData) return new Set();
    return new Set(provinceData.features.map((feature) => feature.properties.name));
  }, [provinceData]);

  const provinceCounts = useMemo(() => {
    if (!provinceData || !geojsonData) return null;

    const counts = new Map();

    geojsonData.features.forEach((feature) => {
      const rawProvince = feature.properties?.province;
      const normalized = normalizeProvinceName(rawProvince, provinceNameSet);
      if (!normalized) return;

      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });

    let maxCount = 0;
    const features = provinceData.features.map((feature) => {
      const count = counts.get(feature.properties.name) || 0;
      if (count > maxCount) maxCount = count;

      return {
        ...feature,
        id: feature.properties.id,
        properties: {
          ...feature.properties,
          count
        }
      };
    });

    // Create label points at province centroids
    const labelFeatures = provinceData.features.map((feature) => {
      const centroid = getPolygonCentroid(feature);
      const name = feature.properties.name;
      // Shorten display names by removing suffixes
      let displayName = name
        .replace(' Autonomous Region', '')
        .replace(' Uygur', '')
        .replace(' Province', '')
        .replace(' Municipality', '');

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: centroid || [0, 0]
        },
        properties: {
          name: displayName,
          fullName: name,
          count: counts.get(name) || 0
        }
      };
    }).filter((f) => f.geometry.coordinates[0] !== 0);

    const countsArray = features.map((feature) => feature.properties.count || 0);

    return {
      data: {
        type: 'FeatureCollection',
        features
      },
      labels: {
        type: 'FeatureCollection',
        features: labelFeatures
      },
      maxCount,
      countsArray
    };
  }, [geojsonData, provinceData, provinceNameSet]);

  const colorStops = useMemo(() => {
    if (!provinceCounts) return [];
    const positiveCounts = provinceCounts.countsArray.filter((value) => value > 0);
    return buildQuantileStops(positiveCounts, COLOR_CLASSES.length - 1);
  }, [provinceCounts]);

  const fillColorExpression = useMemo(() => {
    if (!colorStops.length) {
      return ['step', ['get', 'count'], COLOR_CLASSES[0], 1, COLOR_CLASSES[COLOR_CLASSES.length - 1]];
    }

    return colorStops.reduce(
      (expression, stop, index) => [...expression, stop, COLOR_CLASSES[index + 1]],
      ['step', ['get', 'count'], COLOR_CLASSES[0]]
    );
  }, [colorStops]);

  const legendGradient = useMemo(() => {
    const segmentSize = 100 / COLOR_CLASSES.length;
    const segments = COLOR_CLASSES.map((color, index) => {
      const start = (index * segmentSize).toFixed(2);
      const end = ((index + 1) * segmentSize).toFixed(2);
      return `${color} ${start}%, ${color} ${end}%`;
    });
    return `linear-gradient(90deg, ${segments.join(', ')})`;
  }, []);

  const selectedPoints = useMemo(() => {
    if (!geojsonData || !selectedProvince) return null;
    const normalizedSelected = normalizeProvinceName(selectedProvince, provinceNameSet);

    // Debug: show unique province names from farm data
    const uniqueProvinces = [...new Set(geojsonData.features.map(f => f.properties?.province))];
    console.log('Sample provinces from farm data:', uniqueProvinces.slice(0, 10));
    console.log('Province names from GeoJSON:', [...provinceNameSet].slice(0, 5));

    const filtered = geojsonData.features.filter((feature) => {
      const rawProvince = feature.properties?.province;
      const normalized = normalizeProvinceName(rawProvince, provinceNameSet);
      return normalized === normalizedSelected;
    });

    console.log(`Selected province: ${selectedProvince}, normalized: ${normalizedSelected}, found ${filtered.length} points`);

    return {
      type: 'FeatureCollection',
      features: filtered
    };
  }, [geojsonData, selectedProvince, provinceNameSet]);

  // Force map update when selectedPoints changes and ensure icons are loaded
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !selectedPoints) return;

    console.log('Forcing map update for selectedPoints with', selectedPoints.features.length, 'features');

    // Ensure icons are added
    if (!map.hasImage('square-farm')) {
      addSalmonIcons(map);
      setIconsLoaded(true);
    }

    // Check if source was added
    setTimeout(() => {
      const source = map.getSource('province-points');
      const pointsLayer = map.getLayer('province-points-layer');

      // Check actual features in source
      let sourceFeatures = [];
      if (source && source._data) {
        sourceFeatures = source._data.features || [];
      }

      // Query rendered features
      const renderedPoints = map.queryRenderedFeatures({ layers: ['province-points-layer'] });

      console.log('Mapbox state after render:', {
        sourceExists: Boolean(source),
        pointsLayerExists: Boolean(pointsLayer),
        currentZoom: map.getZoom(),
        sourceFeaturesCount: sourceFeatures.length,
        renderedPointsCount: renderedPoints.length,
        sampleCoords: selectedPoints?.features?.[0]?.geometry?.coordinates
      });
    }, 500);

    // Trigger a map resize/repaint to ensure layers render
    requestAnimationFrame(() => {
      map.triggerRepaint();
    });
  }, [selectedPoints]);

  const clearHoverState = () => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getSource('provinces')) return;

    if (hoveredIdRef.current !== null) {
      map.setFeatureState({ source: 'provinces', id: hoveredIdRef.current }, { hover: false });
      hoveredIdRef.current = null;
    }
  };

  const handleMouseMove = (event) => {
    if (isDetailView || !showProvinceLayer) return;
    const map = mapRef.current?.getMap();
    if (!map || !map.getSource('provinces')) return;

    const feature = event.features && event.features[0];
    if (!feature) {
      clearHoverState();
      setHoverInfo(null);
      return;
    }

    if (hoveredIdRef.current !== null && hoveredIdRef.current !== feature.id) {
      map.setFeatureState({ source: 'provinces', id: hoveredIdRef.current }, { hover: false });
    }

    hoveredIdRef.current = feature.id;
    map.setFeatureState({ source: 'provinces', id: feature.id }, { hover: true });

    setHoverInfo({
      name: feature.properties.name,
      longitude: event.lngLat.lng,
      latitude: event.lngLat.lat
    });
  };

  const handleMouseLeave = () => {
    if (isDetailView || !showProvinceLayer) return;
    clearHoverState();
    setHoverInfo(null);
  };

  const handleMapClick = (event) => {
    const features = event.features || [];

    // Check if user clicked on a cluster
    const clusterFeature = features.find((item) => item.layer?.id === 'province-clusters');
    if (clusterFeature) {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const clusterId = clusterFeature.properties.cluster_id;
      const source = map.getSource('province-points');

      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;

        map.easeTo({
          center: clusterFeature.geometry.coordinates,
          zoom: zoom,
          duration: 500
        });
      });
      return;
    }

    // Check if user clicked on an individual point
    const pointFeature = features.find((item) => item.layer?.id === 'province-points');
    if (pointFeature) {
      setSelectedPoint(pointFeature);
      return;
    }

    // Only handle province clicks when province layer is visible
    if (!showProvinceLayer) return;

    const provinceFeature = features.find((item) => item.layer?.id === 'province-fill');
    if (!provinceFeature) return;

    const provinceName = provinceFeature.properties.name;
    console.log('Province clicked:', provinceName);
    selectionJustMadeRef.current = true;
    setSelectedProvince(provinceName);
    setSelectedPoint(null);
    clearHoverState();
    setHoverInfo(null);
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Get farms in the selected province to calculate data bounds
    const normalizedProvince = normalizeProvinceName(provinceName, provinceNameSet);
    const farmsInProvince = geojsonData.features.filter((f) => {
      const rawProvince = f.properties?.province;
      const normalized = normalizeProvinceName(rawProvince, provinceNameSet);
      return normalized === normalizedProvince;
    });

    // Zoom to data bounds (where farms are), fall back to province geometry bounds
    const dataBounds = getDataBounds(farmsInProvince);
    const bounds = dataBounds || getFeatureBounds(provinceFeature);
    if (!bounds) return;

    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 80, left: 100, right: 100 },
      duration: 1400,
      easing: (t) => t * (2 - t)
    });
  };

  const handleMoveEnd = (evt) => {
    setViewState(evt.viewState);
    console.log(`Zoom: ${evt.viewState.zoom.toFixed(2)}, selectedProvince: ${selectedProvince}, showProvinceLayer: ${showProvinceLayer}`);

    if (!selectedProvince) return;

    const isUserMove = Boolean(evt.originalEvent);
    if (selectionJustMadeRef.current && !isUserMove) {
      selectionJustMadeRef.current = false;
      return;
    }

    if (evt.viewState.zoom <= 5 && isUserMove) {
      setSelectedProvince(null);
      setSelectedPoint(null);
      clearHoverState();
      setHoverInfo(null);
    }
  };

  if (!provinceCounts || !provinceCounts.data) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontSize: '18px',
        color: '#6b7280'
      }}>
        Loading province density...
      </div>
    );
  }

  console.log('Render state:', {
    selectedProvince,
    isDetailView,
    showProvinceLayer,
    hasSelectedPoints: Boolean(selectedPoints),
    selectedPointsCount: selectedPoints?.features?.length || 0,
    zoom: viewState.zoom,
    iconsLoaded,
    geojsonDataCount: geojsonData?.features?.length || 0
  });

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapGL
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        reuseMaps={false}
        initialViewState={viewState}
        minZoom={2.5}
        maxZoom={12}
        maxBounds={BOUNDS}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        interactiveLayerIds={[
          ...(selectedPoints ? ['province-points-layer'] : []),
          ...(showProvinceLayer ? ['province-fill'] : [])
        ]}
        cursor={showProvinceLayer && !isDetailView ? (hoverInfo ? 'pointer' : 'grab') : 'default'}
        onLoad={handleMapLoad}
        onMoveEnd={handleMoveEnd}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleMapClick}
      >
        {showProvinceLayer && (
          <Source id="provinces" type="geojson" data={provinceCounts.data}>
            <Layer
              id="province-fill"
              type="fill"
              paint={{
                'fill-color': fillColorExpression,
                'fill-opacity': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  0.95,
                  0.82
                ]
              }}
            />
            <Layer
              id="province-outline"
              type="line"
              paint={{
                'line-color': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  '#f8fafc',
                  '#94a3b8'
                ],
                'line-width': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  2,
                  0.8
                ],
                'line-opacity': 0.85
              }}
            />
                      </Source>
        )}

        {showProvinceLayer && provinceCounts?.labels && (
          <Source id="province-labels" type="geojson" data={provinceCounts.labels}>
            <Layer
              id="province-label-text"
              type="symbol"
              layout={{
                'text-field': ['get', 'name'],
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 11,
                'text-anchor': 'center',
                'text-allow-overlap': true,
                'text-ignore-placement': true
              }}
              paint={{
                'text-color': '#f1f5f9',
                'text-halo-color': '#0a1929',
                'text-halo-width': 1.5,
                'text-halo-blur': 0.5
              }}
            />
          </Source>
        )}

        {isDetailView && selectedPoints && selectedPoints.features.length > 0 && (
          <Source
            id="province-points"
            type="geojson"
            data={selectedPoints}
          >
            <Layer
              id="province-points-layer"
              type="circle"
              paint={{
                'circle-radius': 6,
                'circle-color': [
                  'match',
                  ['get', 'locationType'],
                  'office', '#f59e0b',
                  '#d61313'
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 1
              }}
            />
          </Source>
        )}

        {!isDetailView && hoverInfo && (
          <Popup
            longitude={hoverInfo.longitude}
            latitude={hoverInfo.latitude}
            closeButton={false}
            closeOnClick={false}
            offset={10}
            anchor="top"
          >
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#0f172a'
            }}>
              {hoverInfo.name}
            </div>
          </Popup>
        )}

        {selectedPoint && (
          <Popup
            longitude={selectedPoint.geometry.coordinates[0]}
            latitude={selectedPoint.geometry.coordinates[1]}
            onClose={() => setSelectedPoint(null)}
            closeButton={true}
            closeOnClick={true}
          >
            <div style={{
              padding: '14px 16px 12px',
              maxWidth: '320px',
              color: '#e5e7eb',
              position: 'relative',
              backgroundColor: '#0b0f14'
            }}>
              <button
                onClick={() => setSelectedPoint(null)}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  border: 'none',
                  background: 'transparent',
                  color: 'rgba(229, 231, 235, 0.6)',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
                aria-label="Close popup"
              >
                x
              </button>
              <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.55)' }}>
                Facility
              </div>
              <h3 style={{ margin: '6px 0 10px 0', fontSize: '16px', color: '#f9fafb', fontWeight: '600' }}>
                {selectedPoint.properties.name}
              </h3>
              {selectedPoint.properties.chineseName && (
                <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  {selectedPoint.properties.chineseName}
                </p>
              )}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px 12px',
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.72)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: '10px',
                marginTop: '10px'
              }}>
                <div>
                  <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.45)' }}>
                    Type
                  </div>
                  <div style={{ fontWeight: '600', color: '#f9fafb' }}>
                    {selectedPoint.properties.locationType === 'office' ? 'Office' : 'Farm'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.45)' }}>
                    Province
                  </div>
                  <div style={{ fontWeight: '600', color: '#f9fafb' }}>
                    {selectedPoint.properties.province || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.45)' }}>
                    Date Started
                  </div>
                  <div style={{ fontWeight: '600', color: '#f9fafb' }}>
                    {selectedPoint.properties.established || '—'}
                  </div>
                </div>
                {selectedPoint.properties.scale && (
                  <div>
                    <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.45)' }}>
                      Scale
                    </div>
                    <div style={{ fontWeight: '600', color: '#f9fafb' }}>
                      {selectedPoint.properties.scale}
                    </div>
                  </div>
                )}
              </div>
              {selectedPoint.properties.address && (
                <div style={{
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingTop: '10px',
                  marginTop: '10px'
                }}>
                  <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.45)', marginBottom: '4px' }}>
                    Address
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#f9fafb', lineHeight: '1.4' }}>
                    {selectedPoint.properties.address}
                  </div>
                </div>
              )}
            </div>
          </Popup>
        )}
      </MapGL>

      {isDetailView && (
        <button
          onClick={() => {
            setSelectedProvince(null);
            setSelectedPoint(null);
            const map = mapRef.current?.getMap();
            if (map) {
              map.easeTo({
                center: [104.75, 34.59],
                zoom: 3.2,
                duration: 1000
              });
            }
          }}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            color: '#111827',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span style={{ fontSize: '16px' }}>&larr;</span>
          Back to Overview
        </button>
      )}

      <LocatorGlobe
        currentCenter={{ longitude: viewState.longitude, latitude: viewState.latitude }}
        currentZoom={viewState.zoom}
      />

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
        <div style={{ marginBottom: '8px', fontWeight: '600', fontSize: '14px', textAlign: 'center', color: '#111827' }}>
          # of Farms
        </div>
        <div style={{
          textAlign: 'center',
          fontSize: '12px',
          color: '#374151',
          fontWeight: '600',
          marginBottom: '8px'
        }}>
          Fewer --&gt; More
        </div>
        <div style={{
          height: '12px',
          borderRadius: '999px',
          background: legendGradient,
          border: '1px solid #e5e7eb'
        }} />
      </div>
    </div>
  );
}
