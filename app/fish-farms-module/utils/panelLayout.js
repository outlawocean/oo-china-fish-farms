/**
 * Geometry for the farm detail panel.
 *
 * The panel has two presentations: a side card pinned to the right edge on wide
 * containers, and a bottom sheet on narrow ones. Selecting a point pans the map
 * to that point, so the pan has to account for whichever presentation is about
 * to cover part of the map — otherwise the map helpfully centres the point
 * underneath the card describing it.
 *
 * Kept free of React and DOM so the arithmetic is directly testable.
 */

/** Width of the desktop side card, matching the style in MapViewer. */
export const CARD_WIDTH = 340;

/** Inset between the side card and the map's right edge. */
export const CARD_MARGIN = 16;

/**
 * Below this container width the side card would occupy an unreasonable share
 * of the map (half of it at 1000px, three quarters at 448px), so the bottom
 * sheet is used instead. Deliberately separate from MOBILE_BREAKPOINT (768),
 * which drives map centres, zoom limits, bounds, and marker sizes.
 */
export const PANEL_STACK_BREAKPOINT = 1024;

/** Fraction of container height the bottom sheet is allowed to occupy. */
const SHEET_HEIGHT_RATIO = 0.6;

/** Ceiling on the vertical lift, so a tall container cannot fling the point offscreen. */
const MAX_LIFT_RATIO = 0.35;

/**
 * Whether the panel should render as a bottom sheet rather than a side card.
 * An unknown width stacks, which is the presentation that cannot cover the
 * horizontal centre of the map.
 */
export const shouldStackPanel = (windowWidth) => {
  if (!windowWidth) return true;
  return windowWidth < PANEL_STACK_BREAKPOINT;
};

/**
 * Offset to pass to Mapbox `easeTo`/`flyTo` when selecting a point.
 *
 * Mapbox defines `offset` as the target centre's offset from the real container
 * centre, so a negative x lands the point left of centre and a negative y lands
 * it above centre.
 *
 * @returns {[number, number]} whole-pixel [x, y]
 */
export const getSelectionPanOffset = ({ containerWidth, containerHeight, stacked }) => {
  if (stacked) {
    const sheetHeight = (containerHeight || 0) * SHEET_HEIGHT_RATIO;
    // Centring the point in the band above the sheet means lifting it by half
    // the sheet's height.
    const lift = Math.min(sheetHeight / 2, (containerHeight || 0) * MAX_LIFT_RATIO);
    return [0, -Math.round(lift)];
  }

  // The card claims CARD_WIDTH + CARD_MARGIN on the right. Shifting the point
  // left by half that centres it in the remaining space.
  return [-Math.round((CARD_WIDTH + CARD_MARGIN) / 2), 0];
};
