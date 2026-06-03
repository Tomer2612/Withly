'use client';

import { useEffect, useState } from 'react';
import CreditCardIcon from './icons/CreditCardIcon';
import PlusIcon from './icons/PlusIcon';

interface SavedCard {
  id: string;
  cardLastFour: string;
  cardBrand: string;
}

interface Props {
  /** Unexpired cards from the user's wallet, primary-first then newest-first.
   *  The parent filters expired ones before passing them in. */
  cards: SavedCard[];
  /** Currently-selected card id — gets the black outline. */
  selectedId: string;
  /** Id of the card already bound to this community (places 2 + 3 only),
   *  shown with a "(נוכחי)" tag. Pass undefined for the new-community case. */
  currentlyBoundId?: string;
  /** Id of a card whose recovery SOFT just rejected. The picker renders a
   *  warning banner naming the failed card and visually de-emphasizes it,
   *  steering the owner toward picking another card or adding a new one. */
  failedCardId?: string;
  onCancel: () => void;
  /** Called when user clicks "בחירת כרטיס" with the radio selection.
   *  Parent goes back to Screen 1 with the new selection. */
  onSelect: (cardId: string) => void;
  /** Opens HYP iframe to add a brand-new card. */
  onAddNew: () => void;
}

// Screen 2 of the saved-card flow: the list of unexpired wallet cards
// + "add new" option. Selection is local until "בחירת כרטיס" — clicking
// outside the modal or ביטול discards.
export default function CardPickerModal({
  cards,
  selectedId,
  currentlyBoundId,
  failedCardId,
  onCancel,
  onSelect,
  onAddNew,
}: Props) {
  const failedCard = failedCardId ? cards.find(c => c.id === failedCardId) : undefined;
  const [localSelected, setLocalSelected] = useState(selectedId);
  // Slide-in from the left (RTL "forward" direction): translateX(-20px) → 0
  // + opacity 0 → 1. Pairs with the confirm popup's slide-from-right so
  // the back-and-forth feels directional (forward = left, back = right).
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" dir="rtl">
      <div
        className="bg-white p-6"
        style={{
          borderRadius: '16px',
          width: 'fit-content',
          maxWidth: 'min(90vw, 480px)',
          minWidth: 'min(90vw, 420px)',
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateX(0)' : 'translateX(-20px)',
          transition: 'opacity 250ms ease-out, transform 250ms ease-out',
        }}
      >
        <h2
          className="font-semibold text-right mb-6"
          style={{ fontSize: '18px', color: 'var(--color-black)' }}
        >
          בחירת אמצעי תשלום
        </h2>

        {/* Failure notice — appears when the parent passed a failedCardId,
            i.e. the previous recovery SOFT rejected. Steers the owner toward
            picking a different saved card or adding a new one. */}
        {failedCard && (
          <div
            className="mb-4 p-3 text-right"
            style={{
              backgroundColor: '#FCE8E6',
              color: '#B3261E',
              borderRadius: '12px',
              fontSize: '14px',
            }}
          >
            החיוב לא עבר עם הכרטיס {failedCard.cardBrand} ···· {failedCard.cardLastFour}. ניתן לבחור כרטיס אחר או להוסיף כרטיס חדש.
          </div>
        )}

        {/* Card rows — uniform 1.5px border weight; selected = black, others = gray-4 */}
        <div className="flex flex-col gap-3 mb-6">
          {cards.map(card => {
            const isSelected = card.id === localSelected;
            const isCurrent = card.id === currentlyBoundId;
            const isFailed = card.id === failedCardId;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setLocalSelected(card.id)}
                className="p-3 text-right transition hover:opacity-90"
                style={{
                  border: isSelected
                    ? '2px solid var(--color-black)'
                    : '2px solid var(--color-gray-4)',
                  borderRadius: '12px',
                  background: '#fff',
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Radio dot on the LTR end of the row (left side in RTL) */}
                  <span
                    className="flex-shrink-0 rounded-full inline-flex items-center justify-center"
                    style={{
                      width: '18px',
                      height: '18px',
                      border: '1.5px solid var(--color-black)',
                    }}
                    aria-hidden
                  >
                    {isSelected && (
                      <span
                        className="rounded-full"
                        style={{ width: '10px', height: '10px', background: 'var(--color-black)' }}
                      />
                    )}
                  </span>
                  <CreditCardIcon className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-black)' }} />
                  <div
                    className="flex-1 text-right"
                    style={{
                      fontSize: '16px',
                      color: 'var(--color-black)',
                      opacity: isFailed ? 0.5 : 1,
                    }}
                  >
                    {card.cardBrand} ···· {card.cardLastFour}
                    {isCurrent && !isFailed && (
                      <span className="mr-2" style={{ fontSize: '14px', color: 'var(--color-gray-6)' }}>
                        (נוכחי)
                      </span>
                    )}
                    {isFailed && (
                      <span className="mr-2" style={{ fontSize: '14px', color: '#B3261E' }}>
                        (החיוב נכשל)
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {/* + Add new card row (dashed border, same 1.5px weight) */}
          <button
            type="button"
            onClick={onAddNew}
            className="p-3 text-right transition hover:opacity-90"
            style={{
              border: '2px dashed var(--color-gray-4)',
              borderRadius: '12px',
              background: '#fff',
            }}
          >
            <div className="flex items-center gap-3">
              <PlusIcon className="flex-shrink-0" size={18} color="var(--color-black)" />
              <span style={{ fontSize: '16px', color: 'var(--color-black)' }}>הוספת כרטיס חדש</span>
            </div>
          </button>
        </div>

        {/* Buttons — new modal style */}
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={onCancel}
            style={{
              fontSize: '16px',
              fontWeight: 400,
              borderRadius: '12px',
              padding: '0.375rem 1.25rem',
              borderColor: 'var(--color-black)',
            }}
            className="bg-white text-black border hover:bg-gray-50 transition"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() => onSelect(localSelected)}
            style={{
              fontSize: '16px',
              fontWeight: 400,
              borderRadius: '12px',
              padding: '0.375rem 1.25rem',
            }}
            className="bg-black text-white hover:opacity-90 transition"
          >
            בחירת כרטיס
          </button>
        </div>
      </div>
    </div>
  );
}
