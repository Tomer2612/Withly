'use client';

import { useState } from 'react';
import Modal from './Modal';
import CloseIcon from './icons/CloseIcon';
import CreditCardForm, { isCardComplete } from './CreditCardForm';

export interface UpdateCardModalSuccess {
  cardLastFour: string;
  cardBrand: string;
  subscriptionCancelledAt: string | null;
  suspendedAt: string | null;
  subscriptionStatus: 'ACTIVE' | 'SUSPENDED';
  /** True if the community was suspended at the moment the modal opened — lets
      the parent show a "הקהילה חזרה לפעילות" success message vs. a generic one. */
  wasSuspended: boolean;
}

interface UpdateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  currentCardBrand?: string | null;
  currentCardLastFour?: string | null;
  /** Whether the community is currently suspended — affects success message tone. */
  wasSuspended: boolean;
  onSuccess: (data: UpdateCardModalSuccess) => void;
  onError: (message: string) => void;
}

export default function UpdateCardModal({
  isOpen,
  onClose,
  communityId,
  currentCardBrand,
  currentCardLastFour,
  wasSuspended,
  onSuccess,
  onError,
}: UpdateCardModalProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!isCardComplete(cardNumber, cardExpiry, cardCvv)) {
      onError('יש למלא פרטי כרטיס תקינים');
      return;
    }

    setSubmitting(true);
    try {
      const lastFour = cardNumber.slice(-4);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/payment`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardLastFour: lastFour, cardBrand: 'Visa' }),
        },
      );

      // Mirror the card to the user's payment-methods list (idempotent — backend
      // dedupes on duplicate cardLastFour). Pre-HYP this keeps both sources of
      // truth in sync; post-HYP the duplication goes away (HYP follow-up #8).
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardLastFour: lastFour, cardBrand: 'Visa' }),
      });

      if (res.ok) {
        const updated = await res.json().catch(() => null);
        reset();
        onSuccess({
          cardLastFour: updated?.cardLastFour ?? lastFour,
          cardBrand: updated?.cardBrand ?? 'Visa',
          subscriptionCancelledAt: updated?.subscriptionCancelledAt ?? null,
          suspendedAt: updated?.suspendedAt ?? null,
          subscriptionStatus: updated?.subscriptionStatus ?? 'ACTIVE',
          wasSuspended,
        });
      } else {
        onError('שגיאה בעדכון אמצעי התשלום');
      }
    } catch (err) {
      console.error('Error saving card', err);
      onError('שגיאה בעדכון אמצעי התשלום');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} blur={false}>
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md" dir="rtl">
        <button
          type="button"
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 mb-4"
          disabled={submitting}
        >
          <CloseIcon size={20} />
        </button>

        <h2 className="text-2xl font-bold text-center mb-8">עדכון אמצעי תשלום</h2>

        {currentCardLastFour && (
          <p className="text-center text-gray-600 mb-4">
            כרטיס ראשי: <strong>{currentCardBrand || 'Visa'} ************{currentCardLastFour}</strong>
          </p>
        )}

        <CreditCardForm
          cardNumber={cardNumber}
          cardExpiry={cardExpiry}
          cardCvv={cardCvv}
          onCardNumberChange={setCardNumber}
          onCardExpiryChange={setCardExpiry}
          onCardCvvChange={setCardCvv}
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={submitting}
          className="w-full mt-8 bg-black text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? 'שומר...' : 'שמור כרטיס'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          הכרטיס ישמש לחיוב המנוי החודשי של הקהילה.
        </p>
      </div>
    </Modal>
  );
}
