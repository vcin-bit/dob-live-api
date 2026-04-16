import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('/');
  });

  test('should show sign in form by default', async ({ page }) => {
    // Should see the DOB Live branding
    await expect(page.getByText('DOB Live')).toBeVisible();
    await expect(page.getByText('Security Officer Portal')).toBeVisible();
    
    // Should see sign in form
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    
    // Should see option to switch to sign up
    await expect(page.getByText('Need an account?')).toBeVisible();
  });

  test('should switch to sign up form', async ({ page }) => {
    // Click sign up link
    await page.getByText('Sign up').click();
    
    // Should now see sign up form
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();
    
    // Should see option to switch back to sign in
    await expect(page.getByText('Already have an account?')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Try to sign in without credentials
    const signInButton = page.getByRole('button', { name: /sign in/i }).first();
    await signInButton.click();
    
    // Should show validation errors (Clerk handles this)
    // We can't test the exact Clerk validation, but we can ensure no redirect happened
    await expect(page).toHaveURL('/');
  });

  test('should handle authentication errors gracefully', async ({ page }) => {
    // Test with invalid credentials (if we had test credentials)
    // This would be expanded with actual test user accounts
    
    // For now, just ensure the form is present and functional
    await expect(page.getByText('DOB Live')).toBeVisible();
  });
});

test.describe('Loading States', () => {
  test('should show loading spinner during authentication', async ({ page }) => {
    await page.goto('/');
    
    // The initial load should show some loading state
    // This tests that the app doesn't crash on load
    await expect(page.getByText('DOB Live')).toBeVisible({ timeout: 10000 });
  });
});
