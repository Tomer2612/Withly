'use client';

import { Suspense, useEffect } from 'react';
import { SocketProvider } from '../lib/SocketContext';
import ChatWidget from './ChatWidget';
import RouteProgress from './RouteProgress';
import { clearSessionAndRedirect } from '../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
// Endpoints that mustn't trigger the refresh-on-401 loop. /auth/refresh is
// excluded because a 401 from refresh is the genuine signal that the user is
// fully logged out — looping would just hammer the server.
const NO_REFRESH_PATHS = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout'];

function isApiUrl(url: string): boolean {
  // Match the configured API base if we have one; fall back to anything that
  // looks like our backend during dev (port 4000).
  if (API_BASE && url.startsWith(API_BASE)) return true;
  return /^https?:\/\/[^/]*:4000/.test(url);
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
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

      if (response.status !== 401 || !targetsApi) return response;

      // 401 on an API call. Decide whether to attempt refresh-and-retry.
      const shouldSkip = NO_REFRESH_PATHS.some(p => url.includes(p));
      if (shouldSkip) return response;

      const refreshed = await tryRefresh();
      if (!refreshed) {
        // Refresh itself failed — really logged out. Bounce to login.
        clearSessionAndRedirect();
        return response;
      }

      // Retry the original request once with the new access cookie.
      return originalFetch(input, finalInit);
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  return (
    <SocketProvider>
      <Suspense fallback={null}>
        <RouteProgress />
      </Suspense>
      {children}
      <ChatWidget />
    </SocketProvider>
  );
}
