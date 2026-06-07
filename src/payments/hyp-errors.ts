// Phase 6 Mission 6.5 — map HYP CCodes to user-facing Hebrew reasons.
// Gender-neutral, passive voice (rule #5). Caller decides whether to
// surface the "specific" message inline (for emails: only when isSpecific
// to avoid "הסיבה: החיוב נכשל" which adds nothing).
//
// Sources: HYP status-code reference + empirical observations from
// Phase 4/5 smoke tests (e.g. CCode=33 seen during token-corruption
// tests). Update this table when HYP confirms new codes in the wild.

const HEBREW_BY_CCODE: Record<string, string> = {
  // General-purpose declines
  '1': 'החיוב נדחה על ידי הבנק',
  '2': 'החיוב נדחה על ידי הבנק',
  '4': 'הכרטיס נדחה',
  '5': 'הכרטיס נדחה',

  // Input validation
  '6': 'פרטי הכרטיס שגויים (CVV או תעודת זהות)',
  '26': 'תעודת הזהות שגויה',

  // Card/token issues
  '33': 'בעיה עם הכרטיס',
  '36': 'הכרטיס פג תוקף',

  // 3DS / brand-specific
  '141': 'בעיית אישור עם הבנק',

  // Network / generic card-side
  '447': 'בעיית חיוב — נא לפנות לבנק',
  '997': 'בעיית חיוב — נא לפנות לבנק',
  '998': 'בעיית חיוב — נא לפנות לבנק',
  '999': 'בעיית תקשורת — נא לנסות שוב מאוחר יותר',
};

const GENERIC = 'החיוב נכשל';

export function hypCCodeToHebrew(ccode: string | null | undefined): {
  message: string;
  isSpecific: boolean;
} {
  if (!ccode) return { message: GENERIC, isSpecific: false };
  const specific = HEBREW_BY_CCODE[ccode];
  if (specific) return { message: specific, isSpecific: true };
  return { message: GENERIC, isSpecific: false };
}
