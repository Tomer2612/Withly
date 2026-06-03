'use client';

import { useEffect, useState } from 'react';
import CreditCardIcon from './icons/CreditCardIcon';
import { getImageUrl } from '../lib/imageUrl';

interface SavedCard {
  id: string;
  cardLastFour: string;
  cardBrand: string;
}

interface Props {
  /** Header title (community name for places 2/3, the new community's name for place 4). */
  title: string;
  /** Community logo URL — passes through getImageUrl. If null, a placeholder
   *  circle with the first letter of the title is rendered instead. */
  logoUrl?: string | null;
  /** Monthly fee shown in the price box AND in the action button. */
  monthlyPrice: number;
  /** The card currently selected (pre-filled to user's primary on parent's mount). */
  selectedCard: SavedCard;
  /** Full label for the primary action button (e.g., "הצטרפות ב₪99",
   *  "חידוש מנוי ב₪99", or "עדכון כרטיס"). Parent decides whether to
   *  include the price — for renewals/joins it's meaningful; for a simple
   *  card swap on an active community there's no charge, so the price
   *  would be misleading. */
  actionLabel: string;
  /** True while the parent runs the bind/finalize call so we can disable + show loading state. */
  loading?: boolean;
  /** When true, render the community avatar (logo / fallback letter) next to
   *  the title. Place 4 (new community via /pricing) passes false: no
   *  community exists yet so there's nothing representative to put there. */
  showAvatar?: boolean;
  /** New-community checkout only: the owner gets a free first month before the
   *  first SOFT charge (Plan.trialLengthMonths). When true, the price/card
   *  subtitles reflect the trial instead of implying an immediate charge.
   *  The update-card screens (active communities) leave this false — swapping
   *  a card there starts no new trial. Generic copy, no computed date. */
  trialFirstMonthFree?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Opens the picker (Screen 2) — parent handles the transition. */
  onSwitchCard: () => void;
}

// Screen 1 of the saved-card flow: confirms what's about to happen
// (subscription + the pre-selected payment method) and offers a switch
// link to the picker. No HYP iframe involved — that only opens if the
// user clicks "+ הוסף כרטיס חדש" inside the picker.
export default function ExistingCardConfirmModal({
  title,
  logoUrl,
  monthlyPrice,
  selectedCard,
  actionLabel,
  loading,
  showAvatar = true,
  trialFirstMonthFree = false,
  onCancel,
  onConfirm,
  onSwitchCard,
}: Props) {
  // Slide-in from the right (RTL "previous" direction): translateX(20px) → 0
  // + opacity 0 → 1 over 250ms. Going back from the picker feels like the
  // wallet view collapsed and the confirm popup came forward.
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
          maxWidth: 'min(90vw, 540px)',
          minWidth: 'min(90vw, 480px)',
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateX(0)' : 'translateX(20px)',
          transition: 'opacity 250ms ease-out, transform 250ms ease-out',
        }}
      >
        {/* Header: title always shown. Avatar (logo / fallback letter) is
            shown next to it for places 2/3 (existing communities) but
            hidden for place 4 (new community — nothing to represent yet).
            Source order is avatar-first so RTL renders it on the right
            side, before the title in reading order. */}
        <div className="flex items-center gap-3 mb-6">
          {showAvatar && (
            <CommunityAvatar logoUrl={logoUrl} fallbackChar={title.charAt(0) || '·'} />
          )}
          <h2
            className="font-semibold text-right flex-1"
            style={{ fontSize: '18px', color: 'var(--color-black)' }}
          >
            {title}
          </h2>
        </div>

        {/* Price box — tight padding (12px) to match the picker row size */}
        <div
          className="p-3 mb-3"
          style={{ border: '2px solid var(--color-gray-4)', borderRadius: '12px' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 text-right">
              <div style={{ fontSize: '16px', color: 'var(--color-black)', lineHeight: 1.2 }}>
                מחיר חודשי
              </div>
              <div style={{ fontSize: '14px', color: 'var(--color-gray-6)', marginTop: '2px', lineHeight: 1.2 }}>
                {trialFirstMonthFree
                  ? `חודש ראשון חינם, ולאחר מכן ₪${monthlyPrice} בחודש. תזכורת תישלח 3 ימים לפני החיוב.`
                  : 'החיוב יתחדש אוטומטית כל חודש'}
              </div>
            </div>
            <div
              className="font-semibold whitespace-nowrap"
              style={{ fontSize: '18px', color: 'var(--color-black)' }}
            >
              ₪{monthlyPrice}
            </div>
          </div>
        </div>

        {/* Card box — same padding as price box; החלפת כרטיס at LTR end,
            vertically centered with the card lines. */}
        <div
          className="p-3 mb-6"
          style={{ border: '2px solid var(--color-gray-4)', borderRadius: '12px' }}
        >
          <div className="flex items-center gap-3">
            <CreditCardIcon className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-black)' }} />
            <div className="flex-1 text-right">
              <div style={{ fontSize: '16px', color: 'var(--color-black)', lineHeight: 1.2 }}>
                {selectedCard.cardBrand} ···· {selectedCard.cardLastFour}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--color-gray-6)', marginTop: '2px', lineHeight: 1.2 }}>
                {trialFirstMonthFree ? 'החיוב הראשון לאחר חודש ההתנסות' : 'יחויב מכרטיס זה'}
              </div>
            </div>
            <button
              type="button"
              onClick={onSwitchCard}
              disabled={loading}
              className="underline hover:opacity-70 transition disabled:opacity-50 whitespace-nowrap"
              style={{ fontSize: '14px', color: 'var(--color-black)' }}
            >
              החלפת כרטיס
            </button>
          </div>
        </div>

        {/* Buttons — new modal style (PriceChangeAnnouncementModal pattern). */}
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              fontSize: '16px',
              fontWeight: 400,
              borderRadius: '12px',
              padding: '0.375rem 1.25rem',
              borderColor: 'var(--color-black)',
            }}
            className="bg-white text-black border hover:bg-gray-50 transition disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              fontSize: '16px',
              fontWeight: 400,
              borderRadius: '12px',
              padding: '0.375rem 1.25rem',
            }}
            className="bg-black text-white hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'טוען...' : actionLabel}
          </button>
        </div>

        {/* Cancel-anytime reassurance — moved out of the price subtitle to sit
            below the buttons as a quiet footnote. */}
        <p
          className="text-center"
          style={{ fontSize: '13px', fontWeight: 400, color: 'var(--color-gray-6)', marginTop: '12px' }}
        >
          ניתן לבטל בכל עת
        </p>
      </div>
    </div>
  );
}

// Small helper: shows the community logo if we have a URL, otherwise a
// colored circle with the first letter. Sized to sit comfortably next to
// the 18px title text.
function CommunityAvatar({ logoUrl, fallbackChar }: { logoUrl?: string | null; fallbackChar: string }) {
  const SIZE = 40;
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={getImageUrl(logoUrl)}
        alt=""
        style={{
          width: SIZE,
          height: SIZE,
          objectFit: 'cover',
          borderRadius: '10px',
        }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center font-semibold"
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: '10px',
        background: 'var(--color-gray-3)',
        color: 'var(--color-black)',
        fontSize: '16px',
      }}
      aria-hidden
    >
      {fallbackChar}
    </div>
  );
}
