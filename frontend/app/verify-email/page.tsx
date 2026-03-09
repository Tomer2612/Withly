'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SiteHeader from '../components/SiteHeader';
import CloseIcon from '../components/icons/CloseIcon';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('טוקן אימות חסר');
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-email/${token}`);
        const data = await res.json();

        if (res.ok) {
          setStatus('success');
          setMessage('האימייל אומת בהצלחה!');
        } else {
          setStatus('error');
          setMessage(data.message || 'אימות נכשל');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage('שגיאה באימות האימייל');
      }
    };

    verifyEmail();
  }, [token]);

  if (status === 'loading') {
    return (
      <main className="min-h-screen flex flex-col" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
        <SiteHeader hideAuthButtons={true} />

        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center text-center" style={{ border: '1px solid #D0D0D4' }}>
              {/* Spinner */}
              <div className="w-10 h-10">
                <svg className="animate-spin w-10 h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="#D0D0D4" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="#A7EA7B" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>

              <h1 className="font-semibold text-black" style={{ fontSize: '28px', marginTop: '16px' }}>מאמת את האימייל...</h1>
              
              <p className="text-black" style={{ fontSize: '18px', marginTop: '12px' }}>אנא המתן</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (status === 'success') {
    return (
      <main className="min-h-screen flex flex-col" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
        <SiteHeader hideAuthButtons={true} />

        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center text-center" style={{ border: '1px solid #D0D0D4' }}>
              {/* Success Icon - matching forgot-password style */}
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

              <h1 className="font-semibold text-black" style={{ fontSize: '28px', marginTop: '16px' }}>אימות הושלם!</h1>
              
              <p className="text-black" style={{ fontSize: '18px', marginTop: '12px' }}>{message}</p>

              <a
                href="/login"
                className="bg-black text-white py-3 px-6 transition-colors"
                style={{ fontSize: '18px', marginTop: '24px', borderRadius: '12px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3F3F46'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'black'}
              >
                להתחברות
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Error state
  return (
    <main className="min-h-screen flex flex-col" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
      <SiteHeader hideAuthButtons={true} />

      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center text-center" style={{ border: '1px solid #D0D0D4' }}>
            {/* Error Icon */}
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
              <CloseIcon className="w-5 h-5" style={{ color: '#B3261E' }} />
            </div>

            <h1 className="font-semibold text-black" style={{ fontSize: '28px', marginTop: '16px' }}>אימות נכשל</h1>
            
            <p className="text-black" style={{ fontSize: '18px', marginTop: '12px' }}>{message}</p>

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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F4F4F5' }}>טוען...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
