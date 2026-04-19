import { test, expect } from '@playwright/test';

// Fake Clerk JWT — the API validates via Clerk's JWKS endpoint, so these tests
// intercept API calls and return canned responses.  The auth header just needs
// to be present so the app's request() helper doesn't skip it.
const AUTH_TOKEN = 'test-e2e-token';

const MOCK_USER = {
  id: 'e2e-officer-1',
  clerk_id: 'clerk_e2e_1',
  company_id: 'comp-1',
  role: 'OFFICER',
  first_name: 'Test',
  last_name: 'Officer',
  email: 'officer@e2e.test',
  active: true,
  is_route_planner: false,
};

const MOCK_SITE = {
  id: 'site-1',
  name: 'E2E Test Site',
  address: '1 Test Street',
  company_id: 'comp-1',
};

const MOCK_SHIFT = {
  id: 'shift-1',
  site_id: 'site-1',
  officer_id: 'e2e-officer-1',
  start_time: new Date().toISOString(),
  checked_in_at: new Date().toISOString(),
  planned_end_time: new Date(Date.now() + 8 * 3600000).toISOString(),
  status: 'ACTIVE',
};

const MOCK_ROUTE = {
  id: 'route-1',
  site_id: 'site-1',
  name: 'Main Perimeter',
  checkpoints: [
    { id: 'cp-1', name: 'Front Gate', order_index: 0, lat: 52.48, lng: -1.89 },
    { id: 'cp-2', name: 'Car Park', order_index: 1, lat: 52.481, lng: -1.891 },
    { id: 'cp-3', name: 'Loading Bay', order_index: 2, lat: 52.482, lng: -1.892 },
  ],
};

const MOCK_SESSION = {
  id: 'session-1',
  site_id: 'site-1',
  route_id: 'route-1',
  status: 'ACTIVE',
};

// ---------------------------------------------------------------------------
// Helper: set up route interception so the SPA works without real auth / API
// ---------------------------------------------------------------------------
async function setupMocks(page, { withShift = false, withPatrolSession = false } = {}) {
  // Inject fake Clerk token getter before the app loads
  await page.addInitScript(() => {
    window.__clerkGetToken = () => Promise.resolve('test-e2e-token');
  });

  await page.setExtraHTTPHeaders({ Authorization: `Bearer ${AUTH_TOKEN}` });

  // Intercept all API calls to the backend
  const API = 'https://dob-live-api.onrender.com';

  await page.route(`${API}/health`, route =>
    route.fulfill({ json: { status: 'ok' } }));

  await page.route(`${API}/api/users/me*`, route =>
    route.fulfill({ json: { data: MOCK_USER } }));

  await page.route(`${API}/api/users?*`, route =>
    route.fulfill({ json: { data: [MOCK_USER] } }));

  await page.route(`${API}/api/users`, route =>
    route.fulfill({ json: { data: [MOCK_USER] } }));

  await page.route(`${API}/api/sites*`, route =>
    route.fulfill({ json: { data: [MOCK_SITE] } }));

  // Shifts — return active shift or empty depending on scenario
  await page.route(`${API}/api/shifts*`, route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ json: { data: MOCK_SHIFT } });
    }
    return route.fulfill({ json: { data: withShift ? [MOCK_SHIFT] : [] } });
  });

  await page.route(`${API}/api/shifts/start`, route =>
    route.fulfill({ json: { data: MOCK_SHIFT } }));

  await page.route(`${API}/api/shifts/*/checkin`, route =>
    route.fulfill({ json: { data: MOCK_SHIFT } }));

  // Logs
  await page.route(`${API}/api/logs*`, route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ json: { data: { id: 'log-new', ...JSON.parse(route.request().postData() || '{}') } } });
    }
    return route.fulfill({ json: { data: [] } });
  });

  // Patrols
  await page.route(`${API}/api/patrols/routes*`, route =>
    route.fulfill({ json: { data: [MOCK_ROUTE] } }));

  await page.route(`${API}/api/patrols/sessions/active*`, route => {
    if (withPatrolSession) {
      return route.fulfill({ json: { data: MOCK_SESSION } });
    }
    return route.fulfill({ json: { data: null } });
  });

  await page.route(`${API}/api/patrols/sessions/start`, route =>
    route.fulfill({ json: { data: MOCK_SESSION } }));

  await page.route(`${API}/api/patrols/sessions/*/checkpoint`, route =>
    route.fulfill({ json: { success: true } }));

  await page.route(`${API}/api/patrols/sessions/*/end`, route =>
    route.fulfill({ json: { success: true } }));

  await page.route(`${API}/api/patrols/sessions/*/gps`, route =>
    route.fulfill({ json: { success: true } }));

  // Tasks, messages, alerts, handovers, playbooks, instructions, etc.
  await page.route(`${API}/api/tasks*`, route =>
    route.fulfill({ json: { data: [] } }));

  await page.route(`${API}/api/messages*`, route =>
    route.fulfill({ json: { data: [] } }));

  await page.route(`${API}/api/alerts*`, route =>
    route.fulfill({ json: { data: [] } }));

  await page.route(`${API}/api/handovers*`, route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ json: { data: { id: 'ho-1' } } });
    }
    return route.fulfill({ json: { data: [] } });
  });

  await page.route(`${API}/api/playbooks/*`, route =>
    route.fulfill({ json: { playbook: null, tasks: [], checks: [] } }));

  await page.route(`${API}/api/instructions*`, route =>
    route.fulfill({ json: { data: null } }));

  await page.route(`${API}/api/policies*`, route =>
    route.fulfill({ json: { data: null } }));

  await page.route(`${API}/api/report/**`, route =>
    route.fulfill({ json: { data: null } }));

  // Catch-all for any other API calls
  await page.route(`${API}/api/**`, route =>
    route.fulfill({ json: { data: [] } }));
}

