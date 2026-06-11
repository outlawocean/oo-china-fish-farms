// Converts the fishmeal plant source CSV into public/data/fishmeal-plants.json
// Run with: node generate-fishmeal-plants.js [path-to-csv]
// Default source: ../../../ship_scraper/data/processed/fishmeal_plants_china.csv

import fs from 'fs';
import { convertFishmealCsvToGeoJSON } from './app/fish-farms-module/utils/fishmealPlants.js';

const DEFAULT_CSV_PATH = '../../../ship_scraper/data/processed/fishmeal_plants_china.csv';
const OUTPUT_PATH = './public/data/fishmeal-plants.json';

const csvPath = process.argv[2] || DEFAULT_CSV_PATH;
const csvText = fs.readFileSync(csvPath, 'utf8');

const geojson = convertFishmealCsvToGeoJSON(csvText);
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(geojson));

console.log(`Wrote ${geojson.features.length} fishmeal plants to ${OUTPUT_PATH}`);
