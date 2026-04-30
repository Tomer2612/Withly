'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GoogleSuccessPage() {
  const router = useRouter();

  // The OAuth callback already set the httpOnly access + refresh cookies on
  // the backend response before redirecting here. Set the legacy logged-in
  // marker that some pages still gate on, then land the user on home.
  useEffect(() => {
    localStorage.setItem('token', 'cookie-auth');
    router.push('/');
  }, [router]);

  return (
    <main className="flex items-center justify-center min-h-screen text-center">
      <h1 className="text-lg">מתחברים עם גוגל...</h1>
    </main>
  );
}
