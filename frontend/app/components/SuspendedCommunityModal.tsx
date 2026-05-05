'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from './Modal';
import LogoutIcon from './icons/LogoutIcon';

interface SuspendedCommunityModalProps {
  role: 'member' | 'owner';
  communityId: string;
  /** Show the "leave community" link — only meaningful for actual members. */
  canLeave?: boolean;
}

export default function SuspendedCommunityModal({ role, communityId, canLeave }: SuspendedCommunityModalProps) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const goHome = () => router.push('/');
  const goRenew = () => router.push(`/communities/${communityId}/manage?tab=payments`);

  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/leave`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to leave community');
      }
      router.push('/');
    } catch {
      alert('שגיאה בעזיבת הקהילה');
      setLeaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={() => {}}
      closeOnBackdrop={false}
      blur
    >
      <div
        dir="rtl"
        className="bg-white p-6 text-center shadow-xl"
        style={{ borderRadius: '16px', width: 'fit-content', maxWidth: 'min(90vw, 640px)' }}
      >
        {role === 'member' ? (
          <>
            <h2 className="font-semibold text-black mb-2" style={{ fontSize: '21px' }}>
              הקהילה כרגע לא זמינה
            </h2>
            <p style={{ fontSize: '18px', fontWeight: 400, color: 'var(--color-gray-10)' }}>
              ניתן לחזור לעמוד הבית ולגלות קהילות נוספות.
            </p>
            <p className="mb-6" style={{ fontSize: '18px', fontWeight: 400, color: 'var(--color-gray-10)' }}>
              נודיע לך כשהקהילה תחזור לפעילות.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={goHome}
                className="bg-black text-white hover:opacity-90 transition"
                style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem' }}
              >
                הבנתי
              </button>
              {canLeave && (
                <button
                  type="button"
                  onClick={handleLeave}
                  disabled={leaving}
                  className="text-error hover:bg-red-50 transition disabled:opacity-50 flex items-center gap-2"
                  style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem' }}
                >
                  <LogoutIcon size={16} />
                  {leaving ? 'עוזב...' : 'עזיבת הקהילה'}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="font-semibold text-black mb-2" style={{ fontSize: '21px' }}>
              הקהילה שלך מושבתת
            </h2>
            <p className="mb-6 leading-relaxed" style={{ fontSize: '18px', fontWeight: 400, color: 'var(--color-gray-10)' }}>
              תקופת המנוי הסתיימה והקהילה כרגע לא זמינה לחברים.
              <br />
              כל התוכן והחברים שלך נשמרו במלואם.
            </p>
            <button
              type="button"
              onClick={goRenew}
              className="w-full bg-black text-white hover:opacity-90 transition mb-3"
              style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem' }}
            >
              חידוש המנוי
            </button>
            <button
              type="button"
              onClick={goHome}
              className="hover:opacity-70 transition"
              style={{ fontSize: '16px', fontWeight: 400, color: 'var(--color-gray-10)' }}
            >
              חזרה לעמוד הבית
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
