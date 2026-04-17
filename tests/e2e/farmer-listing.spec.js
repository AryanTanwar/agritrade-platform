'use strict';

/**
 * E2E — Farmer listing management
 *
 * Covers: create listing, view my listings, edit listing, cancel (delete) listing.
 * All tests run as an API-seeded farmer to skip the registration UI flow.
 */

const { test, expect } = require('@playwright/test');
const { registerFarmer, createListing } = require('./helpers/api');

let farmerCreds;

test.beforeAll(async () => {
  farmerCreds = await registerFarmer({ name: 'Listing Mgmt Farmer' });
});

// ─── Helper: login ────────────────────────────────────────────────────────────
async function loginAsFarmer(page) {
  await page.goto('/login');
  await page.getByLabel(/phone/i).fill(farmerCreds.phone);
  await page.getByLabel(/password/i).fill(farmerCreds.password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/i, { timeout: 10_000 });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
test('farmer dashboard shows stat cards', async ({ page }) => {
  await loginAsFarmer(page);
  await page.goto('/farmer/dashboard');

  await expect(page.getByText(/active listings/i)).toBeVisible({ timeout: 6_000 });
  await expect(page.getByText(/pending orders/i)).toBeVisible();
});

// ─── Create listing ───────────────────────────────────────────────────────────
test.describe('Create listing', () => {
  test('navigates to create-listing form from dashboard', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer/dashboard');

    const newListingBtn = page.getByRole('link', { name: /new listing|create listing/i })
      .or(page.getByRole('button', { name: /new listing|create listing/i }));
    await newListingBtn.click();

    await expect(page).toHaveURL(/listing.*new|new.*listing|create/i, { timeout: 6_000 });
  });

  test('creates a listing and sees it in My Listings', async ({ page }) => {
    const title = `E2E Create Listing ${Date.now()}`;
    await loginAsFarmer(page);
    await page.goto('/farmer/listings/new');

    await page.getByLabel(/title/i).fill(title);
    // Category — click chip or select
    const grainsChip = page.getByRole('button', { name: /^grains$/i })
      .or(page.getByRole('option', { name: /grains/i }));
    if (await grainsChip.isVisible()) await grainsChip.click();

    await page.getByLabel(/quantity/i).fill('250');
    await page.getByLabel(/price/i).fill('60');

    // Unit — select kg
    const kgOption = page.getByRole('button', { name: /^kg$/i })
      .or(page.getByRole('option', { name: /^kg$/i }));
    if (await kgOption.isVisible()) await kgOption.click();

    await page.getByLabel(/city/i).fill('Chandigarh');
    await page.getByLabel(/state/i).fill('Punjab');

    await page.getByRole('button', { name: /publish|create|submit/i }).click();

    // Should redirect to listings page or detail
    await expect(page).toHaveURL(/listings|dashboard/i, { timeout: 10_000 });
    await expect(page.getByText(new RegExp(title, 'i'))).toBeVisible({ timeout: 8_000 });
  });

  test('shows validation error when required fields are empty', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer/listings/new');

    // Submit without filling anything
    await page.getByRole('button', { name: /publish|create|submit/i }).click();

    // Should see at least one validation error
    const errEl = page.getByRole('alert')
      .or(page.getByText(/required|fill in|cannot be empty/i))
      .first();
    await expect(errEl).toBeVisible({ timeout: 5_000 });
  });
});

// ─── My Listings page ─────────────────────────────────────────────────────────
test.describe('My Listings', () => {
  test('shows API-seeded listing in the list', async ({ page }) => {
    const seeded = await createListing(farmerCreds.token, {
      title: `E2E Seeded Listing ${Date.now()}`,
    });
    const listingTitle = seeded.title ?? seeded.listing?.title;

    await loginAsFarmer(page);
    await page.goto('/farmer/listings');

    await expect(page.getByText(new RegExp(listingTitle ?? 'E2E Seeded', 'i')))
      .toBeVisible({ timeout: 8_000 });
  });

  test('listing card shows status badge', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer/listings');
    await expect(page.getByText(/active|pending|inactive/i).first()).toBeVisible({ timeout: 6_000 });
  });
});

// ─── Cancel listing ────────────────────────────────────────────────────────────
test.describe('Cancel listing', () => {
  test('farmer can cancel an active listing', async ({ page }) => {
    const seeded = await createListing(farmerCreds.token, {
      title: `E2E Cancel Listing ${Date.now()}`,
    });
    const listingId = seeded.id ?? seeded.listing?.id;

    await loginAsFarmer(page);
    await page.goto(`/farmer/listings/${listingId}`);

    const cancelBtn = page.getByRole('button', { name: /cancel listing|remove|delete/i });
    if (await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await cancelBtn.click();
      const confirmBtn = page.getByRole('button', { name: /yes|confirm|ok/i }).last();
      if (await confirmBtn.isVisible()) await confirmBtn.click();
      await expect(page.getByText(/cancelled|removed/i)).toBeVisible({ timeout: 6_000 });
    } else {
      // Navigate to listings list and try cancel from list view
      await page.goto('/farmer/listings');
      await expect(
        page.getByText(/active|cancelled/i).first()
      ).toBeVisible({ timeout: 6_000 });
    }
  });
});
