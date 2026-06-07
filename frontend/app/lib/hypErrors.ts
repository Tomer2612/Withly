// Phase 6 Mission 6.5 — frontend mirror of src/payments/hyp-errors.ts.
// Kept manually in sync (small table, low churn). When backend throws
// CHARGE_FAILED:<ccode> in an error body or surfaces a ccode via URL
// param, the receiving page passes the ccode here for the user-facing
// Hebrew copy. Falls back to "החיוב נכשל" for unmapped codes.

const HEBREW_BY_CCODE: Record<string, string> = {
  '1': 'החיוב נדחה על ידי הבנק',
  '2': 'החיוב נדחה על ידי הבנק',
  '4': 'הכרטיס נדחה',
  '5': 'הכרטיס נדחה',
  '6': 'פרטי הכרטיס שגויים (CVV או תעודת זהות)',
  '26': 'תעודת הזהות שגויה',
  '33': 'בעיה עם הכרטיס',
  '36': 'הכרטיס פג תוקף',
  '141': 'בעיית אישור עם הבנק',
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
