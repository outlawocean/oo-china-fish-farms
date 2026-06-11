/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterSidebar from '../../app/components/FilterSidebar';

// Mock useIsMobile hook
jest.mock('../../app/hooks/useIsMobile', () => ({
  __esModule: true,
  default: jest.fn(() => false), // Default to desktop
}));

// Mock LocatorGlobe component
jest.mock('../../app/components/LocatorGlobe', () => ({
  __esModule: true,
  default: () => <div data-testid="locator-globe">Globe</div>,
}));

import useIsMobile from '../../app/hooks/useIsMobile';

describe('FilterSidebar Component', () => {
  const mockData = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          province: 'Xinjiang Uyghur Autonomous Region',
          name: 'Farm A',
        },
        geometry: { type: 'Point', coordinates: [85, 42] },
      },
      {
        type: 'Feature',
        properties: {
          province: 'Xinjiang Uyghur Autonomous Region',
          name: 'Farm B',
        },
        geometry: { type: 'Point', coordinates: [86, 43] },
      },
      {
        type: 'Feature',
        properties: {
          province: 'Tibet Autonomous Region',
          name: 'Farm C',
        },
        geometry: { type: 'Point', coordinates: [91, 30] },
      },
      {
        type: 'Feature',
        properties: {
          province: 'Qinghai Province',
          name: 'Farm D',
        },
        geometry: { type: 'Point', coordinates: [96, 35] },
      },
    ],
  };

  const defaultProps = {
    data: mockData,
    onFilterChange: jest.fn(),
    isCollapsed: false,
    onToggleCollapse: jest.fn(),
    timeline: null,
    showTimeline: false,
    activeTab: 'western',
    onTabChange: jest.fn(),
    viewMode: 'points',
    onViewModeChange: jest.fn(),
    mapViewState: null,
    hasActiveFilters: false,
    isTimelineActive: false,
    onSearchChange: jest.fn(),
    currentFilters: { provinces: [] },
    currentSearchTerm: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useIsMobile.mockReturnValue(false);
  });

  describe('Desktop Layout', () => {
    it('should render sidebar with correct structure', () => {
      render(<FilterSidebar {...defaultProps} />);

      expect(screen.getByText(/Filter.*Records/)).toBeInTheDocument();
    });

    it('should render collapse button', () => {
      render(<FilterSidebar {...defaultProps} />);

      const closeButton = screen.getByLabelText(/close/i) || screen.getByText('←');
      expect(closeButton).toBeInTheDocument();
    });

    it('should render location filter section in western view', () => {
      render(<FilterSidebar {...defaultProps} activeTab="western" />);

      expect(screen.getByText('LOCATION')).toBeInTheDocument();
    });

    it('should render province filter section in all view', () => {
      render(<FilterSidebar {...defaultProps} activeTab="all" />);

      expect(screen.getByText('PROVINCE')).toBeInTheDocument();
    });

    it('should show simplified location options in western view', () => {
      render(<FilterSidebar {...defaultProps} activeTab="western" />);

      expect(screen.getByText('Xinjiang')).toBeInTheDocument();
      expect(screen.getByText('Tibetan Plateau')).toBeInTheDocument();
    });

    it('should return null when collapsed', () => {
      const { container } = render(<FilterSidebar {...defaultProps} isCollapsed={true} />);

      expect(container.firstChild).toBeNull();
    });

    it('should call onToggleCollapse when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<FilterSidebar {...defaultProps} />);

      const closeButton = screen.getByText('←');
      await user.click(closeButton);

      expect(defaultProps.onToggleCollapse).toHaveBeenCalled();
    });

    it('should display total record count', () => {
      render(<FilterSidebar {...defaultProps} />);

      expect(screen.getByText(/Filter 4 Records/)).toBeInTheDocument();
    });

    it('should show "Showing all records" when no filters active', () => {
      render(<FilterSidebar {...defaultProps} />);

      expect(screen.getByText('Showing all records')).toBeInTheDocument();
    });
  });

  describe('Filter Interactions', () => {
    it('should call onFilterChange when filter checkbox is clicked', async () => {
      const user = userEvent.setup();
      render(<FilterSidebar {...defaultProps} activeTab="western" />);

      const xinjiangCheckbox = screen.getByRole('checkbox', { name: /xinjiang/i }) ||
        screen.getAllByRole('checkbox')[0];
      await user.click(xinjiangCheckbox);

      expect(defaultProps.onFilterChange).toHaveBeenCalled();
    });

    it('should show "only" button on hover (desktop)', async () => {
      const user = userEvent.setup();
      render(<FilterSidebar {...defaultProps} activeTab="western" />);

      // Find the filter item container
      const filterItems = screen.getAllByRole('checkbox');
      const firstFilterItem = filterItems[0].closest('div');

      // Simulate hover
      fireEvent.mouseEnter(firstFilterItem);

      await waitFor(() => {
        expect(screen.getByText('only')).toBeInTheDocument();
      });
    });

    it('should show reset button when filters are active', () => {
      render(
        <FilterSidebar
          {...defaultProps}
          currentFilters={{ provinces: ['Xinjiang'] }}
        />
      );

      expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    it('should call onFilterChange with empty filters when reset is clicked', async () => {
      const user = userEvent.setup();
      render(
        <FilterSidebar
          {...defaultProps}
          currentFilters={{ provinces: ['Xinjiang'] }}
        />
      );

      const resetButton = screen.getByText('Reset');
      await user.click(resetButton);

      expect(defaultProps.onFilterChange).toHaveBeenCalledWith({ provinces: [] });
    });

    it('should sync filter state from currentFilters prop', () => {
      const { rerender } = render(
        <FilterSidebar {...defaultProps} currentFilters={{ provinces: [] }} />
      );

      // Rerender with active filters
      rerender(
        <FilterSidebar
          {...defaultProps}
          currentFilters={{ provinces: ['Xinjiang'] }}
        />
      );

      // The component should reflect the new filter state
      expect(screen.getByText('Filters active')).toBeInTheDocument();
    });
  });

  describe('Timeline Section', () => {
    const timelineProps = {
      minYear: 2000,
      maxYear: 2025,
      value: 2020,
      onChange: jest.fn(),
    };

    it('should render timeline when showTimeline is true', () => {
      render(
        <FilterSidebar
          {...defaultProps}
          showTimeline={true}
          timeline={timelineProps}
        />
      );

      expect(screen.getByText('ESTABLISHED')).toBeInTheDocument();
    });

    it('should display year range', () => {
      render(
        <FilterSidebar
          {...defaultProps}
          showTimeline={true}
          timeline={timelineProps}
        />
      );

      expect(screen.getByText('2000')).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();
    });

    it('should display current year value', () => {
      render(
        <FilterSidebar
          {...defaultProps}
          showTimeline={true}
          timeline={timelineProps}
        />
      );

      expect(screen.getByText(/Through 2020/)).toBeInTheDocument();
    });

    it('should render range slider', () => {
      render(
        <FilterSidebar
          {...defaultProps}
          showTimeline={true}
          timeline={timelineProps}
        />
      );

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '2000');
      expect(slider).toHaveAttribute('max', '2025');
    });

    it('should not render timeline when showTimeline is false', () => {
      render(<FilterSidebar {...defaultProps} showTimeline={false} />);

      expect(screen.queryByText('ESTABLISHED')).not.toBeInTheDocument();
    });
  });

  describe('Search Section', () => {
    it('should render search input in western view', () => {
      render(<FilterSidebar {...defaultProps} activeTab="western" />);

      expect(screen.getByPlaceholderText(/search by farm name/i)).toBeInTheDocument();
    });

    it('should sync search term from currentSearchTerm prop', () => {
      render(
        <FilterSidebar
          {...defaultProps}
          activeTab="western"
          currentSearchTerm="test farm"
        />
      );

      const searchInput = screen.getByPlaceholderText(/search by farm name/i);
      expect(searchInput).toHaveValue('test farm');
    });

    it('should call onSearchChange when typing (debounced)', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ delay: null });

      render(<FilterSidebar {...defaultProps} activeTab="western" />);

      const searchInput = screen.getByPlaceholderText(/search by farm name/i);
      await user.type(searchInput, 'test');

      // Fast-forward through debounce
      jest.advanceTimersByTime(350);

      expect(defaultProps.onSearchChange).toHaveBeenCalledWith('test');

      jest.useRealTimers();
    });

    it('should show clear button when search has value', async () => {
      const user = userEvent.setup();
      render(
        <FilterSidebar
          {...defaultProps}
          activeTab="western"
          currentSearchTerm="test"
        />
      );

      const clearButton = screen.getByLabelText(/clear search/i);
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('View Mode Section', () => {
    it('should render view mode toggle in western view', () => {
      render(<FilterSidebar {...defaultProps} activeTab="western" />);

      expect(screen.getByText('VIEW MODE')).toBeInTheDocument();
      expect(screen.getByText('Points')).toBeInTheDocument();
      expect(screen.getByText('Density')).toBeInTheDocument();
    });

    it('should highlight active view mode', () => {
      render(<FilterSidebar {...defaultProps} viewMode="points" />);

      const pointsButton = screen.getByText('Points');
      expect(pointsButton).toHaveStyle({ color: '#f9fafb' });
    });

    it('should call onViewModeChange when clicking view mode button', async () => {
      const user = userEvent.setup();
      render(<FilterSidebar {...defaultProps} viewMode="points" />);

      const densityButton = screen.getByText('Density');
      await user.click(densityButton);

      expect(defaultProps.onViewModeChange).toHaveBeenCalledWith('density');
    });

    it('should not render view mode when timeline is active', () => {
      render(
        <FilterSidebar
          {...defaultProps}
          isTimelineActive={true}
        />
      );

      expect(screen.queryByText('VIEW MODE')).not.toBeInTheDocument();
    });

    it('should not render view mode when filters are active', () => {
      render(
        <FilterSidebar
          {...defaultProps}
          hasActiveFilters={true}
        />
      );

      expect(screen.queryByText('VIEW MODE')).not.toBeInTheDocument();
    });

    it('should show density legend when density mode is active', () => {
      render(<FilterSidebar {...defaultProps} viewMode="density" />);

      expect(screen.getByText('Farm Density')).toBeInTheDocument();
      expect(screen.getByText('Fewer')).toBeInTheDocument();
      expect(screen.getByText('More')).toBeInTheDocument();
    });
  });

  describe('Explore Data Section', () => {
    it('should render explore data button in western view', () => {
      render(<FilterSidebar {...defaultProps} activeTab="western" />);

      expect(screen.getByText('EXPLORE THE DATA')).toBeInTheDocument();
      expect(screen.getByText(/View & Download All China Data/)).toBeInTheDocument();
    });

    it('should call onTabChange when explore button is clicked', async () => {
      const user = userEvent.setup();
      render(<FilterSidebar {...defaultProps} activeTab="western" />);

      const exploreButton = screen.getByText(/View & Download All China Data/);
      await user.click(exploreButton);

      expect(defaultProps.onTabChange).toHaveBeenCalledWith('table');
    });
  });

  describe('Methodology Link', () => {
    it('should render methodology link', () => {
      render(<FilterSidebar {...defaultProps} />);

      const methodologyLink = screen.getByText(/How did we build this map/);
      expect(methodologyLink).toBeInTheDocument();
      expect(methodologyLink.closest('a')).toHaveAttribute('target', '_blank');
    });
  });

  describe('Mobile Layout', () => {
    beforeEach(() => {
      useIsMobile.mockReturnValue(true);
    });

    it('should render mobile drawer when on mobile', () => {
      render(<FilterSidebar {...defaultProps} />);

      // Mobile layout should have overlay
      expect(document.querySelector('.drawer-overlay')).toBeInTheDocument();
    });

    it('should render close button with X in mobile', () => {
      render(<FilterSidebar {...defaultProps} />);

      expect(screen.getByLabelText(/close filters/i)).toBeInTheDocument();
    });

    it('should render apply filters button on mobile', () => {
      render(<FilterSidebar {...defaultProps} />);

      expect(screen.getByText('Apply Filters')).toBeInTheDocument();
    });

    it('should call onToggleCollapse when Apply Filters is clicked', async () => {
      const user = userEvent.setup();
      render(<FilterSidebar {...defaultProps} />);

      const applyButton = screen.getByText('Apply Filters');
      await user.click(applyButton);

      expect(defaultProps.onToggleCollapse).toHaveBeenCalled();
    });

    it('should render Reset All button when filters are active on mobile', () => {
      render(
        <FilterSidebar
          {...defaultProps}
          currentFilters={{ provinces: ['Xinjiang'] }}
        />
      );

      expect(screen.getByText('Reset All')).toBeInTheDocument();
    });

    it('should close drawer when overlay is clicked', async () => {
      const user = userEvent.setup();
      render(<FilterSidebar {...defaultProps} />);

      const overlay = document.querySelector('.drawer-overlay');
      await user.click(overlay);

      expect(defaultProps.onToggleCollapse).toHaveBeenCalled();
    });

    it('should show "only" button always on mobile (not just on hover)', () => {
      render(<FilterSidebar {...defaultProps} activeTab="western" />);

      // On mobile, "only" buttons should be visible without hover
      expect(screen.getAllByText('only').length).toBeGreaterThan(0);
    });

    it('should not render locator globe on mobile', () => {
      render(
        <FilterSidebar
          {...defaultProps}
          mapViewState={{ longitude: 91, latitude: 39, zoom: 4 }}
        />
      );

      expect(screen.queryByTestId('locator-globe')).not.toBeInTheDocument();
    });
  });

  describe('Locator Globe', () => {
    beforeEach(() => {
      useIsMobile.mockReturnValue(false);
    });

    it('should render locator globe when mapViewState is provided', () => {
      render(
        <FilterSidebar
          {...defaultProps}
          mapViewState={{ longitude: 91, latitude: 39, zoom: 4 }}
        />
      );

      expect(screen.getByTestId('locator-globe')).toBeInTheDocument();
      expect(screen.getByText('VIEW EXTENT')).toBeInTheDocument();
    });

    it('should not render locator globe when mapViewState is null', () => {
      render(<FilterSidebar {...defaultProps} mapViewState={null} />);

      expect(screen.queryByTestId('locator-globe')).not.toBeInTheDocument();
    });
  });

  describe('Section Collapsing', () => {
    it('should collapse filter section when arrow is clicked', async () => {
      const user = userEvent.setup();
      render(<FilterSidebar {...defaultProps} activeTab="western" />);

      // Find collapse button (arrow)
      const collapseButtons = screen.getAllByRole('button', { name: /collapse|expand/i });
      const locationCollapseBtn = collapseButtons[0];

      // Section should be visible initially
      expect(screen.getByText('Xinjiang')).toBeInTheDocument();

      await user.click(locationCollapseBtn);

      // Section content should be hidden
      await waitFor(() => {
        expect(screen.queryByText('Xinjiang')).not.toBeInTheDocument();
      });
    });

    it('should expand collapsed section when arrow is clicked again', async () => {
      const user = userEvent.setup();
      render(<FilterSidebar {...defaultProps} activeTab="western" />);

      const collapseButtons = screen.getAllByRole('button', { name: /collapse|expand/i });
      const locationCollapseBtn = collapseButtons[0];

      // Collapse
      await user.click(locationCollapseBtn);

      // Expand
      await user.click(locationCollapseBtn);

      await waitFor(() => {
        expect(screen.getByText('Xinjiang')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for interactive elements', () => {
      render(<FilterSidebar {...defaultProps} activeTab="western" />);

      expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });

    it('should support keyboard navigation for checkboxes', async () => {
      const user = userEvent.setup();
      render(<FilterSidebar {...defaultProps} activeTab="western" />);

      const firstCheckbox = screen.getAllByRole('checkbox')[0];
      firstCheckbox.focus();

      await user.keyboard('{Space}');

      expect(defaultProps.onFilterChange).toHaveBeenCalled();
    });
  });

  describe('Fishmeal Plants Toggle', () => {
    beforeEach(() => {
      useIsMobile.mockReturnValue(false);
    });

    it('should render the section header and explainer copy', () => {
      render(<FilterSidebar {...defaultProps} />);

      expect(screen.getByText('Fishmeal Plants')).toBeInTheDocument();
      expect(screen.getByText(/feed that contains fishmeal/i)).toBeInTheDocument();
      expect(screen.getByText(/more than 300 plants across the country/i)).toBeInTheDocument();
    });

    it('should render unchecked by default and call onFishmealToggle(true) when clicked', async () => {
      const user = userEvent.setup();
      const onFishmealToggle = jest.fn();
      render(<FilterSidebar {...defaultProps} onFishmealToggle={onFishmealToggle} />);

      const checkbox = screen.getByRole('checkbox', { name: /show fishmeal plants/i });
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);

      expect(onFishmealToggle).toHaveBeenCalledWith(true);
    });

    it('should call onFishmealToggle(false) when toggled off', async () => {
      const user = userEvent.setup();
      const onFishmealToggle = jest.fn();
      render(
        <FilterSidebar
          {...defaultProps}
          showFishmealPlants={true}
          onFishmealToggle={onFishmealToggle}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /show fishmeal plants/i });
      expect(checkbox).toBeChecked();

      await user.click(checkbox);

      expect(onFishmealToggle).toHaveBeenCalledWith(false);
    });

    it('should show the plant count when data is loaded', () => {
      render(<FilterSidebar {...defaultProps} fishmealCount={324} />);

      expect(screen.getByText('324')).toBeInTheDocument();
    });

    it('should render the toggle in the mobile drawer layout', () => {
      useIsMobile.mockReturnValue(true);
      render(<FilterSidebar {...defaultProps} />);

      expect(screen.getByText('Fishmeal Plants')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /show fishmeal plants/i })).toBeInTheDocument();
    });
  });
});
