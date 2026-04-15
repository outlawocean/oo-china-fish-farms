'use client';

import { createContext, useContext, useMemo } from 'react';

const AppConfigContext = createContext(undefined);

const defaultConfig = {
  mapbox: {
    token: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    styles: {
      satellite: 'mapbox://styles/mapbox/satellite-v9',
      streets: 'mapbox://styles/mapbox/streets-v12',
      light: 'mapbox://styles/mapbox/light-v11',
      dark: 'mapbox://styles/mapbox/dark-v11',
      outdoors: 'mapbox://styles/mapbox/outdoors-v12',
    },
    defaultStyle: 'satellite',
  },
  defaultView: {
    center: [104.1954, 35.8617],
    zoom: 4,
    pitch: 0,
    bearing: 0,
  },
  density: {
    hexRadius: 20,
    colorScale: 'YlOrRd',
    opacity: 0.7,
  },
  data: {
    mode: 'graphql',
    graphql: {
      url: process.env.NEXT_PUBLIC_GRAPHQL_URL,
      token: process.env.NEXT_PUBLIC_GRAPHQL_TOKEN,
      collection: process.env.NEXT_PUBLIC_GRAPHQL_COLLECTION,
    },
  },
  app: {
    title: 'China Fish Farms Mapping',
    description: 'Interactive mapping application for fish farm locations in China',
    version: '1.0.0',
  },
  features: {
    enableSearch: true,
    enableFilters: true,
    enableTimeline: false,
    enableExport: false,
    enable3D: false,
  },
};

export function AppConfigProvider({ children, config = {} }) {
  const mergedConfig = useMemo(() => ({
    ...defaultConfig,
    ...config,
  }), [config]);

  return (
    <AppConfigContext.Provider value={mergedConfig}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  const context = useContext(AppConfigContext);

  if (context === undefined) {
    throw new Error('useAppConfig must be used within an AppConfigProvider');
  }

  return context;
}
