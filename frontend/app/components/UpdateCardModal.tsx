'use client';

import { useUser } from '../lib/UserContext';
import HypPaymentIframeModal from './HypPaymentIframeModal';

interface UpdateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  /** Whether the community is currently suspended. Informational only — the
   *  success path is a full-page redirect via BOF=True, so the parent
   *  doesn't get an inline result. The parent page reads ?card=updated /
   *  ?card=existing / ?card=error from the URL after the redirect. */
  wasSuspended: boolean;
  /** ILS amount displayed on the HYP page. J5=J2 doesn't charge, but HYP
   *  always shows the value — pass the community's monthly price for
   *  contextual clarity ("this card will be billed ~₪X/mo"). Falls back to
   *  1 if not provided. */
  amount?: number;
}

// Phase 3.2 — community billing-card update modal. Thin wrapper around
// HypPaymentIframeModal: mounts the HYP J5=J2 validation page in an
// iframe with an Order prefix the backend uses to dispatch to the
// community-binding flow (vs. the personal-wallet flow on /settings).
//
// Note: the old onSuccess(data) callback no longer applies. With
// BOF=True, completing the payment redirects the parent window away, so
// callers read ?card=updated / ?card=error from the URL after the
// redirect lands — see manage/page.tsx and settings/page.tsx handlers.
export default function UpdateCardModal({
  isOpen,
  onClose,
  communityId,
  wasSuspended: _wasSuspended,
  amount,
}: UpdateCardModalProps) {
  const { user } = useUser();

  if (!isOpen || !user) {
    return null;
  }

  // HypPaymentIframeModal appends "-<userId>-<timestamp>" to the prefix.
  // Final Order shape: tokenize-community-<communityId>-<userId>-<ts>.
  // Backend regex destructures: communityId then userId.
  const orderPrefix = `tokenize-community-${communityId}`;

  return (
    <HypPaymentIframeModal
      // Clamp to >= 1: HYP rejects 0 (donation mode); our DTO has @Min(1).
      // A community with price=0 (free) would otherwise crash the modal here.
      amount={Math.max(1, amount ?? 1)}
      j5="J2"
      bof
      orderPrefix={orderPrefix}
      clientName={user.name || user.email}
      email={user.email}
      userId={user.userId}
      title="עדכון אמצעי תשלום"
      onClose={onClose}
    />
  );
}
