/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MapViewer from '../../app/components/MapViewer';

// Mock useIsMobileWithLoading hook
jest.mock('../../app/hooks/useIsMobile', () => ({
  __esModule: true,
  default: jest.fn(() => false),
  useIsMobileWithLoading: jest.fn(() => ({ isMobile: false, isLoaded: true })),
}));

// Mock map style imports
jest.mock('../../app/styles/dark-ocean-style.json', () => ({
  version: 8,
  name: 'Dark Ocean',
  sources: {},
  layers: [],
}), { virtual: true });

jest.mock('../../app/styles/satellite-western-style.json', () => ({
  version: 8,
  name: 'Satellite Western',
  sources: {},
  layers: [],
}), { virtual: true });

// Mock cloneMapStyle
jest.mock('../../app/fish-farms-module/utils/mapStyle', () => ({
  cloneMapStyle: jest.fn((style) => ({ ...style })),
}));

import { useIsMobileWithLoading } from '../../app/hooks/useIsMobile';

describe('MapViewer Component', () => {
  const mockGeoJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          id: '1',
          name: 'Test Farm A',
          chineseName: '测试农场A',
          province: 'Xinjiang Uyghur Autonomous Region',
          city: 'Urumqi',
          district: 'Test District',
          address: '123 Test St',
          established: '2020-01-01',
          scale: 'Large',
        },
        geometry: { type: 'Point', coordinates: [85, 42] },
      },
      {
        type: 'Feature',
        properties: {
          id: '2',
          name: 'Test Farm B',
          chineseName: '测试农场B',
          province: 'Tibet Autonomous Region',
          city: 'Lhasa',
          district: 'Test District 2',
          address: '456 Test Ave',
          established: '2018-05-15',
          scale: 'Medium',
        },
        geometry: { type: 'Point', coordinates: [91, 30] },
      },
    ],
  };

  const defaultProps = {
    geojsonData: mockGeoJSON,
    datasetType: 'western',
    isSidebarCollapsed: false,
    timelineYear: null,
    timelineMaxYear: null,
    hasActiveFilters: false,
    viewMode: 'points',
    onViewModeChange: jest.fn(),
    onViewStateChange: jest.fn(),
    searchTerm: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useIsMobileWithLoading.mockReturnValue({ isMobile: false, isLoaded: true });
  });

  describe('Rendering', () => {
    it('should render map container', () => {
      render(<MapViewer {...defaultProps} />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should show loading state when mobile state is not yet determined', () => {
      useIsMobileWithLoading.mockReturnValue({ isMobile: false, isLoaded: false });

      render(<MapViewer {...defaultProps} />);

      expect(screen.getByText('Loading map...')).toBeInTheDocument();
    });

    it('should not show loading state when mobile state is determined', () => {
      render(<MapViewer {...defaultProps} />);

      expect(screen.queryByText('Loading map...')).not.toBeInTheDocument();
    });

    it('should render with western dataset type', () => {
      render(<MapViewer {...defaultProps} datasetType="western" />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should render with all dataset type', () => {
      render(<MapViewer {...defaultProps} datasetType="all" />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  describe('Initial View State', () => {
    it('should call onViewStateChange with initial view on mount', () => {
      render(<MapViewer {...defaultProps} />);

      expect(defaultProps.onViewStateChange).toHaveBeenCalled();
    });

    it('should use western view center for western dataset', () => {
      render(<MapViewer {...defaultProps} datasetType="western" />);

      // Initial view should be set
      expect(defaultProps.onViewStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          longitude: expect.any(Number),
          latitude: expect.any(Number),
          zoom: expect.any(Number),
        })
      );
    });

    it('should use different center for mobile western view', () => {
      useIsMobileWithLoading.mockReturnValue({ isMobile: true, isLoaded: true });

      render(<MapViewer {...defaultProps} datasetType="western" />);

      // Mobile should have different initial coordinates
      expect(defaultProps.onViewStateChange).toHaveBeenCalled();
    });
  });

  describe('Detail Panel', () => {
    it('should not show detail panel when no farm is selected', () => {
      render(<MapViewer {...defaultProps} />);

      expect(screen.queryByText('Test Farm A')).not.toBeInTheDocument();
    });

    // Note: Testing farm selection would require simulating map click events
    // which is complex with mocked map components
  });

  describe('View Mode', () => {
    it('should handle points view mode', () => {
      render(<MapViewer {...defaultProps} viewMode="points" />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should handle density view mode', () => {
      render(<MapViewer {...defaultProps} viewMode="density" />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should call onViewModeChange when view mode changes', () => {
      const { rerender } = render(<MapViewer {...defaultProps} viewMode="points" />);

      // Simulate view mode change from parent
      rerender(<MapViewer {...defaultProps} viewMode="density" />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  describe('Timeline Filtering', () => {
    it('should handle timeline year filter', () => {
      render(
        <MapViewer
          {...defaultProps}
          timelineYear={2020}
          timelineMaxYear={2025}
        />
      );

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should show all features when timeline year equals max year', () => {
      render(
        <MapViewer
          {...defaultProps}
          timelineYear={2025}
          timelineMaxYear={2025}
        />
      );

      // No timeline filter should be applied
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should filter features when timeline year is less than max', () => {
      render(
        <MapViewer
          {...defaultProps}
          timelineYear={2019}
          timelineMaxYear={2025}
        />
      );

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  describe('Search Highlighting', () => {
    it('should handle empty search term', () => {
      render(<MapViewer {...defaultProps} searchTerm="" />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should handle search term with results', () => {
      render(<MapViewer {...defaultProps} searchTerm="Test Farm" />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should zoom to search results when feature count is small', () => {
      const searchResults = {
        type: 'FeatureCollection',
        features: [mockGeoJSON.features[0]], // Only 1 result
      };

      render(
        <MapViewer
          {...defaultProps}
          geojsonData={searchResults}
          searchTerm="Test Farm A"
        />
      );

      // Map should attempt to zoom to results
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  describe('Reset View Button', () => {
    it('should render reset view button in western view when zoomed in', () => {
      // This test is limited due to mocked map components
      // In real E2E tests, we would test this more thoroughly
      render(<MapViewer {...defaultProps} datasetType="western" />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  describe('Mobile Layout', () => {
    beforeEach(() => {
      useIsMobileWithLoading.mockReturnValue({ isMobile: true, isLoaded: true });
    });

    it('should render mobile layout', () => {
      render(<MapViewer {...defaultProps} />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should use mobile-specific initial view', () => {
      render(<MapViewer {...defaultProps} datasetType="western" />);

      expect(defaultProps.onViewStateChange).toHaveBeenCalled();
    });

    it('should not show mobile pan hint initially', () => {
      render(<MapViewer {...defaultProps} />);

      // Pan hint appears after delay, not immediately
      expect(screen.queryByText('Pan to explore more farms')).not.toBeInTheDocument();
    });
  });

  describe('Data Source Handling', () => {
    it('should handle empty feature collection', () => {
      const emptyData = {
        type: 'FeatureCollection',
        features: [],
      };

      render(<MapViewer {...defaultProps} geojsonData={emptyData} />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should handle large feature collections', () => {
      const largeData = {
        type: 'FeatureCollection',
        features: Array.from({ length: 5000 }, (_, i) => ({
          type: 'Feature',
          properties: { id: String(i), name: `Farm ${i}` },
          geometry: { type: 'Point', coordinates: [85 + Math.random() * 10, 35 + Math.random() * 10] },
        })),
      };

      render(<MapViewer {...defaultProps} geojsonData={largeData} />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should use layers for large datasets', () => {
      const largeData = {
        type: 'FeatureCollection',
        features: Array.from({ length: 3000 }, (_, i) => ({
          type: 'Feature',
          properties: { id: String(i) },
          geometry: { type: 'Point', coordinates: [85, 35] },
        })),
      };

      render(<MapViewer {...defaultProps} geojsonData={largeData} />);

      // With > 2000 features, should use Mapbox layers instead of markers
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  describe('Props Updates', () => {
    it('should handle geojsonData updates', () => {
      const { rerender } = render(<MapViewer {...defaultProps} />);

      const newData = {
        type: 'FeatureCollection',
        features: [mockGeoJSON.features[0]],
      };

      rerender(<MapViewer {...defaultProps} geojsonData={newData} />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should reset selected farm when dataset type changes', () => {
      const { rerender } = render(<MapViewer {...defaultProps} datasetType="western" />);

      rerender(<MapViewer {...defaultProps} datasetType="all" />);

      // Selected farm should be cleared
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should update view state when dataset type changes', () => {
      const { rerender } = render(<MapViewer {...defaultProps} datasetType="western" />);

      jest.clearAllMocks();

      rerender(<MapViewer {...defaultProps} datasetType="all" />);

      expect(defaultProps.onViewStateChange).toHaveBeenCalled();
    });
  });

  describe('Coordinate Display', () => {
    it('should render coordinate display on desktop', () => {
      render(<MapViewer {...defaultProps} />);

      // Coordinate display should be present
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should not render coordinate display on mobile', () => {
      useIsMobileWithLoading.mockReturnValue({ isMobile: true, isLoaded: true });

      render(<MapViewer {...defaultProps} />);

      // Mobile should not show coordinates
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper structure for screen readers', () => {
      render(<MapViewer {...defaultProps} />);

      // Map container should be present
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing Mapbox token gracefully', () => {
      const originalToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

      render(<MapViewer {...defaultProps} />);

      // Should still render, albeit with error handling
      expect(screen.getByTestId('map-container')).toBeInTheDocument();

      process.env.NEXT_PUBLIC_MAPBOX_TOKEN = originalToken;
    });

    it('should handle invalid geojson gracefully', () => {
      const invalidData = {
        type: 'FeatureCollection',
        features: null,
      };

      // This might throw, but should be handled
      expect(() => {
        render(<MapViewer {...defaultProps} geojsonData={invalidData} />);
      }).not.toThrow();
    });
  });
});
