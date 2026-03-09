'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GoogleSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      localStorage.setItem('token', token);
      // Set cookie for middleware auth
      const isProduction = process.env.NODE_ENV === 'production';
      const maxAge = 30 * 24 * 60 * 60; // 30 days to match JWT expiry
      document.cookie = `auth-token=${token}; path=/; max-age=${maxAge}; SameSite=Lax${isProduction ? '; Secure' : ''}`;
      router.push('/');
    }
  }, [router]);

  return (
    <main className="flex items-center justify-center min-h-screen text-center">
      <h1 className="text-lg">מתחברים עם גוגל...</h1>
    </main>
  );
}
