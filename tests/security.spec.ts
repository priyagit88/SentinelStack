import { test, expect } from '@playwright/test';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sentinelstack';

test.describe('Cybersecurity Heuristic & Threat Detection', () => {

  test('Honeypot Bot Detection (Hackathon Demo 1)', async ({ page }) => {
    await page.goto('/register');
    const email = `bot-${Date.now()}@example.com`;
    await page.fill('input[name="name"]', 'Bot User');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'BotPassword123!');

    // Force fill hidden honeypot
    await page.locator('input[name="website"]').evaluate((el: HTMLInputElement) => {
      el.value = 'http://malicious-site.com';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.click('button:has-text("Register Securely")');

    // Silent drop: App redirects to login with success message but user isn't created
    await expect(page).toHaveURL(/login\?registered=1/);

    // DB Verification: Confirm the log was created in Atlas
    const client = new MongoClient(MONGODB_URI);
    try {
      await client.connect();
      const db = client.db();
      const log = await db.collection('securityLog').findOne({ type: 'HONEYPOT', 'metadata.email': email });
      expect(log).not.toBeNull();
      console.log(`✅ Verified HONEYPOT log in DB for ${email}`);
    } finally {
      await client.close();
    }
  });

  test('Velocity Bot Detection (Hackathon Demo 2)', async ({ page }) => {
    await page.goto('/register');
    const fastEmail = `fast-${Date.now()}@example.com`;

    // Instant submission (< 1500ms)
    await page.evaluate((email) => {
      const name = document.querySelector('input[name="name"]') as HTMLInputElement;
      const mail = document.querySelector('input[name="email"]') as HTMLInputElement;
      const pass = document.querySelector('input[name="password"]') as HTMLInputElement;
      const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement;

      name.value = 'Fast Bot';
      mail.value = email;
      pass.value = 'FastPass123!';
      
      [name, mail, pass].forEach(i => i.dispatchEvent(new Event('input', { bubbles: true })));
      btn.click();
    }, fastEmail);

    await expect(page).toHaveURL(/verify-request/);
  });

  test('Brute Force Login Attack (Hackathon Demo 3)', async ({ page }) => {
    const targetEmail = 'achintyak30@gmail.com';
    
    for (let i = 0; i < 3; i++) { // 3 attempts for brevity
      await page.goto('/login');
      await page.fill('input[name="email"]', targetEmail);
      await page.fill('input[name="password"]', `wrong-${i}`);
      await page.click('button:has-text("Sign In")');
      await expect(page.locator('text=Login failed')).toBeVisible();
    }
  });

  test('Impossible Travel Detection (Hackathon Demo 5)', async ({ page, context }) => {
    const testEmail = `traveler-${Date.now()}@example.com`;
    const testPass = 'Password123!';

    // First login from Bengaluru (Mock)
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
    await page.goto('/register');
    await page.fill('input[name="name"]', 'Traveler');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPass);
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Register Securely")');
    
    // Login to create session 1
    await page.goto('/login');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPass);
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL('/profile');

    // Second login from New York (Mock) within same minute
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': '10.0.0.1' });
    await page.goto('/login');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPass);
    await page.click('button:has-text("Sign In")');

    await expect(page).toHaveURL('/profile');
    
    // Check risk status on profile
    await expect(page.locator('text=Elevated Risk')).toBeVisible();
  });
});
