'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import MapViewer from './components/MapViewer';
import TableView from './components/TableView';
import FilterSidebar from './components/FilterSidebar';
import ErrorBoundary from './components/ErrorBoundary';
import { dataService } from '../services/dataService';
import useIsMobile from './hooks/useIsMobile';

const parseEstablishedYear = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value !== 'string') return null;
  const match = value.match(/(19|20)\d{2}/);
  return match ? Number.parseInt(match[0], 10) : null;
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('western');
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    provinces: []
  });
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(true); // Start collapsed on mobile
  const [timelineYear, setTimelineYear] = useState(null);
  const [dataCache, setDataCache] = useState({});
  const [viewMode, setViewMode] = useState('points');
  const [mapViewState, setMapViewState] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFishmealPlants, setShowFishmealPlants] = useState(false);
  const [fishmealData, setFishmealData] = useState(null);
  const isMobile = useIsMobile();

  // On mobile, sidebar starts collapsed; on desktop, it starts open
  useEffect(() => {
    setIsFilterCollapsed(isMobile);
  }, [isMobile]);

  // Load data based on active tab from local JSON files.
  // Western China uses a smaller dataset (~695 farms),
  // while other tabs load the full 63k+ records. Cached to avoid re-fetching on tab switch.
  // Use a ref for cache to avoid re-triggering the effect when cache updates.
  const dataCacheRef = useRef(dataCache);
  dataCacheRef.current = dataCache;

  useEffect(() => {
    const cacheKey = activeTab === 'western' ? 'western' : 'all';

    if (dataCacheRef.current[cacheKey]) {
      setMapData(dataCacheRef.current[cacheKey]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchData = activeTab === 'western'
      ? dataService.getWesternFarms()
      : dataService.getAllData();

    fetchData
      .then(data => {
        setDataCache(prev => ({ ...prev, [cacheKey]: data }));
        setMapData(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading data:', error);
        setLoading(false);
      });
  }, [activeTab]);

  // Lazy-load fishmeal plant locations the first time the layer is enabled
  useEffect(() => {
    if (!showFishmealPlants || fishmealData) return;

    dataService.getFishmealPlants()
      .then(setFishmealData)
      .catch(error => {
        console.error('Error loading fishmeal plant data:', error);
      });
  }, [showFishmealPlants, fishmealData]);

  // Apply province filters and search to the dataset
  const filteredData = useMemo(() => {
    if (!mapData) return null;

    const hasProvinceFilters = filters.provinces.length > 0;
    const hasSearch = searchTerm.trim().length > 0;

    if (!hasProvinceFilters && !hasSearch) {
      return mapData;
    }

    // Map simplified filter names to actual province names in the data
    const expandedProvinces = filters.provinces.flatMap(p => {
      if (p === 'Tibetan Plateau') {
        return ['Tibet Autonomous Region', 'Qinghai Province'];
      }
      if (p === 'Xinjiang') {
        return ['Xinjiang Uyghur Autonomous Region'];
      }
      return [p];
    });

    const searchLower = searchTerm.trim().toLowerCase();

    const filtered = mapData.features.filter(feature => {
      const props = feature.properties;

      // Province filter
      if (hasProvinceFilters && !expandedProvinces.includes(props.province)) {
        return false;
      }

      // Search filter (matches against farm name)
      if (hasSearch && !props.name?.toLowerCase().includes(searchLower)) {
        return false;
      }

      return true;
    });

    return {
      ...mapData,
      features: filtered
    };
  }, [mapData, filters, searchTerm]);

  // Fixed timeline range of 2000-2025
  const establishedRange = useMemo(() => {
    if (!filteredData) return { minYear: null, maxYear: null };
    return { minYear: 2000, maxYear: 2025 };
  }, [filteredData]);

  useEffect(() => {
    if (!establishedRange.minYear || !establishedRange.maxYear) {
      setTimelineYear(null);
      return;
    }

    setTimelineYear((prev) => {
      if (!prev || prev < establishedRange.minYear || prev > establishedRange.maxYear) {
        return establishedRange.maxYear;
      }
      return prev;
    });
  }, [establishedRange.minYear, establishedRange.maxYear]);

  const mapDataWithEstablishedYear = useMemo(() => {
    if (!filteredData) return null;
    return {
      ...filteredData,
      features: filteredData.features.map((feature) => {
        const establishedValue = feature?.properties?.established;
        const year = parseEstablishedYear(establishedValue);
        if (year === null) return feature;
        return {
          ...feature,
          properties: {
            ...(feature.properties || {}),
            establishedYear: year
          }
        };
      })
    };
  }, [filteredData]);

  // Stable reference: memoize timelineProps to prevent cascading re-renders in FilterSidebar
  const timelineProps = useMemo(() => {
    if (!establishedRange.minYear || !establishedRange.maxYear) return null;
    return {
      minYear: establishedRange.minYear,
      maxYear: establishedRange.maxYear,
      value: timelineYear,
      onChange: setTimelineYear
    };
  }, [establishedRange.minYear, establishedRange.maxYear, timelineYear]);

  const mapGeojsonData = mapDataWithEstablishedYear || filteredData;

  const hasActiveFilters = filters.provinces.length > 0 || searchTerm.trim().length > 0;

  // Stable callback refs to prevent child re-renders
  const handleToggleCollapse = useCallback(() => {
    setIsFilterCollapsed(prev => !prev);
  }, []);

  const handleCollapseClose = useCallback(() => {
    setIsFilterCollapsed(true);
  }, []);

  const handleBackToMap = useCallback(() => {
    setActiveTab('western');
  }, []);

  return (
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'column', margin: 0, padding: 0, backgroundColor: 'var(--color-black)', overflow: 'hidden' }}>
      {loading && <p style={{ padding: '1.5em', color: 'var(--color-white)', fontWeight: '500' }}>Loading farm data...</p>}

      {!loading && mapData && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
          {/* Desktop sidebar - only show when not collapsed and not on mobile */}
          {activeTab !== 'table' && !isFilterCollapsed && !isMobile && (
            <FilterSidebar
              data={mapData}
              onFilterChange={setFilters}
              isCollapsed={isFilterCollapsed}
              onToggleCollapse={handleToggleCollapse}
              timeline={timelineProps}
              showTimeline={Boolean(timelineProps)}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              mapViewState={mapViewState}
              hasActiveFilters={filters.provinces.length > 0}
              isTimelineActive={Boolean(timelineProps && timelineYear && timelineYear < establishedRange.maxYear)}
              onSearchChange={setSearchTerm}
              currentFilters={filters}
              currentSearchTerm={searchTerm}
              showFishmealPlants={showFishmealPlants}
              onFishmealToggle={setShowFishmealPlants}
              fishmealCount={fishmealData?.features?.length ?? null}
            />
          )}

          {/* Mobile drawer - rendered as overlay */}
          {activeTab !== 'table' && !isFilterCollapsed && isMobile && (
            <FilterSidebar
              data={mapData}
              onFilterChange={setFilters}
              isCollapsed={isFilterCollapsed}
              onToggleCollapse={handleCollapseClose}
              timeline={timelineProps}
              showTimeline={Boolean(timelineProps)}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              mapViewState={mapViewState}
              hasActiveFilters={filters.provinces.length > 0}
              isTimelineActive={Boolean(timelineProps && timelineYear && timelineYear < establishedRange.maxYear)}
              onSearchChange={setSearchTerm}
              currentFilters={filters}
              currentSearchTerm={searchTerm}
              showFishmealPlants={showFishmealPlants}
              onFishmealToggle={setShowFishmealPlants}
              fishmealCount={fishmealData?.features?.length ?? null}
            />
          )}

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {activeTab === 'table' ? (
              <ErrorBoundary name="table">
                <TableView geojsonData={mapData} onBackToMap={handleBackToMap} />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary name="map">
                <MapViewer
                  geojsonData={mapGeojsonData}
                  datasetType="western"
                  isSidebarCollapsed={isFilterCollapsed}
                  timelineYear={timelineYear}
                  timelineMaxYear={establishedRange.maxYear}
                  hasActiveFilters={filters.provinces.length > 0}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  onViewStateChange={setMapViewState}
                  searchTerm={searchTerm}
                  showFishmealPlants={showFishmealPlants}
                  fishmealData={fishmealData}
                />
              </ErrorBoundary>
            )}
          </div>

          {/* Mobile filter toggle button */}
          {activeTab !== 'table' && isMobile && isFilterCollapsed && (
            <button
              onClick={() => setIsFilterCollapsed(false)}
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                backgroundColor: 'rgba(11, 15, 20, 0.95)',
                border: '1.5px solid hsla(0, 0%, 100%, 0.25)',
                borderRadius: '12px',
                color: 'var(--color-white)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                padding: '12px 16px',
                transition: 'background-color 0.2s ease',
                zIndex: 100,
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              aria-label="Open filters"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="7" y1="12" x2="17" y2="12" />
                <line x1="10" y1="18" x2="14" y2="18" />
              </svg>
              Filters
              {hasActiveFilters && (
                <span style={{
                  backgroundColor: 'var(--color-hr)',
                  borderRadius: '50%',
                  width: '8px',
                  height: '8px',
                  marginLeft: '2px'
                }} />
              )}
            </button>
          )}

          {/* Desktop collapse toggle */}
          {activeTab !== 'table' && isFilterCollapsed && !isMobile && (
            <button
              onClick={() => setIsFilterCollapsed(false)}
              style={{
                position: 'absolute',
                top: '1em',
                left: '1em',
                backgroundColor: 'var(--color-black)',
                border: '1.5px solid hsla(0, 0%, 100%, 0.2)',
                borderRadius: '0.375rem',
                color: 'var(--color-white)',
                cursor: 'pointer',
                fontSize: '1.125em',
                padding: '0.75em',
                transition: 'background-color 0.2s ease, opacity 0.2s ease',
                zIndex: 1000,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'var(--color-black)';
              }}
              aria-label="Open filters"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="7" y1="12" x2="17" y2="12" />
                <line x1="10" y1="18" x2="14" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}
    </main>
  );
}
