// Client-side helper that hands off to HYP's hosted payment page.
//
// Usage from any button onClick:
//   await startHypPayment({
//     amount: 99,
//     clientName: user.name,
//     email: user.email,
//     order: `withly-owner-sub-${communityId}`,
//   });
//
// On success, the user's browser navigates to HYP. On failure, the promise
// rejects with the API error so the caller can show a banner.

export interface StartHypPaymentInput {
  /** Amount in ILS (whole number). */
  amount: number;
  clientName: string;
  email: string;
  /** Internal order id; HYP echoes it back on the success redirect. */
  order: string;
  /** Optional free-text description. Defaults server-side to userId tag. */
  info?: string;
  /**
   * Frontend path to land on after payment-success verification. Encoded
   * into HYP's Info field so it round-trips. E.g. "/test-hyp" or
   * "/communities/{slug}/manage". Defaults to "/" if omitted.
   */
  redirectPath?: string;
}

export async function startHypPayment(input: StartHypPaymentInput): Promise<never> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/create-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || 'Failed to create payment');
  }

  const { url } = (await res.json()) as { url: string };
  if (!url) {
    throw new Error('Payment URL missing from server response');
  }

  // Hard navigation away from the SPA so HYP's hosted page renders cleanly
  // and back-button history works as expected. This function never returns.
  window.location.href = url;
  // Type assertion: we navigated, so anything after this is unreachable.
  return new Promise<never>(() => {});
}
