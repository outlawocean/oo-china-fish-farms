# Data Service API Abstraction Layer

## Overview

The `dataService` is the **single source of truth** for all data access in the application. It provides a clean abstraction that makes switching between JSON files and the Directus GraphQL API as simple as changing one line of code.

## ✅ Current Status

- ✅ dataService created
- ✅ JSON mode tested and working
- ✅ GraphQL mode configured (ready when Directus data is imported)
- ✅ Environment variables set up
- ✅ Test script created

## How It Works

### The Magic: One Line To Switch Data Sources

In `services/dataService.js`, there's ONE configuration object that controls everything:

```javascript
const DATA_SOURCE = {
  type: 'json',  // Change to 'graphql' when ready!

  jsonBasePath: '/data',
  graphqlUrl: process.env.NEXT_PUBLIC_GRAPHQL_URL,
  graphqlToken: process.env.NEXT_PUBLIC_GRAPHQL_TOKEN,
  graphqlCollection: 'china_fish_farms'
};
```

**To switch from JSON to GraphQL:**
1. Import your data into Directus (using the `directus-setup` scripts)
2. Change `type: 'json'` to `type: 'graphql'`
3. Done! All your components automatically use the API

## Usage in Components

### Import the service

```javascript
import { dataService } from '@/services/dataService';
```

### Get Western China farms (695 farms)

```javascript
const westernData = await dataService.getWesternFarms();
// Returns GeoJSON FeatureCollection
```

### Get ALL data (62k+ records)

```javascript
const allData = await dataService.getAllData();
// Returns GeoJSON FeatureCollection
```

### Get filtered data

```javascript
const filtered = await dataService.getFilteredData({
  locationType: 'farm',                    // 'farm' or 'office'
  provinces: ['Xinjiang...', 'Tibet...'],  // Array of province names
  scales: ['small', 'medium'],             // Array of enterprise scales
  dateRange: {
    start: '2010-01-01',
    end: '2020-12-31'
  },
  search: 'Aquaculture'                    // Search company names
});
```

### Clear cache (if needed)

```javascript
dataService.clearCache();
```

## Return Format

All methods return data in **GeoJSON format**, which is what the Mapbox components expect:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [longitude, latitude]
      },
      "properties": {
        "id": 1,
        "name": "Company Name",
        "chineseName": "中文名称",
        "province": "Province Name",
        "city": "City Name",
        "locationType": "farm",
        "scale": "small",
        ...
      }
    }
  ]
}
```

## Example: Using in a React Component

```javascript
'use client';
import { useState, useEffect } from 'react';
import { dataService } from '@/services/dataService';
import Map from 'react-map-gl/mapbox';

export default function MyMap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const result = await dataService.getWesternFarms();
        setData(result);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!data) return <p>No data</p>;

  return <Map>...render {data.features.length} farms...</Map>;
}
```

## Testing

### Run the test script

```bash
cd china-fish-farms
node test-dataservice.js
```

**Expected output:**
```
✅ Success! Fetched 694 western farms
✅ Success! Fetched 30623 total records
✅ Success! Filtered to X farms
✅ GeoJSON structure is valid
```

## Switching to GraphQL (When Ready)

### Step 1: Import data to Directus

```bash
cd directus-setup
node 1-create-schema.js
node 2-import-data.js
```

### Step 2: Change configuration

In `services/dataService.js`:

```javascript
const DATA_SOURCE = {
  type: 'graphql',  // Changed from 'json'
  // ...rest stays the same
};
```

### Step 3: Test it

```bash
node test-dataservice.js
```

You should see:
```
Current data source: graphql
🌐 Fetching from GraphQL API
✅ Success! Fetched 695 western farms
```

### Step 4: Restart your Next.js dev server

```bash
npm run dev
```

Your app now uses the Directus API! 🎉

## Environment Variables

Make sure these are in `.env.local`:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=your-token-here

# Directus GraphQL (only needed for GraphQL mode)
NEXT_PUBLIC_GRAPHQL_URL=https://your-directus-instance.up.railway.app/graphql
NEXT_PUBLIC_GRAPHQL_TOKEN=your-directus-token
NEXT_PUBLIC_GRAPHQL_COLLECTION=china_fish_farms
```

## How Filtering Works

### JSON Mode (Client-Side Filtering)
1. Fetches ALL data once
2. Filters in JavaScript (fast with 62k records)
3. Caches the full dataset

### GraphQL Mode (Server-Side Filtering)
1. Sends filter criteria to Directus
2. Directus filters in database
3. Returns only matching records (faster, less bandwidth)

## Caching

The dataService includes automatic caching:
- Each data fetch is cached
- Repeated calls use cached data (instant!)
- Call `clearCache()` to force refresh
- Filtered results are not cached (dynamic)

## Benefits of This Approach

✅ **Single source of truth** - All data access goes through one service
✅ **Easy switching** - JSON ↔ GraphQL with one line change
✅ **Type safety** - Consistent GeoJSON output format
✅ **Performance** - Built-in caching
✅ **Testing** - Easy to test with JSON files
✅ **Production ready** - Switch to GraphQL when backend is ready

## Next Steps

1. ✅ ~~Create dataService~~ (DONE)
2. ✅ ~~Test with JSON mode~~ (DONE)
3. Update existing components to use dataService
4. Import data into Directus
5. Switch to GraphQL mode
6. Build new features with confidence!
