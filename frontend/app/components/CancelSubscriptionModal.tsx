'use client';

import { useState } from 'react';
import Modal from './Modal';

const formatHebrewDate = (d: Date): string => d.toLocaleDateString('he-IL');

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  /** End-of-current-period date the subscription will switch to SUSPENDED on. */
  effectiveDate: Date;
  isPaidCommunity: boolean;
  /** For the "יש לך X חברים משלמים" line; pass 0 if free. */
  paidMembersCount: number;
  /** Called after the PATCH succeeds, with the effectiveDate the parent can store locally. */
  onSuccess: (effectiveDate: Date) => void;
  /** Called if the API returned a non-OK or threw. Parent shows its own error UI. */
  onError?: () => void;
}

export default function CancelSubscriptionModal({
  isOpen,
  onClose,
  communityId,
  effectiveDate,
  isPaidCommunity,
  paidMembersCount,
  onSuccess,
  onError,
}: CancelSubscriptionModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/payment`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionCancelledAt: effectiveDate.toISOString() }),
        },
      );
      if (res.ok) {
        onSuccess(effectiveDate);
      } else {
        onError?.();
      }
    } catch {
      onError?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} blur={false}>
      <div
        dir="rtl"
        className="bg-white p-6 text-center"
        style={{ borderRadius: '16px', width: 'fit-content', maxWidth: 'min(90vw, 640px)' }}
      >
        <h2 className="font-semibold text-black" style={{ fontSize: '21px', marginBottom: '12px' }}>
          לבטל את המנוי?
        </h2>
        <p style={{ fontSize: '18px', fontWeight: 400, color: 'var(--color-gray-10)', marginBottom: '4px' }}>
          {`הקהילה תישאר פעילה עד ${formatHebrewDate(effectiveDate)}. לאחר מכן היא `}
          <span style={{ fontWeight: 600 }}>תושבת</span>
          {`, וניתן לחדש בכל עת.`}
        </p>
        {isPaidCommunity && (
          <p style={{ fontSize: '18px', fontWeight: 400, color: 'var(--color-gray-10)' }}>
            {`יש לך ${paidMembersCount} חברים משלמים. החיוב שלהם ייעצר אוטומטית בסוף התקופה.`}
          </p>
        )}
        <div className="flex gap-3 justify-center" style={{ marginTop: '24px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem', borderColor: 'var(--color-black)' }}
            className="bg-white text-black border hover:bg-gray-50 transition disabled:opacity-50"
          >
            השארת המנוי
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem' }}
            className="bg-error text-white hover:opacity-90 transition disabled:opacity-50"
          >
            {submitting ? 'מבטל...' : 'ביטול המנוי'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
