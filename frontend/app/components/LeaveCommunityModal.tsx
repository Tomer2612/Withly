'use client';

import Modal from './Modal';

const formatHebrewDate = (d: Date): string => d.toLocaleDateString('he-IL');

interface LeaveCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityName: string;
  isLeaving: boolean;
  onConfirm: () => void;
  /** When true, switches the body copy to the paid-leave variant (access stays
      until end of paid period, then auto-leave). Requires `effectiveDate`. */
  isPaid?: boolean;
  /** Last day of the current paid billing period — only used when `isPaid`. */
  effectiveDate?: Date;
}

export default function LeaveCommunityModal({
  isOpen,
  onClose,
  communityName,
  isLeaving,
  onConfirm,
  isPaid = false,
  effectiveDate,
}: LeaveCommunityModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} blur={false}>
      <div
        dir="rtl"
        className="bg-white p-6 text-center shadow-lg"
        style={{ borderRadius: '16px', width: 'fit-content', maxWidth: 'min(90vw, 640px)' }}
      >
        <h3 className="font-semibold text-black mb-2" style={{ fontSize: '21px' }}>
          עזיבת הקהילה
        </h3>
        <p className="mb-6" style={{ fontSize: '18px', color: 'var(--color-gray-10)' }}>
          {isPaid && effectiveDate ? (
            <>
              {`הגישה לקהילה `}
              <span className="font-semibold">{communityName}</span>
              {` תישמר עד ל-${formatHebrewDate(effectiveDate)}, ולאחר מכן החברות תסתיים אוטומטית. החיוב החודשי ייפסק, וניתן יהיה להצטרף מחדש בכל עת.`}
            </>
          ) : (
            <>
              {`האם לעזוב את הקהילה `}
              <span className="font-semibold">{communityName}</span>
              {`? לאחר העזיבה לא תהיה לך גישה לתכני הקהילה, עד להצטרפות מחדש`}
            </>
          )}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            disabled={isLeaving}
            className="bg-white text-black border hover:bg-gray-50 transition disabled:opacity-50"
            style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem', borderColor: 'var(--color-black)' }}
          >
            חזרה
          </button>
          <button
            onClick={onConfirm}
            disabled={isLeaving}
            className="bg-error text-white hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem' }}
          >
            {isLeaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                עוזב...
              </>
            ) : (
              'עזיבת הקהילה'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
