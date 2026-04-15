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
