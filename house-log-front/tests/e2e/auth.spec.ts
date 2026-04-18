import { test, expect } from '@playwright/test';

// Smoke — garante que as telas críticas de auth carregam e que os elementos
// principais estão visíveis. Não bate na API real; só testa a shell Next.js.

test.describe('auth smoke', () => {
  test('login page renderiza o formulário', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading')).toBeVisible();
    // Qualquer campo email aceita: busca por type="email" OU label contendo "email"
    const email = page.locator('input[type="email"]').first();
    await expect(email).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('register page renderiza o formulário', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('rota protegida redireciona quando sem sessão', async ({ page }) => {
    await page.goto('/dashboard');
    // Pode ir para /login ou para a home; o importante é NÃO permanecer em /dashboard autenticado
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url).not.toMatch(/\/dashboard($|\?)/);
  });
});
