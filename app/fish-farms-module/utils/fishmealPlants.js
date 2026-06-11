// Converts the fishmeal plant source CSV into the GeoJSON FeatureCollection
// served from /public/data/fishmeal-plants.json. Used by generate-fishmeal-plants.js.
import { parse } from 'csv-parse/sync';

// Source data uses inconsistent province naming; map to the canonical names
// used elsewhere in the app (e.g. "Qinghai Province")
const PROVINCE_ALIASES = {
  'Fujian': 'Fujian Province',
  'Liaoning': 'Liaoning Province',
  'Sichuan': 'Sichuan Province',
  'Zhe Jiang Sheng': 'Zhejiang Province'
};

export function normalizeProvince(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';

  const titleCased = trimmed
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return PROVINCE_ALIASES[titleCased] || titleCased;
}

const isValidCoordinate = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

export function convertFishmealCsvToGeoJSON(csvText) {
  const rows = parse(csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true
  });

  const features = rows
    .filter(row =>
      row.status === 'published' &&
      !(row.exclude_from_fmfo_plant_counts || '').trim()
    )
    .map(row => {
      const lat = parseFloat(row.location_latitude);
      const lng = parseFloat(row.location_longitude);
      if (!isValidCoordinate(lat, lng)) return null;

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        properties: {
          id: row.entity_id,
          name: row.entity_name,
          chineseName: row.entity_name_local,
          province: normalizeProvince(row.address_administrative_1),
          city: row.address_administrative_2,
          address: row.address_street,
          locationPrecision: row.location_type,
          kind: 'fishmeal_plant'
        }
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name));

  return {
    type: 'FeatureCollection',
    features
  };
}
