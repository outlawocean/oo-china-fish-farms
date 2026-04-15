/**
 * @jest-environment jsdom
 */
import { getColorForCount, getHexbinStats } from '../../app/fish-farms-module/utils/hexbinUtils';

describe('hexbinUtils', () => {
  describe('getColorForCount', () => {
    it('should return transparent for count of 0', () => {
      expect(getColorForCount(0, 100)).toBe('rgba(0,0,0,0)');
    });

    it('should return lightest color for very low counts', () => {
      const color = getColorForCount(1, 100);
      // Should be in the lightest blue range
      expect(color).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
      // First color: [247, 251, 255]
      expect(color).toBe('rgb(247, 251, 255)');
    });

    it('should return darker color for higher normalized values', () => {
      // At 80% of max, should be darkest
      const darkColor = getColorForCount(80, 100);
      expect(darkColor).toBe('rgb(8, 48, 107)');
    });

    it('should handle edge case where count equals maxCount', () => {
      const color = getColorForCount(100, 100);
      // Normalized = 1.0, should be darkest color
      expect(color).toBe('rgb(8, 48, 107)');
    });

    it('should return appropriate color for 20% threshold', () => {
      const color = getColorForCount(20, 100);
      expect(color).toBe('rgb(198, 219, 239)');
    });

    it('should return appropriate color for 40% threshold', () => {
      const color = getColorForCount(40, 100);
      expect(color).toBe('rgb(107, 174, 214)');
    });

    it('should return appropriate color for 60% threshold', () => {
      const color = getColorForCount(60, 100);
      expect(color).toBe('rgb(33, 113, 181)');
    });

    it('should handle very small maxCount values', () => {
      const color = getColorForCount(1, 1);
      // 1/1 = 100%, should be darkest
      expect(color).toBe('rgb(8, 48, 107)');
    });

    it('should handle decimal count values', () => {
      const color = getColorForCount(50.5, 100);
      expect(color).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
    });

    it('should be consistent across multiple calls with same input', () => {
      const color1 = getColorForCount(50, 100);
      const color2 = getColorForCount(50, 100);
      expect(color1).toBe(color2);
    });

    describe('color gradient progression', () => {
      it('should produce progressively darker colors as count increases', () => {
        const maxCount = 100;
        const counts = [10, 25, 45, 65, 85];
        const colors = counts.map(c => getColorForCount(c, maxCount));

        // Verify we get different colors as count increases
        const uniqueColors = new Set(colors);
        expect(uniqueColors.size).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('getHexbinStats', () => {
    it('should calculate correct stats for single hexbin', () => {
      const hexbinData = {
        type: 'FeatureCollection',
        features: [
          { properties: { count: 10 } }
        ]
      };

      const stats = getHexbinStats(hexbinData);

      expect(stats.min).toBe(10);
      expect(stats.max).toBe(10);
      expect(stats.mean).toBe(10);
      expect(stats.total).toBe(10);
    });

    it('should calculate correct stats for multiple hexbins', () => {
      const hexbinData = {
        type: 'FeatureCollection',
        features: [
          { properties: { count: 5 } },
          { properties: { count: 10 } },
          { properties: { count: 15 } },
          { properties: { count: 20 } }
        ]
      };

      const stats = getHexbinStats(hexbinData);

      expect(stats.min).toBe(5);
      expect(stats.max).toBe(20);
      expect(stats.mean).toBe(12.5);
      expect(stats.total).toBe(50);
    });

    it('should handle hexbins with varying counts', () => {
      const hexbinData = {
        type: 'FeatureCollection',
        features: [
          { properties: { count: 1 } },
          { properties: { count: 100 } },
          { properties: { count: 50 } },
          { properties: { count: 25 } },
          { properties: { count: 75 } }
        ]
      };

      const stats = getHexbinStats(hexbinData);

      expect(stats.min).toBe(1);
      expect(stats.max).toBe(100);
      expect(stats.mean).toBe(50.2);
      expect(stats.total).toBe(251);
    });

    it('should handle all hexbins with same count', () => {
      const hexbinData = {
        type: 'FeatureCollection',
        features: [
          { properties: { count: 42 } },
          { properties: { count: 42 } },
          { properties: { count: 42 } }
        ]
      };

      const stats = getHexbinStats(hexbinData);

      expect(stats.min).toBe(42);
      expect(stats.max).toBe(42);
      expect(stats.mean).toBe(42);
      expect(stats.total).toBe(126);
    });

    it('should handle large datasets', () => {
      const features = Array.from({ length: 1000 }, (_, i) => ({
        properties: { count: i + 1 }
      }));

      const hexbinData = {
        type: 'FeatureCollection',
        features
      };

      const stats = getHexbinStats(hexbinData);

      expect(stats.min).toBe(1);
      expect(stats.max).toBe(1000);
      expect(stats.mean).toBe(500.5);
      expect(stats.total).toBe(500500);
    });

    it('should return correct types for all properties', () => {
      const hexbinData = {
        type: 'FeatureCollection',
        features: [
          { properties: { count: 10 } },
          { properties: { count: 20 } }
        ]
      };

      const stats = getHexbinStats(hexbinData);

      expect(typeof stats.min).toBe('number');
      expect(typeof stats.max).toBe('number');
      expect(typeof stats.mean).toBe('number');
      expect(typeof stats.total).toBe('number');
    });

    describe('edge cases', () => {
      it('should handle hexbins with zero counts', () => {
        const hexbinData = {
          type: 'FeatureCollection',
          features: [
            { properties: { count: 0 } },
            { properties: { count: 10 } },
            { properties: { count: 0 } }
          ]
        };

        const stats = getHexbinStats(hexbinData);

        expect(stats.min).toBe(0);
        expect(stats.max).toBe(10);
        expect(stats.total).toBe(10);
      });

      it('should handle very large counts', () => {
        const hexbinData = {
          type: 'FeatureCollection',
          features: [
            { properties: { count: 1000000 } },
            { properties: { count: 2000000 } }
          ]
        };

        const stats = getHexbinStats(hexbinData);

        expect(stats.min).toBe(1000000);
        expect(stats.max).toBe(2000000);
        expect(stats.mean).toBe(1500000);
        expect(stats.total).toBe(3000000);
      });

      it('should handle floating point counts', () => {
        const hexbinData = {
          type: 'FeatureCollection',
          features: [
            { properties: { count: 1.5 } },
            { properties: { count: 2.5 } },
            { properties: { count: 3.0 } }
          ]
        };

        const stats = getHexbinStats(hexbinData);

        expect(stats.min).toBeCloseTo(1.5);
        expect(stats.max).toBeCloseTo(3.0);
        expect(stats.mean).toBeCloseTo(2.333, 2);
        expect(stats.total).toBeCloseTo(7.0);
      });
    });
  });
});
