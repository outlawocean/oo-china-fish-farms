// Data service - abstraction layer for JSON files or GraphQL API
// Change DATA_SOURCE.type to switch between 'json' and 'graphql'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

const DATA_SOURCE = {
  type: 'json',
  jsonBasePath: `${BASE_PATH}/data`,
  graphqlUrl: process.env.NEXT_PUBLIC_GRAPHQL_URL,
  graphqlToken: process.env.NEXT_PUBLIC_GRAPHQL_TOKEN,
  graphqlCollection: process.env.NEXT_PUBLIC_GRAPHQL_COLLECTION || 'china_fish_farms'
};

class DataService {
  constructor() {
    this.cache = {};
  }

  async fetch(endpoint, options = {}) {
    const cacheKey = `${DATA_SOURCE.type}:${endpoint}`;
    if (this.cache[cacheKey] && !options.skipCache) {
      return this.cache[cacheKey];
    }

    let data;

    if (DATA_SOURCE.type === 'json') {
      data = await this.fetchFromJSON(endpoint);
    } else if (DATA_SOURCE.type === 'graphql') {
      data = await this.fetchFromGraphQL(options.query, options.variables);
    } else {
      throw new Error(`Unknown data source type: ${DATA_SOURCE.type}`);
    }

    this.cache[cacheKey] = data;
    return data;
  }

  async fetchFromJSON(endpoint) {
    // In Node.js (testing), read from file system
    if (typeof window === 'undefined') {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'public', 'data', endpoint.replace('/data/', ''));
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(fileContent);
    }

    // In browser, use fetch
    const url = `${DATA_SOURCE.jsonBasePath}${endpoint}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch JSON: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Return full GeoJSON object for FeatureCollections
    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      return data;
    }

    return data;
  }

  async fetchFromGraphQL(query, variables = {}) {
    if (!DATA_SOURCE.graphqlUrl) {
      throw new Error('GraphQL URL not configured. Set NEXT_PUBLIC_GRAPHQL_URL in .env.local');
    }

    const response = await fetch(DATA_SOURCE.graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DATA_SOURCE.graphqlToken}`
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  transformToGeoJSON(records, collectionName) {
    if (records.type === 'FeatureCollection') {
      return records;
    }

    const data = records[collectionName] || records;

    if (!Array.isArray(data)) {
      console.error('Expected array of records, got:', data);
      return { type: 'FeatureCollection', features: [] };
    }

    return {
      type: 'FeatureCollection',
      features: data.map(record => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            parseFloat(record.longitude_wgs84),
            parseFloat(record.latitude_wgs84)
          ]
        },
        properties: {
          id: record.id,
          name: record.company_name,
          chineseName: record.chinese_name,
          address: record.registered_address,
          province: record.province,
          city: record.city,
          district: record.district_and_county,
          locationType: record.location_type,
          scale: record.enterprise_scale,
          established: record.date_of_establishment,
          taxpayerId: record.taxpayer_id
        }
      }))
    };
  }

  // Get all farms and offices (62k+ records)
  async getAllData() {
    if (DATA_SOURCE.type === 'json') {
      return await this.fetch('/all-data.json');
    }

    const query = `
      query GetAllFarms {
        ${DATA_SOURCE.graphqlCollection}(limit: -1) {
          id company_name chinese_name registered_address latitude_wgs84 longitude_wgs84
          province city district_and_county location_type enterprise_scale
          date_of_establishment taxpayer_id
        }
      }
    `;

    const result = await this.fetch('all-data', { query });
    return this.transformToGeoJSON(result, DATA_SOURCE.graphqlCollection);
  }

  // Get Western China farms only (~1243 farms + offices)
  async getWesternFarms() {
    if (DATA_SOURCE.type === 'json') {
      return await this.fetch('/western-farms.json');
    }

    const query = `
      query GetWesternFarms {
        ${DATA_SOURCE.graphqlCollection}(
          limit: -1
          filter: {
            _or: [
              { province: { _eq: "Xinjiang Uyghur Autonomous Region" } }
              { province: { _eq: "Tibet Autonomous Region" } }
              { province: { _eq: "Qinghai Province" } }
            ]
          }
        ) {
          id company_name chinese_name registered_address latitude_wgs84 longitude_wgs84
          province city district_and_county location_type enterprise_scale
          date_of_establishment taxpayer_id
        }
      }
    `;

    const result = await this.fetch('western-farms', { query });
    return this.transformToGeoJSON(result, DATA_SOURCE.graphqlCollection);
  }

  // Get filtered data based on user selections
  async getFilteredData(filters = {}) {
    if (DATA_SOURCE.type === 'json') {
      const allData = await this.getAllData();
      return this.filterGeoJSON(allData, filters);
    }

    const query = this.buildFilteredQuery(filters);
    const result = await this.fetch(`filtered-${JSON.stringify(filters)}`, {
      query,
      skipCache: true
    });
    return this.transformToGeoJSON(result, DATA_SOURCE.graphqlCollection);
  }

  filterGeoJSON(geojson, filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return geojson;
    }

    const filtered = {
      ...geojson,
      features: geojson.features.filter(feature => {
        const props = feature.properties;

        if (filters.locationType && props.locationType !== filters.locationType) {
          return false;
        }

        if (filters.provinces && filters.provinces.length > 0) {
          if (!filters.provinces.includes(props.province)) {
            return false;
          }
        }

        if (filters.scales && filters.scales.length > 0) {
          if (!filters.scales.includes(props.scale)) {
            return false;
          }
        }

        if (filters.dateRange && props.dateEstablished) {
          const date = new Date(props.dateEstablished);
          const { start, end } = filters.dateRange;
          if (start && date < new Date(start)) return false;
          if (end && date > new Date(end)) return false;
        }

        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          const nameMatch = props.name?.toLowerCase().includes(searchLower);
          const chineseMatch = props.chineseName?.toLowerCase().includes(searchLower);
          if (!nameMatch && !chineseMatch) {
            return false;
          }
        }

        return true;
      })
    };

    return filtered;
  }

  buildFilteredQuery(filters) {
    const filterConditions = [];

    if (filters.locationType) {
      filterConditions.push(`{ location_type: { _eq: "${filters.locationType}" } }`);
    }

    if (filters.provinces && filters.provinces.length > 0) {
      const provinceFilters = filters.provinces.map(p => `{ province: { _eq: "${p}" } }`).join(', ');
      filterConditions.push(`{ _or: [${provinceFilters}] }`);
    }

    if (filters.scales && filters.scales.length > 0) {
      const scaleFilters = filters.scales.map(s => `{ enterprise_scale: { _eq: "${s}" } }`).join(', ');
      filterConditions.push(`{ _or: [${scaleFilters}] }`);
    }

    if (filters.search) {
      filterConditions.push(`{
        _or: [
          { company_name: { _contains: "${filters.search}" } }
          { chinese_name: { _contains: "${filters.search}" } }
        ]
      }`);
    }

    const filterString = filterConditions.length > 0
      ? `filter: { _and: [${filterConditions.join(', ')}] }`
      : '';

    return `
      query GetFilteredFarms {
        ${DATA_SOURCE.graphqlCollection}(limit: -1${filterString ? ', ' + filterString : ''}) {
          id company_name chinese_name registered_address latitude_wgs84 longitude_wgs84
          province city district_and_county location_type enterprise_scale
          date_of_establishment taxpayer_id
        }
      }
    `;
  }

  clearCache() {
    this.cache = {};
  }
}

export const dataService = new DataService();
export const getDataSourceType = () => DATA_SOURCE.type;
export const getDataSourceConfig = () => ({ ...DATA_SOURCE });
