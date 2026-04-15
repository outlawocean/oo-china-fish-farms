import * as turf from '@turf/turf';

// Generate hexbin grid over China and count points in each hexagon
export function generateHexbins(geojsonData, cellSize = 100) {
  const bbox = [73, 18, 135, 54]; // China bounding box [west, south, east, north]
  const hexgrid = turf.hexGrid(bbox, cellSize, { units: 'kilometers' });

  const hexCounts = new Map();

  // For each point, find which hexagon it belongs to
  geojsonData.features.forEach((point) => {
    const pointCoords = point.geometry.coordinates;
    const pt = turf.point(pointCoords);

    for (let i = 0; i < hexgrid.features.length; i++) {
      const hex = hexgrid.features[i];

      if (turf.booleanPointInPolygon(pt, hex)) {
        hexCounts.set(i, (hexCounts.get(i) || 0) + 1);
        break;
      }
    }
  });

  // Build result with only non-empty hexagons
  const nonEmptyHexbins = Array.from(hexCounts.entries()).map(([index, count]) => {
    const hex = hexgrid.features[index];
    return {
      ...hex,
      properties: {
        ...hex.properties,
        count: count
      }
    };
  });

  return {
    type: 'FeatureCollection',
    features: nonEmptyHexbins
  };
}

// Get color for a given count based on a blue scale
export function getColorForCount(count, maxCount) {
  if (count === 0) return 'rgba(0,0,0,0)';

  const colors = [
    { threshold: 0, color: [247, 251, 255] },
    { threshold: 0.2, color: [198, 219, 239] },
    { threshold: 0.4, color: [107, 174, 214] },
    { threshold: 0.6, color: [33, 113, 181] },
    { threshold: 0.8, color: [8, 48, 107] }
  ];

  const normalized = count / maxCount;

  for (let i = colors.length - 1; i >= 0; i--) {
    if (normalized >= colors[i].threshold) {
      const [r, g, b] = colors[i].color;
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  return `rgb(${colors[0].color.join(',')})`;
}

// Calculate statistics for hexbin data
export function getHexbinStats(hexbinData) {
  const counts = hexbinData.features.map(f => f.properties.count);

  return {
    min: Math.min(...counts),
    max: Math.max(...counts),
    mean: counts.reduce((a, b) => a + b, 0) / counts.length,
    total: counts.reduce((a, b) => a + b, 0)
  };
}
