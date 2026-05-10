'use client';

// Temporary HYP integration test page. Lets a logged-in user kick off a real
// payment with the HYP test card and observe the redirect-back behavior.
// Delete when the actual payment flows (pricing, preview, UpdateCardModal)
// are wired to startHypPayment().

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '../../lib/UserContext';
import { startHypPayment } from '../../lib/hypPayment';

export default function TestHypPage() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const paid = searchParams.get('paid');

  const [amount, setAmount] = useState(10);
  const [clientName, setClientName] = useState('Test User');
  const [email, setEmail] = useState('test@example.com');
  const [order, setOrder] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill defaults from the logged-in user once context loads, and seed
  // a fresh order id so each test run is uniquely identifiable.
  useEffect(() => {
    setOrder(`test-${Date.now()}`);
    if (user?.email) setEmail(user.email);
  }, [user]);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await startHypPayment({ amount, clientName, email, order, redirectPath: '/test-hyp' });
      // never returns — page navigates to HYP
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen p-8" dir="rtl">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold">בדיקת תשלום HYP</h1>

        {paid === 'ok' && (
          <div className="bg-green-100 text-green-800 border border-green-200 rounded p-3 text-sm">
            ✅ התשלום אומת בהצלחה. Order: {searchParams.get('order')}
          </div>
        )}
        {paid === 'fail' && (
          <div className="bg-red-50 text-red-800 border border-red-200 rounded p-3 text-sm">
            ❌ התשלום נכשל. CCode: {searchParams.get('ccode')}
          </div>
        )}
        {paid === 'error' && (
          <div className="bg-red-50 text-red-800 border border-red-200 rounded p-3 text-sm">
            ❌ שגיאה בתהליך האימות.
          </div>
        )}

        <p className="text-sm text-gray-600">
          שולח בקשת תשלום אמיתית ל-HYP. כרטיס לבדיקות:<br />
          <code className="bg-gray-100 px-1">5326107300020772</code> / 05/31 / 125 / 000000000<br />
          מומלץ סכומים נמוכים (5–10 ₪).
        </p>

        <div>
          <label className="block text-sm font-medium mb-1">סכום (₪)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">שם הלקוח</label>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">אימייל</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Order ID</label>
          <input
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-black text-white rounded py-3 font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? 'יוצר קישור תשלום...' : 'תשלום באמצעות HYP'}
        </button>

        {error && (
          <div className="bg-red-50 text-red-800 border border-red-200 rounded p-3 text-sm">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
