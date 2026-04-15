'use client';

import { useState, useMemo, useCallback } from 'react';
import useIsMobile from '../hooks/useIsMobile';

const ROWS_PER_PAGE = 100;
const MOBILE_ROWS_PER_PAGE = 20;

// Western China provinces (full names as they appear in the data)
const WESTERN_PROVINCES = [
  'Xinjiang Uyghur Autonomous Region',
  'Tibet Autonomous Region',
  'Qinghai Province'
];

// Priority companies to show first on initial table load
// Order matters: first company is always shown first, rest are alphabetical
const PRIORITY_COMPANIES = [
  'Xinjiang Tianyun Organic Agriculture Company Ltd',  // Always first
  'Longyang Zhixian',  // Always second
  'Xinjiang Zungui Fresh Food Technology Company Ltd',
  'Tekes County Tianyun Fishery Company Ltd',
  'Gongliu County Tianyun Fisheries Company Ltd',
  'Longchang Tianyun Aquaculture Family Farm',
  'Gushi County Tianyun Aquaculture Farm',
  'Rushan Tianyun Aquaculture Farm',
  'Tianyun Aquaculture Center',
  'Bin County Tianyun Aquaculture Company',
  'Zhanjiang Tianyun Aquaculture Company',
  'Huoqiu County Tianyun Aquaculture Family Farm',
  'Yili Yueran Ecological Agriculture Company Ltd'
];

// Companies that should always appear first and second
const TOP_PRIORITY_COMPANY = 'Xinjiang Tianyun Organic Agriculture Company Ltd';
const SECOND_PRIORITY_COMPANY = 'Longyang Zhixian';

