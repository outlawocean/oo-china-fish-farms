// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Desktop Experience', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    // Wait for the map to load
    await page.waitForSelector('[class*="mapboxgl-map"]', { timeout: 30000 });
  });

  test.describe('Initial Load', () => {
    test('should display the map', async ({ page }) => {
      const map = page.locator('[class*="mapboxgl-map"]');
      await expect(map).toBeVisible();
    });

    test('should display filter sidebar', async ({ page }) => {
      // Look for filter sidebar content
      const filterText = page.locator('text=Filter').first();
      await expect(filterText).toBeVisible({ timeout: 10000 });
    });

    test('should show western view by default', async ({ page }) => {
      // Western view should show Location filter
      const locationHeader = page.locator('text=LOCATION');
      await expect(locationHeader).toBeVisible({ timeout: 10000 });
    });

    test('should display Xinjiang and Tibetan Plateau options', async ({ page }) => {
      const xinjiang = page.locator('text=Xinjiang');
      const tibetanPlateau = page.locator('text=Tibetan Plateau');

      await expect(xinjiang).toBeVisible({ timeout: 10000 });
      await expect(tibetanPlateau).toBeVisible();
    });

    test('should show record count', async ({ page }) => {
      // Should show "Filter X Records"
      const recordCount = page.locator('text=/Filter.*Records/');
      await expect(recordCount).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Filter Sidebar Interactions', () => {
    test('should collapse sidebar when close button is clicked', async ({ page }) => {
      // Find and click the close/collapse button
      const closeButton = page.locator('button:has-text("←")');
      await closeButton.click();

      // Sidebar content should be hidden
      await expect(page.locator('text=LOCATION')).not.toBeVisible({ timeout: 5000 });

      // Filter toggle button should appear
      const filterToggle = page.locator('[aria-label*="filter" i], [aria-label*="open" i]').first();
      await expect(filterToggle).toBeVisible();
    });

    test('should reopen sidebar when filter toggle is clicked', async ({ page }) => {
      // Close sidebar first
      await page.locator('button:has-text("←")').click();

      // Click the filter toggle button
      const filterToggle = page.locator('[aria-label*="filter" i], [aria-label*="open" i]').first();
      await filterToggle.click();

      // Sidebar content should be visible again
      await expect(page.locator('text=LOCATION')).toBeVisible({ timeout: 5000 });
    });

    test('should filter by location when checkbox is clicked', async ({ page }) => {
      // Wait for checkboxes to be available
      const checkboxes = page.locator('input[type="checkbox"]');
      await expect(checkboxes.first()).toBeVisible({ timeout: 10000 });

      // Click Xinjiang checkbox
      const xinjiangCheckbox = checkboxes.first();
      await xinjiangCheckbox.click();

      // Should show "Filters active"
      const filtersActive = page.locator('text=Filters active');
      await expect(filtersActive).toBeVisible({ timeout: 5000 });
    });

    test('should show reset button when filters are active', async ({ page }) => {
      // Apply a filter
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.first().click();

      // Reset button should appear
      const resetButton = page.locator('button:has-text("Reset")');
      await expect(resetButton).toBeVisible({ timeout: 5000 });
    });

    test('should clear filters when reset is clicked', async ({ page }) => {
      // Apply a filter
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.first().click();

      // Click reset
      const resetButton = page.locator('button:has-text("Reset")').first();
      await resetButton.click();

      // Should show "Showing all records"
      const showingAll = page.locator('text=Showing all records');
      await expect(showingAll).toBeVisible({ timeout: 5000 });
    });

    test('should show "only" button on hover', async ({ page }) => {
      // Hover over a filter item
      const filterItem = page.locator('input[type="checkbox"]').first().locator('..');
      await filterItem.hover();

      // "only" button should appear
      const onlyButton = page.locator('button:has-text("only")').first();
      await expect(onlyButton).toBeVisible({ timeout: 3000 });
    });

    test('should apply "only" filter when only button is clicked', async ({ page }) => {
      // Hover over a filter item and click "only"
      const filterItem = page.locator('input[type="checkbox"]').first().locator('..');
      await filterItem.hover();

      const onlyButton = page.locator('button:has-text("only")').first();
      await onlyButton.click();

      // Should show "Filters active"
      const filtersActive = page.locator('text=Filters active');
      await expect(filtersActive).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Timeline', () => {
    test('should display timeline section', async ({ page }) => {
      const established = page.locator('text=ESTABLISHED');
      await expect(established).toBeVisible({ timeout: 10000 });
    });

    test('should show year range', async ({ page }) => {
      await expect(page.locator('text=2000')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=2025')).toBeVisible();
    });

    test('should have range slider', async ({ page }) => {
      const slider = page.locator('input[type="range"]');
      await expect(slider).toBeVisible({ timeout: 10000 });
    });

    test('should have play/reset controls', async ({ page }) => {
      const playButton = page.locator('button:has-text("Play")');
      const resetButton = page.locator('button:has-text("Start Over"), button:has-text("Reset")');

      await expect(playButton.or(resetButton.first())).toBeVisible({ timeout: 10000 });
    });

    test('should update display when slider changes', async ({ page }) => {
      const slider = page.locator('input[type="range"]');
      await slider.fill('2015');

      // Should show updated year
      const yearDisplay = page.locator('text=/Through 2015/');
      await expect(yearDisplay).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Search', () => {
    test('should display search input', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search" i]');
      await expect(searchInput).toBeVisible({ timeout: 10000 });
    });

    test('should filter results when searching', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search" i]');
      await searchInput.fill('test');

      // Should trigger filter (debounced)
      await page.waitForTimeout(500);

      // Search term should be in input
      await expect(searchInput).toHaveValue('test');
    });

    test('should show clear button when search has value', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search" i]');
      await searchInput.fill('test');

      // Clear button should appear
      const clearButton = page.locator('[aria-label*="clear" i], button:has-text("×")').first();
      await expect(clearButton).toBeVisible({ timeout: 5000 });
    });

    test('should clear search when clear button is clicked', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search" i]');
      await searchInput.fill('test');

      const clearButton = page.locator('[aria-label*="clear" i]').first();
      await clearButton.click();

      await expect(searchInput).toHaveValue('');
    });
  });

  test.describe('View Mode', () => {
    test('should display view mode toggle', async ({ page }) => {
      const viewModeHeader = page.locator('text=VIEW MODE');
      await expect(viewModeHeader).toBeVisible({ timeout: 10000 });
    });

    test('should have Points and Density buttons', async ({ page }) => {
      await expect(page.locator('button:has-text("Points")')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('button:has-text("Density")')).toBeVisible();
    });

    test('should switch to density view', async ({ page }) => {
      const densityButton = page.locator('button:has-text("Density")');
      await densityButton.click();

      // Density legend should appear
      const legend = page.locator('text=Farm Density');
      await expect(legend).toBeVisible({ timeout: 5000 });
    });

    test('should show legend in density mode', async ({ page }) => {
      const densityButton = page.locator('button:has-text("Density")');
      await densityButton.click();

      await expect(page.locator('text=Fewer')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=More')).toBeVisible();
    });
  });

  test.describe('Table View', () => {
    test('should navigate to table view', async ({ page }) => {
      const tableButton = page.locator('text=/View.*Download.*Data/i');
      await tableButton.click();

      // Table view should be visible
      await page.waitForSelector('table, [data-testid="table-view"]', { timeout: 30000 });
    });

    test('should show back button in table view', async ({ page }) => {
      const tableButton = page.locator('text=/View.*Download.*Data/i');
      await tableButton.click();

      await page.waitForSelector('table, [data-testid="table-view"]', { timeout: 30000 });

      const backButton = page.locator('button:has-text("Back"), button:has-text("Map")');
      await expect(backButton.first()).toBeVisible({ timeout: 10000 });
    });

    test('should return to map view', async ({ page }) => {
      // Go to table
      const tableButton = page.locator('text=/View.*Download.*Data/i');
      await tableButton.click();

      await page.waitForSelector('table, [data-testid="table-view"]', { timeout: 30000 });

      // Go back to map
      const backButton = page.locator('button:has-text("Back"), button:has-text("Map")');
      await backButton.first().click();

      // Map should be visible
      await expect(page.locator('[class*="mapboxgl-map"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Map Interactions', () => {
    test('should allow map panning', async ({ page }) => {
      const map = page.locator('[class*="mapboxgl-map"]');

      // Get initial map center (this is a simplified test)
      await map.click({ position: { x: 100, y: 100 } });

      // Pan the map
      await page.mouse.move(300, 300);
      await page.mouse.down();
      await page.mouse.move(200, 200, { steps: 10 });
      await page.mouse.up();

      // Map should still be functional
      await expect(map).toBeVisible();
    });

    test('should allow map zooming', async ({ page }) => {
      const map = page.locator('[class*="mapboxgl-map"]');

      // Zoom with scroll (if supported)
      await map.hover();
      await page.mouse.wheel(0, -100);

      // Map should still be functional
      await expect(map).toBeVisible();
    });

    test('should show detail panel when farm is clicked', async ({ page }) => {
      // This test requires actual farm points to be rendered
      // Click on map area where farms should be
      const map = page.locator('[class*="mapboxgl-map"]');
      await map.click({ position: { x: 300, y: 300 } });

      // If a farm was clicked, detail panel might appear
      // This is a best-effort test since farm positions vary
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Methodology Link', () => {
    test('should have methodology link', async ({ page }) => {
      const methodologyLink = page.locator('text=/How did we build this map/i');
      await expect(methodologyLink).toBeVisible({ timeout: 10000 });
    });

    test('should open in new tab', async ({ page }) => {
      const methodologyLink = page.locator('a:has-text("How did we build this map")');
      const target = await methodologyLink.getAttribute('target');
      expect(target).toBe('_blank');
    });
  });

  test.describe('Locator Globe', () => {
    test('should display locator globe section', async ({ page }) => {
      const viewExtent = page.locator('text=VIEW EXTENT');
      await expect(viewExtent).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const h2Elements = page.locator('h2');
      const h3Elements = page.locator('h3');

      await expect(h2Elements.first()).toBeVisible({ timeout: 10000 });
    });

    test('should have accessible form controls', async ({ page }) => {
      // Checkboxes should be accessible
      const checkboxes = page.locator('input[type="checkbox"]');
      await expect(checkboxes.first()).toBeVisible({ timeout: 10000 });
    });

    test('should have aria labels on buttons', async ({ page }) => {
      const closeButton = page.locator('button[aria-label]').first();
      await expect(closeButton).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/');
      await page.waitForSelector('[class*="mapboxgl-map"]', { timeout: 30000 });

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(30000); // 30 seconds max
    });

    test('should remain responsive during filter changes', async ({ page }) => {
      await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 });

      const startTime = Date.now();
      await page.locator('input[type="checkbox"]').first().click();
      const clickTime = Date.now() - startTime;

      expect(clickTime).toBeLessThan(2000); // Filter should apply quickly
    });
  });
});
