'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PriceChangeAnnouncementModalProps {
  communityId: string;
  currentPrice: number;
  newPrice: number;
  effectiveDate: Date;
  onClose: () => void;
}

const formatHebrewDate = (d: Date): string => d.toLocaleDateString('he-IL');

export default function PriceChangeAnnouncementModal({
  communityId,
  currentPrice,
  newPrice,
  effectiveDate,
  onClose,
}: PriceChangeAnnouncementModalProps) {
  const router = useRouter();
  const [acking, setAcking] = useState(false);

  // Acknowledge fires for both buttons — once dismissed in any way the
  // popup shouldn't return on the next navigation.
  const acknowledge = async () => {
    if (acking) return;
    setAcking(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/acknowledge-price-change`, {
        method: 'POST',
      });
    } catch {
      // Best-effort — if the ack fails the popup will just show again
      // next time. Not fatal.
    }
  };

  const handleDismiss = async () => {
    await acknowledge();
    onClose();
  };

  const handleCancelSubscription = async () => {
    await acknowledge();
    router.push('/settings#payment');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white p-6 text-center"
        dir="rtl"
        style={{
          borderRadius: '16px',
          width: 'fit-content',
          maxWidth: 'min(90vw, 640px)',
        }}
      >
        <h2
          className="font-semibold text-black"
          style={{ fontSize: '21px', marginBottom: '12px' }}
        >
          המחיר החודשי של הקהילה השתנה
        </h2>
        <p style={{ fontSize: '18px', fontWeight: 400, color: 'var(--color-gray-10)', marginBottom: '4px' }}>
          {`מ-${formatHebrewDate(effectiveDate)}, החיוב החודשי שלך יעלה מ-₪${currentPrice} ל-₪${newPrice}.`}
        </p>
        <p style={{ fontSize: '18px', fontWeight: 400, color: 'var(--color-gray-10)' }}>
          ניתן להמשיך כרגיל, או לבטל את המנוי בכל עת.
        </p>
        <div className="flex gap-3 justify-center" style={{ marginTop: '24px' }}>
          <button
            type="button"
            onClick={handleCancelSubscription}
            disabled={acking}
            style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem', borderColor: 'var(--color-black)' }}
            className="bg-white text-black border hover:bg-gray-50 transition disabled:opacity-50"
          >
            ביטול המנוי
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={acking}
            style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem' }}
            className="bg-black text-white hover:opacity-90 transition disabled:opacity-50"
          >
            הבנתי
          </button>
        </div>
      </div>
    </div>
  );
}
