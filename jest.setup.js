import '@testing-library/jest-dom';

// Mock global fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }),
  })
);

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock Mapbox GL
jest.mock('mapbox-gl', () => ({
  Map: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    remove: jest.fn(),
    addControl: jest.fn(),
    removeControl: jest.fn(),
    getCenter: jest.fn(() => ({ lng: 91, lat: 39 })),
    getZoom: jest.fn(() => 4),
    getBounds: jest.fn(() => ({
      getNorth: () => 45,
      getSouth: () => 25,
      getEast: () => 110,
      getWest: () => 70,
    })),
    easeTo: jest.fn(),
    fitBounds: jest.fn(),
    hasImage: jest.fn(() => false),
    addImage: jest.fn(),
    loadImage: jest.fn((url, cb) => cb(null, {})),
  })),
  NavigationControl: jest.fn(),
  Marker: jest.fn(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    remove: jest.fn(),
  })),
}));

// Mock react-map-gl
jest.mock('react-map-gl/mapbox', () => ({
  __esModule: true,
  default: jest.fn(({ children }) => <div data-testid="map-container">{children}</div>),
  Source: jest.fn(({ children }) => <div data-testid="map-source">{children}</div>),
  Layer: jest.fn(() => <div data-testid="map-layer" />),
  Marker: jest.fn(({ children }) => <div data-testid="map-marker">{children}</div>),
}));

// Mock environment variables
process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'test-mapbox-token';
process.env.NEXT_PUBLIC_GRAPHQL_URL = 'https://test.graphql.api/graphql';
process.env.NEXT_PUBLIC_GRAPHQL_TOKEN = 'test-token';
process.env.NEXT_PUBLIC_GRAPHQL_COLLECTION = 'china_fish_farms';

// Suppress console.error for expected test failures
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
       args[0].includes('act(...)'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
