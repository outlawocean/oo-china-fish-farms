'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import LocatorGlobe from './LocatorGlobe';
import useIsMobile from '../hooks/useIsMobile';

// Extracted outside render to avoid re-creation on every parent render
const FilterItem = memo(function FilterItem({ category, value, count, label, isChecked, isMobile, onToggle, onOnly }) {
  const [isHovered, setIsHovered] = useState(false);
  const isOnlySelected = false; // Determined by parent via isChecked context
  const shouldShowOnly = (isHovered || isMobile);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '0.75em 1em' : '0.5em 0.75em',
        cursor: 'pointer',
        backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        borderRadius: '0.375rem',
        transition: 'background-color 0.2s',
        gap: '0.75em',
        minHeight: isMobile ? '48px' : 'auto'
      }}
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
      onClick={() => onToggle(category, value)}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={() => {}}
        style={{
          width: isMobile ? '20px' : '16px',
          height: isMobile ? '20px' : '16px',
          cursor: 'pointer',
          flexShrink: 0,
          alignSelf: 'center'
        }}
      />
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5em',
        fontSize: isMobile ? '1em' : '0.875em',
        color: 'var(--color-white)',
        fontWeight: '500',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: shouldShowOnly ? 'normal' : 'nowrap'
      }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label || value}
        </span>
      </span>
      {shouldShowOnly && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOnly(category, value);
          }}
          style={{
            padding: '0.25em 0.625em',
            fontSize: isMobile ? '0.75em' : '0.6875em',
            color: 'var(--color-hr)',
            backgroundColor: 'transparent',
            border: '1px solid var(--color-hr)',
            borderRadius: '0.25em',
            cursor: 'pointer',
            fontWeight: '700',
            transition: 'background-color 0.2s ease, color 0.2s ease',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            minHeight: isMobile ? '32px' : 'auto'
          }}
        >
          only
        </button>
      )}
      <span style={{
        fontSize: isMobile ? '0.9375em' : '0.875em',
        color: 'hsla(0, 0%, 100%, 0.5)',
        fontWeight: '500',
        flexShrink: 0,
        minWidth: '40px',
        textAlign: 'right'
      }}>
        {count}
      </span>
    </div>
  );
});

