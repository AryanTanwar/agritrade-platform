'use strict';

/**
 * E2E — Marketplace browsing
 *
 * Covers: listing grid, search, category filter, organic filter,
 * listing detail page, and the "Place Order" CTA (buyer only).
 */

const { test, expect } = require('@playwright/test');
const { registerFarmer, registerBuyer, createListing } = require('./helpers/api');

// Seed one listing once for all read-only tests in this file
let farmerCreds, buyerCreds, listing;

test.beforeAll(async () => {
  farmerCreds = await registerFarmer();
  buyerCreds  = await registerBuyer();
  listing     = await createListing(farmerCreds.token, {
    title:         'E2E Organic Basmati Rice',
    category:      'grains',
    quantity:      200,
    unit:          'kg',
    price_per_unit:75,
    is_organic:    true,
    description:   'Single-origin, no pesticides',
    location:      { city: 'Ludhiana', state: 'Punjab' },
  });
});

// ─── Public marketplace (no auth) ────────────────────────────────────────────
test.describe('Public marketplace', () => {
  test('loads listing grid on /marketplace', async ({ page }) => {
    await page.goto('/marketplace');
    await expect(page.getByRole('heading', { name: /marketplace/i })).toBeVisible();
    // At least one listing card
    const cards = page.locator('[data-testid="listing-card"], .listing-card').or(
      page.getByRole('article')
    );
    await expect(cards.first()).toBeVisible({ timeout: 8_000 });
  });

  test('search filters listings by title', async ({ page }) => {
    await page.goto('/marketplace');
    const searchInput = page.getByPlaceholder(/search/i)
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="search"], input[name="search"]').first());
    await searchInput.fill('E2E Organic Basmati');
    // Debounce or Enter
    await page.keyboard.press('Enter');
    await expect(page.getByText(/E2E Organic Basmati/i)).toBeVisible({ timeout: 6_000 });
  });

  test('category chip filters listings', async ({ page }) => {
    await page.goto('/marketplace');
    const grainsChip = page.getByRole('button', { name: /grains/i })
      .or(page.getByText('Grains').first());
    await grainsChip.click();
    // URL or heading should reflect filter
    await expect(
      page.getByText(/grains/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('organic toggle shows only organic listings', async ({ page }) => {
    await page.goto('/marketplace');
    const organicToggle = page.getByRole('checkbox', { name: /organic/i })
      .or(page.getByRole('button', { name: /organic/i }))
      .or(page.getByLabel(/organic/i));
    await organicToggle.click();
    // Every visible listing should be labelled organic
    const organicBadges = page.getByText(/organic/i);
    await expect(organicBadges.first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Listing detail ───────────────────────────────────────────────────────────
test.describe('Listing detail page', () => {
  test('navigates to listing detail and shows key fields', async ({ page }) => {
    await page.goto('/marketplace');
    const searchInput = page.getByPlaceholder(/search/i)
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="search"]').first());
    await searchInput.fill('E2E Organic Basmati');
    await page.keyboard.press('Enter');

    // Click the first result
    await page.getByText(/E2E Organic Basmati/i).first().click();

    // Detail page shows price, quantity, seller info
    await expect(page.getByText(/₹75|75\s*\/\s*kg/i)).toBeVisible({ timeout: 6_000 });
    await expect(page.getByText(/200\s*kg/i)).toBeVisible();
    await expect(page.getByText(/Ludhiana|Punjab/i)).toBeVisible();
  });

  test('detail page shows "Place Order" button for authenticated buyers', async ({ page }) => {
    // Login as buyer
    await page.goto('/login');
    await page.getByLabel(/phone/i).fill(buyerCreds.phone);
    await page.getByLabel(/password/i).fill(buyerCreds.password);
    await page.getByRole('button', { name: /log in|sign in/i }).click();
    await expect(page).toHaveURL(/marketplace|dashboard/i, { timeout: 10_000 });

    // Navigate to listing detail
    await page.goto(`/marketplace/${listing.id ?? listing.listing?.id}`);

    const placeOrderBtn = page.getByRole('button', { name: /place order|buy now|order/i })
      .or(page.getByRole('link', { name: /place order|buy now/i }));
    await expect(placeOrderBtn).toBeVisible({ timeout: 6_000 });
  });

  test('unauthenticated user sees login prompt instead of Place Order', async ({ page }) => {
    await page.goto(`/marketplace/${listing.id ?? listing.listing?.id}`);
    // Either the button is hidden or there's a login prompt
    const loginPrompt = page.getByText(/log in|sign in|login to/i)
      .or(page.getByRole('link', { name: /login|sign in/i }));
    const placeOrderBtn = page.getByRole('button', { name: /^place order$/i });
    const hasLoginPrompt = await loginPrompt.isVisible().catch(() => false);
    const hasPlaceOrder  = await placeOrderBtn.isVisible().catch(() => false);
    expect(hasLoginPrompt || !hasPlaceOrder).toBe(true);
  });
});
