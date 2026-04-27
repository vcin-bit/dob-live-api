import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Fake JWT — structurally valid so Clerk's SDK accepts it
// ---------------------------------------------------------------------------
function fakeJWT() {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '');
  const payload = btoa(JSON.stringify({
    sub: 'user_e2e',
    iss: 'https://clerk.doblive.co.uk',
    exp: Math.floor(Date.now() / 1000) + 86400,
    iat: Math.floor(Date.now() / 1000),
    sid: 'sess_e2e',
  })).replace(/=/g, '');
  return `${header}.${payload}.fakesig`;
}

const JWT = fakeJWT();

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
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

// Clerk /v1/client response — simulates a signed-in session
function clerkClientResponse() {
  return {
    response: {
      object: 'client',
      id: 'client_e2e',
      sessions: [{
        object: 'session',
        id: 'sess_e2e',
        status: 'active',
        expire_at: Date.now() + 86400000,
        abandon_at: Date.now() + 86400000 * 7,
        last_active_at: Date.now(),
        last_active_organization_id: null,
        actor: null,
        user: {
          object: 'user', id: 'user_e2e', external_id: null,
          primary_email_address_id: 'idn_e2e', primary_phone_number_id: null,
          primary_web3_wallet_id: null, username: null,
          first_name: 'Test', last_name: 'Officer',
          profile_image_url: '', image_url: '', has_image: false,
          email_addresses: [{
            id: 'idn_e2e', object: 'email_address', email_address: 'officer@e2e.test',
            verification: { status: 'verified', strategy: 'email_code' }, linked_to: [],
          }],
          phone_numbers: [], web3_wallets: [], external_accounts: [],
          password_enabled: true, two_factor_enabled: false, totp_enabled: false, backup_code_enabled: false,
          public_metadata: {}, unsafe_metadata: {},
          created_at: Date.now() - 86400000, updated_at: Date.now(),
          last_sign_in_at: Date.now(), last_active_at: Date.now(),
        },
        public_user_data: {
          first_name: 'Test', last_name: 'Officer',
          profile_image_url: '', image_url: '', has_image: false,
          identifier: 'officer@e2e.test',
        },
        created_at: Date.now() - 3600000,
        updated_at: Date.now(),
        last_active_token: { object: 'token', jwt: JWT },
      }],
      sign_in: null, sign_up: null,
      last_active_session_id: 'sess_e2e',
      cookie_expires_at: Date.now() + 86400000,
      created_at: Date.now() - 86400000,
      updated_at: Date.now(),
    },
    client: null,
  };
}

// ---------------------------------------------------------------------------
// URL matcher helper — matches if the pathname includes the given segment
// ---------------------------------------------------------------------------
function urlIncludes(segment) {
  return url => new URL(url).pathname.includes(segment);
}

