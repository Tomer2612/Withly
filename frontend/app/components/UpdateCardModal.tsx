'use client';

import { useEffect, useState } from 'react';
import { useUser } from '../lib/UserContext';
import HypPaymentIframeModal from './HypPaymentIframeModal';
import ExistingCardConfirmModal from './ExistingCardConfirmModal';
import CardPickerModal from './CardPickerModal';

interface UpdateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  /** Whether the community is currently suspended. Drives the action-button
   *  label (suspended → "חידוש מנוי ב₪X", active → "עדכון כרטיס") and the
   *  inline reactivation flip on the backend (bindTokenizedPaymentMethod
   *  handles SUSPENDED → ACTIVE). The redirect path is the same either way:
   *  parent page reads ?card=updated / ?card=existing / ?card=error. */
  wasSuspended: boolean;
  /** Withly monthly platform fee shown in the price box AND, for renewals,
   *  in the action button. Defaults to 1 (HYP rejects 0). */
  amount?: number;
}

interface SavedCard {
  id: string;
  cardLastFour: string;
  cardBrand: string;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  isPrimary: boolean;
  createdAt: string;
}

interface CommunitySummary {
  id: string;
  name: string;
  logo: string | null;
  // Cover image — used as a fallback header avatar when no dedicated logo
  // has been uploaded. Most test communities currently have neither, so
  // the modal renders the placeholder circle with the first letter.
  image: string | null;
  paymentMethodId: string | null;
}

type View = 'loading' | 'confirm' | 'picker' | 'iframe';

// Hides expired wallet cards from the picker. HYP would reject a SOFT
// charge on them anyway (and the backend defense-in-depth check would
// fail), so offering them in the UI would just lead to a confusing error.
// NULL exp fields predate HYP wiring (Phase 6.1 backfill) — treat as
// unexpired so legacy rows still appear and can be re-tokenized.
function isCardExpired(card: SavedCard): boolean {
  if (card.cardExpMonth == null || card.cardExpYear == null) return false;
  const now = new Date();
  const nowYM = now.getFullYear() * 100 + (now.getMonth() + 1);
  const cardYM = card.cardExpYear * 100 + card.cardExpMonth;
  return cardYM < nowYM;
}

// Phase 3.2 / 3.3 — community billing-card update modal. Orchestrates
// three sub-views:
//   1. ExistingCardConfirmModal (Screen 1) — pre-selected primary card.
//   2. CardPickerModal (Screen 2) — full unexpired wallet list.
//   3. HypPaymentIframeModal — the original iframe flow, used when the
//      wallet is empty or the user explicitly picks "+ הוסף כרטיס חדש".
//
// On mount we fetch the user's payment methods and the community summary
// in parallel. Zero unexpired cards → straight to the iframe. One or more
// → Screen 1 with the primary pre-selected. The existing-card success
// path navigates to /communities/:id/manage?card=updated|existing, which
// hooks the same URL handlers the iframe redirect uses.
export default function UpdateCardModal({
  isOpen,
  onClose,
  communityId,
  wasSuspended,
  amount,
}: UpdateCardModalProps) {
  const { user } = useUser();

  const [view, setView] = useState<View>('loading');
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [community, setCommunity] = useState<CommunitySummary | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [binding, setBinding] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const [pmRes, comRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/payment-methods`, {
            credentials: 'include',
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`, {
            credentials: 'include',
          }),
        ]);
        if (cancelled) return;

        const allCards: SavedCard[] = pmRes.ok ? await pmRes.json() : [];
        const com: CommunitySummary | null = comRes.ok ? await comRes.json() : null;

        const unexpired = allCards.filter(c => !isCardExpired(c));
        // Primary first, then newest first — matches backend's order. The
        // first entry is the natural pre-selection.
        unexpired.sort((a, b) => {
          if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        setCards(unexpired);
        setCommunity(com);
        if (unexpired.length === 0) {
          setView('iframe');
        } else {
          setSelectedId(unexpired[0].id);
          setView('confirm');
        }
      } catch {
        // Defensive fallback: if we can't decide which view, default to
        // the iframe (matches pre-restructure behavior).
        if (!cancelled) setView('iframe');
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, communityId]);

  if (!isOpen || !user) return null;

  if (view === 'loading') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" dir="rtl">
        <div className="bg-white rounded-2xl px-8 py-6" style={{ color: '#A1A1AA' }}>
          טוען...
        </div>
      </div>
    );
  }

  if (view === 'iframe') {
    // Identical to the pre-restructure flow: HYP iframe with the
    // tokenize-community Order prefix. The frontend appends userId + ts.
    return (
      <HypPaymentIframeModal
        amount={Math.max(1, amount ?? 1)}
        j5="J2"
        bof
        orderPrefix={`tokenize-community-${communityId}`}
        clientName={user.name || user.email}
        email={user.email}
        userId={user.userId}
        title="עדכון אמצעי תשלום"
        onClose={onClose}
      />
    );
  }

  const selectedCard = cards.find(c => c.id === selectedId) ?? cards[0];

  const confirmBindExisting = async () => {
    setBinding(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/bind-existing-card`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethodId: selectedId }),
        },
      );
      if (!res.ok) {
        // Reuse the manage page's URL-param handler for the failure toast.
        window.location.href = `/communities/${communityId}/manage?card=error`;
        return;
      }
      const result = await res.json();
      // bindTokenizedPaymentMethod returns { community, wasAlreadyBound, wasReactivated }.
      // Match the iframe redirect's ?card=updated vs ?card=existing semantics.
      const cardParam = result?.wasAlreadyBound ? 'existing' : 'updated';
      window.location.href = `/communities/${communityId}/manage?card=${cardParam}`;
    } catch {
      window.location.href = `/communities/${communityId}/manage?card=error`;
    }
  };

  if (view === 'picker') {
    return (
      <CardPickerModal
        cards={cards.map(c => ({ id: c.id, cardLastFour: c.cardLastFour, cardBrand: c.cardBrand }))}
        selectedId={selectedId}
        currentlyBoundId={community?.paymentMethodId ?? undefined}
        onCancel={onClose}
        onSelect={(id) => {
          setSelectedId(id);
          setView('confirm');
        }}
        onAddNew={() => setView('iframe')}
      />
    );
  }

  // Suspended community → this flow renews the subscription, so include the
  // price in the button label. Active community → just a card swap, no
  // charge, no need to show the price (it's right above in the price box).
  const monthlyPrice = Math.max(1, amount ?? 1);
  const actionLabel = wasSuspended
    ? `חידוש מנוי ב₪${monthlyPrice}`
    : 'עדכון כרטיס';

  // view === 'confirm'
  return (
    <ExistingCardConfirmModal
      title={community?.name ?? 'עדכון אמצעי תשלום'}
      logoUrl={community?.logo ?? community?.image ?? null}
      monthlyPrice={monthlyPrice}
      selectedCard={{
        id: selectedCard.id,
        cardLastFour: selectedCard.cardLastFour,
        cardBrand: selectedCard.cardBrand,
      }}
      actionLabel={actionLabel}
      loading={binding}
      onCancel={onClose}
      onConfirm={confirmBindExisting}
      onSwitchCard={() => setView('picker')}
    />
  );
}
