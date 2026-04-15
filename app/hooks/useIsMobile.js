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