// ---------------------------------------------------------------------------
// Setup: Clerk auth bypass + API mocks
// ---------------------------------------------------------------------------
async function setupMocks(page, context, { withShift = false, withPatrolSession = false } = {}) {
  // Set cookies so Clerk SDK treats the session as active
  await context.addCookies([
    { name: '__session', value: JWT, domain: 'app.doblive.co.uk', path: '/', secure: true, sameSite: 'Lax' },
    { name: '__client_uat', value: String(Math.floor(Date.now() / 1000)), domain: 'app.doblive.co.uk', path: '/', secure: true, sameSite: 'Lax' },
  ]);

  // Inject fake token getter
  await page.addInitScript(() => {
    window.__clerkGetToken = () => Promise.resolve('test-e2e-token');
  });

  // --- Clerk API mocks ---
  await page.route('**/v1/client?*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(clerkClientResponse()) }));

  await page.route('**/v1/client/sessions/**/tokens**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ object: 'token', jwt: JWT }) }));

  await page.route('**/v1/client/sessions/**/touch**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(clerkClientResponse()) }));

  // --- API mocks (use function matchers for reliable URL matching) ---
  await page.route(url => url.toString().includes('/api/users/me'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_USER }) }));

  // /api/users/:id/sites — officer site assignments
  await page.route(url => /\/api\/users\/[^/]+\/sites/.test(url.toString()), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [MOCK_SITE] }) }));

  await page.route(url => { const s = url.toString(); return s.includes('/api/users') && !s.includes('/me') && !s.includes('/sites'); }, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [MOCK_USER] }) }));

  await page.route(url => url.toString().includes('/api/sites'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [MOCK_SITE] }) }));

  await page.route(url => url.toString().includes('/api/shifts'), route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_SHIFT }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: withShift ? [MOCK_SHIFT] : [] }) });
  });

  await page.route(url => url.toString().includes('/api/logs'), route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'log-new' } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });

  await page.route(url => url.toString().includes('/api/patrols/routes'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [MOCK_ROUTE] }) }));

  await page.route(url => url.toString().includes('/api/patrols/sessions/active'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: withPatrolSession ? MOCK_SESSION : null }) }));

  await page.route(url => url.toString().includes('/api/patrols/sessions') && url.toString().includes('/start'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_SESSION }) }));

  await page.route(url => url.toString().includes('/api/patrols/sessions') && url.toString().includes('/checkpoint'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }));

  await page.route(url => url.toString().includes('/api/patrols/sessions') && url.toString().includes('/end'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }));

  await page.route(url => { const s = url.toString(); return s.includes('/api/patrols/sessions') && s.includes('/gps'); }, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }));

  await page.route(url => url.toString().includes('/api/tasks'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));

  await page.route(url => url.toString().includes('/api/messages'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));

  await page.route(url => url.toString().includes('/api/alerts'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));

  await page.route(url => url.toString().includes('/api/handovers'), route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'ho-1' } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });

  await page.route(url => url.toString().includes('/api/playbooks'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ playbook: null, tasks: [], checks: [] }) }));

  await page.route(url => url.toString().includes('/api/instructions'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) }));

  await page.route(url => url.toString().includes('/api/policies'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) }));

  await page.route(url => url.toString().includes('/api/report'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) }));

  // Catch-all for any other API calls (health, undefined, etc.)
  await page.route(url => url.toString().includes('/health') || url.toString().includes('/undefined/'), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) }));
}

// Navigate past site picker to home screen
async function selectSite(page, { hasShift = false } = {}) {
  await page.goto('/');
  const siteBtn = page.getByText('E2E Test Site');
  await expect(siteBtn).toBeVisible({ timeout: 15000 });
  await siteBtn.click();
  // If no active shift, the shift modal auto-opens — dismiss it
  if (!hasShift) {
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await expect(cancelBtn).toBeVisible({ timeout: 3000 });
    await cancelBtn.click();
  }
  await expect(page.getByText('Log Occurrence')).toBeVisible({ timeout: 5000 });
}

// ===========================================================================
// 1. Start Shift
// ===========================================================================
test.describe('Start Shift', () => {
  test('officer sees Start Shift, enters finish time, confirms, shift becomes active and Handover appears', async ({ page, context }) => {
    await setupMocks(page, context, { withShift: false });
    // Select site — modal auto-opens, don't dismiss it
    await page.goto('/');
    await expect(page.getByText('E2E Test Site')).toBeVisible({ timeout: 15000 });
    await page.getByText('E2E Test Site').click();

    // Modal should already be visible (auto-opened after site selection)
    await expect(page.getByText('Planned Finish Time')).toBeVisible({ timeout: 5000 });

    const timeInput = page.locator('input[type="time"]');
    await timeInput.fill('06:00');

    // After start, shifts endpoint returns active shift
    await page.route(url => url.toString().includes('/api/shifts'), route => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_SHIFT }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [MOCK_SHIFT] }) });
    });

    const confirmBtn = page.locator('button').filter({ hasText: 'Start Shift' }).last();
    await confirmBtn.click();

    await expect(page.getByText('Shift Active')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('End Shift / Handover')).toBeVisible();
  });
});