export default function FilterSidebar({ data, onFilterChange, isCollapsed, onToggleCollapse, timeline, showTimeline, activeTab, onTabChange, viewMode, onViewModeChange, mapViewState, hasActiveFilters: hasActiveFiltersProp, isTimelineActive, onSearchChange, currentFilters, currentSearchTerm, showFishmealPlants = false, onFishmealToggle, fishmealCount = null }) {
  const [filters, setFilters] = useState({
    provinces: []
  });

  // Sync internal state with parent's filter state when component mounts or reopens
  useEffect(() => {
    if (currentFilters) {
      setFilters(currentFilters);
    }
  }, [currentFilters]);

  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef(null);
  const isMobile = useIsMobile();

  // Search state with debounce
  const [searchTerm, setSearchTerm] = useState(currentSearchTerm || '');
  const searchDebounceRef = useRef(null);

  // Sync search term with parent state when component mounts or reopens
  useEffect(() => {
    if (currentSearchTerm !== undefined) {
      setSearchTerm(currentSearchTerm);
    }
  }, [currentSearchTerm]);

  // Timeline playback animation
  useEffect(() => {
    if (isPlaying && timeline) {
      intervalRef.current = setInterval(() => {
        if (timeline.value >= timeline.maxYear) {
          setIsPlaying(false);
          return;
        }
        timeline.onChange(timeline.value + 1);
      }, 500);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, timeline]);

  const [collapsedSections, setCollapsedSections] = useState({});
  const [activeInfoTooltip, setActiveInfoTooltip] = useState(null);

  // Debounced search handler - fires after 300ms of no typing
  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      if (onSearchChange) {
        onSearchChange(value);
      }
    }, 300);
  }, [onSearchChange]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobile && !isCollapsed) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, isCollapsed]);

  const toggleSectionCollapse = (category) => {
    setCollapsedSections(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Memoize province counts - only recompute when data changes (not on filter/render)
  // Uses excludeFilter='provinces' so counts always reflect full dataset
  const provinces = useMemo(() => {
    if (!data?.features) return [];

    const counts = {};
    for (const feature of data.features) {
      const province = feature.properties.province;
      if (province) {
        counts[province] = (counts[province] || 0) + 1;
      }
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }));
  }, [data]);

  // Western view groups provinces into simplified location options
  const isWesternView = activeTab === 'western';
  const locationOptions = isWesternView ? [
    {
      value: 'Xinjiang',
      count: provinces.find(p => p.value === 'Xinjiang Uyghur Autonomous Region')?.count || 0
    },
    {
      value: 'Tibetan Plateau',
      count: (provinces.find(p => p.value === 'Tibet Autonomous Region')?.count || 0) +
             (provinces.find(p => p.value === 'Qinghai Province')?.count || 0)
    }
  ] : provinces;

  const handleToggle = (category, value) => {
    const newFilters = { ...filters };

    if (newFilters[category].includes(value)) {
      newFilters[category] = newFilters[category].filter(v => v !== value);
    } else {
      newFilters[category] = [...newFilters[category], value];
    }

    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleOnly = (category, value) => {
    const newFilters = { ...filters };
    newFilters[category] = [value];

    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleAll = (category) => {
    const newFilters = { ...filters };
    newFilters[category] = [];

    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleResetAll = () => {
    const newFilters = {
      provinces: []
    };

    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const FilterSection = ({ title, category, items, formatLabel, infoContent }) => {
    const hasActiveFilters = filters[category].length > 0;
    const isCollapsedSection = collapsedSections[category];

    return (
      <div style={{ marginBottom: '1.5em' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75em',
          paddingBottom: '0.5em',
          borderBottom: '1px solid hsla(0, 0%, 100%, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
            <button
              onClick={() => toggleSectionCollapse(category)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-white)',
                cursor: 'pointer',
                padding: isMobile ? '0.5em' : 0,
                fontSize: '0.75em',
                transition: 'transform 0.2s ease',
                transform: isCollapsedSection ? 'rotate(-90deg)' : 'rotate(0deg)',
                display: 'flex',
                alignItems: 'center',
                minWidth: isMobile ? '44px' : 'auto',
                minHeight: isMobile ? '44px' : 'auto',
                justifyContent: 'center'
              }}
              aria-label={isCollapsedSection ? 'Expand section' : 'Collapse section'}
            >
              ▼
            </button>
            <h3 style={{
              fontSize: isMobile ? '1em' : '0.875em',
              fontWeight: '700',
              color: 'var(--color-white)',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {title}
            </h3>
            {infoContent && !isMobile && (
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <button
                  onClick={() => setActiveInfoTooltip(activeInfoTooltip === category ? null : category)}
                  onMouseEnter={() => setActiveInfoTooltip(category)}
                  onMouseLeave={() => setActiveInfoTooltip(null)}
                  style={{
                    background: 'transparent',
                    border: '1px solid hsla(0, 0%, 100%, 0.4)',
                    borderRadius: '50%',
                    color: 'hsla(0, 0%, 100%, 0.6)',
                    cursor: 'pointer',
                    padding: 0,
                    width: '16px',
                    height: '16px',
                    fontSize: '10px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  aria-label="More information"
                >
                  i
                </button>
                {activeInfoTooltip === category && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '8px',
                    backgroundColor: '#1a1f2e',
                    border: '1px solid hsla(0, 0%, 100%, 0.2)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '0.75em',
                    color: 'hsla(0, 0%, 100%, 0.85)',
                    width: '220px',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    lineHeight: '1.4'
                  }}>
                    {infoContent}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => handleAll(category)}
            style={{
              padding: isMobile ? '0.5em 1em' : '0.25em 0.75em',
              fontSize: '0.75em',
              color: hasActiveFilters ? 'var(--color-hr)' : 'hsla(0, 0%, 100%, 0.3)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: hasActiveFilters ? 'pointer' : 'default',
              fontWeight: '700',
              transition: 'color 0.2s ease, opacity 0.2s ease',
              minHeight: isMobile ? '44px' : 'auto'
            }}
            disabled={!hasActiveFilters}
          >
            All
          </button>
        </div>
        {!isCollapsedSection && (
          <div>
            {items.map(({ value, count }) => (
              <FilterItem
                key={value}
                category={category}
                value={value}
                count={count}
                label={formatLabel ? formatLabel(value) : value}
                isChecked={filters[category].includes(value)}
                isMobile={isMobile}
                onToggle={handleToggle}
                onOnly={handleOnly}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const totalCount = data.features.length;
  const hasAnyFilters = filters.provinces.length > 0;

  // Fishmeal plants overlay toggle — shared between mobile and desktop layouts
  const fishmealSection = (
    <div style={{ marginBottom: '1.5em' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75em',
        paddingBottom: '0.5em',
        borderBottom: '1px solid hsla(0, 0%, 100%, 0.2)'
      }}>
        <h3 style={{
          fontSize: isMobile ? '1em' : '0.875em',
          fontWeight: '700',
          color: 'var(--color-white)',
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Fishmeal Plants
        </h3>
      </div>
      <div
        onClick={() => onFishmealToggle && onFishmealToggle(!showFishmealPlants)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75em',
          padding: isMobile ? '0.75em 1em' : '0.5em 0.75em',
          cursor: 'pointer',
          borderRadius: '0.375rem',
          minHeight: isMobile ? '48px' : 'auto'
        }}
      >
        <input
          type="checkbox"
          checked={showFishmealPlants}
          onChange={() => {}}
          aria-label="Show fishmeal plants"
          style={{
            width: isMobile ? '20px' : '16px',
            height: isMobile ? '20px' : '16px',
            cursor: 'pointer',
            flexShrink: 0
          }}
        />
        <span style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: '#e8b30c',
          border: '1px solid white',
          flexShrink: 0
        }} />
        <span style={{
          fontSize: isMobile ? '1em' : '0.875em',
          color: 'var(--color-white)',
          fontWeight: '500',
          flex: 1
        }}>
          Show fishmeal plants
        </span>
        {fishmealCount != null && (
          <span style={{
            fontSize: isMobile ? '0.9375em' : '0.875em',
            color: 'hsla(0, 0%, 100%, 0.5)',
            fontWeight: '500',
            flexShrink: 0,
            minWidth: '40px',
            textAlign: 'right'
          }}>
            {fishmealCount}
          </span>
        )}
      </div>
      <p style={{
        fontSize: isMobile ? '0.875em' : '0.8125em',
        color: 'rgba(255, 255, 255, 0.55)',
        margin: '0.5em 0 0 0',
        lineHeight: '1.5'
      }}>
        Most farmed fish are raised on feed that contains fishmeal, a protein made from ground-up fish. This layer shows more than 300 plants across the country, many of which supply the farms with fishmeal.
      </p>
    </div>
  );

  if (isCollapsed) {
    return null;
  }

  // Mobile drawer layout
  if (isMobile) {
    return (
      <>
        {/* Overlay */}
        <div
          className="drawer-overlay"
          onClick={onToggleCollapse}
          style={{
            animation: 'fadeInOverlay 0.2s ease forwards'
          }}
        />

        {/* Drawer */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100dvh',
          backgroundColor: 'var(--color-black)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInFromLeft 0.3s ease forwards',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          touchAction: 'pan-y'
        }}>
          {/* Mobile header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem',
            borderBottom: '1px solid hsla(0, 0%, 100%, 0.2)',
            flexShrink: 0
          }}>
            <h2 style={{
              fontSize: '1.125em',
              fontWeight: '700',
              color: 'var(--color-white)',
              margin: 0
            }}>
              Filters
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {(hasAnyFilters || searchTerm) && (
                <button
                  onClick={() => {
                    handleResetAll();
                    setSearchTerm('');
                    if (onSearchChange) onSearchChange('');
                  }}
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.8125em',
                    color: 'var(--color-hr)',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-hr)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Reset All
                </button>
              )}
              <button
                onClick={onToggleCollapse}
                style={{
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-white)',
                  cursor: 'pointer',
                  fontSize: '1.5em'
                }}
                aria-label="Close filters"
              >
                ×
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div
            className="mobile-scroll"
            style={{
              flex: '1 1 0%',
              minHeight: 0,
              overflowY: 'scroll',
              overflowX: 'hidden',
              padding: '1rem',
              paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {isWesternView && (
              <div style={{
                marginBottom: '1.5em',
                paddingBottom: '1.5em',
                borderBottom: '1px solid hsla(0, 0%, 100%, 0.2)'
              }}>
                <p style={{
                  fontSize: '0.9375em',
                  color: 'rgba(255, 255, 255, 0.85)',
                  margin: 0,
                  lineHeight: '1.65',
                  fontWeight: '400'
                }}>
                  In recent years, China has pushed fish farming in the country's desert and mountainous far west, particularly in Xinjiang and across the Tibetan plateau. This map shows more than 1,200 of these farms and it also offers access to a national database of more than 63,000 farms.
                </p>
              </div>
            )}

            <div style={{ marginBottom: '1.5em' }}>
              <h2 style={{
                fontSize: '1.125em',
                fontWeight: '700',
                color: 'var(--color-white)',
                margin: '0 0 0.5em 0',
                lineHeight: '1'
              }}>
                Filter {totalCount.toLocaleString()} Records
              </h2>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75em'
              }}>
                <p style={{
                  fontSize: '0.875em',
                  color: 'hsla(0, 0%, 100%, 0.5)',
                  margin: 0,
                  fontWeight: '500'
                }}>
                  {hasAnyFilters || searchTerm ? 'Filters active' : 'Showing all records'}
                </p>
                {(hasAnyFilters || searchTerm) && (
                  <button
                    onClick={() => {
                      handleResetAll();
                      setSearchTerm('');
                      if (onSearchChange) onSearchChange('');
                    }}
                    style={{
                      padding: '0.5em 1em',
                      fontSize: '0.875em',
                      color: 'var(--color-hr)',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--color-hr)',
                      borderRadius: '0.25em',
                      cursor: 'pointer',
                      fontWeight: '700',
                      minHeight: '44px'
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {showTimeline && timeline && (
              <div style={{ marginBottom: '1.5em' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75em',
                  paddingBottom: '0.5em',
                  borderBottom: '1px solid hsla(0, 0%, 100%, 0.2)'
                }}>
                  <h3 style={{
                    fontSize: '1em',
                    fontWeight: '700',
                    color: 'var(--color-white)',
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Established
                  </h3>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: 'hsla(0, 0%, 100%, 0.7)',
                  fontSize: '0.875em',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: '0.75em'
                }}>
                  <span>{timeline.minYear}</span>
                  <span style={{ color: 'var(--color-white)', fontWeight: '600' }}>Through {timeline.value ?? timeline.maxYear}</span>
                  <span>{timeline.maxYear}</span>
                </div>
                <input
                  type="range"
                  min={timeline.minYear}
                  max={timeline.maxYear}
                  step={1}
                  value={timeline.value ?? timeline.maxYear}
                  onChange={(event) => {
                    setIsPlaying(false);
                    timeline.onChange(Number.parseInt(event.target.value, 10));
                  }}
                  style={{
                    width: '100%',
                    accentColor: '#60a5fa',
                    height: '44px'
                  }}
                />
              </div>
            )}

            <FilterSection
              title={isWesternView ? "Location" : "Province"}
              category="provinces"
              items={locationOptions}
            />

            {/* Search input */}
            {isWesternView && (
              <div style={{ marginBottom: '1.5em' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75em',
                  paddingBottom: '0.5em',
                  borderBottom: '1px solid hsla(0, 0%, 100%, 0.2)'
                }}>
                  <h3 style={{
                    fontSize: '1em',
                    fontWeight: '700',
                    color: 'var(--color-white)',
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Search
                  </h3>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search by farm name..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.875em 1em',
                      paddingRight: searchTerm ? '2.5em' : '1em',
                      backgroundColor: 'var(--color-dark-offset, rgba(255, 255, 255, 0.05))',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '0.375rem',
                      color: 'var(--color-white)',
                      fontSize: '1em',
                      fontFamily: 'inherit',
                      outline: 'none',
                      boxSizing: 'border-box',
                      minHeight: '48px'
                    }}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        if (onSearchChange) onSearchChange('');
                      }}
                      style={{
                        position: 'absolute',
                        right: '0.5em',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.5)',
                        cursor: 'pointer',
                        padding: '0.5em',
                        fontSize: '1.25em',
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '44px',
                        height: '44px'
                      }}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )}

            {isWesternView && (
              <div style={{ marginBottom: '1.5em' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75em',
                  paddingBottom: '0.5em',
                  borderBottom: '1px solid hsla(0, 0%, 100%, 0.2)'
                }}>
                  <h3 style={{
                    fontSize: '1em',
                    fontWeight: '700',
                    color: 'var(--color-white)',
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Explore the Data
                  </h3>
                </div>
                <p style={{
                  fontSize: '0.875em',
                  color: 'rgba(255, 255, 255, 0.55)',
                  margin: '0 0 0.75em 0',
                  lineHeight: '1.5'
                }}>
                  Search, sort, and download CSV data for all 63,000+ farms across China.
                </p>
                <button
                  onClick={() => {
                    onToggleCollapse();
                    onTabChange('table');
                  }}
                  style={{
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5em',
                    padding: '1em',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: '0.375rem',
                    color: 'var(--color-white)',
                    fontSize: '0.9375em',
                    fontWeight: '500',
                    cursor: 'pointer',
                    minHeight: '48px'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="3" y1="15" x2="21" y2="15" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                  View & Download All China Data
                </button>
              </div>
            )}

            {/* View mode toggle (Points / Density) — only in western view when conditions allow */}
            {isWesternView && !isTimelineActive && !hasActiveFiltersProp && (
              <div style={{ marginBottom: '1.5em' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75em',
                  paddingBottom: '0.5em',
                  borderBottom: '1px solid hsla(0, 0%, 100%, 0.2)'
                }}>
                  <h3 style={{
                    fontSize: '1em',
                    fontWeight: '700',
                    color: 'var(--color-white)',
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    View Mode
                  </h3>
                </div>
                <div style={{
                  display: 'flex',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  overflow: 'hidden'
                }}>
                  <button
                    onClick={() => onViewModeChange('points')}
                    style={{
                      flex: 1,
                      padding: '14px',
                      fontSize: '14px',
                      fontWeight: '500',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: viewMode === 'points' ? 'rgba(214, 19, 19, 0.3)' : 'transparent',
                      color: viewMode === 'points' ? '#f9fafb' : 'rgba(229, 231, 235, 0.7)',
                      borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                      minHeight: '48px'
                    }}
                  >
                    Points
                  </button>
                  <button
                    onClick={() => onViewModeChange('density')}
                    style={{
                      flex: 1,
                      padding: '14px',
                      fontSize: '14px',
                      fontWeight: '500',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: viewMode === 'density' ? 'rgba(214, 19, 19, 0.3)' : 'transparent',
                      color: viewMode === 'density' ? '#f9fafb' : 'rgba(229, 231, 235, 0.7)',
                      minHeight: '48px'
                    }}
                  >
                    Density
                  </button>
                </div>
                {viewMode === 'density' && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)'
                  }}>
                    <div style={{
                      fontSize: '11px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'rgba(255, 255, 255, 0.55)',
                      marginBottom: '10px',
                      textAlign: 'center'
                    }}>
                      Farm Density
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>Fewer</span>
                      <div style={{
                        display: 'flex',
                        height: '14px',
                        flex: 1,
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                        {['rgba(252, 187, 161, 0.85)', 'rgba(252, 146, 114, 0.88)', 'rgba(239, 59, 44, 0.9)', 'rgba(203, 24, 29, 0.92)', 'rgba(153, 0, 13, 0.95)'].map((color, i) => (
                          <div key={i} style={{ flex: 1, backgroundColor: color }} />
                        ))}
                      </div>
                      <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>More</span>
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'rgba(255, 255, 255, 0.5)',
                      marginTop: '10px',
                      textAlign: 'center'
                    }}>
                      Tap hexagon to zoom
                    </div>
                  </div>
                )}
              </div>
            )}

            {fishmealSection}

            {/* Bottom actions */}
            <div style={{
              marginTop: 'auto',
              paddingTop: '1.5em',
              borderTop: '1px solid hsla(0, 0%, 100%, 0.2)'
            }}>
              {/* Methodology link */}
              <a
                href="https://docs.google.com/document/d/1dJ3RlCSJ1xE0lpI8UmNRtkzb89H3MkgZNEcv75dTYSE/edit?tab=t.0#heading=h.o8mnhftwhx6z"
                target="_blank"
                rel="noopener noreferrer"
                title="View Map Methodology"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5em',
                  padding: '1em',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'transparent',
                  color: 'hsla(0, 0%, 100%, 0.7)',
                  cursor: 'pointer',
                  borderRadius: '0.375rem',
                  textDecoration: 'none',
                  fontSize: '0.9375em',
                  fontWeight: '500',
                  minHeight: '48px'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5em' }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  How did we build this map?
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: 0.5 }}
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>

          {/* Apply filters button (sticky at bottom) */}
          <div style={{
            padding: '1rem',
            borderTop: '1px solid hsla(0, 0%, 100%, 0.2)',
            paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
            flexShrink: 0
          }}>
            <button
              onClick={onToggleCollapse}
              style={{
                width: '100%',
                padding: '1em',
                backgroundColor: 'var(--color-hr)',
                border: 'none',
                borderRadius: '0.5rem',
                color: 'var(--color-white)',
                fontSize: '1em',
                fontWeight: '600',
                cursor: 'pointer',
                minHeight: '52px'
              }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </>
    );
  }

  // Desktop sidebar layout (original)
  return (
    <div style={{
      width: '320px',
      height: '100%',
      backgroundColor: 'var(--color-black)',
      borderRight: '1.5px solid hsla(0, 0%, 100%, 0.2)',
      overflowY: 'auto',
      padding: '1.5em',
      color: 'var(--color-white)',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <button
        onClick={onToggleCollapse}
        style={{
          position: 'absolute',
          top: '1em',
          right: '1em',
          background: 'transparent',
          border: 'none',
          color: 'var(--color-white)',
          cursor: 'pointer',
          fontSize: '1.25em',
          padding: '0.25em',
          transition: 'opacity 0.2s ease',
          zIndex: 10
        }}
        onMouseEnter={(e) => {
          e.target.style.opacity = '0.6';
        }}
        onMouseLeave={(e) => {
          e.target.style.opacity = '1';
        }}
      >
        ←
      </button>
      {isWesternView && (
        <div style={{
          marginBottom: '1.5em',
          paddingBottom: '1.5em',
          paddingTop: '2.5em',
          borderBottom: '1px solid hsla(0, 0%, 100%, 0.2)'
        }}>
          <p style={{
            fontSize: '0.9375em',
            color: 'rgba(255, 255, 255, 0.85)',
            margin: 0,
            lineHeight: '1.65',
            fontWeight: '400'
          }}>
            In recent years, China has pushed fish farming in the country's desert and mountainous far west, particularly in Xinjiang and across the Tibetan plateau. This map shows more than 1,200 of these farms and it also offers access to a national database of more than 63,000 farms.
          </p>
        </div>
      )}

      <div style={{ marginBottom: '1.5em' }}>
        <h2 style={{
          fontSize: '1.125em',
          fontWeight: '700',
          color: 'var(--color-white)',
          margin: '0 0 0.5em 0',
          lineHeight: '1'
        }}>
          Filter {totalCount.toLocaleString()} Records
        </h2>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75em'
        }}>
          <p style={{
            fontSize: '0.875em',
            color: 'hsla(0, 0%, 100%, 0.5)',
            margin: 0,
            fontWeight: '500'
          }}>
            {hasAnyFilters || searchTerm ? 'Filters active' : 'Showing all records'}
          </p>
          {(hasAnyFilters || searchTerm) && (
            <button
              onClick={() => {
                handleResetAll();
                setSearchTerm('');
                if (onSearchChange) onSearchChange('');
              }}
              style={{
                padding: '0.25em 0.75em',
                fontSize: '0.75em',
                color: 'var(--color-hr)',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-hr)',
                borderRadius: '0.25em',
                cursor: 'pointer',
                fontWeight: '700',
                transition: 'background-color 0.2s ease, color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'var(--color-hr)';
                e.target.style.color = 'var(--color-black)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = 'var(--color-hr)';
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {showTimeline && timeline && (
        <div style={{ marginBottom: '1.5em' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75em',
            paddingBottom: '0.5em',
            borderBottom: '1px solid hsla(0, 0%, 100%, 0.2)'
          }}>
            <h3 style={{
              fontSize: '0.875em',
              fontWeight: '700',
              color: 'var(--color-white)',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Established
            </h3>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'hsla(0, 0%, 100%, 0.7)',
            fontSize: '0.75em',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: '0.5em'
          }}>
            <span>{timeline.minYear}</span>
            <span style={{ color: 'var(--color-white)', fontWeight: '600' }}>Through {timeline.value ?? timeline.maxYear}</span>
            <span>{timeline.maxYear}</span>
          </div>
          <input
            type="range"
            min={timeline.minYear}
            max={timeline.maxYear}
            step={1}
            value={timeline.value ?? timeline.maxYear}
            onChange={(event) => {
              setIsPlaying(false);
              timeline.onChange(Number.parseInt(event.target.value, 10));
            }}
            style={{
              width: '100%',
              accentColor: '#60a5fa'
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '10px'
          }}>
            <button
              onClick={() => {
                timeline.onChange(timeline.minYear);
                setIsPlaying(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.85)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
              </svg>
              Start Over
            </button>
            {isPlaying ? (
              <button
                onClick={() => setIsPlaying(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 18px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  borderRadius: '6px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  gap: '7px'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                Pause
              </button>
            ) : (
              <button
                onClick={() => {
                  if (timeline.value >= timeline.maxYear) {
                    timeline.onChange(timeline.minYear);
                  }
                  setIsPlaying(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 18px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  borderRadius: '6px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  gap: '7px'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                Play
              </button>
            )}
            <button
              onClick={() => {
                setIsPlaying(false);
                timeline.onChange(timeline.maxYear);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.85)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="19,3 5,12 19,21" />
                <rect x="3" y="4" width="3" height="16" />
              </svg>
              Reset
            </button>
          </div>
        </div>
      )}

      <FilterSection
        title={isWesternView ? "Location" : "Province"}
        category="provinces"
        items={locationOptions}
      />

      {/* Search input */}
      {isWesternView && (
        <div style={{ marginBottom: '1.5em' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75em',
            paddingBottom: '0.5em',
            borderBottom: '1px solid hsla(0, 0%, 100%, 0.2)'
          }}>
            <h3 style={{
              fontSize: '0.875em',
              fontWeight: '700',
              color: 'var(--color-white)',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Search
            </h3>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by farm name..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75em 1em',
                paddingRight: searchTerm ? '2.5em' : '1em',
                backgroundColor: 'var(--color-dark-offset, rgba(255, 255, 255, 0.05))',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '0.375rem',
                color: 'var(--color-white)',
                fontSize: '0.875em',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color 0.2s ease, background-color 0.2s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.35)';
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                e.target.style.backgroundColor = 'var(--color-dark-offset, rgba(255, 255, 255, 0.05))';
              }}
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  if (onSearchChange) onSearchChange('');
                }}
                style={{
                  position: 'absolute',
                  right: '0.5em',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  padding: '0.25em',
                  fontSize: '1em',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.8)'}
                onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.5)'}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {isWesternView && (
        <div style={{ marginBottom: '1.5em' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75em',
            paddingBottom: '0.5em',
            borderBottom: '1px solid hsla(0, 0%, 100%, 0.2)'
          }}>
            <h3 style={{
              fontSize: '0.875em',
              fontWeight: '700',
              color: 'var(--color-white)',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Explore the Data
            </h3>
          </div>
          <p style={{
            fontSize: '0.8125em',
            color: 'rgba(255, 255, 255, 0.55)',
            margin: '0 0 0.75em 0',
            lineHeight: '1.5'
          }}>
            Search, sort, and download CSV data for all 63,000+ farms across China.
          </p>
          <button
            onClick={() => onTabChange('table')}
            style={{
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5em',
              padding: '0.75em 1em',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '0.375rem',
              color: 'var(--color-white)',
              fontSize: '0.8125em',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, border-color 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            View & Download All China Data
          </button>
        </div>
      )}

      {/* View mode toggle (Points / Density) — only in western view when conditions allow */}
      {isWesternView && !isTimelineActive && !hasActiveFiltersProp && (
        <div style={{ marginBottom: '1.5em' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75em',
            paddingBottom: '0.5em',
            borderBottom: '1px solid hsla(0, 0%, 100%, 0.2)'
          }}>
            <h3 style={{
              fontSize: '0.875em',
              fontWeight: '700',
              color: 'var(--color-white)',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              View Mode
            </h3>
          </div>
          <div style={{
            display: 'flex',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => onViewModeChange('points')}
              style={{
                flex: 1,
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: '500',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: viewMode === 'points' ? 'rgba(214, 19, 19, 0.3)' : 'transparent',
                color: viewMode === 'points' ? '#f9fafb' : 'rgba(229, 231, 235, 0.7)',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s ease'
              }}
            >
              Points
            </button>
            <button
              onClick={() => onViewModeChange('density')}
              style={{
                flex: 1,
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: '500',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: viewMode === 'density' ? 'rgba(214, 19, 19, 0.3)' : 'transparent',
                color: viewMode === 'density' ? '#f9fafb' : 'rgba(229, 231, 235, 0.7)',
                transition: 'all 0.2s ease'
              }}
            >
              Density
            </button>
          </div>
          {viewMode === 'density' && (
            <div style={{
              marginTop: '10px',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(255, 255, 255, 0.03)'
            }}>
              <div style={{
                fontSize: '10px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.55)',
                marginBottom: '8px',
                textAlign: 'center'
              }}>
                Farm Density
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>Fewer</span>
                <div style={{
                  display: 'flex',
                  height: '12px',
                  flex: 1,
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  {['rgba(252, 187, 161, 0.85)', 'rgba(252, 146, 114, 0.88)', 'rgba(239, 59, 44, 0.9)', 'rgba(203, 24, 29, 0.92)', 'rgba(153, 0, 13, 0.95)'].map((color, i) => (
                    <div key={i} style={{ flex: 1, backgroundColor: color }} />
                  ))}
                </div>
                <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>More</span>
              </div>
              <div style={{
                fontSize: '10px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginTop: '8px',
                textAlign: 'center'
              }}>
                Click hexagon to zoom
              </div>
            </div>
          )}
        </div>
      )}

      {fishmealSection}

      {/* Locator Globe */}
      {mapViewState && (
        <div style={{ marginBottom: '1.5em' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75em',
            paddingBottom: '0.5em',
            borderBottom: '1px solid hsla(0, 0%, 100%, 0.2)'
          }}>
            <h3 style={{
              fontSize: '0.875em',
              fontWeight: '700',
              color: 'var(--color-white)',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              View Extent
            </h3>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '90px', height: '90px', opacity: 0.85 }}>
              <LocatorGlobe
                currentCenter={{ longitude: mapViewState.longitude, latitude: mapViewState.latitude }}
                currentZoom={mapViewState.zoom}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div style={{
        marginTop: 'auto',
        paddingTop: '1.5em',
        borderTop: '1px solid hsla(0, 0%, 100%, 0.2)'
      }}>
        {/* Methodology link */}
        <a
          href="https://docs.google.com/document/d/1dJ3RlCSJ1xE0lpI8UmNRtkzb89H3MkgZNEcv75dTYSE/edit?tab=t.0#heading=h.o8mnhftwhx6z"
          target="_blank"
          rel="noopener noreferrer"
          title="View Map Methodology"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5em',
            padding: '0.75em 1em',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'transparent',
            color: 'hsla(0, 0%, 100%, 0.7)',
            cursor: 'pointer',
            borderRadius: '0.375rem',
            transition: 'color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease',
            textDecoration: 'none',
            fontSize: '0.8125em',
            fontWeight: '500'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-white)';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'hsla(0, 0%, 100%, 0.7)';
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5em' }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            How did we build this map?
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.5 }}
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  );
}
