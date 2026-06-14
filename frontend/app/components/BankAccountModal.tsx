'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ISRAEL_BANKS, bankLabel } from '../lib/israelBanks';

export interface BankAccount {
  accountHolderName: string;
  bank: string;
  branchNumber: string;
  accountNumber: string;
  idNumber: string;
}

interface BankAccountModalProps {
  /** Pre-fill for editing; null for first-time setup. */
  initial?: BankAccount | null;
  /** e.g. "שלב 2 מתוך 2" shown centered at the top; omit when standalone. */
  stepLabel?: string;
  /** "הגדרת חשבון בנק" (new) or "עדכון פרטי חשבון בנק" (edit). */
  title: string;
  /** Forward slide-in (the price-flow step 2). Off for the standalone
   *  settings popup, which is just an edit dialog. */
  animateIn?: boolean;
  onCancel: () => void;
  onSaved: (account: BankAccount) => void;
}

const labelStyle = { fontSize: '14px', fontWeight: 400, color: 'var(--color-gray-8)' } as const;
const inputClass =
  'w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black';
const inputStyle = { borderColor: '#D0D0D4' } as const;

// Name: Hebrew/Latin letters + spaces only (no digits, no special chars).
const onlyLetters = (v: string) => v.replace(/[^֐-׿a-zA-Z\s]/g, '');
// Numeric fields: digits only.
const onlyDigits = (v: string) => v.replace(/\D/g, '');

