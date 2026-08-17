'use client';

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

export default function useIsMobile() {
  // Start with null to indicate "not yet determined"
  const [isMobile, setIsMobile] = useState(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Initial check
    checkMobile();

    // Listen for resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Return false during SSR/initial render, actual value after hydration
  return isMobile ?? false;
}

/**
 * Current viewport width, or null before hydration.
 *
 * Callers that need a breakpoint other than MOBILE_BREAKPOINT should use this
 * rather than widening MOBILE_BREAKPOINT — that value drives map centres, zoom
 * limits, bounds, and marker sizes, so moving it changes far more than layout.
 */
export function useViewportWidth() {
  const [width, setWidth] = useState(null);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);

    update();

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return width;
}

// Hook that also returns whether we've determined the mobile state yet
export function useIsMobileWithLoading() {
  const [state, setState] = useState({ isMobile: false, isLoaded: false });

  useEffect(() => {
    const checkMobile = () => {
      setState({ isMobile: window.innerWidth < MOBILE_BREAKPOINT, isLoaded: true });
    };

    checkMobile();

    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return state;
}
