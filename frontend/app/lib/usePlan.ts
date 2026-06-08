import { useEffect, useState } from 'react';

export interface Plan {
  id: string;
  slug: string;
  name: string;
  monthlyPriceILS: number;
  commissionBasisPoints: number;
  trialLengthMonths: number;
  isActive: boolean;
  isDefault: boolean;
  features: unknown | null;
}

// Fetches the default platform plan from /api/plans/default on mount.
// Returns null while loading or on error — callers should handle that
// case (loading skeleton or hardcoded fallback for the initial paint).
// One source of truth for plan price + trial length + name — replaces
// the old hardcoded WITHLY_MONTHLY_PRICE and TRIAL_LENGTH_MONTHS
// constants scattered across the frontend.
// Fetches all active platform plans from /api/plans (ordered cheapest-first
// by the backend) on mount. Returns null while loading or on error — the
// pricing page falls back to a hardcoded two-plan scaffold for first paint.
export function useActivePlans(): Plan[] | null {
  const [plans, setPlans] = useState<Plan[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/plans`);
        if (!res.ok) return;
        const data = (await res.json()) as Plan[];
        if (!cancelled) setPlans(data);
      } catch {
        // Silent fail — caller handles the null state.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return plans;
}

export function useDefaultPlan(): Plan | null {
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/plans/default`);
        if (!res.ok) return;
        const data = (await res.json()) as Plan;
        if (!cancelled) setPlan(data);
      } catch {
        // Silent fail — caller handles the null state.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return plan;
}
