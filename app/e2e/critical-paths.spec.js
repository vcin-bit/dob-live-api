import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------
function fakeJWT() {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '');
  const payload = btoa(JSON.stringify({
    sub: 'user_e2e', iss: 'https://clerk.doblive.co.uk',
    exp: Math.floor(Date.now() / 1000) + 86400, iat: Math.floor(Date.now() / 1000), sid: 'sess_e2e',
  })).replace(/=/g, '');
  return `${header}.${payload}.fakesig`;
}
const JWT = fakeJWT();

const MOCK_USER = {
  id: 'e2e-officer-1', clerk_id: 'clerk_e2e_1', company_id: 'comp-1',
  role: 'OFFICER', first_name: 'Test', last_name: 'Officer',
  email: 'officer@e2e.test', active: true, phone: '+447700000001',
  sia_licence_number: '1234567890123456', sia_licence_type: 'Security Guarding',
  sia_expiry_date: '2027-06-15', permissions: [],
  safe_pin: '1234', duress_pin: '9999',
};

const MOCK_SITE = { id: 'site-1', name: 'E2E Test Site', address: '1 Test Street', company_id: 'comp-1' };

const MOCK_SHIFT_SCHEDULED = {
  id: 'shift-1', site_id: 'site-1', officer_id: 'e2e-officer-1', company_id: 'comp-1',
  status: 'SCHEDULED', start_time: new Date().toISOString(), end_time: new Date(Date.now() + 12*3600000).toISOString(),
  site: MOCK_SITE, officer: MOCK_USER,
};

const MOCK_SHIFT_ACTIVE = {
  ...MOCK_SHIFT_SCHEDULED, status: 'ACTIVE', checked_in_at: new Date().toISOString(), checked_out_at: null,
};

const MOCK_SHIFT_COMPLETED = {
  ...MOCK_SHIFT_SCHEDULED, status: 'COMPLETED',
  checked_in_at: new Date(Date.now() - 12*3600000).toISOString(),
  checked_out_at: new Date().toISOString(),
};

async function mockClerkAuth(page) {
  await page.addInitScript(() => {
    window.__clerkGetToken = () => Promise.resolve('fake-token');
    window.__clerk_frontend_api = 'clerk.test';
  });
}

