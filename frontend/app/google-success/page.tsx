'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../lib/UserContext';

export default function GoogleSuccessPage() {
  const router = useRouter();
  const { refresh: refreshUser } = useUser();

  // The OAuth callback already set the httpOnly access + refresh cookies
  // on the backend response before redirecting here. Refresh the
  // UserContext so the new session shows up everywhere, then land on home.
  useEffect(() => {
    void refreshUser().then(() => {
      router.push('/');
    });
  }, [router, refreshUser]);

  return (
    <main className="flex items-center justify-center min-h-screen text-center">
      <h1 className="text-lg">מתחברים עם גוגל...</h1>
    </main>
  );
}
