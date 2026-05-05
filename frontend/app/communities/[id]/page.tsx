'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '../../lib/UserContext';

export default function CommunityRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const communityId = params.id as string;
  const { user } = useUser();

  useEffect(() => {
    const checkMembership = async () => {
      if (!user) {
        router.replace(`/communities/${communityId}/preview`);
        return;
      }
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/membership`);
        if (res.ok) {
          const data = await res.json();
          if (data.role) {
            router.replace(`/communities/${communityId}/feed`);
          } else {
            router.replace(`/communities/${communityId}/preview`);
          }
        } else {
          router.replace(`/communities/${communityId}/preview`);
        }
      } catch {
        router.replace(`/communities/${communityId}/preview`);
      }
    };
    checkMembership();
  }, [communityId, router, user]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-600">מעביר לקהילה...</p>
    </main>
  );
}
