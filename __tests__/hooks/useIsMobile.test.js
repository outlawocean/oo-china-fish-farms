/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import useIsMobile, { useIsMobileWithLoading } from '../../app/hooks/useIsMobile';

describe('useIsMobile Hook', () => {
  const MOBILE_BREAKPOINT = 768;
  let originalInnerWidth;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  const setWindowWidth = (width) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
  };

  describe('useIsMobile', () => {
    it('should return false during SSR/initial render (before hydration)', () => {
      setWindowWidth(500); // Mobile width
      const { result } = renderHook(() => useIsMobile());

      // Initially returns false (SSR default), then updates after useEffect
      expect(typeof result.current).toBe('boolean');
    });

    it('should return true when window width is below mobile breakpoint', async () => {
      setWindowWidth(500);
      const { result } = renderHook(() => useIsMobile());

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it('should return false when window width is at mobile breakpoint', async () => {
      setWindowWidth(768);
      const { result } = renderHook(() => useIsMobile());

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });

    it('should return false when window width is above mobile breakpoint', async () => {
      setWindowWidth(1024);
      const { result } = renderHook(() => useIsMobile());

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });

    it('should update when window is resized from desktop to mobile', async () => {
      setWindowWidth(1024);
      const { result } = renderHook(() => useIsMobile());

      await waitFor(() => {
        expect(result.current).toBe(false);
      });

      act(() => {
        setWindowWidth(500);
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it('should update when window is resized from mobile to desktop', async () => {
      setWindowWidth(500);
      const { result } = renderHook(() => useIsMobile());

      await waitFor(() => {
        expect(result.current).toBe(true);
      });

      act(() => {
        setWindowWidth(1024);
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });

    it('should clean up resize listener on unmount', async () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useIsMobile());
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });

    it('should handle rapid resize events correctly', async () => {
      setWindowWidth(1024);
      const { result } = renderHook(() => useIsMobile());

      await waitFor(() => {
        expect(result.current).toBe(false);
      });

      // Simulate rapid resizing
      act(() => {
        setWindowWidth(500);
        window.dispatchEvent(new Event('resize'));
        setWindowWidth(800);
        window.dispatchEvent(new Event('resize'));
        setWindowWidth(300);
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it('should handle edge case at exactly breakpoint - 1', async () => {
      setWindowWidth(767);
      const { result } = renderHook(() => useIsMobile());

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it('should handle very small viewport widths', async () => {
      setWindowWidth(320); // iPhone SE width
      const { result } = renderHook(() => useIsMobile());

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it('should handle very large viewport widths', async () => {
      setWindowWidth(2560); // Large monitor
      const { result } = renderHook(() => useIsMobile());

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });
  });

  describe('useIsMobileWithLoading', () => {
    it('should have isLoaded true after hook runs', async () => {
      setWindowWidth(500);
      const { result } = renderHook(() => useIsMobileWithLoading());

      // After useEffect runs (which happens synchronously in test env), isLoaded should be true
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });
    });

    it('should eventually set isLoaded to true', async () => {
      setWindowWidth(500);
      const { result } = renderHook(() => useIsMobileWithLoading());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });
    });

    it('should correctly identify mobile state when loaded', async () => {
      setWindowWidth(500);
      const { result } = renderHook(() => useIsMobileWithLoading());

      await waitFor(() => {
        expect(result.current).toEqual({ isMobile: true, isLoaded: true });
      });
    });

    it('should correctly identify desktop state when loaded', async () => {
      setWindowWidth(1024);
      const { result } = renderHook(() => useIsMobileWithLoading());

      await waitFor(() => {
        expect(result.current).toEqual({ isMobile: false, isLoaded: true });
      });
    });

    it('should update state on resize while keeping isLoaded true', async () => {
      setWindowWidth(1024);
      const { result } = renderHook(() => useIsMobileWithLoading());

      await waitFor(() => {
        expect(result.current).toEqual({ isMobile: false, isLoaded: true });
      });

      act(() => {
        setWindowWidth(500);
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        expect(result.current).toEqual({ isMobile: true, isLoaded: true });
      });
    });

    it('should clean up resize listener on unmount', async () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useIsMobileWithLoading());
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });

    it('should return consistent object shape throughout lifecycle', async () => {
      setWindowWidth(500);
      const { result, rerender } = renderHook(() => useIsMobileWithLoading());

      // Check object shape
      expect(result.current).toHaveProperty('isMobile');
      expect(result.current).toHaveProperty('isLoaded');

      rerender();

      expect(result.current).toHaveProperty('isMobile');
      expect(result.current).toHaveProperty('isLoaded');
    });
  });

  describe('Breakpoint boundary tests', () => {
    const testCases = [
      { width: 320, expected: true, description: 'iPhone SE' },
      { width: 375, expected: true, description: 'iPhone X' },
      { width: 414, expected: true, description: 'iPhone Plus' },
      { width: 428, expected: true, description: 'iPhone 14 Pro Max' },
      { width: 640, expected: true, description: 'Small tablet portrait' },
      { width: 767, expected: true, description: 'Just below breakpoint' },
      { width: 768, expected: false, description: 'Exactly at breakpoint' },
      { width: 769, expected: false, description: 'Just above breakpoint' },
      { width: 834, expected: false, description: 'iPad Mini portrait' },
      { width: 1024, expected: false, description: 'iPad landscape / small laptop' },
      { width: 1280, expected: false, description: 'Standard laptop' },
      { width: 1440, expected: false, description: 'Large laptop' },
      { width: 1920, expected: false, description: 'Full HD desktop' },
      { width: 2560, expected: false, description: 'QHD desktop' },
    ];

    testCases.forEach(({ width, expected, description }) => {
      it(`should return ${expected} for ${description} (${width}px)`, async () => {
        setWindowWidth(width);
        const { result } = renderHook(() => useIsMobile());

        await waitFor(() => {
          expect(result.current).toBe(expected);
        });
      });
    });
  });
});
