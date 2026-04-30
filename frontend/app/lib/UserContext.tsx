'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

export interface User {
  userId: string;
  email: string;
  name?: string;
  profileImage?: string | null;
}

interface UserContextValue {
  user: User | null;
  isLoggedIn: boolean;
  // True while the initial /users/me probe is in flight. Most consumers
  // can ignore this — the SSR-provided initialUser already gives us the
  // right shape on first paint. It matters for code that needs to wait
  // for the freshest profile before deciding (e.g., gating a write
  // action that depends on knowing the current user).
  loading: boolean;
  // Re-probe /users/me. Call after login/signup so the context reflects
  // the new session without a full page reload.
  refresh: () => Promise<void>;
  // Mark the local context as logged-out without hitting the server.
  // Logout flows that already navigated still call this for cleanliness.
  setLoggedOut: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used inside <UserProvider>');
  }
  return ctx;
}

interface UserProviderProps {
  // Server-resolved auth state — root layout reads the access cookie via
  // next/headers and passes us the JWT payload's email/userId. When null,
  // we render as logged-out from first paint.
  initialUser: { userId: string; email: string } | null;
  children: React.ReactNode;
}

const PROFILE_CACHE_KEY = 'userProfileCache';

export function UserProvider({ initialUser, children }: UserProviderProps) {
  // Initial state must match what SSR renders — that means no localStorage
  // peek here. If we hydrated the cached profile in the lazy initializer,
  // server (no localStorage) and client (has cache) would produce
  // different first renders and React would flag a hydration mismatch.
  // Cache hydration happens in the effect below, after mount.
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(false);

  // Post-hydration: merge cached profile into the user object so the
  // avatar/name appear immediately without waiting for the /users/me
  // round-trip below. Safe — runs only on the client.
  useEffect(() => {
    if (!initialUser) return;
    try {
      const cached = localStorage.getItem(PROFILE_CACHE_KEY);
      if (!cached) return;
      const parsed = JSON.parse(cached) as { name?: string; profileImage?: string | null };
      setUser((prev) => (prev ? { ...prev, ...parsed } : prev));
    } catch {
      // Ignore parse errors.
    }
  }, [initialUser]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`);
      if (!res.ok) {
        setUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(PROFILE_CACHE_KEY);
        }
        return;
      }
      const data = (await res.json()) as User;
      const next: User = {
        userId: data.userId,
        email: data.email,
        name: data.name,
        profileImage: data.profileImage,
      };
      setUser(next);
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          PROFILE_CACHE_KEY,
          JSON.stringify({ name: next.name, profileImage: next.profileImage }),
        );
      }
    } catch {
      // Network failure — keep current state. The next API call will
      // retry naturally and the global interceptor handles 401s.
    } finally {
      setLoading(false);
    }
  }, []);

  const setLoggedOut = useCallback(() => {
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  }, []);

  // Hydrate fresh profile data on mount if SSR said we're logged in.
  // The initialUser prop only carries email/userId from the JWT — name
  // and profileImage need a server probe.
  useEffect(() => {
    if (initialUser) {
      void refresh();
    }
  }, [initialUser, refresh]);

  const value = useMemo<UserContextValue>(
    () => ({
      user,
      isLoggedIn: !!user,
      loading,
      refresh,
      setLoggedOut,
    }),
    [user, loading, refresh, setLoggedOut],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
