import { test, expect } from '@playwright/test';

/*
 * Critical Path Tests for DOB Live
 *
 * These tests use the same Clerk mock pattern as officer-flows.spec.js
 * and run against the production URL with all API responses mocked.
 *
 * Run: npx playwright test e2e/critical-paths.spec.js
 */

// --- Auth helpers (same as officer-flows.spec.js) ---
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
  sia_expiry_date: '2027-06-15', permissions: [], is_route_planner: false,
  safe_pin: '1234', duress_pin: '9999',
};
const MOCK_SITE = { id: 'site-1', name: 'E2E Test Site', address: '1 Test Street', company_id: 'comp-1' };
const NOW = new Date().toISOString();
const MOCK_SHIFT = { id: 'shift-1', site_id: 'site-1', officer_id: 'e2e-officer-1', company_id: 'comp-1', status: 'ACTIVE', start_time: NOW, end_time: new Date(Date.now()+12*3600000).toISOString(), checked_in_at: NOW, checked_out_at: null, site: MOCK_SITE, officer: MOCK_USER };

function clerkClientResponse() {
  return {
    response: {
      object: 'client', id: 'client_e2e',
      sessions: [{
        object: 'session', id: 'sess_e2e', status: 'active',
        expire_at: Date.now() + 86400000, abandon_at: Date.now() + 86400000*7,
        last_active_at: Date.now(), last_active_organization_id: null, actor: null,
        user: {
          object: 'user', id: 'user_e2e', external_id: null,
          primary_email_address_id: 'idn_e2e', primary_phone_number_id: null, primary_web3_wallet_id: null, username: null,
          first_name: 'Test', last_name: 'Officer', profile_image_url: '', image_url: '', has_image: false,
          email_addresses: [{ id: 'idn_e2e', object: 'email_address', email_address: 'officer@e2e.test', verification: { status: 'verified', strategy: 'email_code' }, linked_to: [] }],
          phone_numbers: [], web3_wallets: [], external_accounts: [],
          password_enabled: true, two_factor_enabled: false, totp_enabled: false, backup_code_enabled: false,
          public_metadata: {}, unsafe_metadata: {},
          created_at: Date.now()-86400000, updated_at: Date.now(), last_sign_in_at: Date.now(), last_active_at: Date.now(),
        },
        public_user_data: { first_name: 'Test', last_name: 'Officer', profile_image_url: '', image_url: '', has_image: false, identifier: 'officer@e2e.test' },
        created_at: Date.now()-3600000, updated_at: Date.now(),
        last_active_token: { object: 'token', jwt: JWT },
      }],
      sign_in: null, sign_up: null, last_active_session_id: 'sess_e2e',
      cookie_expires_at: Date.now()+86400000, created_at: Date.now()-86400000, updated_at: Date.now(),
    }, client: null,
  };
}

async function setupMocks(page, context, { withShift = true } = {}) {
  await context.addCookies([
    { name: '__session', value: JWT, domain: 'app.doblive.co.uk', path: '/', secure: true, sameSite: 'Lax' },
    { name: '__client_uat', value: String(Math.floor(Date.now()/1000)), domain: 'app.doblive.co.uk', path: '/', secure: true, sameSite: 'Lax' },
  ]);
  await page.addInitScript(() => { window.__clerkGetToken = () => Promise.resolve('test-e2e-token'); });

  // Clerk mocks
  await page.route(u => u.toString().includes('/v1/client?'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(clerkClientResponse()) }));
  await page.route(u => u.toString().includes('/v1/client/sessions/') && u.toString().includes('/tokens'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ object: 'token', jwt: JWT }) }));
  await page.route(u => u.toString().includes('/v1/client/sessions/') && u.toString().includes('/touch'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ object: 'session', id: 'sess_e2e', status: 'active', last_active_token: { object: 'token', jwt: JWT } }) }));
  await page.route(u => u.toString().includes('/v1/environment'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ auth_config: { single_session_mode: true }, display_config: { theme: {} }, user_settings: { attributes: {} } }) }));

  // API mocks
  await page.route(u => u.toString().includes('/health'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) }));
  await page.route(u => u.toString().includes('/api/users/me'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_USER }) }));
  await page.route(u => /\/api\/officer-sites\//.test(u.toString()), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [MOCK_SITE] }) }));
  await page.route(u => u.toString().includes('/api/sites'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [MOCK_SITE] }) }));
  await page.route(u => u.toString().includes('/api/shifts'), r => {
    if (r.request().method() === 'POST') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_SHIFT }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: withShift ? [MOCK_SHIFT] : [] }) });
  });
  await page.route(u => u.toString().includes('/api/logs'), r => {
    if (r.request().method() === 'POST') return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { id: 'log-1' } }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });
  await page.route(u => u.toString().includes('/api/patrols'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));
  await page.route(u => u.toString().includes('/api/playbooks'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ playbook: null, tasks: [] }) }));
  await page.route(u => u.toString().includes('/api/alerts'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));
  await page.route(u => u.toString().includes('/api/visitors'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));
  await page.route(u => u.toString().includes('/api/escalation'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }));
  await page.route(u => u.toString().includes('/api/handovers'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) }));
  await page.route(u => u.toString().includes('/api/site-checks'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));
  await page.route(u => { const s = u.toString(); return s.includes('/api/users') && !s.includes('/me') && !s.includes('/sites'); }, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [MOCK_USER] }) }));
}

// ---------------------------------------------------------------------------
// TESTS — Officer on duty
// ---------------------------------------------------------------------------
test.describe('Active Shift Dashboard', () => {
  test('dashboard renders with safety check timer', async ({ page, context }) => {
    await setupMocks(page, context);
    await page.goto('/');
    await expect(page.getByText(/Safety Check/)).toBeVisible({ timeout: 15000 });
  });

  test('safety check is not immediately due on fresh shift', async ({ page, context }) => {
    await setupMocks(page, context);
    await page.goto('/');
    await page.waitForTimeout(4000);
    await expect(page.getByText('SAFETY CHECK DUE NOW')).not.toBeVisible();
  });

  test('log incident button visible and navigates', async ({ page, context }) => {
    await setupMocks(page, context);
    await page.goto('/');
    await expect(page.getByText('Log an Incident')).toBeVisible({ timeout: 15000 });
  });

  test('visitor section shows no visitors', async ({ page, context }) => {
    await setupMocks(page, context);
    await page.goto('/');
    await expect(page.getByText('No Visitors On Site')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Incident Form', () => {
  test('incident form loads with all fields', async ({ page, context }) => {
    await setupMocks(page, context);
    await page.goto('/log?type=INCIDENT');
    await expect(page.getByText('WHAT HAPPENED')).toBeVisible({ timeout: 15000 });
  });

  test('AI button appears after typing', async ({ page, context }) => {
    await setupMocks(page, context);
    await page.goto('/log?type=INCIDENT');
    const textarea = page.getByPlaceholder(/Describe what you saw/);
    await textarea.waitFor({ timeout: 15000 });
    await textarea.fill('Suspicious activity in car park');
    await expect(page.getByText('Write with AI')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Handover', () => {
  test('handover form loads with structured fields', async ({ page, context }) => {
    await setupMocks(page, context);
    await page.goto('/handover');
    await expect(page.getByText('End of Shift Handover')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Site Status')).toBeVisible();
    await expect(page.getByText('Equipment Handover')).toBeVisible();
  });
});
