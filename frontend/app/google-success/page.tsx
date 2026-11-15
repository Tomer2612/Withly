'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../lib/UserContext';
import { safeReturnPath } from '../lib/auth';

export default function GoogleSuccessPage() {
  const router = useRouter();
  const { refresh: refreshUser } = useUser();

  // The OAuth callback already set the httpOnly access + refresh cookies
  // on the backend response before redirecting here. Refresh the
  // UserContext so the new session shows up everywhere, then continue.
  useEffect(() => {
    void (async () => {
      await refreshUser();

      // Same as the login and signup pages: a visitor who clicked "join" on a
      // community's preview page while signed out (the preview page stored
      // pendingJoinCommunity) is taken into that community, not dropped on
      // the home page.
      const pendingJoinCommunity = localStorage.getItem('pendingJoinCommunity');
      // Where the user was headed before signing in (stored by the Google
      // buttons on /login and /signup). Read once, then cleared.
      const returnUrl = safeReturnPath(localStorage.getItem('returnUrl'));
      localStorage.removeItem('returnUrl');
      if (pendingJoinCommunity) {
        const pendingPayment = localStorage.getItem('pendingPayment');
        localStorage.removeItem('pendingJoinCommunity');
        localStorage.removeItem('pendingPayment');

        if (pendingPayment) {
          // Paid community: back to its preview with the payment modal open.
          router.push(`/communities/${pendingJoinCommunity}/preview?showPayment=true`);
          return;
        }
        // Free community: join directly. The global fetch interceptor adds
        // credentials, so the new access cookie authenticates this.
        try {
          const joinRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${pendingJoinCommunity}/join`, {
            method: 'POST',
          });
          router.push(`/communities/${pendingJoinCommunity}/${joinRes.ok ? 'feed' : 'preview'}`);
        } catch {
          router.push(`/communities/${pendingJoinCommunity}/preview`);
        }
        return;
      }

      router.push(returnUrl ?? '/');
    })();
  }, [router, refreshUser]);

  return (
    <main className="flex items-center justify-center min-h-screen text-center">
      <h1 className="text-lg">מתחברים עם גוגל...</h1>
    </main>
  );
}
