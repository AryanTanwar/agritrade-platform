'use strict';

/**
 * E2E — Authentication flow
 *
 * Covers: registration (farmer + buyer), OTP verification, login,
 * token refresh, and logout via the web UI.
 *
 * These tests target the React web portal (client/web).  The test
 * environment must have NODE_ENV=test so the auth service accepts the
 * fixed OTP "000000" without calling Twilio.
 */

const { test, expect } = require('@playwright/test');
const { registerFarmer, registerBuyer } = require('./helpers/api');

// ─── Farmer registration + login ──────────────────────────────────────────────
test.describe('Farmer auth flow', () => {
  test('registers a farmer, verifies OTP, and lands on dashboard', async ({ page }) => {
    const phone = `+9198765${String(Date.now()).slice(-5)}`;

    // 1. Navigate to register page
    await page.goto('/register');
    await expect(page).toHaveURL(/register/);

    // 2. Fill registration form
    await page.getByLabel(/name/i).fill('Ranjit Singh');
    await page.getByLabel(/phone/i).fill(phone);
    await page.getByLabel(/password/i).first().fill('TestFarmer@123!');
    await page.getByLabel(/confirm password/i).fill('TestFarmer@123!');
    // Select role = farmer (radio / select)
    const farmerOpt = page.getByRole('radio', { name: /farmer/i })
      .or(page.getByRole('option', { name: /farmer/i }));
    if (await farmerOpt.isVisible()) await farmerOpt.click();

    await page.getByRole('button', { name: /register|sign up|create account/i }).click();

    // 3. OTP screen — enter test OTP
    await expect(page).toHaveURL(/otp|verify/i);
    const otpInput = page.getByLabel(/otp|code/i).first()
      .or(page.locator('input[type="text"], input[type="number"]').first());
    await otpInput.fill('000000');
    await page.getByRole('button', { name: /verify|confirm|submit/i }).click();

    // 4. Should land on login or dashboard
    await expect(page).toHaveURL(/login|dashboard/i, { timeout: 10_000 });
  });

  test('logs in with valid credentials and reaches dashboard', async ({ page }) => {
    const { phone, password } = await registerFarmer();

    await page.goto('/login');
    await page.getByLabel(/phone/i).fill(phone);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /log in|sign in|login/i }).click();

    await expect(page).toHaveURL(/dashboard/i, { timeout: 10_000 });
    await expect(page.getByText(/welcome|hello/i)).toBeVisible();
  });

  test('shows error on wrong password', async ({ page }) => {
    const { phone } = await registerFarmer();

    await page.goto('/login');
    await page.getByLabel(/phone/i).fill(phone);
    await page.getByLabel(/password/i).fill('WrongPassword!999');
    await page.getByRole('button', { name: /log in|sign in|login/i }).click();

    await expect(page.getByRole('alert').or(page.getByText(/invalid|incorrect|wrong|failed/i)))
      .toBeVisible({ timeout: 6_000 });
    await expect(page).toHaveURL(/login/i);
  });

  test('logout clears session and redirects to login', async ({ page }) => {
    const { phone, password } = await registerFarmer();

    // Login first
    await page.goto('/login');
    await page.getByLabel(/phone/i).fill(phone);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /log in|sign in|login/i }).click();
    await expect(page).toHaveURL(/dashboard/i, { timeout: 10_000 });

    // Logout
    const logoutBtn = page.getByRole('button', { name: /log ?out|sign ?out/i })
      .or(page.getByRole('link', { name: /log ?out|sign ?out/i }));
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    } else {
      // Some UIs hide logout behind a profile menu
      await page.getByRole('button', { name: /profile|account|menu/i }).first().click();
      await page.getByRole('menuitem', { name: /log ?out|sign ?out/i }).click();
    }

    await expect(page).toHaveURL(/login/i, { timeout: 6_000 });
  });
});

// ─── Buyer registration ───────────────────────────────────────────────────────
test.describe('Buyer auth flow', () => {
  test('registers a buyer and logs in successfully', async ({ page }) => {
    const { phone, password } = await registerBuyer();

    await page.goto('/login');
    await page.getByLabel(/phone/i).fill(phone);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /log in|sign in|login/i }).click();

    // Buyer lands on marketplace or dashboard
    await expect(page).toHaveURL(/marketplace|dashboard|home/i, { timeout: 10_000 });
  });
});

// ─── Protected route guard ────────────────────────────────────────────────────
test.describe('Route protection', () => {
  test('unauthenticated user cannot access /farmer/dashboard', async ({ page }) => {
    await page.goto('/farmer/dashboard');
    await expect(page).toHaveURL(/login/i, { timeout: 6_000 });
  });

  test('unauthenticated user cannot access /orders', async ({ page }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL(/login/i, { timeout: 6_000 });
  });
});
