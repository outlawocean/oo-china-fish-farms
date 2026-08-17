/**
 * @jest-environment jsdom
 */
import { cloneMapStyle } from '../../app/fish-farms-module/utils/mapStyle';

describe('cloneMapStyle', () => {
  describe('basic cloning functionality', () => {
    it('should create a deep copy of a simple object', () => {
      const original = { version: 8, name: 'Test Style' };
      const clone = cloneMapStyle(original);

      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
    });

    it('should clone nested objects deeply', () => {
      const original = {
        version: 8,
        sources: {
          composite: {
            url: 'mapbox://mapbox.satellite',
            type: 'raster',
          },
        },
      };

      const clone = cloneMapStyle(original);

      expect(clone.sources.composite).toEqual(original.sources.composite);
      expect(clone.sources.composite).not.toBe(original.sources.composite);
    });

    it('should clone arrays deeply', () => {
      const original = {
        layers: [
          { id: 'background', type: 'background' },
          { id: 'water', type: 'fill' },
        ],
      };

      const clone = cloneMapStyle(original);

      expect(clone.layers).toEqual(original.layers);
      expect(clone.layers).not.toBe(original.layers);
      expect(clone.layers[0]).not.toBe(original.layers[0]);
    });

    it('should handle complex map style structures', () => {
      const original = {
        version: 8,
        name: 'Dark Ocean Style',
        sources: {
          composite: {
            url: 'mapbox://mapbox.satellite',
            type: 'raster',
            tileSize: 256,
          },
          labels: {
            type: 'vector',
            url: 'mapbox://mapbox.terrain-rgb',
          },
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#000000',
            },
          },
          {
            id: 'water',
            type: 'fill',
            source: 'composite',
            'source-layer': 'water',
            paint: {
              'fill-color': '#1a1a2e',
            },
          },
        ],
        glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
        sprite: 'mapbox://sprites/mapbox/streets-v11',
      };

      const clone = cloneMapStyle(original);

      expect(clone).toEqual(original);
      expect(clone.sources).not.toBe(original.sources);
      expect(clone.layers).not.toBe(original.layers);
      expect(clone.layers[0].paint).not.toBe(original.layers[0].paint);
    });
  });

  describe('mutation isolation', () => {
    it('should not affect original when clone is modified', () => {
      const original = {
        version: 8,
        layers: [{ id: 'test', paint: { color: '#fff' } }],
      };

      const clone = cloneMapStyle(original);
      clone.version = 9;
      clone.layers[0].id = 'modified';
      clone.layers[0].paint.color = '#000';

      expect(original.version).toBe(8);
      expect(original.layers[0].id).toBe('test');
      expect(original.layers[0].paint.color).toBe('#fff');
    });

    it('should not affect clone when original is modified after cloning', () => {
      const original = {
        version: 8,
        layers: [{ id: 'test' }],
      };

      const clone = cloneMapStyle(original);
      original.version = 9;
      original.layers[0].id = 'modified';

      expect(clone.version).toBe(8);
      expect(clone.layers[0].id).toBe('test');
    });
  });

  describe('edge cases', () => {
    it('should handle empty object', () => {
      const original = {};
      const clone = cloneMapStyle(original);

      expect(clone).toEqual({});
      expect(clone).not.toBe(original);
    });

    it('should handle object with null values', () => {
      const original = { center: null, zoom: null };
      const clone = cloneMapStyle(original);

      expect(clone).toEqual(original);
    });

    it('should handle object with undefined values', () => {
      const original = { center: undefined, zoom: 5 };
      const clone = cloneMapStyle(original);

      // Note: JSON.parse/stringify converts undefined to missing keys
      expect(clone.zoom).toBe(5);
    });

    it('should handle deeply nested structures', () => {
      const original = {
        a: { b: { c: { d: { e: { f: 'deep' } } } } },
      };
      const clone = cloneMapStyle(original);

      expect(clone.a.b.c.d.e.f).toBe('deep');
      expect(clone.a.b.c.d.e).not.toBe(original.a.b.c.d.e);
    });

    it('should handle arrays with mixed types', () => {
      const original = {
        expression: ['interpolate', ['linear'], ['zoom'], 5, 1, 10, 2],
      };
      const clone = cloneMapStyle(original);

      expect(clone.expression).toEqual(original.expression);
      expect(clone.expression).not.toBe(original.expression);
    });

    it('should handle numbers (including floats)', () => {
      const original = {
        zoom: 4.13,
        bearing: -13.6,
        pitch: 45.5,
      };
      const clone = cloneMapStyle(original);

      expect(clone).toEqual(original);
    });

    it('should handle boolean values', () => {
      const original = {
        interactive: true,
        preserveDrawingBuffer: false,
      };
      const clone = cloneMapStyle(original);

      expect(clone).toEqual(original);
    });
  });

  describe('MapTiler key injection', () => {
    const originalKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;

    afterEach(() => {
      process.env.NEXT_PUBLIC_MAPTILER_KEY = originalKey;
      jest.restoreAllMocks();
    });

    it('should replace the placeholder in source urls', () => {
      process.env.NEXT_PUBLIC_MAPTILER_KEY = 'test-key-123';
      const original = {
        sources: {
          openmaptiles: {
            url: 'https://api.maptiler.com/tiles/v3-openmaptiles/tiles.json?key={MAPTILER_KEY}',
          },
        },
      };

      const clone = cloneMapStyle(original);

      expect(clone.sources.openmaptiles.url).toBe(
        'https://api.maptiler.com/tiles/v3-openmaptiles/tiles.json?key=test-key-123'
      );
    });

    it('should replace the placeholder in glyphs', () => {
      process.env.NEXT_PUBLIC_MAPTILER_KEY = 'test-key-123';
      const original = {
        glyphs: 'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key={MAPTILER_KEY}',
      };

      const clone = cloneMapStyle(original);

      expect(clone.glyphs).toBe(
        'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=test-key-123'
      );
    });

    it('should replace every occurrence across nested structures', () => {
      process.env.NEXT_PUBLIC_MAPTILER_KEY = 'abc';
      const original = {
        glyphs: 'https://api.maptiler.com/fonts/f/r.pbf?key={MAPTILER_KEY}',
        sources: {
          a: { url: 'https://api.maptiler.com/tiles/v4/tiles.json?key={MAPTILER_KEY}' },
          b: { url: 'https://api.maptiler.com/tiles/satellite-v2/tiles.json?key={MAPTILER_KEY}' },
        },
      };

      const clone = cloneMapStyle(original);
      const serialized = JSON.stringify(clone);

      expect(serialized).not.toContain('{MAPTILER_KEY}');
      expect(serialized.match(/key=abc/g)).toHaveLength(3);
    });

    it('should preserve mapbox template tokens like {z}/{x}/{y}', () => {
      process.env.NEXT_PUBLIC_MAPTILER_KEY = 'abc';
      const original = {
        sources: {
          a: { tiles: ['https://api.maptiler.com/tiles/{z}/{x}/{y}.pbf?key={MAPTILER_KEY}'] },
        },
      };

      const clone = cloneMapStyle(original);

      expect(clone.sources.a.tiles[0]).toBe(
        'https://api.maptiler.com/tiles/{z}/{x}/{y}.pbf?key=abc'
      );
    });

    it('should leave styles without the placeholder untouched', () => {
      process.env.NEXT_PUBLIC_MAPTILER_KEY = 'abc';
      const original = {
        sources: { composite: { url: 'mapbox://mapbox.satellite' } },
      };

      const clone = cloneMapStyle(original);

      expect(clone).toEqual(original);
    });

    it('should leave the placeholder intact when the key is missing', () => {
      delete process.env.NEXT_PUBLIC_MAPTILER_KEY;
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      const original = {
        sources: { a: { url: 'https://api.maptiler.com/tiles/v4/tiles.json?key={MAPTILER_KEY}' } },
      };

      const clone = cloneMapStyle(original);

      expect(clone.sources.a.url).toContain('{MAPTILER_KEY}');
      expect(clone.sources.a.url).not.toContain('undefined');
    });

    it('should warn when the key is missing', () => {
      delete process.env.NEXT_PUBLIC_MAPTILER_KEY;
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const original = {
        sources: { a: { url: 'https://api.maptiler.com/tiles/v4/tiles.json?key={MAPTILER_KEY}' } },
      };

      cloneMapStyle(original);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_MAPTILER_KEY'));
    });

    it('should still deep-clone when injecting', () => {
      process.env.NEXT_PUBLIC_MAPTILER_KEY = 'abc';
      const original = {
        sources: { a: { url: 'https://api.maptiler.com/tiles/v4/tiles.json?key={MAPTILER_KEY}' } },
      };

      const clone = cloneMapStyle(original);
      clone.sources.a.url = 'mutated';

      expect(original.sources.a.url).toContain('{MAPTILER_KEY}');
    });
  });

  describe('performance and correctness', () => {
    it('should correctly clone a style with many layers', () => {
      const layers = Array.from({ length: 100 }, (_, i) => ({
        id: `layer-${i}`,
        type: 'fill',
        paint: { 'fill-color': `#${String(i).padStart(6, '0')}` },
      }));

      const original = { version: 8, layers };
      const clone = cloneMapStyle(original);

      expect(clone.layers.length).toBe(100);
      expect(clone.layers[50]).toEqual(original.layers[50]);
      expect(clone.layers[50]).not.toBe(original.layers[50]);
    });
  });
});
