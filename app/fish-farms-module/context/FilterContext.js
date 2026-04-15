'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

const DEFAULT_FILTERS = {
  province: '',
  city: '',
  district: '',
  scale: '',
  searchText: '',
};

const STORAGE_KEY = 'fish-farms-filters';
const FilterContext = createContext(undefined);

export function FilterProvider({ children }) {
  const [filters, setFiltersState] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          return { ...DEFAULT_FILTERS, ...JSON.parse(saved) };
        }
      } catch (error) {
        console.error('Failed to load filters from localStorage:', error);
      }
    }
    return DEFAULT_FILTERS;
  });

  // Persist filters to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
      } catch (error) {
        console.error('Failed to save filters to localStorage:', error);
      }
    }
  }, [filters]);

  const setFilter = useCallback((key, value) => {
    setFiltersState(prevFilters => ({
      ...prevFilters,
      [key]: value,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const setMultipleFilters = useCallback((updates) => {
    setFiltersState(prevFilters => ({
      ...prevFilters,
      ...updates,
    }));
  }, []);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(value => {
      if (typeof value === 'string') {
        return value.trim() !== '';
      }
      return !!value;
    }).length;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  const activeFiltersList = useMemo(() => {
    return Object.entries(filters)
      .filter(([_, value]) => {
        if (typeof value === 'string') return value.trim() !== '';
        return !!value;
      })
      .map(([key, _]) => key);
  }, [filters]);

  const value = useMemo(() => ({
    filters,
    setFilter,
    resetFilters,
    setMultipleFilters,
    activeFilterCount,
    hasActiveFilters,
    activeFiltersList,
  }), [
    filters,
    setFilter,
    resetFilters,
    setMultipleFilters,
    activeFilterCount,
    hasActiveFilters,
    activeFiltersList,
  ]);

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);

  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }

  return context;
}