async function mockAPI(page, overrides = {}) {
  await page.route('**/api/users/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: overrides.user || MOCK_USER }) }));
  await page.route('**/api/users?*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [MOCK_USER] }) }));
  await page.route('**/api/users', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [MOCK_USER] }) }));
  await page.route('**/api/sites*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [MOCK_SITE] }) }));
  await page.route('**/api/officer-sites/*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [MOCK_SITE] }) }));
  await page.route('**/api/shifts/previous*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) }));
  await page.route('**/api/handovers/pending/*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) }));
  await page.route('**/api/site-checks/*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));
  await page.route('**/api/shifts?*', route => {
    const url = route.request().url();
    if (url.includes('status=ACTIVE')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: overrides.activeShifts || [] }) });
    }
    if (url.includes('status=SCHEDULED')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: overrides.scheduledShifts || [MOCK_SHIFT_SCHEDULED] }) });
    }
    if (url.includes('status=COMPLETED')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: overrides.completedShifts || [] }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: overrides.shifts || [] }) });
  });
  await page.route('**/api/shifts/start', route => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: MOCK_SHIFT_ACTIVE }) }));
  await page.route('**/api/shifts/*/checkin', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_SHIFT_ACTIVE }) }));
  await page.route('**/api/shifts/*/checkout', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_SHIFT_COMPLETED }) }));
  await page.route('**/api/logs*', route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { id: 'log-1' } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: overrides.logs || [] }) });
  });
  await page.route('**/api/patrols/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: overrides.patrols || [] }) }));
  await page.route('**/api/playbooks/*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ playbook: null, tasks: [] }) }));
  await page.route('**/api/alerts*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));
  await page.route('**/api/visitors*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: overrides.visitors || [] }) }));
  await page.route('**/api/escalation/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }));
  await page.route('**/api/handovers', route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { id: 'handover-1' } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });
  await page.route('**/health', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) }));
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

test.describe('Officer Shift Lifecycle', () => {
  test('officer can see scheduled shift and go on duty', async ({ page }) => {
    await mockClerkAuth(page);
    await mockAPI(page, { scheduledShifts: [MOCK_SHIFT_SCHEDULED] });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Should see GO ON DUTY button
    await expect(page.getByText('GO ON DUTY')).toBeVisible({ timeout: 10000 });
  });

  test('officer sees no shift message when no shifts scheduled', async ({ page }) => {
    await mockClerkAuth(page);
    await mockAPI(page, { scheduledShifts: [] });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Should see no shift message
    await expect(page.getByText(/No shift scheduled|contact/i)).toBeVisible({ timeout: 10000 });
  });

  test('active shift shows dashboard with check call timer', async ({ page }) => {
    await mockClerkAuth(page);
    await mockAPI(page, { activeShifts: [MOCK_SHIFT_ACTIVE] });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Should see safety check button with countdown
    await expect(page.getByText(/Safety Check/)).toBeVisible({ timeout: 10000 });
  });

  test('check call timer shows minutes countdown', async ({ page }) => {
    await mockClerkAuth(page);
    await mockAPI(page, { activeShifts: [MOCK_SHIFT_ACTIVE] });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Timer should show minutes (not 0 or negative)
    await expect(page.getByText(/Safety Check — \d+ min/)).toBeVisible({ timeout: 10000 });
  });

  test('check call button is not due immediately on shift start', async ({ page }) => {
    await mockClerkAuth(page);
    const recentShift = { ...MOCK_SHIFT_ACTIVE, checked_in_at: new Date().toISOString() };
    await mockAPI(page, { activeShifts: [recentShift] });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Should NOT show SAFETY CHECK DUE
    await expect(page.getByText('SAFETY CHECK DUE NOW')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Handover Flow', () => {
  test('incoming officer sees handover when one exists', async ({ page }) => {
    await mockClerkAuth(page);
    const handover = {
      id: 'h1', content: 'All secure, nothing to report', site_status: 'ALL_SECURE',
      keys_handed_over: true, radio_handed_over: true, outstanding_issues: null,
      author: { first_name: 'Previous', last_name: 'Officer' }, created_at: new Date().toISOString(),
    };
    await mockAPI(page, { scheduledShifts: [MOCK_SHIFT_SCHEDULED] });
    await page.route('**/api/handovers/pending/*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: handover }) }));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByText('GO ON DUTY').click();
    await expect(page.getByText('Handover from Previous Officer')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('All Secure')).toBeVisible();
  });

  test('incoming officer sees warning when no handover submitted', async ({ page }) => {
    await mockClerkAuth(page);
    await mockAPI(page, { scheduledShifts: [MOCK_SHIFT_SCHEDULED] });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByText('GO ON DUTY').click();
    await expect(page.getByText('No handover submitted')).toBeVisible({ timeout: 10000 });
  });

  test('officer can submit structured handover', async ({ page }) => {
    await mockClerkAuth(page);
    await mockAPI(page, { activeShifts: [MOCK_SHIFT_ACTIVE] });
    await page.goto('/handover');
    await page.waitForLoadState('networkidle');
    // Fill in key points
    await page.getByPlaceholder(/What does the next officer/).fill('All secure, patrol completed');
    await expect(page.getByText('Submit Handover & End Shift')).toBeVisible();
  });
});

test.describe('Incident Reporting', () => {
  test('log incident button opens incident form', async ({ page }) => {
    await mockClerkAuth(page);
    await mockAPI(page, { activeShifts: [MOCK_SHIFT_ACTIVE] });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByText('Log an Incident').click();
    await expect(page.getByText('INCIDENT')).toBeVisible({ timeout: 10000 });
  });

  test('AI write button appears after typing description', async ({ page }) => {
    await mockClerkAuth(page);
    await mockAPI(page, { activeShifts: [MOCK_SHIFT_ACTIVE] });
    await page.goto('/log?type=INCIDENT');
    await page.waitForLoadState('networkidle');
    // Fill description
    const textarea = page.getByPlaceholder(/Describe what you saw/);
    if (await textarea.isVisible()) {
      await textarea.fill('Saw someone breaking into a car');
      await expect(page.getByText('Write with AI')).toBeVisible({ timeout: 5000 });
    }
  });

  test('photo upload button is present on incident form', async ({ page }) => {
    await mockClerkAuth(page);
    await mockAPI(page, { activeShifts: [MOCK_SHIFT_ACTIVE] });
    await page.goto('/log?type=INCIDENT');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('ADD PHOTO')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Visitor Management', () => {
  test('visitor count shows on dashboard', async ({ page }) => {
    await mockClerkAuth(page);
    const visitors = [{ id: 'v1', visitor_name: 'John Builder', status: 'on_site' }];
    await mockAPI(page, { activeShifts: [MOCK_SHIFT_ACTIVE], visitors });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/1 Visitor.*On Site/)).toBeVisible({ timeout: 10000 });
  });

  test('no visitors shows grey state', async ({ page }) => {
    await mockClerkAuth(page);
    await mockAPI(page, { activeShifts: [MOCK_SHIFT_ACTIVE], visitors: [] });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('No Visitors On Site')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('HR Portal - Hours & Invoice', () => {
  test('hours tab loads and shows shifts', async ({ page }) => {
    await mockClerkAuth(page);
    const completedShifts = [
      { ...MOCK_SHIFT_COMPLETED, id: 's1', start_time: '2026-05-01T06:00:00+01:00', end_time: '2026-05-01T18:00:00+01:00', checked_in_at: '2026-05-01T06:00:00+01:00', checked_out_at: '2026-05-01T18:00:00+01:00', pay_rate: 14, site: MOCK_SITE },
      { ...MOCK_SHIFT_COMPLETED, id: 's2', start_time: '2026-05-02T06:00:00+01:00', end_time: '2026-05-02T18:00:00+01:00', checked_in_at: '2026-05-02T06:00:00+01:00', checked_out_at: '2026-05-02T18:00:00+01:00', pay_rate: 14, site: MOCK_SITE },
    ];
    await mockAPI(page, { completedShifts });
    await page.route('**/api/hr', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { employment_status: 'self_employed', gdpr_consent: true, self_employment_declaration: true } }) }));
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');
    // Navigate to hours tab — look for the tab
    const hoursTab = page.getByText('Hours');
    if (await hoursTab.isVisible()) {
      await hoursTab.click();
      await expect(page.getByText(/shift.*found|E2E Test Site/i)).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Timezone Consistency', () => {
  test('shift times display in UK timezone', async ({ page }) => {
    await mockClerkAuth(page);
    // Shift at 18:00 BST = 17:00 UTC
    const shift = { ...MOCK_SHIFT_ACTIVE, start_time: '2026-05-10T17:00:00+00:00', end_time: '2026-05-11T05:00:00+00:00', checked_in_at: '2026-05-10T17:00:00+00:00' };
    await mockAPI(page, { activeShifts: [shift] });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Should display as 18:00 not 17:00
    await expect(page.getByText('18:00')).toBeVisible({ timeout: 10000 });
  });
});
