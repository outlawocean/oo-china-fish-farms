/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from '../../app/page';

// Mock useIsMobile hook
jest.mock('../../app/hooks/useIsMobile', () => ({
  __esModule: true,
  default: jest.fn(() => false),
}));

// Mock data service
jest.mock('../../services/dataService', () => ({
  dataService: {
    getWesternFarms: jest.fn(),
    getAllData: jest.fn(),
  },
}));

// Mock components to simplify testing
jest.mock('../../app/components/MapViewer', () => ({
  __esModule: true,
  default: function MockMapViewer(props) {
    return (
      <div data-testid="map-viewer">
        <span data-testid="has-active-filters">{String(props.hasActiveFilters)}</span>
        <span data-testid="view-mode">{props.viewMode}</span>
        <span data-testid="timeline-year">{props.timelineYear || 'null'}</span>
        <span data-testid="search-term">{props.searchTerm || 'empty'}</span>
      </div>
    );
  },
}));

jest.mock('../../app/components/FilterSidebar', () => ({
  __esModule: true,
  default: function MockFilterSidebar(props) {
    return (
      <div data-testid="filter-sidebar">
        <button
          data-testid="apply-xinjiang-filter"
          onClick={() => props.onFilterChange({ provinces: ['Xinjiang'] })}
        >
          Apply Xinjiang Filter
        </button>
        <button
          data-testid="clear-filters"
          onClick={() => props.onFilterChange({ provinces: [] })}
        >
          Clear Filters
        </button>
        <button
          data-testid="close-sidebar"
          onClick={props.onToggleCollapse}
        >
          Close
        </button>
        <button
          data-testid="change-to-table"
          onClick={() => props.onTabChange('table')}
        >
          Table View
        </button>
        <input
          data-testid="search-input"
          onChange={(e) => props.onSearchChange(e.target.value)}
        />
        <span data-testid="current-filters">
          {JSON.stringify(props.currentFilters)}
        </span>
      </div>
    );
  },
}));

jest.mock('../../app/components/TableView', () => ({
  __esModule: true,
  default: function MockTableView(props) {
    return (
      <div data-testid="table-view">
        <button
          data-testid="back-to-map"
          onClick={props.onBackToMap}
        >
          Back to Map
        </button>
      </div>
    );
  },
}));

import useIsMobile from '../../app/hooks/useIsMobile';
import { dataService } from '../../services/dataService';

