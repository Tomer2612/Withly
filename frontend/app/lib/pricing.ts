// Source of truth (frontend mirror) for Withly platform pricing. Backend
// equivalent lives at src/users/users.service.ts. Both must move together
// when the plan price changes. Pre-launch the value is hardcoded here;
// once we add multiple plans the right move is to fetch it from a
// /pricing endpoint and drop this file.
export const WITHLY_MONTHLY_PRICE = 99;
