// Owner free-trial end date for the Manage → payments disclosure.
//
// The trial is the stretch before the owner's FIRST successful SOFT charge.
// While no charge has happened, that charge date is community.nextBillingDate —
// the exact column the billing cron reads — so a trial extended by moving
// nextBillingDate out (e.g. a goodwill extension) is shown with the real date.
//
// "Never charged" = currentPeriodStart is null: it's only ever set by a
// successful owner charge (monthly cron or suspension recovery) and never
// cleared. Legacy rows without nextBillingDate fall back to
// trialStartDate + plan trial length (the pre-HYP computation).
//
// Returns the trial end while the trial is still running, otherwise null
// (caller then shows the regular "next billing" line).
export function getActiveTrialEnd(
  c: {
    trialStartDate: Date | null;
    nextBillingDate: Date | null;
    currentPeriodStart: Date | null;
    trialLengthMonths: number;
  },
  now: Date = new Date(),
): Date | null {
  if (c.currentPeriodStart) return null;

  let end = c.nextBillingDate;
  if (!end && c.trialStartDate) {
    end = new Date(c.trialStartDate);
    end.setMonth(end.getMonth() + c.trialLengthMonths);
  }
  return end && end > now ? end : null;
}