const generateCSV = (features) => {
  const headers = [
    'Name',
    'Chinese Name',
    'Province',
    'City',
    'District',
    'Address',
    'Established',
    'Lat (WGS84)',
    'Lon (WGS84)',
    'Taxpayer ID'
  ];

  const rows = features.map(feature => {
    const props = feature.properties;
    const [lon, lat] = feature.geometry.coordinates;

    // Escape values that contain commas, quotes, or newlines
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    return [
      escapeCSV(props.name),
      escapeCSV(props.chineseName),
      escapeCSV(props.province),
      escapeCSV(props.city),
      escapeCSV(props.district),
      escapeCSV(props.address),
      escapeCSV(props.established),
      lat,
      lon,
      escapeCSV(props.taxpayerId)
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};

const downloadCSV = (csvContent, filename) => {
  // UTF-8 BOM for Excel compatibility with Chinese characters
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function TableView({ geojsonData, onBackToMap }) {
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [userHasSorted, setUserHasSorted] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const isMobile = useIsMobile();

  const rowsPerPage = isMobile ? MOBILE_ROWS_PER_PAGE : ROWS_PER_PAGE;

  const handleSort = useCallback((field) => {
    setUserHasSorted(true);
    setSortField(prev => {
      if (prev === field) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDirection('asc');
      return field;
    });
    setCurrentPage(1);
  }, []);

  // On initial load, priority companies appear first; user sorting disables this
  const processedData = useMemo(() => {
    if (!geojsonData) return [];

    let filtered = geojsonData.features;

    // Filter by search term (only searches Company Name)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(feature => {
        return feature.properties.name?.toLowerCase().includes(search);
      });
    }

    // Sort data
    const sorted = [...filtered].sort((a, b) => {
      // On initial load (name, asc, no user interaction), show priority companies first
      const isInitialSort = sortField === 'name' && sortDirection === 'asc' && !userHasSorted;

      if (isInitialSort) {
        const aIsPriority = PRIORITY_COMPANIES.includes(a.properties.name);
        const bIsPriority = PRIORITY_COMPANIES.includes(b.properties.name);

        // If one is priority and the other isn't, priority comes first
        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;

        // Within priority companies, TOP_PRIORITY_COMPANY first, SECOND_PRIORITY_COMPANY second
        if (aIsPriority && bIsPriority) {
          const aIsTop = a.properties.name === TOP_PRIORITY_COMPANY;
          const bIsTop = b.properties.name === TOP_PRIORITY_COMPANY;
          if (aIsTop && !bIsTop) return -1;
          if (!aIsTop && bIsTop) return 1;
          const aIsSecond = a.properties.name === SECOND_PRIORITY_COMPANY;
          const bIsSecond = b.properties.name === SECOND_PRIORITY_COMPANY;
          if (aIsSecond && !bIsSecond) return -1;
          if (!aIsSecond && bIsSecond) return 1;
          // Both are priority but neither is top or second, sort alphabetically
        }
      }

      const aVal = a.properties[sortField] || '';
      const bVal = b.properties[sortField] || '';

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return sorted;
  }, [geojsonData, searchTerm, sortField, sortDirection, userHasSorted]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return processedData.slice(startIndex, endIndex);
  }, [processedData, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(processedData.length / rowsPerPage);

  const handleSearch = useCallback((value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  const handleDownloadWestern = useCallback(() => {
    if (!geojsonData) return;
    const westernFeatures = geojsonData.features.filter(feature =>
      WESTERN_PROVINCES.includes(feature.properties.province)
    );
    const csv = generateCSV(westernFeatures);
    downloadCSV(csv, 'western-china-fish-farms.csv');
  }, [geojsonData]);

  const handleDownloadAll = useCallback(() => {
    if (!geojsonData) return;
    const csv = generateCSV(geojsonData.features);
    downloadCSV(csv, 'all-china-fish-farms.csv');
  }, [geojsonData]);

  const westernCount = useMemo(() => {
    if (!geojsonData) return 0;
    return geojsonData.features.filter(feature =>
      WESTERN_PROVINCES.includes(feature.properties.province)
    ).length;
  }, [geojsonData]);

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
    }
    return <span style={{ marginLeft: '4px' }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const PageButton = ({ page, isCurrent }) => (
    <button
      onClick={() => setCurrentPage(page)}
      style={{
        padding: isMobile ? '0.625em 0.875em' : '0.5em 0.75em',
        backgroundColor: isCurrent ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
        border: 'var(--border-heavy)',
        borderRadius: 'var(--border-radius)',
        color: isCurrent ? 'var(--color-white)' : 'var(--theme-text-against-dark-medium)',
        cursor: isCurrent ? 'default' : 'pointer',
        fontSize: isMobile ? '0.9375em' : '0.875em',
        fontWeight: isCurrent ? '600' : '500',
        transition: 'background-color 0.15s ease',
        minWidth: isMobile ? '44px' : 'auto',
        minHeight: isMobile ? '44px' : 'auto'
      }}
      disabled={isCurrent}
    >
      {page}
    </button>
  );

  // Mobile card component
  const FarmCard = ({ feature, index }) => {
    const isExpanded = expandedCard === index;
    const coords = feature.geometry.coordinates;

    return (
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <div
          onClick={() => setExpandedCard(isExpanded ? null : index)}
          style={{ cursor: 'pointer' }}
        >
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--color-white)',
            margin: '0 0 8px 0',
            lineHeight: '1.3'
          }}>
            {feature.properties.name || '—'}
          </h3>
          <div style={{
            fontSize: '14px',
            color: 'var(--theme-text-against-dark-medium)',
            marginBottom: '8px'
          }}>
            {feature.properties.chineseName || ''}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.5)'
            }}>
              {feature.properties.province || '—'}
            </span>
            <span style={{
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.5)'
            }}>
              Est. {feature.properties.established || '—'}
            </span>
          </div>
        </div>

        {isExpanded && (
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(255, 255, 255, 0.4)',
                marginBottom: '4px'
              }}>
                Location
              </div>
              <div style={{ fontSize: '14px', color: 'var(--theme-text-against-dark-medium)' }}>
                {feature.properties.city && <div>{feature.properties.city}</div>}
                {feature.properties.district && <div>{feature.properties.district}</div>}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(255, 255, 255, 0.4)',
                marginBottom: '4px'
              }}>
                Coordinates
              </div>
              <button
                onClick={() => {
                  window.open(`https://www.google.com/maps?q=${coords[1]},${coords[0]}&t=k`, '_blank');
                }}
                style={{
                  fontSize: '14px',
                  color: '#60a5fa',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {coords[1].toFixed(4)}, {coords[0].toFixed(4)} →
              </button>
            </div>

            {feature.properties.taxpayerId && (
              <div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(255, 255, 255, 0.4)',
                  marginBottom: '4px'
                }}>
                  Taxpayer ID
                </div>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--theme-text-against-dark-medium)',
                  fontFamily: 'monospace'
                }}>
                  {feature.properties.taxpayerId}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Mobile layout
  if (isMobile) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-black)',
        color: 'var(--color-white)'
      }}>
        {/* Mobile header */}
        <div style={{
          padding: '16px',
          borderBottom: 'var(--border-heavy)',
          flexShrink: 0
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            {onBackToMap && (
              <button
                onClick={onBackToMap}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: '10px',
                  color: 'var(--color-white)',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
                aria-label="Back to Map"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
            )}
            <h1 style={{
              fontSize: '18px',
              fontWeight: '600',
              margin: 0,
              flex: 1
            }}>
              All China Data
            </h1>
            <span style={{
              fontSize: '13px',
              color: 'var(--theme-text-against-dark-medium)'
            }}>
              {processedData.length.toLocaleString()}
            </span>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search farms..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px',
              backgroundColor: 'var(--color-dark-offset)',
              border: 'var(--border-heavy)',
              borderRadius: '10px',
              color: 'var(--color-white)',
              fontSize: '16px',
              fontFamily: 'var(--font-sans)',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Download buttons */}
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          flexShrink: 0,
          overflowX: 'auto'
        }}>
          <button
            onClick={handleDownloadWestern}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: 'var(--color-white)',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minHeight: '44px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Western ({westernCount.toLocaleString()})
          </button>
          <button
            onClick={handleDownloadAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: 'var(--color-white)',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minHeight: '44px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            All ({geojsonData?.features.length.toLocaleString() || 0})
          </button>
        </div>

        {/* Card list */}
        <div
          className="mobile-scroll"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px',
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))'
          }}
        >
          {paginatedData.map((feature, index) => (
            <FarmCard key={index} feature={feature} index={index} />
          ))}

          {processedData.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '3em 1em',
              color: 'var(--theme-text-against-dark-medium)'
            }}>
              No facilities found matching your search.
            </div>
          )}
        </div>

        {/* Mobile pagination */}
        {totalPages > 1 && (
          <div style={{
            padding: '16px',
            borderTop: 'var(--border-heavy)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))'
          }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'var(--border-heavy)',
                borderRadius: '10px',
                color: currentPage === 1 ? 'rgba(255, 255, 255, 0.2)' : 'var(--color-white)',
                cursor: currentPage === 1 ? 'default' : 'pointer'
              }}
            >
              ←
            </button>
            <span style={{
              fontSize: '14px',
              color: 'var(--theme-text-against-dark-medium)',
              padding: '0 8px'
            }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'var(--border-heavy)',
                borderRadius: '10px',
                color: currentPage === totalPages ? 'rgba(255, 255, 255, 0.2)' : 'var(--color-white)',
                cursor: currentPage === totalPages ? 'default' : 'pointer'
              }}
            >
              →
            </button>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout (original)
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--color-black)',
      color: 'var(--color-white)'
    }}>
      {/* Search, download buttons, and count */}
      <div style={{
        padding: '1.5em',
        borderBottom: 'var(--border-heavy)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1em',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: '0.75em', alignItems: 'center' }}>
          {onBackToMap && (
            <button
              onClick={onBackToMap}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4em',
                padding: '0.625em 1em',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: 'var(--border-radius)',
                color: 'var(--color-white)',
                fontSize: '0.8125em',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
                whiteSpace: 'nowrap'
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back to Map
            </button>
          )}
          <input
            type="text"
            placeholder="Search farms..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              width: '280px',
              padding: '0.75em 1em',
              backgroundColor: 'var(--color-dark-offset)',
              border: 'var(--border-heavy)',
              borderRadius: 'var(--border-radius)',
              color: 'var(--color-white)',
              fontSize: '0.875em',
              fontFamily: 'var(--font-sans)'
            }}
          />
          <button
            onClick={handleDownloadWestern}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5em',
              padding: '0.625em 1em',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: 'var(--border-radius)',
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Western China CSV ({westernCount.toLocaleString()})
          </button>
          <button
            onClick={handleDownloadAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5em',
              padding: '0.625em 1em',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: 'var(--border-radius)',
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            All China CSV ({geojsonData?.features.length.toLocaleString() || 0})
          </button>
        </div>
        <div style={{
          fontSize: '0.875em',
          color: 'var(--theme-text-against-dark-medium)',
          fontWeight: '500'
        }}>
          {processedData.length.toLocaleString()} {processedData.length === 1 ? 'facility' : 'facilities'}
        </div>
      </div>

      {/* Table */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '0 1.5em 1.5em'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.875em'
        }}>
          <thead>
            <tr style={{
              position: 'sticky',
              top: 0,
              backgroundColor: 'var(--color-black)',
              borderBottom: 'var(--border-heavy)',
              zIndex: 10
            }}>
              <th
                onClick={() => handleSort('name')}
                style={{
                  padding: '1em 0.75em',
                  textAlign: 'left',
                  fontWeight: '600',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                Name <SortIcon field="name" />
              </th>
              <th
                onClick={() => handleSort('chineseName')}
                style={{
                  padding: '1em 0.75em',
                  textAlign: 'left',
                  fontWeight: '600',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                Chinese Name <SortIcon field="chineseName" />
              </th>
              <th
                onClick={() => handleSort('province')}
                style={{
                  padding: '1em 0.75em',
                  textAlign: 'left',
                  fontWeight: '600',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                Province <SortIcon field="province" />
              </th>
              <th
                onClick={() => handleSort('established')}
                style={{
                  padding: '1em 0.75em',
                  textAlign: 'left',
                  fontWeight: '600',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                Established <SortIcon field="established" />
              </th>
              <th style={{
                padding: '1em 0.75em',
                textAlign: 'left',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                width: '200px'
              }}>
                Address
              </th>
              <th style={{
                padding: '1em 0.75em',
                textAlign: 'right',
                fontWeight: '600',
                whiteSpace: 'nowrap'
              }}>
                Lat (WGS84)
              </th>
              <th style={{
                padding: '1em 0.75em',
                textAlign: 'right',
                fontWeight: '600',
                whiteSpace: 'nowrap'
              }}>
                Lon (WGS84)
              </th>
              <th style={{
                padding: '1em 0.75em',
                textAlign: 'left',
                fontWeight: '600',
                whiteSpace: 'nowrap'
              }}>
                Taxpayer ID
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((feature, index) => (
              <tr
                key={index}
                style={{
                  borderBottom: '1px solid hsla(0, 0%, 100%, 0.05)',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsla(0, 0%, 100%, 0.03)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <td style={{
                  padding: '1em 0.75em',
                  color: 'var(--color-white)'
                }}>
                  {feature.properties.name || '—'}
                </td>
                <td style={{
                  padding: '1em 0.75em',
                  color: 'var(--theme-text-against-dark-medium)'
                }}>
                  {feature.properties.chineseName || '—'}
                </td>
                <td style={{
                  padding: '1em 0.75em',
                  color: 'var(--theme-text-against-dark-medium)'
                }}>
                  {feature.properties.province || '—'}
                </td>
                <td style={{
                  padding: '1em 0.75em',
                  color: 'var(--theme-text-against-dark-medium)'
                }}>
                  {feature.properties.established || '—'}
                </td>
                <td style={{
                  padding: '1em 0.75em',
                  maxWidth: '200px'
                }}>
                  {feature.properties.address ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${feature.geometry.coordinates[1]},${feature.geometry.coordinates[0]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#60a5fa',
                        textDecoration: 'none',
                        fontSize: '0.875em',
                        transition: 'color 0.15s ease',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#93c5fd';
                        e.currentTarget.style.textDecoration = 'underline';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#60a5fa';
                        e.currentTarget.style.textDecoration = 'none';
                      }}
                    >
                      {feature.properties.address} →
                    </a>
                  ) : (
                    <span style={{ color: 'var(--theme-text-against-dark-medium)' }}>—</span>
                  )}
                </td>
                <td style={{
                  padding: '1em 0.75em',
                  textAlign: 'right',
                  color: 'var(--theme-text-against-dark-medium)',
                  fontFamily: 'monospace',
                  fontSize: '0.8125em'
                }}>
                  {feature.geometry.coordinates[1].toFixed(6)}
                </td>
                <td style={{
                  padding: '1em 0.75em',
                  textAlign: 'right',
                  color: 'var(--theme-text-against-dark-medium)',
                  fontFamily: 'monospace',
                  fontSize: '0.8125em'
                }}>
                  {feature.geometry.coordinates[0].toFixed(6)}
                </td>
                <td style={{
                  padding: '1em 0.75em',
                  color: 'var(--theme-text-against-dark-medium)',
                  fontFamily: 'monospace',
                  fontSize: '0.8125em'
                }}>
                  {feature.properties.taxpayerId || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {processedData.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '3em 1em',
            color: 'var(--theme-text-against-dark-medium)'
          }}>
            No facilities found matching your search.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          padding: '1.5em',
          borderTop: 'var(--border-heavy)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5em',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '0.5em 0.75em',
              backgroundColor: 'transparent',
              border: 'var(--border-heavy)',
              borderRadius: 'var(--border-radius)',
              color: currentPage === 1 ? 'hsla(0, 0%, 100%, 0.3)' : 'var(--theme-text-against-dark-medium)',
              cursor: currentPage === 1 ? 'default' : 'pointer',
              fontSize: '0.875em',
              fontWeight: '500'
            }}
          >
            ← Previous
          </button>

          {/* Page numbers */}
          {(() => {
            const pages = [];
            const showEllipsisStart = currentPage > 3;
            const showEllipsisEnd = currentPage < totalPages - 2;

            // Always show first page
            pages.push(<PageButton key={1} page={1} isCurrent={currentPage === 1} />);

            // Show ellipsis if needed
            if (showEllipsisStart) {
              pages.push(<span key="ellipsis-start" style={{ color: 'var(--theme-text-against-dark-medium)', padding: '0 0.5em' }}>...</span>);
            }

            // Show pages around current page
            const startPage = Math.max(2, currentPage - 1);
            const endPage = Math.min(totalPages - 1, currentPage + 1);

            for (let i = startPage; i <= endPage; i++) {
              pages.push(<PageButton key={i} page={i} isCurrent={currentPage === i} />);
            }

            // Show ellipsis if needed
            if (showEllipsisEnd) {
              pages.push(<span key="ellipsis-end" style={{ color: 'var(--theme-text-against-dark-medium)', padding: '0 0.5em' }}>...</span>);
            }

            // Always show last page if there's more than one
            if (totalPages > 1) {
              pages.push(<PageButton key={totalPages} page={totalPages} isCurrent={currentPage === totalPages} />);
            }

            return pages;
          })()}

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '0.5em 0.75em',
              backgroundColor: 'transparent',
              border: 'var(--border-heavy)',
              borderRadius: 'var(--border-radius)',
              color: currentPage === totalPages ? 'hsla(0, 0%, 100%, 0.3)' : 'var(--theme-text-against-dark-medium)',
              cursor: currentPage === totalPages ? 'default' : 'pointer',
              fontSize: '0.875em',
              fontWeight: '500'
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
