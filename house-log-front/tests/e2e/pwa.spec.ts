import { test, expect } from '@playwright/test';

// Verifica que o PWA está minimamente saudável: manifest e SW servidos,
// página /offline disponível.
test.describe('pwa smoke', () => {
  test('manifest.json responde', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('name');
  });

  test('sw.js responde', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body).toContain('addEventListener');
  });

  test('/offline renderiza', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.locator('body')).toBeVisible();
  });
});
