'use client';

import { Suspense } from 'react';
import { SocketProvider } from '../lib/SocketContext';
import { UserProvider } from '../lib/UserContext';
import ChatWidget from './ChatWidget';
import RouteProgress from './RouteProgress';
import { clearSessionAndRedirect } from '../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
// Endpoints that mustn't trigger the refresh-on-401 loop. /auth/refresh is
// excluded because a 401 from refresh is the genuine signal that the user is
// fully logged out — looping would just hammer the server.
const NO_REFRESH_PATHS = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout'];
// Endpoints where a refresh-failure should NOT redirect to /login. /users/me
// is the auth probe UserProvider runs on mount — anonymous visitors on public
// pages will hit it and 401, and we want them to just stay logged-out, not
// get bounced. A real 401 on a user-action API call still redirects normally.
const NO_REDIRECT_ON_REFRESH_FAILURE_PATHS = ['/users/me'];

function isApiUrl(url: string): boolean {
  // Match the configured API base if we have one; fall back to anything that
  // looks like our backend during dev (port 4000).
  if (API_BASE && url.startsWith(API_BASE)) return true;
  return /^https?:\/\/[^/]*:4000/.test(url);
}

// Install the fetch interceptor at module scope rather than in a useEffect.
// In React, child useEffects fire before parent useEffects — putting this in
// ClientProviders' useEffect means SiteHeader's /users/me probe runs first,
// without credentials:include, gets 401, and the user looks logged-out even
// though their cookie is fine. Module scope runs once during JS load, before
// any React tree mounts.
let interceptorInstalled = false;
function installFetchInterceptor() {
  if (typeof window === 'undefined' || interceptorInstalled) return;
  interceptorInstalled = true;

  const originalFetch = window.fetch;

  // In-flight refresh promise, shared across concurrent 401s so we hit
  // /auth/refresh at most once per failure window.
  let refreshing: Promise<boolean> | null = null;
  const tryRefresh = (): Promise<boolean> => {
    if (!refreshing) {
      refreshing = originalFetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
        .then(r => r.ok)
        .catch(() => false)
        .finally(() => { refreshing = null; });
    }
    return refreshing;
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL ? input.toString() : input.url;
    const targetsApi = isApiUrl(url);

    // Auto-include cookies on every API call so the new httpOnly access
    // and refresh cookies actually get sent. Doesn't override callers
    // that have already chosen something explicit.
    const finalInit: RequestInit = targetsApi && (!init || init.credentials === undefined)
      ? { ...(init ?? {}), credentials: 'include' }
      : (init ?? {});

    const response = await originalFetch(input, finalInit);

    // Phase 6.2 — stale-tab race: the cron flips a community to
    // SUSPENDED while the user has a tab open. Their layout's cached
    // state still says ACTIVE so no popup; their next write returns
    // 403 with message=COMMUNITY_SUSPENDED. Detect that here and
    // hard-reload the page — the layout refetches, sees SUSPENDED,
    // renders the SuspendedCommunityModal naturally. Dedupe via
    // sessionStorage so we don't loop if a suspended page somehow
    // triggers another 403 immediately on reload.
    if (response.status === 403 && targetsApi) {
      try {
        const peek = await response.clone().json();
        if (peek?.message === 'COMMUNITY_SUSPENDED') {
          const last = sessionStorage.getItem('suspended_reload_at');
          const now = Date.now();
          if (!last || now - parseInt(last, 10) > 5000) {
            sessionStorage.setItem('suspended_reload_at', String(now));
            window.location.reload();
          }
        }
      } catch {
        // Body wasn't JSON or didn't have the expected shape — fall
        // through and return the response to the caller as normal.
      }
      return response;
    }

    if (response.status !== 401 || !targetsApi) return response;

    // 401 on an API call. Decide whether to attempt refresh-and-retry.
    const shouldSkip = NO_REFRESH_PATHS.some(p => url.includes(p));
    if (shouldSkip) return response;

    const refreshed = await tryRefresh();
    if (!refreshed) {
      // Refresh itself failed — really logged out.
      const skipRedirect = NO_REDIRECT_ON_REFRESH_FAILURE_PATHS.some(p => url.includes(p));
      if (!skipRedirect) {
        clearSessionAndRedirect();
      }
      return response;
    }

    // Retry the original request once with the new access cookie.
    return originalFetch(input, finalInit);
  };
}

installFetchInterceptor();

interface ClientProvidersProps {
  initialUser: { userId: string; email: string } | null;
  children: React.ReactNode;
}

export function ClientProviders({ initialUser, children }: ClientProvidersProps) {
  return (
    <UserProvider initialUser={initialUser}>
      <SocketProvider>
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        {children}
        <ChatWidget />
      </SocketProvider>
    </UserProvider>
  );
}
