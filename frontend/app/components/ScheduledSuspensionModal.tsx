'use client';

import { useState } from 'react';

interface ScheduledSuspensionModalProps {
  communityId: string;
  communityName?: string | null;
  effectiveDate: Date;
  ownerName?: string | null;
  isPaidCommunity: boolean;
  onClose: () => void;
}

const formatHebrewDate = (d: Date): string => d.toLocaleDateString('he-IL');

export default function ScheduledSuspensionModal({
  communityId,
  communityName,
  effectiveDate,
  ownerName,
  isPaidCommunity,
  onClose,
}: ScheduledSuspensionModalProps) {
  const [acking, setAcking] = useState(false);

  const handleDismiss = async () => {
    if (acking) return;
    setAcking(true);
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/acknowledge-suspension-scheduled`,
        { method: 'POST' },
      );
    } catch {
      // Best-effort — if the ack fails the popup will just show again next time.
    }
    onClose();
  };

  // Fall back to a generic noun if the owner's name didn't come through —
  // shouldn't happen on the regular fetch path, but defensive.
  const actor = ownerName?.trim() || 'מנהל הקהילה';

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
          הקהילה תושבת
        </h2>
        <p style={{ fontSize: '18px', fontWeight: 400, color: 'var(--color-gray-10)', marginBottom: isPaidCommunity ? '4px' : '0' }}>
          {communityName
            ? `${actor} החל/ה תהליך השבתה של קהילת ${communityName} בתאריך ${formatHebrewDate(effectiveDate)}. עד אז הכל ימשיך כרגיל.`
            : `${actor} החל/ה תהליך השבתה של הקהילה בתאריך ${formatHebrewDate(effectiveDate)}. עד אז הכל ימשיך כרגיל.`}
        </p>
        {isPaidCommunity && (
          <p style={{ fontSize: '18px', fontWeight: 400, color: 'var(--color-gray-10)' }}>
            החיוב החודשי שלך ייעצר אוטומטית בסוף התקופה.
          </p>
        )}
        <div className="flex justify-center" style={{ marginTop: '24px' }}>
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
