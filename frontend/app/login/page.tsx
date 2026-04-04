'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Image from 'next/image';
import Link from 'next/link';
import SiteHeader from '../components/SiteHeader';
import GoogleIcon from '../components/icons/GoogleIcon';
import MailIcon from '../components/icons/MailIcon';
import KeyIcon from '../components/icons/KeyIcon';
import { clearSessionData } from '../lib/auth';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'info'>('error');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  // Clear any expired tokens on mount
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.exp || payload.exp * 1000 < Date.now()) {
          clearSessionData();
        }
      }
    } catch { clearSessionData(); }
  }, []);

  useEffect(() => {
    // Check for Google auth error
    const errorParam = searchParams.get('error');
    if (errorParam === 'account_exists') {
      setMessage('חשבון עם כתובת האימייל הזו כבר קיים. אנא התחבר עם האימייל והסיסמא שלך.');
      setMessageType('error');
    } else if (errorParam === 'google_failed') {
      setMessage('שגיאה בהתחברות עם Google. אנא נסה שוב.');
      setMessageType('error');
    }

    // Check for expired session
    const expiredParam = searchParams.get('expired');
    if (expiredParam === 'true') {
      setMessage('פג תוקף ההתחברות. אנא התחבר מחדש.');
      setMessageType('info');
    }

    // Check URL param first, then localStorage
    const returnParam = searchParams.get('returnUrl');
    const redirectParam = searchParams.get('redirect');
    if (returnParam) {
      setReturnUrl(returnParam);
    } else if (redirectParam) {
      setReturnUrl(redirectParam);
    } else {
      // Check localStorage (set by signup page before email verification)
      const storedReturnUrl = localStorage.getItem('returnUrl');
      if (storedReturnUrl) {
        setReturnUrl(storedReturnUrl);
        localStorage.removeItem('returnUrl');
      }
    }
  }, [searchParams]);

  const scrollToField = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.focus();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setEmailError('');
    setPasswordError('');

    // Validate fields before submitting
    if (!email.trim()) {
      setEmailError('יש להזין כתובת אימייל');
      scrollToField('login-email');
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('כתובת אימייל לא תקינה');
      scrollToField('login-email');
      return;
    }

    if (!password) {
      setPasswordError('יש להזין סיסמה');
      scrollToField('login-password');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.access_token) {
        localStorage.setItem('token', data.access_token);
        // Set cookie for middleware auth (30 days to match JWT expiry)
        document.cookie = `auth-token=${data.access_token}; path=/; max-age=2592000; SameSite=Lax`;
        
        // Check for pending community join
        const pendingJoinCommunity = localStorage.getItem('pendingJoinCommunity');
        if (pendingJoinCommunity) {
          localStorage.removeItem('pendingJoinCommunity');
          const pendingPayment = localStorage.getItem('pendingPayment');
          localStorage.removeItem('pendingPayment');
          
          if (pendingPayment) {
            router.push(`/communities/${pendingJoinCommunity}/preview?showPayment=true`);
          } else {
            // Try to join directly
            try {
              const joinRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${pendingJoinCommunity}/join`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${data.access_token}` },
              });
              if (joinRes.ok) {
                router.push(`/communities/${pendingJoinCommunity}/feed`);
              } else {
                router.push(`/communities/${pendingJoinCommunity}/preview`);
              }
            } catch {
              router.push(`/communities/${pendingJoinCommunity}/preview`);
            }
          }
        } else {
          router.push(returnUrl || '/');
        }
      } else {
        // Parse specific error messages and show inline
        const errorMsg = data.message || '';
        if (errorMsg.includes('User not found') || errorMsg.includes('not found')) {
          setEmailError('לא נמצא חשבון עם כתובת אימייל זו');
          scrollToField('login-email');
        } else if (errorMsg.includes('Incorrect password') || errorMsg.includes('password')) {
          setPasswordError('הסיסמה שגויה');
          scrollToField('login-password');
        } else {
          setMessage('ההתחברות נכשלה. אנא בדוק את הפרטים ונסה שוב');
          setMessageType('error');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setMessage('שגיאה בהתחברות. אנא נסה שוב מאוחר יותר');
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
      {/* Top Navbar */}
      <SiteHeader hideAuthButtons={true} />

      {/* Content Area */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl p-8 shadow-sm">
            <form
              onSubmit={handleLogin}
              className="w-full flex flex-col gap-4 text-right"
            >
                <h1 className="text-[21px] text-center mb-2" style={{ fontWeight: 600 }}>התחברות</h1>

                {/* Google Button */}
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg text-[16px] hover:opacity-80 transition border"
                  style={{ borderColor: '#E1E1E2', backgroundColor: '#F4F4F5' }}
                >
                  התחברות מהירה עם Google
                  <GoogleIcon className="w-5 h-5" />
                </a>

                <div className="relative my-3 text-center text-[12px]" style={{ color: '#A1A1AA' }}>
                  <span className="bg-white px-3 relative z-10">או באמצעות מייל</span>
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full" style={{ borderTop: '1px solid #E1E1E2' }}></div>
                  </div>
                </div>

                {/* Email Field */}
                <div>
                  <div className="relative">
                    <MailIcon className="absolute right-3 top-3.5 pointer-events-none w-5 h-5 text-black" />
                    <input
                      id="login-email"
                      type="text"
                      placeholder="כתובת אימייל"
                      className={`auth-input w-full p-3 pr-10 border rounded-lg focus:outline-none text-[14px]`}
                      style={{ borderColor: emailError ? '#B3261E' : '#D0D0D4' }}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError('');
                      }}
                    />
                  </div>
                  {emailError && (
                    <div className="mt-2 flex items-center gap-2 text-sm p-2 rounded-lg" style={{ color: '#B3261E', backgroundColor: '#FEE2E2' }}>
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#B3261E" strokeWidth="2"/><line x1="12" y1="8" x2="12" y2="13" stroke="#B3261E" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16.5" r="1" fill="#B3261E"/></svg>
                      <p>{emailError}</p>
                    </div>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <div className="relative">
                    <KeyIcon className="absolute right-3 top-3.5 w-5 h-5 text-black" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="סיסמה"
                      className={`auth-input w-full p-3 pr-10 pl-10 border rounded-lg focus:outline-none text-[14px]`}
                      style={{ borderColor: passwordError ? '#B3261E' : '#D0D0D4' }}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (passwordError) setPasswordError('');
                      }}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-3.5 transition-colors"
                      style={{ color: '#A1A1AA' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#52525B'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#A1A1AA'}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  {passwordError && (
                    <div className="mt-2 flex items-center gap-2 text-sm p-2 rounded-lg" style={{ color: '#B3261E', backgroundColor: '#FEE2E2' }}>
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#B3261E" strokeWidth="2"/><line x1="12" y1="8" x2="12" y2="13" stroke="#B3261E" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16.5" r="1" fill="#B3261E"/></svg>
                      <p>{passwordError}</p>
                    </div>
                  )}
                </div>

                <div className="text-left">
                  <a href="/forgot-password" className="text-[14px] hover:underline" style={{ color: '#52525B' }}>
                    שכחת סיסמה?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !email || !password}
                  className="bg-black text-white py-3 transition-colors font-medium disabled:cursor-not-allowed"
                  style={{ borderRadius: '12px', backgroundColor: (isSubmitting || !email || !password) ? '#D0D0D4' : 'black' }}
                  onMouseEnter={(e) => !(isSubmitting || !email || !password) && (e.currentTarget.style.backgroundColor = '#3F3F46')}
                  onMouseLeave={(e) => !(isSubmitting || !email || !password) && (e.currentTarget.style.backgroundColor = 'black')}
                >
                  {isSubmitting ? 'מתחבר...' : 'התחברות'}
                </button>

                {message && (
                  <div className="flex items-center gap-2 text-[14px] p-2 rounded-lg" style={{ 
                    color: messageType === 'error' ? '#B3261E' : '#003233',
                    backgroundColor: messageType === 'error' ? '#FEE2E2' : '#E0F2FE'
                  }}>
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16.5" r="1" fill="currentColor"/></svg>
                    <p>{message}</p>
                  </div>
                )}

                <p className="text-center text-[14px] mt-2">
                  עדיין לא הצטרפת?{' '}
                  <a href={`/signup${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`} className="text-black font-medium hover:underline">
                    הירשמו כאן
                  </a>
                </p>
              </form>
            </div>
          </div>
        </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">טוען...</div>}>
      <LoginContent />
    </Suspense>
  );
}
