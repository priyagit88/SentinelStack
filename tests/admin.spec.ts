import { test, expect } from '@playwright/test';

test.describe('Admin Control Panel Audit (Hackathon Finale)', () => {

  test('Admin Dashboard Visual Validation', async ({ page }) => {
    // 1. Login as Admin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'achintyak30@gmail.com');
    await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD || 'AdminSecurePassword123!');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL('/profile');

    // 2. Navigate to Admin
    await page.goto('/admin');

    // 3. Assert WebGL Globe
    const globe = page.locator('article:has-text("Global Session Intelligence")');
    await expect(globe).toBeVisible();
    await expect(globe.locator('canvas')).toBeVisible();

    // 4. Assert Security Feed
    const feed = page.locator('article:has-text("Security Feed")');
    await expect(feed).toBeVisible();

    // 5. Look for Hackathon Events
    // We expect some events to be there if other tests ran, 
    // but we check for the structure regardless.
    await expect(page.locator('text=Active Sessions')).toBeVisible();
    await expect(page.locator('text=Flagged Nodes')).toBeVisible();
  });
});
