'use client';

import { useState, useEffect, useCallback } from 'react';
import { dataService } from '../../../services/dataService';

export function useFarmData(dataset = 'western') {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let fetchedData;

      if (dataset === 'western') {
        fetchedData = await dataService.getWesternFarms();
      } else if (dataset === 'all') {
        fetchedData = await dataService.getAllData();
      } else if (typeof dataset === 'object') {
        fetchedData = await dataService.getFilteredData(dataset);
      } else {
        throw new Error(`Invalid dataset: "${dataset}". Expected 'western', 'all', or filter object.`);
      }

      setData(fetchedData);
      setLoading(false);

    } catch (err) {
      console.error('Error fetching farm data:', err);
      setError(err);
      setLoading(false);
      setData([]);
    }
  }, [dataset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}
