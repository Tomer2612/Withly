'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function CommunityRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const communityId = params.id as string;
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkMembership = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace(`/communities/${communityId}/preview`);
        return;
      }
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/membership`, {
          headers: { Authorization: `Bearer ${token}` },
        });
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
      setChecked(true);
    };
    checkMembership();
  }, [communityId, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-600">מעביר לקהילה...</p>
    </main>
  );
}
