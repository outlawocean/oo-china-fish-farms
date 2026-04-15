'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { geoOrthographic, geoPath, geoGraticule } from 'd3-geo';
import { feature } from 'topojson-client';

export default function LocatorGlobe({ currentCenter, currentZoom }) {
  const canvasRef = useRef(null);
  const [countries, setCountries] = useState(null);

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(response => response.json())
      .then(topology => {
        const land = feature(topology, topology.objects.countries);
        setCountries(land);
      })
      .catch(err => console.error('Failed to load geography:', err));
  }, []);

  // Throttle updates to reduce re-renders during map panning
  const throttledCenter = useMemo(() => {
    if (!currentCenter) return null;
    return {
      longitude: Math.round(currentCenter.longitude * 10) / 10,
      latitude: Math.round(currentCenter.latitude * 10) / 10
    };
  }, [currentCenter?.longitude, currentCenter?.latitude]);

  const throttledZoom = useMemo(() => {
    if (currentZoom === undefined) return null;
    return Math.round(currentZoom * 2) / 2;
  }, [currentZoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !throttledCenter || !countries) return;

    const ctx = canvas.getContext('2d');
    const size = 90;
    const centerX = size / 2;
    const centerY = size / 2;
    const scale = 42;

    ctx.clearRect(0, 0, size, size);

    const projection = geoOrthographic()
      .scale(scale)
      .translate([centerX, centerY])
      .rotate([-105, -35, 0])
      .precision(0.1);

    const path = geoPath(projection, ctx);

    // Ocean background
    ctx.beginPath();
    ctx.arc(centerX, centerY, scale, 0, 2 * Math.PI);
    ctx.fillStyle = '#283d48';
    ctx.fill();

    // Graticule lines
    const graticule = geoGraticule();
    ctx.beginPath();
    path(graticule());
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Draw countries, highlighting China
    countries.features.forEach(country => {
      const isChina = country.id === '156';

      ctx.beginPath();
      path(country);

      if (isChina) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(200, 200, 180, 0.85)';
        ctx.fill();
      }
    });

    // Current view indicator circle
    if (throttledCenter && throttledZoom !== null) {
      const coords = [throttledCenter.longitude, throttledCenter.latitude];
      const projected = projection(coords);

      if (projected) {
        const [x, y] = projected;
        const indicatorSize = Math.max(4, 20 / throttledZoom);

        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        if (distance < scale) {
          ctx.beginPath();
          ctx.arc(x, y, indicatorSize, 0, 2 * Math.PI);
          ctx.strokeStyle = '#bf1b1b';
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }
      }
    }

  }, [throttledCenter, throttledZoom, countries]);

  return (
    <div
      style={{
        width: '90px',
        height: '90px',
        pointerEvents: 'none'
      }}
    >
      <canvas
        ref={canvasRef}
        width={90}
        height={90}
        style={{
          display: 'block',
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
}
