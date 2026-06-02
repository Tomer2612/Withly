'use client';

import { useEffect, useState } from 'react';
import CloseIcon from './icons/CloseIcon';

interface Props {
  // HYP requires Amount even on J5=J2 (no money moves). Shown on the form.
  amount: number;
  // 'J2' = card credibility check, no charge (Settings Add-Card pattern).
  // 'True' = 3-day credit-line preservation. Omit for normal charge.
  j5?: 'J2' | 'True';
  // BOF=True makes HYP redirect the parent window (not the iframe) when the
  // payment completes. Required for iframe flows; default true.
  bof?: boolean;
  // Encodes the flow context for paymentSuccess dispatch on the backend.
  // The modal appends "-<userId>-<timestamp>" automatically.
  orderPrefix: string;
  clientName: string;
  email: string;
  userId: string;
  title?: string;
  onClose: () => void;
}

// Embeds HYP's hosted card form inside a modal on withly.co.il. The card
// fields are HYP's (PCI scope stays on their side); the surrounding chrome
// is ours. On submit, HYP redirects the parent window to
// /api/payments/payment-success with the transaction Id, which the backend
// dispatches based on the Order prefix.
export default function HypPaymentIframeModal({
  amount,
  j5,
  bof = true,
  orderPrefix,
  clientName,
  email,
  userId,
  title,
  onClose,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const order = `${orderPrefix}-${userId}-${Date.now()}`;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/create-payment`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            clientName,
            email,
            order,
            j5,
            bof,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setUrl(data.url);
      } catch {
        if (!cancelled) setError('שגיאה בטעינת דף התשלום. נסה שוב מאוחר יותר.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally mount-once — props that change should re-mount the modal
    // (the parent controls visibility, not us).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-lg flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E1E1E2' }}>
          <h2 className="text-lg font-bold" style={{ color: '#3F3F46' }}>
            {title ?? 'הוספת כרטיס אשראי'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="hover:opacity-70 transition"
            style={{ color: '#A1A1AA' }}
            aria-label="סגור"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden" style={{ minHeight: '640px' }}>
          {error && (
            <div className="p-8 text-center" style={{ color: '#B3261E' }}>
              {error}
            </div>
          )}
          {!error && !url && (
            <div className="p-8 text-center" style={{ color: '#A1A1AA' }}>
              טוען דף תשלום...
            </div>
          )}
          {!error && url && (
            <iframe
              src={url}
              className="w-full h-full"
              style={{ minHeight: '640px', border: 'none' }}
              allow="payment"
              title="HYP payment"
            />
          )}
        </div>
      </div>
    </div>
  );
}
