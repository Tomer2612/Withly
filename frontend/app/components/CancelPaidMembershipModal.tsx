'use client';

import Modal from './Modal';

const formatHebrewDate = (d: Date): string => d.toLocaleDateString('he-IL');

interface CancelPaidMembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityName: string;
  isCancelling: boolean;
  onConfirm: () => void;
  /** Last day of the current paid billing period. Required: this modal is only
      shown for paid+active subscriptions. */
  effectiveDate: Date;
}

export default function CancelPaidMembershipModal({
  isOpen,
  onClose,
  communityName,
  isCancelling,
  onConfirm,
  effectiveDate,
}: CancelPaidMembershipModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} blur={false}>
      <div
        dir="rtl"
        className="bg-white p-6 text-center shadow-lg"
        style={{ borderRadius: '16px', width: 'fit-content', maxWidth: 'min(90vw, 640px)' }}
      >
        <h3 className="font-semibold text-black mb-2" style={{ fontSize: '21px' }}>
          ביטול המנוי
        </h3>
        <p className="mb-6" style={{ fontSize: '18px', color: 'var(--color-gray-10)' }}>
          {`הגישה לקהילה `}
          <span className="font-semibold">{communityName}</span>
          {` תישמר עד ל-${formatHebrewDate(effectiveDate)}, ולאחר מכן החברות תסתיים אוטומטית. החיוב החודשי ייפסק, וניתן יהיה להצטרף מחדש בכל עת.`}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            disabled={isCancelling}
            className="bg-white text-black border hover:bg-gray-50 transition disabled:opacity-50"
            style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem', borderColor: 'var(--color-black)' }}
          >
            חזרה
          </button>
          <button
            onClick={onConfirm}
            disabled={isCancelling}
            className="bg-error text-white hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem' }}
          >
            {isCancelling ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                מעבד...
              </>
            ) : (
              'אישור ביטול'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
