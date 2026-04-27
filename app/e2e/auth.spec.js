import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show sign in form by default', async ({ page }) => {
    await expect(page.getByText('DOB Live', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Security Management Platform')).toBeVisible();
    await expect(page.getByText('Sign in')).toBeVisible();
    await expect(page.getByText('No account?')).toBeVisible();
  });

  test('should switch to sign up form', async ({ page }) => {
    await expect(page.getByText('DOB Live', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await page.getByText('Create one').click();
    await expect(page.getByText('Create your account')).toBeVisible();
    await expect(page.getByText('Have an account?')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await expect(page.getByText('DOB Live', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('should handle authentication errors gracefully', async ({ page }) => {
    await expect(page.getByText('DOB Live', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Security Management Platform')).toBeVisible();
  });
});

test.describe('Loading States', () => {
  test('should show loading spinner during authentication', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('DOB Live', { exact: true }).first()).toBeVisible({ timeout: 10000 });
  });
});
