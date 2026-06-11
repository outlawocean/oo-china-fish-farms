/**
 * @jest-environment jsdom
 */
import { convertFishmealCsvToGeoJSON, normalizeProvince } from '../../app/fish-farms-module/utils/fishmealPlants';

const HEADER = 'id,entity_id,entity_name,entity_name_local,entity_name_alternative,status,exclude_from_fmfo_plant_counts,address_street,address_administrative_1,address_administrative_2,address_postal_code,address_local_language,location_type,location_latitude,location_longitude,website,fmfo_people_living_within_half_mile,fmfo_people_living_within_one_mile,fmfo_people_living_within_three_miles,fmfo_people_living_within_five_miles';

const makeRow = (overrides = {}) => {
  const defaults = {
    id: 'uuid-1',
    entity_id: '10544',
    entity_name: 'Test Fishmeal Plant',
    entity_name_local: '测试鱼粉厂',
    entity_name_alternative: '',
    status: 'published',
    exclude_from_fmfo_plant_counts: '',
    address_street: '"No. 1, Test Road, Test City"',
    address_administrative_1: 'Shandong Province',
    address_administrative_2: 'Qingdao',
    address_postal_code: '',
    address_local_language: '',
    location_type: 'Specific',
    location_latitude: '36.06710',
    location_longitude: '120.38264',
    website: '',
    fmfo_people_living_within_half_mile: '',
    fmfo_people_living_within_one_mile: '',
    fmfo_people_living_within_three_miles: '',
    fmfo_people_living_within_five_miles: ''
  };
  return Object.values({ ...defaults, ...overrides }).join(',');
};

const makeCsv = (...rows) => [HEADER, ...rows].join('\n');

describe('convertFishmealCsvToGeoJSON', () => {
  it('converts a valid row to a GeoJSON Point feature', () => {
    const result = convertFishmealCsvToGeoJSON(makeCsv(makeRow()));

    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);

    const feature = result.features[0];
    expect(feature.type).toBe('Feature');
    expect(feature.geometry).toEqual({
      type: 'Point',
      coordinates: [120.38264, 36.0671]
    });
    expect(feature.properties).toEqual({
      id: '10544',
      name: 'Test Fishmeal Plant',
      chineseName: '测试鱼粉厂',
      province: 'Shandong Province',
      city: 'Qingdao',
      address: 'No. 1, Test Road, Test City',
      locationPrecision: 'Specific',
      kind: 'fishmeal_plant'
    });
  });

  it('drops rows without coordinates', () => {
    const result = convertFishmealCsvToGeoJSON(makeCsv(
      makeRow({ location_latitude: '', location_longitude: '' }),
      makeRow({ entity_id: '2', entity_name: 'Has Coords' })
    ));

    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.name).toBe('Has Coords');
  });

  it('drops rows with non-numeric or out-of-range coordinates', () => {
    const result = convertFishmealCsvToGeoJSON(makeCsv(
      makeRow({ location_latitude: 'abc', location_longitude: '120' }),
      makeRow({ location_latitude: '95', location_longitude: '120' }),
      makeRow({ location_latitude: '36', location_longitude: '200' })
    ));

    expect(result.features).toHaveLength(0);
  });

  it('drops rows that are not published', () => {
    const result = convertFishmealCsvToGeoJSON(makeCsv(
      makeRow({ status: 'draft' })
    ));

    expect(result.features).toHaveLength(0);
  });

  it('drops rows flagged for exclusion from plant counts', () => {
    const result = convertFishmealCsvToGeoJSON(makeCsv(
      makeRow({ exclude_from_fmfo_plant_counts: 'Exclude' })
    ));

    expect(result.features).toHaveLength(0);
  });

  it('handles a UTF-8 BOM before the header', () => {
    const result = convertFishmealCsvToGeoJSON('﻿' + makeCsv(makeRow()));

    expect(result.features).toHaveLength(1);
  });

  it('sorts features by plant name for stable output', () => {
    const result = convertFishmealCsvToGeoJSON(makeCsv(
      makeRow({ entity_id: '2', entity_name: 'Zeta Plant' }),
      makeRow({ entity_id: '1', entity_name: 'Alpha Plant' })
    ));

    expect(result.features.map(f => f.properties.name)).toEqual(['Alpha Plant', 'Zeta Plant']);
  });
});

describe('normalizeProvince', () => {
  it('passes through already-complete province names', () => {
    expect(normalizeProvince('Shandong Province')).toBe('Shandong Province');
    expect(normalizeProvince('Guangxi Zhuang Autonomous Region')).toBe('Guangxi Zhuang Autonomous Region');
  });

  it('fixes lowercase names', () => {
    expect(normalizeProvince('hubei province')).toBe('Hubei Province');
  });

  it('maps known aliases to canonical names', () => {
    expect(normalizeProvince('Fujian')).toBe('Fujian Province');
    expect(normalizeProvince('Liaoning')).toBe('Liaoning Province');
    expect(normalizeProvince('Sichuan')).toBe('Sichuan Province');
    expect(normalizeProvince('Zhe Jiang Sheng')).toBe('Zhejiang Province');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeProvince('')).toBe('');
    expect(normalizeProvince('   ')).toBe('');
  });
});
