/**
 * @jest-environment jsdom
 */
import { dataService, getDataSourceType, getDataSourceConfig } from '../../services/dataService';

// Mock fetch
global.fetch = jest.fn();

// Set up environment variables before importing
const originalEnv = process.env;

describe('DataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dataService.clearCache();
    // Mock GraphQL URL for tests that need it
    process.env.NEXT_PUBLIC_GRAPHQL_URL = 'https://test.graphql.api/graphql';
    process.env.NEXT_PUBLIC_GRAPHQL_TOKEN = 'test-token';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('transformToGeoJSON', () => {
    it('should return GeoJSON as-is if already in correct format', () => {
      const geojson = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [91, 39] } }]
      };

      const result = dataService.transformToGeoJSON(geojson, 'test');

      expect(result).toBe(geojson);
    });

    it('should transform array of records to GeoJSON', () => {
      const records = {
        china_fish_farms: [
          {
            id: '1',
            company_name: 'Test Farm',
            chinese_name: '测试农场',
            registered_address: '123 Test St',
            latitude_wgs84: '39.237',
            longitude_wgs84: '91.099',
            province: 'Xinjiang Uyghur Autonomous Region',
            city: 'Urumqi',
            district_and_county: 'Test District',
            location_type: 'Farm',
            enterprise_scale: 'Large',
            date_of_establishment: '2020-01-01',
            taxpayer_id: '123456'
          }
        ]
      };

      const result = dataService.transformToGeoJSON(records, 'china_fish_farms');

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
      expect(result.features[0].type).toBe('Feature');
      expect(result.features[0].geometry.type).toBe('Point');
      expect(result.features[0].geometry.coordinates).toEqual([91.099, 39.237]);
      expect(result.features[0].properties.name).toBe('Test Farm');
      expect(result.features[0].properties.province).toBe('Xinjiang Uyghur Autonomous Region');
    });

    it('should handle empty records array', () => {
      const records = { china_fish_farms: [] };

      const result = dataService.transformToGeoJSON(records, 'china_fish_farms');

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(0);
    });

    it('should handle non-array data gracefully', () => {
      const records = { invalid: 'data' };
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = dataService.transformToGeoJSON(records, 'china_fish_farms');

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should correctly map all properties', () => {
      const records = {
        test: [
          {
            id: 'test-id',
            company_name: 'Company Name',
            chinese_name: '中文名',
            registered_address: 'Address',
            latitude_wgs84: '40.0',
            longitude_wgs84: '100.0',
            province: 'Province',
            city: 'City',
            district_and_county: 'District',
            location_type: 'Type',
            enterprise_scale: 'Scale',
            date_of_establishment: '2020-01-01',
            taxpayer_id: 'TAX123'
          }
        ]
      };

      const result = dataService.transformToGeoJSON(records, 'test');
      const props = result.features[0].properties;

      expect(props.id).toBe('test-id');
      expect(props.name).toBe('Company Name');
      expect(props.chineseName).toBe('中文名');
      expect(props.address).toBe('Address');
      expect(props.province).toBe('Province');
      expect(props.city).toBe('City');
      expect(props.district).toBe('District');
      expect(props.locationType).toBe('Type');
      expect(props.scale).toBe('Scale');
      expect(props.established).toBe('2020-01-01');
      expect(props.taxpayerId).toBe('TAX123');
    });
  });

  describe('filterGeoJSON', () => {
    const mockGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            name: 'Farm A',
            chineseName: '农场A',
            province: 'Xinjiang Uyghur Autonomous Region',
            locationType: 'Farm',
            scale: 'Large'
          },
          geometry: { type: 'Point', coordinates: [85, 42] }
        },
        {
          type: 'Feature',
          properties: {
            name: 'Farm B',
            chineseName: '农场B',
            province: 'Tibet Autonomous Region',
            locationType: 'Farm',
            scale: 'Small'
          },
          geometry: { type: 'Point', coordinates: [91, 30] }
        },
        {
          type: 'Feature',
          properties: {
            name: 'Office C',
            chineseName: '办公室C',
            province: 'Xinjiang Uyghur Autonomous Region',
            locationType: 'Office',
            scale: 'Medium'
          },
          geometry: { type: 'Point', coordinates: [87, 43] }
        }
      ]
    };

    it('should return all features when no filters applied', () => {
      const result = dataService.filterGeoJSON(mockGeoJSON, {});

      expect(result.features).toHaveLength(3);
    });

    it('should return all features when filters is null', () => {
      const result = dataService.filterGeoJSON(mockGeoJSON, null);

      expect(result.features).toHaveLength(3);
    });

    it('should filter by locationType', () => {
      const result = dataService.filterGeoJSON(mockGeoJSON, { locationType: 'Farm' });

      expect(result.features).toHaveLength(2);
      result.features.forEach(f => {
        expect(f.properties.locationType).toBe('Farm');
      });
    });

    it('should filter by provinces array', () => {
      const result = dataService.filterGeoJSON(mockGeoJSON, {
        provinces: ['Xinjiang Uyghur Autonomous Region']
      });

      expect(result.features).toHaveLength(2);
      result.features.forEach(f => {
        expect(f.properties.province).toBe('Xinjiang Uyghur Autonomous Region');
      });
    });

    it('should filter by multiple provinces', () => {
      const result = dataService.filterGeoJSON(mockGeoJSON, {
        provinces: ['Xinjiang Uyghur Autonomous Region', 'Tibet Autonomous Region']
      });

      expect(result.features).toHaveLength(3);
    });

    it('should filter by scales array', () => {
      const result = dataService.filterGeoJSON(mockGeoJSON, {
        scales: ['Large', 'Medium']
      });

      expect(result.features).toHaveLength(2);
    });

    it('should filter by search term matching name', () => {
      const result = dataService.filterGeoJSON(mockGeoJSON, { search: 'Farm A' });

      expect(result.features).toHaveLength(1);
      expect(result.features[0].properties.name).toBe('Farm A');
    });

    it('should filter by search term matching Chinese name', () => {
      const result = dataService.filterGeoJSON(mockGeoJSON, { search: '农场B' });

      expect(result.features).toHaveLength(1);
      expect(result.features[0].properties.chineseName).toBe('农场B');
    });

    it('should be case-insensitive for search', () => {
      const result = dataService.filterGeoJSON(mockGeoJSON, { search: 'FARM A' });

      expect(result.features).toHaveLength(1);
      expect(result.features[0].properties.name).toBe('Farm A');
    });

    it('should combine multiple filters with AND logic', () => {
      const result = dataService.filterGeoJSON(mockGeoJSON, {
        locationType: 'Farm',
        provinces: ['Xinjiang Uyghur Autonomous Region']
      });

      expect(result.features).toHaveLength(1);
      expect(result.features[0].properties.name).toBe('Farm A');
    });

    it('should return empty array when no features match', () => {
      const result = dataService.filterGeoJSON(mockGeoJSON, {
        provinces: ['Non-existent Province']
      });

      expect(result.features).toHaveLength(0);
    });

    it('should preserve original GeoJSON structure', () => {
      const result = dataService.filterGeoJSON(mockGeoJSON, { locationType: 'Farm' });

      expect(result.type).toBe('FeatureCollection');
      expect(Array.isArray(result.features)).toBe(true);
    });

    it('should not mutate original GeoJSON', () => {
      const original = JSON.parse(JSON.stringify(mockGeoJSON));
      dataService.filterGeoJSON(mockGeoJSON, { locationType: 'Farm' });

      expect(mockGeoJSON).toEqual(original);
    });
  });

  describe('buildFilteredQuery', () => {
    it('should build query without filters', () => {
      const query = dataService.buildFilteredQuery({});

      expect(query).toContain('query GetFilteredFarms');
      expect(query).not.toContain('filter:');
    });

    it('should build query with locationType filter', () => {
      const query = dataService.buildFilteredQuery({ locationType: 'Farm' });

      expect(query).toContain('location_type: { _eq: "Farm" }');
    });

    it('should build query with provinces filter', () => {
      const query = dataService.buildFilteredQuery({
        provinces: ['Xinjiang Uyghur Autonomous Region', 'Tibet Autonomous Region']
      });

      expect(query).toContain('_or:');
      expect(query).toContain('province: { _eq: "Xinjiang Uyghur Autonomous Region" }');
      expect(query).toContain('province: { _eq: "Tibet Autonomous Region" }');
    });

    it('should build query with scales filter', () => {
      const query = dataService.buildFilteredQuery({
        scales: ['Large', 'Medium']
      });

      expect(query).toContain('enterprise_scale: { _eq: "Large" }');
      expect(query).toContain('enterprise_scale: { _eq: "Medium" }');
    });

    it('should build query with search filter', () => {
      const query = dataService.buildFilteredQuery({ search: 'test farm' });

      expect(query).toContain('company_name: { _contains: "test farm" }');
      expect(query).toContain('chinese_name: { _contains: "test farm" }');
    });

    it('should combine multiple filters with _and', () => {
      const query = dataService.buildFilteredQuery({
        locationType: 'Farm',
        provinces: ['Xinjiang Uyghur Autonomous Region'],
        search: 'test'
      });

      expect(query).toContain('_and:');
      expect(query).toContain('location_type');
      expect(query).toContain('province');
      expect(query).toContain('company_name');
    });

    it('should include all required fields in query', () => {
      const query = dataService.buildFilteredQuery({});

      expect(query).toContain('id');
      expect(query).toContain('company_name');
      expect(query).toContain('chinese_name');
      expect(query).toContain('latitude_wgs84');
      expect(query).toContain('longitude_wgs84');
      expect(query).toContain('province');
      expect(query).toContain('city');
    });
  });

  describe('caching', () => {
    it('should cache fetch results', async () => {
      const mockResponse = {
        china_fish_farms: [
          { id: '1', latitude_wgs84: '39', longitude_wgs84: '91' }
        ]
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResponse })
      });

      // First call
      await dataService.fetch('test-endpoint', {
        query: 'query { test { id } }'
      });

      // Second call should use cache
      await dataService.fetch('test-endpoint', {
        query: 'query { test { id } }'
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should skip cache when skipCache is true', async () => {
      const mockResponse = { data: {} };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      await dataService.fetch('test-endpoint', {
        query: 'query { test { id } }'
      });

      await dataService.fetch('test-endpoint', {
        query: 'query { test { id } }',
        skipCache: true
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should clear cache properly', async () => {
      const mockResponse = { data: {} };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      await dataService.fetch('test-endpoint', {
        query: 'query { test { id } }'
      });

      dataService.clearCache();

      await dataService.fetch('test-endpoint', {
        query: 'query { test { id } }'
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should throw error on non-ok response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(
        dataService.fetchFromGraphQL('query { test }')
      ).rejects.toThrow('GraphQL request failed: 500 Internal Server Error');
    });

    it('should throw error when GraphQL returns errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errors: [{ message: 'Test error' }]
        })
      });

      await expect(
        dataService.fetchFromGraphQL('query { test }')
      ).rejects.toThrow('GraphQL errors');
    });
  });

  describe('getDataSourceType and getDataSourceConfig', () => {
    it('should return current data source type', () => {
      const type = getDataSourceType();
      expect(['json', 'graphql']).toContain(type);
    });

    it('should return data source config object', () => {
      const config = getDataSourceConfig();

      expect(config).toHaveProperty('type');
      expect(config).toHaveProperty('jsonBasePath');
      expect(config).toHaveProperty('graphqlUrl');
      expect(config).toHaveProperty('graphqlCollection');
    });

    it('should return a copy of config, not the original', () => {
      const config1 = getDataSourceConfig();
      const config2 = getDataSourceConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});