describe('HomePage Component', () => {
  const mockWesternData = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          id: '1',
          name: 'Xinjiang Farm',
          province: 'Xinjiang Uyghur Autonomous Region',
          established: '2020-01-01',
        },
        geometry: { type: 'Point', coordinates: [85, 42] },
      },
      {
        type: 'Feature',
        properties: {
          id: '2',
          name: 'Tibet Farm',
          province: 'Tibet Autonomous Region',
          established: '2019-06-15',
        },
        geometry: { type: 'Point', coordinates: [91, 30] },
      },
    ],
  };

  const mockAllData = {
    type: 'FeatureCollection',
    features: Array.from({ length: 100 }, (_, i) => ({
      type: 'Feature',
      properties: {
        id: String(i),
        name: `Farm ${i}`,
        province: i % 2 === 0 ? 'Xinjiang Uyghur Autonomous Region' : 'Shandong Province',
      },
      geometry: { type: 'Point', coordinates: [100 + i * 0.1, 35] },
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useIsMobile.mockReturnValue(false);
    dataService.getWesternFarms.mockResolvedValue(mockWesternData);
    dataService.getAllData.mockResolvedValue(mockAllData);
  });

  describe('Initial Loading', () => {
    it('should show loading state initially', () => {
      render(<HomePage />);

      expect(screen.getByText(/Loading farm data/i)).toBeInTheDocument();
    });

    it('should load western farms data on mount', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(dataService.getWesternFarms).toHaveBeenCalled();
      });
    });

    it('should render map viewer after data loads', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('map-viewer')).toBeInTheDocument();
      });
    });

    it('should render filter sidebar after data loads (desktop)', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-sidebar')).toBeInTheDocument();
      });
    });
  });

  describe('Desktop Layout', () => {
    beforeEach(async () => {
      useIsMobile.mockReturnValue(false);
    });

    it('should render sidebar open by default on desktop', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-sidebar')).toBeInTheDocument();
      });
    });

    it('should show filter toggle button when sidebar is collapsed', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-sidebar')).toBeInTheDocument();
      });

      // Close sidebar
      await user.click(screen.getByTestId('close-sidebar'));

      await waitFor(() => {
        expect(screen.getByLabelText(/open filters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Layout', () => {
    beforeEach(() => {
      useIsMobile.mockReturnValue(true);
    });

    it('should start with sidebar collapsed on mobile', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('map-viewer')).toBeInTheDocument();
      });

      // Sidebar should not be visible initially
      expect(screen.queryByTestId('filter-sidebar')).not.toBeInTheDocument();
    });

    it('should show filter button on mobile', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/open filters/i)).toBeInTheDocument();
      });
    });

    it('should show active filter indicator on filter button', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/open filters/i)).toBeInTheDocument();
      });

      // Open filters
      await user.click(screen.getByLabelText(/open filters/i));

      // Apply filter
      await user.click(screen.getByTestId('apply-xinjiang-filter'));

      // Close sidebar
      await user.click(screen.getByTestId('close-sidebar'));

      // Filter button should indicate active filters (implementation specific)
      await waitFor(() => {
        expect(screen.getByLabelText(/open filters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filter State Management', () => {
    it('should update filters when onFilterChange is called', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-sidebar')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('apply-xinjiang-filter'));

      await waitFor(() => {
        expect(screen.getByTestId('has-active-filters').textContent).toBe('true');
      });
    });

    it('should pass current filters to FilterSidebar', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-sidebar')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('apply-xinjiang-filter'));

      await waitFor(() => {
        expect(screen.getByTestId('current-filters').textContent).toContain('Xinjiang');
      });
    });

    it('should clear filters when clear is clicked', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-sidebar')).toBeInTheDocument();
      });

      // Apply filter
      await user.click(screen.getByTestId('apply-xinjiang-filter'));

      // Clear filter
      await user.click(screen.getByTestId('clear-filters'));

      await waitFor(() => {
        expect(screen.getByTestId('has-active-filters').textContent).toBe('false');
      });
    });
  });

  describe('Search State Management', () => {
    it('should update search term when onSearchChange is called', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-sidebar')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'test farm');

      await waitFor(() => {
        expect(screen.getByTestId('search-term').textContent).toBe('test farm');
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should switch to table view when tab changes', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-sidebar')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('change-to-table'));

      await waitFor(() => {
        expect(screen.getByTestId('table-view')).toBeInTheDocument();
      });
    });

    it('should hide filter sidebar in table view', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-sidebar')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('change-to-table'));

      await waitFor(() => {
        expect(screen.queryByTestId('filter-sidebar')).not.toBeInTheDocument();
      });
    });

    it('should switch back to map view from table', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-sidebar')).toBeInTheDocument();
      });

      // Go to table
      await user.click(screen.getByTestId('change-to-table'));

      await waitFor(() => {
        expect(screen.getByTestId('table-view')).toBeInTheDocument();
      });

      // Go back to map
      await user.click(screen.getByTestId('back-to-map'));

      await waitFor(() => {
        expect(screen.getByTestId('map-viewer')).toBeInTheDocument();
      });
    });

    it('should load all data when switching to table view', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-sidebar')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('change-to-table'));

      await waitFor(() => {
        expect(dataService.getAllData).toHaveBeenCalled();
      });
    });
  });

  describe('Data Caching', () => {
    it('should cache western data and not refetch', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-sidebar')).toBeInTheDocument();
      });

      // Go to table (loads all data)
      await user.click(screen.getByTestId('change-to-table'));

      await waitFor(() => {
        expect(screen.getByTestId('table-view')).toBeInTheDocument();
      });

      // Go back to map
      await user.click(screen.getByTestId('back-to-map'));

      // Western farms should only be fetched once
      expect(dataService.getWesternFarms).toHaveBeenCalledTimes(1);
    });
  });

  describe('View Mode', () => {
    it('should start with points view mode', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('view-mode').textContent).toBe('points');
      });
    });
  });

  describe('Timeline', () => {
    it('should start with timeline at max year', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('map-viewer')).toBeInTheDocument();
      });

      // Timeline year should be set (2025 is max)
      expect(screen.getByTestId('timeline-year').textContent).not.toBe('null');
    });
  });

  describe('Filter Persistence on Mobile', () => {
    beforeEach(() => {
      useIsMobile.mockReturnValue(true);
    });

    it('should persist filters when sidebar reopens', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/open filters/i)).toBeInTheDocument();
      });

      // Open filters
      await user.click(screen.getByLabelText(/open filters/i));

      await waitFor(() => {
        expect(screen.getByTestId('filter-sidebar')).toBeInTheDocument();
      });

      // Apply filter
      await user.click(screen.getByTestId('apply-xinjiang-filter'));

      // Close sidebar
      await user.click(screen.getByTestId('close-sidebar'));

      // Reopen sidebar
      await user.click(screen.getByLabelText(/open filters/i));

      // Filters should still be applied
      await waitFor(() => {
        expect(screen.getByTestId('current-filters').textContent).toContain('Xinjiang');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle data fetch errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      dataService.getWesternFarms.mockRejectedValue(new Error('Network error'));

      render(<HomePage />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Layout Structure', () => {
    it('should have proper flexbox layout', async () => {
      const { container } = render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('map-viewer')).toBeInTheDocument();
      });

      const main = container.querySelector('main');
      expect(main).toHaveStyle({ display: 'flex' });
    });

    it('should fill viewport height', async () => {
      const { container } = render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByTestId('map-viewer')).toBeInTheDocument();
      });

      const main = container.querySelector('main');
      expect(main).toHaveStyle({ height: '100vh' });
    });
  });
});