// Helper: navigate past site picker to home screen
async function selectSite(page) {
  await page.goto('/');
  // App loads → fetches /users/me → sees OFFICER role → shows site picker
  const siteBtn = page.getByText('E2E Test Site');
  await expect(siteBtn).toBeVisible({ timeout: 10000 });
  await siteBtn.click();
  // Should land on home screen
  await expect(page.getByText('Log Entry')).toBeVisible({ timeout: 5000 });
}

// ===========================================================================
// 1. Start Shift
// ===========================================================================
test.describe('Start Shift', () => {
  test('officer sees Start Shift, enters finish time, confirms, shift becomes active and Handover appears', async ({ page }) => {
    await setupMocks(page, { withShift: false });
    await selectSite(page);

    // Should see "Start Shift" button (no active shift)
    const startBtn = page.getByText('Start Shift', { exact: false }).first();
    await expect(startBtn).toBeVisible();

    // Click Start Shift — modal should appear
    await startBtn.click();
    await expect(page.getByText('Planned Finish Time')).toBeVisible({ timeout: 3000 });

    // Enter a finish time
    const timeInput = page.locator('input[type="time"]');
    await timeInput.fill('06:00');

    // The confirm button should be enabled now — re-route shifts to return active shift after start
    await page.route('https://dob-live-api.onrender.com/api/shifts*', route => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ json: { data: MOCK_SHIFT } });
      }
      return route.fulfill({ json: { data: [MOCK_SHIFT] } });
    });

    // Click the modal's "Start Shift" confirm button
    const confirmBtn = page.locator('button').filter({ hasText: 'Start Shift' }).last();
    await confirmBtn.click();

    // Shift should now be active — "Shift Active" badge and "End Shift / Handover" link appear
    await expect(page.getByText('Shift Active')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('End Shift / Handover')).toBeVisible();
  });
});

