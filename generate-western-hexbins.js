// Pre-generate multi-level hexbin density data for Western China farms
// Smaller hexagon sizes than all-China since the dataset is smaller (~1,200 farms)
// Run with: node generate-western-hexbins.js

import fs from 'fs';

const westernData = JSON.parse(fs.readFileSync('./public/data/western-farms.json', 'utf8'));
console.log(`Loaded ${westernData.features.length} western China features`);

const zoomLevels = [
  { minZoom: 0, maxZoom: 5, cellSize: 75, name: 'western-level-0' },
  { minZoom: 5, maxZoom: 7, cellSize: 40, name: 'western-level-1' },
  { minZoom: 7, maxZoom: 9, cellSize: 20, name: 'western-level-2' },
];

const EARTH_RADIUS = 6378137;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

const project = ([lng, lat]) => {
  const x = EARTH_RADIUS * lng * DEG_TO_RAD;
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * DEG_TO_RAD) / 2));
  return [x, y];
};

const unproject = ([x, y]) => {
  const lng = (x / EARTH_RADIUS) * RAD_TO_DEG;
  const lat = (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * RAD_TO_DEG;
  return [lng, lat];
};

const axialRound = (q, r) => {
  let x = q;
  let z = r;
  let y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return [rx, rz];
};

const pointToHex = (x, y, size) => {
  const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / size;
  const r = (2 / 3 * y) / size;
  return axialRound(q, r);
};

const hexToPixel = (q, r, size) => {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * 1.5 * r;
  return [x, y];
};

const hexPolygon = (centerX, centerY, size) => {
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (60 * i - 30) * DEG_TO_RAD;
    const x = centerX + size * Math.cos(angle);
    const y = centerY + size * Math.sin(angle);
    points.push(unproject([x, y]));
  }
  points.push(points[0]);
  return points;
};

zoomLevels.forEach((level, idx) => {
  console.log(`\n=== Processing ${level.name} (${level.cellSize}km hexagons) ===`);
  const size = level.cellSize * 1000;
  const hexCounts = new Map();

  westernData.features.forEach((point, pointIdx) => {
    const [x, y] = project(point.geometry.coordinates);
    const [q, r] = pointToHex(x, y, size);
    const key = `${q},${r}`;
    hexCounts.set(key, (hexCounts.get(key) || 0) + 1);
  });

  console.log(`Found ${hexCounts.size} hexagons with data`);

  const nonEmptyHexbins = Array.from(hexCounts.entries()).map(([key, count]) => {
    const [q, r] = key.split(',').map(Number);
    const [centerX, centerY] = hexToPixel(q, r, size);
    const polygon = hexPolygon(centerX, centerY, size);

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [polygon]
      },
      properties: {
        count,
        level: idx,
        cellSize: level.cellSize
      }
    };
  });

  const hexbinData = {
    type: 'FeatureCollection',
    features: nonEmptyHexbins
  };

  const filename = `./public/data/hexbin-density-${level.name}.json`;
  fs.writeFileSync(filename, JSON.stringify(hexbinData));

  console.log(`Saved ${nonEmptyHexbins.length} hexagons to ${filename}`);

  // Show count distribution
  const counts = nonEmptyHexbins.map(f => f.properties.count);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);
  const avgCount = (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1);
  console.log(`Count range: ${minCount} - ${maxCount}, average: ${avgCount}`);
});

console.log('\n=== All western zoom levels generated! ===');