// Prefer a real local logo at /public/banks/<code>.{svg,png,ico}; if none is
// there, fall back to the generic bank glyph — no external calls, no
// broken/placeholder icons. Drop a file in and it appears automatically.
const LOGO_EXTS = ['png', 'svg', 'ico'];
function BankLogo({ code }: { code: string }) {
  const [stage, setStage] = useState(0);
  if (stage < LOGO_EXTS.length) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/banks/${code}.${LOGO_EXTS[stage]}`} alt="" width={22} height={22} className="flex-shrink-0 rounded" onError={() => setStage((s) => s + 1)} />;
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
      <path d="M10 18V11M11.119 2.204a1.5 1.5 0 0 1 1.762 0l7.84 3.846a.5.5 0 0 1-.221.95H3.5a.5.5 0 0 1-.22-.95l7.839-3.846ZM14 18V11M18 18V11M3 22h18M6 18V11" stroke="#3F3F46" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function BankAccountModal({ initial, stepLabel, title, animateIn, onCancel, onSaved }: BankAccountModalProps) {
  const [accountHolderName, setAccountHolderName] = useState(initial?.accountHolderName ?? '');
  const [bankCode, setBankCode] = useState(initial?.bank ?? '');
  const [bankQuery, setBankQuery] = useState(initial?.bank ? bankLabel(initial.bank) : '');
  const [bankOpen, setBankOpen] = useState(false);
  const [branchNumber, setBranchNumber] = useState(initial?.branchNumber ?? '');
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? '');
  const [idNumber, setIdNumber] = useState(initial?.idNumber ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bankBoxRef = useRef<HTMLDivElement>(null);

  // Slide-in only in the step flow; settings shows it immediately.
  const [shown, setShown] = useState(!animateIn);
  useEffect(() => {
    if (!animateIn) return;
    const t = setTimeout(() => setShown(true), 10);
    return () => clearTimeout(t);
  }, [animateIn]);

  const filteredBanks = useMemo(() => {
    const q = bankQuery.trim().toLowerCase();
    // A selected bank shows the full list on reopen (its label is "name (code)"
    // which wouldn't match by name); typing clears the selection and filters.
    if (!q || bankCode) return ISRAEL_BANKS;
    return ISRAEL_BANKS.filter((b) => b.name.toLowerCase().includes(q) || b.code.includes(q));
  }, [bankQuery, bankCode]);

  const resolvedBankCode =
    bankCode ||
    ISRAEL_BANKS.find((b) => b.name === bankQuery.trim() || b.code === bankQuery.trim())?.code ||
    '';

  const canSave =
    accountHolderName.trim().length >= 2 &&
    resolvedBankCode !== '' &&
    branchNumber.trim() !== '' &&
    accountNumber.trim() !== '' &&
    idNumber.trim().length >= 5 &&
    confirmed;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    const payload: BankAccount = {
      accountHolderName: accountHolderName.trim(),
      bank: resolvedBankCode,
      branchNumber: branchNumber.trim(),
      accountNumber: accountNumber.trim(),
      idNumber: idNumber.trim(),
    };
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/bank-account`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('save failed');
      onSaved(payload);
    } catch {
      setError('שמירת פרטי החשבון נכשלה. יש לנסות שוב.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white p-6"
        dir="rtl"
        style={{
          borderRadius: '16px',
          width: '100%',
          maxWidth: 'min(92vw, 460px)',
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateX(0)' : 'translateX(-20px)',
          transition: animateIn ? 'opacity 250ms ease-out, transform 250ms ease-out' : undefined,
        }}
      >
        {stepLabel && (
          <p className="text-center" style={{ ...labelStyle, marginBottom: '8px' }}>{stepLabel}</p>
        )}
        <h2 className="text-center font-semibold text-black" style={{ fontSize: '21px' }}>{title}</h2>
        <p className="text-center mt-1" style={{ fontSize: '18px', fontWeight: 400, color: 'var(--color-gray-10)' }}>
          ההכנסות ממנויי הקהילה יועברו לחשבון זה אחת לחודש
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block mb-2" style={labelStyle}>שם בעל החשבון</label>
            <input
              type="text"
              className={inputClass}
              style={inputStyle}
              placeholder="בדיוק כפי שמופיע בחשבון הבנק"
              maxLength={100}
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(onlyLetters(e.target.value))}
            />
          </div>

          {/* Bank — searchable dropdown (filter by name or code), with logos. */}
          <div className="relative" ref={bankBoxRef}>
            <label className="block mb-2" style={labelStyle}>בנק</label>
            <div className="relative">
              <input
                type="text"
                className={inputClass}
                style={{ ...inputStyle, paddingRight: bankCode ? '2.75rem' : undefined }}
                placeholder="בחירת בנק"
                value={bankQuery}
                onChange={(e) => { setBankQuery(e.target.value); setBankCode(''); setBankOpen(true); }}
                onFocus={(e) => { setBankOpen(true); e.currentTarget.select(); }}
                onClick={() => setBankOpen(true)}
                onBlur={() => setTimeout(() => setBankOpen(false), 150)}
              />
              {/* Selected bank's logo, shown inside the field (RTL start). */}
              {bankCode && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <BankLogo code={bankCode} />
                </span>
              )}
              {/* Chevron toggles the list. preventDefault keeps the input from
                  blurring first (which would race the open/close). */}
              <button
                type="button"
                aria-label="פתיחת רשימת הבנקים"
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setBankOpen((o) => !o)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform ${bankOpen ? 'rotate-180' : ''}`}>
                  <path d="M6 9l6 6 6-6" stroke="#71717A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {bankOpen && filteredBanks.length > 0 && (
                <div
                  className="absolute z-10 w-full mt-1 bg-white border rounded-lg overflow-hidden"
                  style={{ borderColor: '#D0D0D4' }}
                >
                  {/* Native RTL list: the (global pill) scrollbar sits on the
                      left, inset from the rounded corners by p-1.5. Each item is dir="rtl". */}
                  <div className="p-1.5" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    {filteredBanks.map((b) => (
                      <button
                        key={b.code}
                        type="button"
                        dir="rtl"
                        className="w-full text-right px-3 py-2.5 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setBankCode(b.code); setBankQuery(`${b.name} (${b.code})`); setBankOpen(false); }}
                      >
                        <BankLogo code={b.code} />
                        <span className="text-[16px] text-black">{b.name}</span>
                        <span className="text-[14px]" style={{ color: 'var(--color-gray-8)' }}>({b.code})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account number (wide) then branch (narrow). */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block mb-2" style={labelStyle}>מספר חשבון</label>
              <input type="text" inputMode="numeric" maxLength={13} className={inputClass} style={inputStyle}
                value={accountNumber} onChange={(e) => setAccountNumber(onlyDigits(e.target.value))} />
            </div>
            <div className="w-28 flex-shrink-0">
              <label className="block mb-2" style={labelStyle}>מספר סניף</label>
              <input type="text" inputMode="numeric" maxLength={3} className={inputClass} style={inputStyle}
                value={branchNumber} onChange={(e) => setBranchNumber(onlyDigits(e.target.value))} />
            </div>
          </div>

          <div>
            <label className="block mb-2" style={labelStyle}>מספר ת.ז</label>
            <input type="text" inputMode="numeric" maxLength={9} className={inputClass} style={inputStyle}
              value={idNumber} onChange={(e) => setIdNumber(onlyDigits(e.target.value))} />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 flex-shrink-0" />
            <span className="text-[14px]" style={{ color: 'var(--color-gray-8)' }}>
              בדקתי ואישרתי שפרטי החשבון מדויקים. ידוע לי ש-Withly לא תישא באחריות לעיכובים או אובדן כספים במקרה של הזנת פרטים שגויים
            </span>
          </label>
        </div>

        {error && <p className="mt-3 text-center text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>}

        <div className="flex gap-3 justify-center mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem', borderColor: 'var(--color-black)' }}
            className="bg-white text-black border hover:bg-gray-50 transition disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem' }}
            className="bg-black text-white hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'שומר...' : 'שמירה וסיום'}
          </button>
        </div>
      </div>
    </div>
  );
}