// ===========================================================================
// 2. Log Entry
// ===========================================================================
test.describe('Log Entry', () => {
  test('officer with active shift creates a PATROL log entry', async ({ page, context }) => {
    await setupMocks(page, context, { withShift: true });
    await selectSite(page, { hasShift: true });

    await expect(page.getByText('Shift Active')).toBeVisible({ timeout: 5000 });

    await page.getByText('Log Occurrence').click();
    // Log Occurrence links to /log?type=GENERAL — single page form
    await expect(page.getByText('Description', { exact: false })).toBeVisible({ timeout: 5000 });

    await page.locator('textarea').first().fill('Routine perimeter check completed, all secure.');

    await page.getByRole('button', { name: 'LOG OCCURRENCE' }).click();

    await expect(page.getByText('Log Occurrence')).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// 3. Patrol Start and Checkpoint
// ===========================================================================
test.describe('Patrol Start and Checkpoint', () => {
  test('officer starts patrol, sees checkpoints, marks one as completed', async ({ page, context }) => {
    await setupMocks(page, context, { withShift: true });
    await selectSite(page, { hasShift: true });

    await page.getByText('Start Patrol').click();

    await expect(page.getByText('E2E Test Site').first()).toBeVisible({ timeout: 5000 });

    // Route selector should appear — select Main Perimeter
    const routeBtn = page.getByRole('button', { name: /Main Perimeter/ });
    await expect(routeBtn).toBeVisible({ timeout: 5000 });
    await routeBtn.click();

    // Start patrol with selected route
    const startPatrolBtn = page.getByRole('button', { name: /START PATROL/ });
    await expect(startPatrolBtn).toBeVisible({ timeout: 3000 });
    await startPatrolBtn.click();

    await expect(page.getByText('● LIVE')).toBeVisible({ timeout: 3000 });

    // Checkpoints from the route should be visible
    await expect(page.getByText('Front Gate').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Car Park').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Loading Bay').first()).toBeVisible({ timeout: 3000 });

    // Mark first checkpoint as reached via All Clear button
    const allClearBtn = page.getByRole('button', { name: /All Clear/ }).first();
    await expect(allClearBtn).toBeVisible({ timeout: 3000 });
    await allClearBtn.click();

    await expect(page.getByText('1 / 3')).toBeVisible({ timeout: 3000 });
  });
});

// ===========================================================================
// 4. End Patrol
// ===========================================================================
test.describe('End Patrol', () => {
  test('officer on active patrol ends it via confirmation modal', async ({ page, context }) => {
    await setupMocks(page, context, { withShift: true, withPatrolSession: true });
    await selectSite(page, { hasShift: true });

    await page.getByText('Start Patrol').click();
    await expect(page.getByText('E2E Test Site').first()).toBeVisible({ timeout: 5000 });

    await expect(page.getByText('● LIVE')).toBeVisible({ timeout: 5000 });

    await page.getByText('END PATROL').click();

    await expect(page.getByText('End Patrol?')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('This will end your current patrol session')).toBeVisible();

    await page.locator('button').filter({ hasText: 'End Patrol' }).last().click();

    await expect(page.getByText('Log Occurrence')).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// 5. Handover
// ===========================================================================
test.describe('Handover', () => {
  test('officer with active shift opens handover page without crashing', async ({ page, context }) => {
    await setupMocks(page, context, { withShift: true });
    await selectSite(page, { hasShift: true });

    await expect(page.getByText('End Shift / Handover')).toBeVisible({ timeout: 5000 });
    await page.getByText('End Shift / Handover').click();

    await expect(page.getByPlaceholder('Brief summary of the shift...')).toBeVisible({ timeout: 5000 });

    const summaryInput = page.getByPlaceholder('Brief summary of the shift...');
    await summaryInput.fill('All quiet, no incidents.');
    await expect(summaryInput).toHaveValue('All quiet, no incidents.');
  });
});

// ===========================================================================
// 6. Sign Out
// ===========================================================================
test.describe('Sign Out', () => {
  test('sign out modal appears, cancel dismisses it', async ({ page, context }) => {
    await setupMocks(page, context, { withShift: false });
    await selectSite(page);

    // Tap Sign Out in the bottom nav
    await page.getByText('Sign Out').click();

    // Confirmation modal should appear
    await expect(page.getByText('Sign Out?')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Please ensure your handover is complete')).toBeVisible();

    // Cancel button should dismiss the modal
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Modal should be gone, home screen still visible
    await expect(page.getByText('Sign Out?')).not.toBeVisible({ timeout: 2000 });
    await expect(page.getByText('Log Occurrence')).toBeVisible();
  });
});

// ===========================================================================
// 7. Log Entry Without Active Shift
// ===========================================================================
test.describe('Log Entry Without Active Shift', () => {
  test('officer with no shift can still submit a log entry', async ({ page, context }) => {
    let capturedLogBody = null;
    await setupMocks(page, context, { withShift: false });

    // Override logs route to capture the POST body
    await page.route(url => url.toString().includes('/api/logs'), route => {
      if (route.request().method() === 'POST') {
        capturedLogBody = JSON.parse(route.request().postData() || '{}');
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'log-no-shift' } }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });

    await selectSite(page);

    // No shift active — should see "Start Shift" not "Shift Active"
    await expect(page.getByText('Shift Active')).not.toBeVisible({ timeout: 2000 });

    // Tap Log Occurrence — goes to /log?type=GENERAL, skips step 1
    await page.getByText('Log Occurrence').click();

    // Single page GENERAL form
    await expect(page.getByText('Description', { exact: false })).toBeVisible({ timeout: 5000 });
    await page.locator('textarea').first().fill('General observation logged without active shift.');

    // Submit directly
    await page.getByRole('button', { name: 'LOG OCCURRENCE' }).click();

    // Should return to home without crashing
    await expect(page.getByText('Log Occurrence')).toBeVisible({ timeout: 5000 });

    // Verify shift_id was null in the POST body
    expect(capturedLogBody).toBeTruthy();
    expect(capturedLogBody.shift_id).toBeNull();
  });
});

// ===========================================================================
// 8. Patrol Screen Loads Without Crashing
// ===========================================================================
test.describe('Patrol Screen Loads', () => {
  test('patrol screen renders start button and no JS errors', async ({ page, context }) => {
    await setupMocks(page, context, { withShift: true });

    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await selectSite(page, { hasShift: true });

    await page.getByText('Start Patrol').click();

    // Site name visible in patrol header
    await expect(page.getByText('E2E Test Site').first()).toBeVisible({ timeout: 5000 });

    // START PATROL button is visible
    await expect(page.getByText(/START PATROL/)).toBeVisible({ timeout: 3000 });

    // No JS errors should have been thrown
    expect(jsErrors).toHaveLength(0);
  });
});

// ===========================================================================
// 9. Shift Start Modal Cancel
// ===========================================================================
test.describe('Shift Start Modal', () => {
  test('cancel dismisses the modal without starting a shift', async ({ page, context }) => {
    await setupMocks(page, context, { withShift: false });
    // Select site — modal auto-opens
    await page.goto('/');
    await expect(page.getByText('E2E Test Site')).toBeVisible({ timeout: 15000 });
    await page.getByText('E2E Test Site').click();

    // Modal should already be visible (auto-opened)
    await expect(page.getByText('Planned Finish Time')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="time"]')).toBeVisible();

    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Modal should be dismissed
    await expect(page.getByText('Planned Finish Time')).not.toBeVisible({ timeout: 2000 });

    // Should still be on home screen with no active shift
    await expect(page.getByText('Start Shift', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Shift Active')).not.toBeVisible({ timeout: 1000 });
  });
});
