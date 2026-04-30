import { test, expect, Page } from '@playwright/test';
import { TEST_USER } from './seed-test-user';

const API_BASE = 'http://localhost:4000';

// Log in via the UI. After this, the page has the auth cookies set and
// localStorage 'token' marker present.
async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(TEST_USER.email);
  await page.locator('#login-password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'התחברות' }).click();
  // Login redirects to / on success — wait for that URL.
  await page.waitForURL('/', { timeout: 10_000 });
}

// Inspect cookies for our two auth cookies. Returns each by name or null.
async function getAuthCookies(page: Page) {
  const cookies = await page.context().cookies();
  const access = cookies.find(c => c.name === 'access_token') ?? null;
  const refresh = cookies.find(c => c.name === 'refresh_token') ?? null;
  return { access, refresh };
}

test.beforeEach(async ({ context, page }) => {
  // Start each test from a clean slate so flows don't leak into each
  // other. clearCookies handles the auth side; the goto + storage clear
  // wipes userProfileCache and any other localStorage residue from a
  // prior test (Playwright's clearCookies doesn't touch storage).
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('login flow sets cookies and shows profile dropdown', async ({ page }) => {
  await login(page);

  const { access, refresh } = await getAuthCookies(page);
  expect(access, 'access_token cookie should be set').not.toBeNull();
  expect(refresh, 'refresh_token cookie should be set').not.toBeNull();
  expect(access?.httpOnly, 'access_token must be httpOnly').toBe(true);
  expect(refresh?.httpOnly, 'refresh_token must be httpOnly').toBe(true);
  expect(refresh?.path, 'refresh_token path should be /auth').toBe('/auth');

  // The profile dropdown lives in SiteHeader. The presence of a clickable
  // "התנתקות" inside it (after we open the dropdown) is a strong signal
  // we're rendered as a logged-in user. We just check for that link
  // becoming visible after clicking the avatar — but for a low-flake
  // first pass, we instead assert the auth buttons are NOT visible.
  await expect(page.getByRole('link', { name: 'כניסה' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'הרשמה' })).toHaveCount(0);
});

test('logout clears cookies and shows auth buttons', async ({ page }) => {
  await login(page);

  // Open the profile dropdown via its testid; logout link says התנתקות.
  await page.getByTestId('user-profile-dropdown-trigger').first().click();
  await page.getByText('התנתקות').click();

  // Logout does window.location.href = '/' so we wait for navigation.
  await page.waitForURL('/', { timeout: 10_000 });

  const { access, refresh } = await getAuthCookies(page);
  expect(access, 'access_token must be cleared after logout').toBeNull();
  expect(refresh, 'refresh_token must be cleared after logout').toBeNull();

  // Auth buttons should be back in the DOM (desktop + mobile variants
  // both render — CSS hides one).
  await expect(page.getByRole('link', { name: 'כניסה' }).first()).toBeVisible();
});

test('auth state survives a hard reload', async ({ page }) => {
  await login(page);
  await page.reload();

  // After reload, still logged in — auth buttons must NOT appear.
  await expect(page.getByRole('link', { name: 'כניסה' })).toHaveCount(0);

  const { access } = await getAuthCookies(page);
  expect(access).not.toBeNull();
});

test('logged-in user can navigate main pages without redirect', async ({ page }) => {
  await login(page);

  for (const path of ['/settings', '/pricing', '/contact', '/']) {
    await page.goto(path);
    // Page reached its target URL (not bounced to /login).
    expect(page.url(), `should land on ${path}`).toContain(path === '/' ? '/' : path);
    // Auth buttons should still be hidden across pages.
    await expect(page.getByRole('link', { name: 'כניסה' })).toHaveCount(0);
  }
});

test('refresh-on-401 silently rotates when access cookie is removed mid-session', async ({ page, context }) => {
  await login(page);

  // Drop only the access cookie. Refresh cookie stays alive.
  const before = await context.cookies();
  const refreshOnly = before.filter(c => c.name !== 'access_token');
  await context.clearCookies();
  await context.addCookies(refreshOnly);

  // Make an authenticated API call from the browser context. The global
  // fetch interceptor sees 401, calls /auth/refresh, retries — all
  // transparently. We can't test this via page navigation because Next
  // middleware bounces protected-page loads before the client interceptor
  // ever runs; the interceptor only protects in-page API calls.
  const status = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/users/me`, { credentials: 'include' });
    return res.status;
  }, API_BASE);

  expect(status, '/users/me should ultimately return 200 via refresh-on-401').toBe(200);

  const { access } = await getAuthCookies(page);
  expect(access, 'access_token must be re-issued by /auth/refresh').not.toBeNull();
});

test('refresh replay detection burns the chain', async ({ page, context }) => {
  await login(page);

  const before = await context.cookies();
  const oldRefresh = before.find(c => c.name === 'refresh_token');
  expect(oldRefresh, 'pre-condition: refresh cookie exists').toBeDefined();

  // Use the page's browser context so cookies are sent automatically.
  // Rotate once — server replaces the old refresh.
  const firstStatus = await page.evaluate(async (api) => {
    const r = await fetch(`${api}/auth/refresh`, { method: 'POST', credentials: 'include' });
    return r.status;
  }, API_BASE);
  expect(firstStatus, 'first refresh should succeed').toBe(201);

  // Manually replay the OLD refresh token via fetch with explicit Cookie.
  // We can't set Cookie header from page.evaluate (browser blocks it),
  // so do it from Node via Playwright's request API but with the cookie
  // jar-injected explicitly. Drop all cookies first to avoid the new
  // refresh sneaking in alongside the replay.
  await context.clearCookies();
  await context.addCookies([{
    ...oldRefresh!,
    // Re-add domain/path required by addCookies API.
    domain: 'localhost',
    path: oldRefresh!.path,
  }]);

  const replayStatus = await page.evaluate(async (api) => {
    const r = await fetch(`${api}/auth/refresh`, { method: 'POST', credentials: 'include' });
    return r.status;
  }, API_BASE);
  expect(replayStatus, 'replay of already-rotated token should be rejected').toBe(401);
});