// ===========================================================================
// 2. Log Entry
// ===========================================================================
test.describe('Log Entry', () => {
  test('officer with active shift creates a PATROL log entry', async ({ page }) => {
    await setupMocks(page, { withShift: true });
    await selectSite(page);

    // Should see active shift
    await expect(page.getByText('Shift Active')).toBeVisible({ timeout: 5000 });

    // Tap Log Entry
    await page.getByText('Log Entry').click();
    await expect(page.getByText('New Log Entry')).toBeVisible({ timeout: 5000 });

    // Step 1: Select PATROL type
    const patrolBtn = page.getByText('PATROL', { exact: true }).first();
    await expect(patrolBtn).toBeVisible();
    await patrolBtn.click();

    // Step 2: Should advance to details — enter description
    await expect(page.getByText('WHAT HAPPENED')).toBeVisible({ timeout: 3000 });
    await page.locator('textarea').first().fill('Routine perimeter check completed, all secure.');

    // Click NEXT STEP
    await page.getByText('NEXT STEP').click();

    // Step 3: Review & Submit
    await expect(page.getByText('Review & Submit')).toBeVisible({ timeout: 3000 });

    // Submit
    await page.getByText(/SUBMIT.*REPORT/).click();

    // Should navigate back to home with success
    await expect(page.getByText('Log Entry')).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// 3. Patrol Start and Checkpoint
// ===========================================================================
test.describe('Patrol Start and Checkpoint', () => {
  test('officer starts patrol, sees checkpoints, marks one as completed', async ({ page }) => {
    await setupMocks(page, { withShift: true });
    await selectSite(page);

    // Tap Start Patrol
    await page.getByText('Start Patrol').click();

    // Should see patrol screen with the site name and route
    await expect(page.getByText('E2E Test Site')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Main Perimeter')).toBeVisible();

    // Click START PATROL button
    const startPatrolBtn = page.getByText('START PATROL', { exact: true });
    await expect(startPatrolBtn).toBeVisible({ timeout: 3000 });
    await startPatrolBtn.click();

    // Should show LIVE badge and checkpoints
    await expect(page.getByText('LIVE')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Front Gate')).toBeVisible();
    await expect(page.getByText('Car Park')).toBeVisible();
    await expect(page.getByText('Loading Bay')).toBeVisible();

    // Tap the "REACHED: Front Gate" button or click the checkpoint
    const reachedBtn = page.getByText(/REACHED.*Front Gate/);
    await expect(reachedBtn).toBeVisible();
    await reachedBtn.click();

    // Progress should update — 1 / 3
    await expect(page.getByText('1 / 3')).toBeVisible({ timeout: 3000 });
  });
});

// ===========================================================================
// 4. End Patrol
// ===========================================================================
test.describe('End Patrol', () => {
  test('officer on active patrol ends it via confirmation modal', async ({ page }) => {
    await setupMocks(page, { withShift: true, withPatrolSession: true });
    await selectSite(page);

    // Go to patrol screen
    await page.getByText('Start Patrol').click();
    await expect(page.getByText('E2E Test Site')).toBeVisible({ timeout: 5000 });

    // Should already show LIVE (active session restored)
    await expect(page.getByText('LIVE')).toBeVisible({ timeout: 5000 });

    // Click END PATROL
    await page.getByText('END PATROL').click();

    // Confirmation modal should appear
    await expect(page.getByText('End Patrol?')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('This will end your current patrol session')).toBeVisible();

    // Confirm
    await page.locator('button').filter({ hasText: 'End Patrol' }).last().click();

    // Should navigate back to home screen
    await expect(page.getByText('Log Entry')).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// 5. Handover
// ===========================================================================
test.describe('Handover', () => {
  test('officer with active shift opens handover page without crashing', async ({ page }) => {
    await setupMocks(page, { withShift: true });
    await selectSite(page);

    // Should see active shift with "End Shift / Handover" link
    await expect(page.getByText('End Shift / Handover')).toBeVisible({ timeout: 5000 });
    await page.getByText('End Shift / Handover').click();

    // Handover page should load — look for the summary textarea placeholder
    await expect(page.getByPlaceholder('Brief summary of the shift...')).toBeVisible({ timeout: 5000 });

    // Page should not have crashed — verify we can still interact
    const summaryInput = page.getByPlaceholder('Brief summary of the shift...');
    await summaryInput.fill('All quiet, no incidents.');
    await expect(summaryInput).toHaveValue('All quiet, no incidents.');
  });
});
