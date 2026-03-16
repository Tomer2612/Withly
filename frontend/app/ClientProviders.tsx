'use client';

import { Suspense, useEffect } from 'react';
import { SocketProvider } from './lib/SocketContext';
import ChatWidget from './components/ChatWidget';
import RouteProgress from './components/RouteProgress';
import { clearSessionAndRedirect } from './lib/auth';

const AUTH_ENDPOINTS = ['/auth/login', '/auth/signup'];

export function ClientProviders({ children }: { children: React.ReactNode }) {
  // clear the expired token and redirect to login.
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);
      if (response.status === 401) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const isAuthEndpoint = AUTH_ENDPOINTS.some(ep => url.includes(ep));
        if (!isAuthEndpoint && localStorage.getItem('token')) {
          clearSessionAndRedirect();
        }
      }
      return response;
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
