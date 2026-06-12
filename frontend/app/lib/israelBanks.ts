// Israeli banks for the payout bank-account dropdown. `code` is the
// Bank-of-Israel bank number (stored + used for transfers/MASAV). `domain`
// is reference metadata (the bank's site); logos are local files served from
// /public/banks/<code>.png. Sorted by code ascending. Verify codes against
// the official Bank-of-Israel list before relying on live transfers.
export interface IsraelBank {
  code: string;
  name: string;
  domain: string;
}

export const ISRAEL_BANKS: IsraelBank[] = [
  { code: '03', name: 'אש ישראל', domain: 'esh.bank' },
  { code: '04', name: 'יהב', domain: 'bank-yahav.co.il' },
  { code: '10', name: 'לאומי', domain: 'leumi.co.il' },
  { code: '11', name: 'דיסקונט', domain: 'discountbank.co.il' },
  { code: '12', name: 'הפועלים', domain: 'bankhapoalim.co.il' },
  { code: '14', name: 'אוצר החייל', domain: 'bankotsar.co.il' },
  { code: '17', name: 'מרכנתיל', domain: 'mercantile.co.il' },
  { code: '18', name: 'וואן זירו', domain: 'onezero.co.il' },
  { code: '20', name: 'מזרחי טפחות', domain: 'mizrahi-tefahot.co.il' },
  { code: '31', name: 'הבינלאומי', domain: 'fibi.co.il' },
  { code: '46', name: 'מסד', domain: 'bankmassad.co.il' },
  { code: '54', name: 'ירושלים', domain: 'bankjerusalem.co.il' },
];

// Resolve a stored bank value (code, or legacy free-text) to a display label.
export function bankLabel(value: string | null | undefined): string {
  if (!value) return '';
  const match = ISRAEL_BANKS.find((b) => b.code === value || b.name === value);
  return match ? `${match.name} (${match.code})` : value;
}
