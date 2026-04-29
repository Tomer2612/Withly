'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GoogleSuccessPage() {
  const router = useRouter();

  // The OAuth callback already set the httpOnly access + refresh cookies on
  // the backend response before redirecting here, so this page just needs
  // to land the user on the home screen.
  useEffect(() => {
    router.push('/');
  }, [router]);

  return (
    <main className="flex items-center justify-center min-h-screen text-center">
      <h1 className="text-lg">מתחברים עם גוגל...</h1>
    </main>
  );
}
