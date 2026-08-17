/**
 * @jest-environment jsdom
 */
import {
  CARD_MARGIN,
  CARD_WIDTH,
  PANEL_STACK_BREAKPOINT,
  getSelectionPanOffset,
  shouldStackPanel,
} from '../../app/fish-farms-module/utils/panelLayout';

describe('shouldStackPanel', () => {
  it('stacks below the breakpoint', () => {
    expect(shouldStackPanel(PANEL_STACK_BREAKPOINT - 1)).toBe(true);
    expect(shouldStackPanel(768)).toBe(true);
    expect(shouldStackPanel(400)).toBe(true);
  });

  it('does not stack at or above the breakpoint', () => {
    expect(shouldStackPanel(PANEL_STACK_BREAKPOINT)).toBe(false);
    expect(shouldStackPanel(1440)).toBe(false);
  });

  it('stacks when the width is unknown, the safer presentation', () => {
    expect(shouldStackPanel(undefined)).toBe(true);
    expect(shouldStackPanel(null)).toBe(true);
    expect(shouldStackPanel(0)).toBe(true);
  });
});

describe('getSelectionPanOffset', () => {
  describe('side card (wide containers)', () => {
    it('shifts the point left by half the card footprint', () => {
      const [x, y] = getSelectionPanOffset({
        containerWidth: 1360,
        containerHeight: 800,
        stacked: false,
      });

      expect(x).toBe(-Math.round((CARD_WIDTH + CARD_MARGIN) / 2));
      expect(y).toBe(0);
    });

    it('centers the point in the area the card does not cover', () => {
      const containerWidth = 1200;
      const [x] = getSelectionPanOffset({
        containerWidth,
        containerHeight: 800,
        stacked: false,
      });

      // Point lands at container center + x. The clear area runs from 0 to the
      // card's left edge; the point should sit at its midpoint.
      const pointX = containerWidth / 2 + x;
      const cardLeftEdge = containerWidth - CARD_MARGIN - CARD_WIDTH;

      expect(pointX).toBeCloseTo(cardLeftEdge / 2, 0);
    });

    it('keeps the point clear of the card at the narrowest non-stacked width', () => {
      const containerWidth = PANEL_STACK_BREAKPOINT;
      const [x] = getSelectionPanOffset({
        containerWidth,
        containerHeight: 800,
        stacked: false,
      });

      const pointX = containerWidth / 2 + x;
      const cardLeftEdge = containerWidth - CARD_MARGIN - CARD_WIDTH;

      expect(pointX).toBeLessThan(cardLeftEdge);
    });

    it('does not depend on container height', () => {
      const a = getSelectionPanOffset({ containerWidth: 1360, containerHeight: 600, stacked: false });
      const b = getSelectionPanOffset({ containerWidth: 1360, containerHeight: 1200, stacked: false });

      expect(a).toEqual(b);
    });
  });

  describe('bottom sheet (narrow containers)', () => {
    it('lifts the point vertically and does not shift it horizontally', () => {
      const [x, y] = getSelectionPanOffset({
        containerWidth: 800,
        containerHeight: 900,
        stacked: true,
      });

      expect(x).toBe(0);
      expect(y).toBeLessThan(0);
    });

    it('centers the point in the band above the sheet', () => {
      const containerHeight = 1000;
      const [, y] = getSelectionPanOffset({
        containerWidth: 800,
        containerHeight,
        stacked: true,
      });

      // Sheet is 60vh, so the visible band is the top 40%. Its midpoint is at
      // 20% of the height, which is 30% above the container centre.
      expect(y).toBe(-300);
    });

    it('never lifts the point past the clamp, even for extreme heights', () => {
      const containerHeight = 4000;
      const [, y] = getSelectionPanOffset({
        containerWidth: 800,
        containerHeight,
        stacked: true,
      });

      expect(Math.abs(y)).toBeLessThanOrEqual(containerHeight * 0.35);
    });

    it('handles a zero-height container without producing NaN', () => {
      const [x, y] = getSelectionPanOffset({
        containerWidth: 0,
        containerHeight: 0,
        stacked: true,
      });

      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });
  });

  it('returns integers, since Mapbox offsets are in whole pixels', () => {
    const cases = [
      { containerWidth: 1333, containerHeight: 777, stacked: false },
      { containerWidth: 999, containerHeight: 555, stacked: true },
    ];

    for (const c of cases) {
      const [x, y] = getSelectionPanOffset(c);
      expect(Number.isInteger(x)).toBe(true);
      expect(Number.isInteger(y)).toBe(true);
    }
  });
});
