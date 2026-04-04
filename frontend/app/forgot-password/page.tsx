'use client';

import { useState } from 'react';
import SiteHeader from '../components/SiteHeader';
import MailIcon from '../components/icons/MailIcon';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.message || 'שגיאה בשליחת הבקשה');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setError('שגיאה בשליחת הבקשה');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen flex flex-col" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
        <SiteHeader hideAuthButtons={true} />

        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center text-center" style={{ border: '1px solid #D0D0D4' }}>
              {/* Success Icon - from contact page */}
              <div className="w-10 h-10">
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
                  <rect width="40" height="40" rx="20" fill="#A7EA7B"/>
                  <g transform="translate(8, 8)">
                    <path d="M22 13V6C22 5.46957 21.7893 4.96086 21.4142 4.58579C21.0391 4.21071 20.5304 4 20 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V18C2 19.1 2.9 20 4 20H12" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 7L13.03 12.7C12.7213 12.8934 12.3643 12.996 12 12.996C11.6357 12.996 11.2787 12.8934 10.97 12.7L2 7" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 19L18 21L22 17" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </g>
                </svg>
              </div>

              <h1 className="font-semibold text-black" style={{ fontSize: '28px', marginTop: '16px' }}>נשלח בהצלחה!</h1>
              
              <p className="text-black" style={{ fontSize: '18px', marginTop: '12px' }}>
                אם כתובת האימייל קיימת במערכת, תקבל קישור לאיפוס הסיסמה.
                <br />
                בדוק גם את תיקיית הספאם
              </p>

              <a
                href="/login"
                className="bg-black text-white py-3 px-6 transition-colors"
                style={{ fontSize: '18px', marginTop: '24px', borderRadius: '12px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3F3F46'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'black'}
              >
                חזרה להתחברות
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
      <SiteHeader hideAuthButtons={true} />

      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-8 flex flex-col text-right"
            style={{ border: '1px solid #D0D0D4', gap: '16px' }}
          >
            <h1 className="font-semibold text-black text-center" style={{ fontSize: '28px' }}>שכחתי סיסמה</h1>
            
            <p className="text-center text-black" style={{ fontSize: '16px', marginTop: '-8px' }}>
              הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה
            </p>

            {/* Email Field - matching login/signup */}
            <div>
              <div className="relative">
                <MailIcon className="absolute right-3 top-3.5 pointer-events-none w-5 h-5 text-black" />
                <input
                  id="forgot-email"
                  type="text"
                  placeholder="כתובת אימייל"
                  className="auth-input w-full p-3 pr-10 border rounded-lg focus:outline-none text-[14px]"
                  style={{ borderColor: error ? '#B3261E' : '#D0D0D4' }}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                />
              </div>
              {error && (
                <div className="mt-2 flex items-center gap-2 text-sm p-2 rounded-lg" style={{ color: '#B3261E', backgroundColor: '#FEE2E2' }}>
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#B3261E" strokeWidth="2"/><line x1="12" y1="8" x2="12" y2="13" stroke="#B3261E" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16.5" r="1" fill="#B3261E"/></svg>
                  <p>{error}</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="bg-black text-white py-3 transition-colors disabled:cursor-not-allowed"
              style={{ fontSize: '18px', borderRadius: '12px', backgroundColor: (loading || !email) ? '#D0D0D4' : 'black' }}
              onMouseEnter={(e) => !(loading || !email) && (e.currentTarget.style.backgroundColor = '#3F3F46')}
              onMouseLeave={(e) => !(loading || !email) && (e.currentTarget.style.backgroundColor = 'black')}
            >
              {loading ? 'שולח...' : 'שלח קישור איפוס'}
            </button>

            <p className="text-center" style={{ fontSize: '14px' }}>
              <a href="/login" className="text-black underline hover:opacity-70 transition">
                חזרה להתחברות
              </a>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
