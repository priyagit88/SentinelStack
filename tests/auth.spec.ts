import { test, expect } from '@playwright/test';
import { MailClient } from './utils/mail-client';

test.describe('Authentication Flows & Identity Security', () => {
  let mailClient: MailClient;

  test.beforeAll(() => {
    mailClient = new MailClient();
  });

  test('Registration with Email OTP Verification', async ({ page }, testInfo) => {
    const testEmail = MailClient.generateTestEmail(testInfo.workerIndex);
    const testName = 'QA Tester';
    const testPassword = 'Password123!';

    await page.goto('/register');
    await page.fill('input[name="name"]', testName);
    await page.waitForTimeout(500);
    await page.fill('input[name="email"]', testEmail);
    await page.waitForTimeout(500);
    await page.fill('input[name="password"]', testPassword);
    await page.waitForTimeout(1000); // Ensure > 1.5s total

    await page.click('button:has-text("Register Securely")');
    await expect(page).toHaveURL(/verify-request/);
    await page.click('button:has-text("One-Time Passcode")');
    await expect(page).toHaveURL(/verify-otp/);

    const email = await mailClient.getLatestEmail(testEmail);
    const otp = mailClient.extractOtp(email.body);
    
    const otpInputs = page.locator('input[inputmode="numeric"]');
    for (let i = 0; i < 6; i++) {
      await otpInputs.nth(i).fill(otp[i] || '0');
    }

    await expect(page).toHaveURL('/profile', { timeout: 15000 });
    await expect(page.locator('h1')).toContainText(testName);
  });

  test('Magic Link Closed-Loop Sign In', async ({ page }, testInfo) => {
    const testEmail = MailClient.generateTestEmail(testInfo.workerIndex);
    
    await page.goto('/register');
    await page.fill('input[name="name"]', 'Magic User');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'Password123!');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Register Securely")');
    
    await page.click('button:has-text("Magic Link")');
    await expect(page.locator('text=Check Your Inbox')).toBeVisible();

    const email = await mailClient.getLatestEmail(testEmail);
    const magicLink = mailClient.extractLink(email.body);
    await page.goto(magicLink);

    await expect(page).toHaveURL('/profile');
    await expect(page.locator('text=Verified')).toBeVisible();
  });

  test('OAuth Email Bypass (Hackathon Demo 4)', async ({ page }) => {
    const oauthEmail = 'achintyak30@gmail.com'; // Known social email from demo

    await page.goto('/register');
    await page.fill('input[name="name"]', 'Evil Twin');
    await page.fill('input[name="email"]', oauthEmail);
    await page.fill('input[name="password"]', 'NewPassword123!');
    await page.click('button:has-text("Register Securely")');

    const errorMsg = page.locator('p.text-red-300');
    await expect(errorMsg).toContainText('registered via Social Login');
  });
});
