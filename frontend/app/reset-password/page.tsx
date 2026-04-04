'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FaCheck, FaTimes, FaEye, FaEyeSlash } from 'react-icons/fa';
import SiteHeader from '../components/SiteHeader';
import LockIcon from '../components/icons/LockIcon';

// Password requirements
const passwordRequirements = [
  { id: 'length', label: 'לפחות 8 תווים', test: (p: string) => p.length >= 8 },
  { id: 'uppercase', label: 'אות גדולה באנגלית', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'אות קטנה באנגלית', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'מספר אחד לפחות', test: (p: string) => /[0-9]/.test(p) },
];

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [status, setStatus] = useState<'form' | 'success' | 'error'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  // Check password strength
  const passwordStrength = passwordRequirements.filter(req => req.test(password)).length;
  const isPasswordValid = passwordStrength === passwordRequirements.length;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const getStrengthColor = () => {
    if (passwordStrength === 0) return '#E1E1E2';
    if (passwordStrength === 1) return '#B3261E';
    if (passwordStrength === 2) return '#F59E0B';
    if (passwordStrength === 3) return '#F59E0B';
    return '#163300';
  };

  const getStrengthText = () => {
    if (password.length === 0) return '';
    if (passwordStrength === 1) return 'חלשה מאוד';
    if (passwordStrength === 2) return 'חלשה';
    if (passwordStrength === 3) return 'בינונית';
    return 'חזקה';
  };

  const scrollToField = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPasswordError('');
    setConfirmPasswordError('');

    if (!isPasswordValid) {
      setPasswordError('הסיסמה לא עומדת בדרישות');
      scrollToField('reset-password');
      return;
    }

    if (!passwordsMatch) {
      setConfirmPasswordError('הסיסמאות אינן תואמות');
      scrollToField('reset-confirm-password');
      return;
    }

    if (!token) {
      setError('טוקן איפוס חסר');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
      } else {
        setError(data.message || 'איפוס הסיסמה נכשל');
        if (data.message?.includes('expired') || data.message?.includes('Invalid')) {
          setStatus('error');
        }
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setError('שגיאה באיפוס הסיסמה');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <main className="min-h-screen flex flex-col" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
        <SiteHeader hideAuthButtons={true} />

        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center text-center" style={{ border: '1px solid #D0D0D4' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <FaTimes className="w-5 h-5" style={{ color: '#B3261E' }} />
              </div>

              <h1 className="font-semibold text-black" style={{ fontSize: '28px', marginTop: '16px' }}>קישור לא תקין</h1>
              
              <p className="text-black" style={{ fontSize: '18px', marginTop: '12px' }}>
                הקישור לאיפוס הסיסמה אינו תקין או פג תוקפו
              </p>

              <a
                href="/forgot-password"
                className="bg-black text-white py-3 px-6 transition-colors"
                style={{ fontSize: '18px', marginTop: '24px', borderRadius: '12px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3F3F46'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'black'}
              >
                בקש קישור חדש
              </a>
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
              <div className="w-10 h-10">
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
                  <rect width="40" height="40" rx="20" fill="#A7EA7B"/>
                  <g transform="translate(10, 10)">
                    <path d="M16.6667 5L7.50001 14.1667L3.33334 10" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </g>
                </svg>
              </div>

              <h1 className="font-semibold text-black" style={{ fontSize: '28px', marginTop: '16px' }}>הסיסמה אופסה בהצלחה!</h1>
              
              <p className="text-black" style={{ fontSize: '18px', marginTop: '12px' }}>
                כעת תוכל להתחבר עם הסיסמה החדשה
              </p>

              <button
                onClick={() => router.push('/login')}
                className="bg-black text-white py-3 px-6 transition-colors"
                style={{ fontSize: '18px', marginTop: '24px', borderRadius: '12px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3F3F46'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'black'}
              >
                להתחברות
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen flex flex-col" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
        <SiteHeader hideAuthButtons={true} />

        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center text-center" style={{ border: '1px solid #D0D0D4' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <FaTimes className="w-5 h-5" style={{ color: '#B3261E' }} />
              </div>

              <h1 className="font-semibold text-black" style={{ fontSize: '28px', marginTop: '16px' }}>איפוס נכשל</h1>
              
              <p className="text-black" style={{ fontSize: '18px', marginTop: '12px' }}>{error}</p>

              <a
                href="/forgot-password"
                className="bg-black text-white py-3 px-6 transition-colors"
                style={{ fontSize: '18px', marginTop: '24px', borderRadius: '12px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3F3F46'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'black'}
              >
                בקש קישור חדש
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
            <h1 className="font-semibold text-black text-center" style={{ fontSize: '28px' }}>איפוס סיסמה</h1>
            
            <p className="text-center text-black" style={{ fontSize: '16px', marginTop: '-8px' }}>
              הזן את הסיסמה החדשה שלך
            </p>

            {/* Password Field */}
            <div>
              <div className="relative">
                <LockIcon className="absolute right-3 top-3.5 pointer-events-none w-5 h-5 text-black" />
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="סיסמה חדשה *"
                  className="auth-input w-full p-3 pr-10 pl-10 border rounded-lg focus:outline-none text-[14px]"
                  style={{
                    borderColor: passwordError
                      ? '#B3261E'
                      : password && isPasswordValid 
                      ? '#163300' 
                      : password && !isPasswordValid
                      ? '#F59E0B'
                      : '#D0D0D4'
                  }}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3.5 transition-colors"
                  style={{ color: '#A1A1AA' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#52525B'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#A1A1AA'}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#E1E1E2' }}>
                      <div 
                        className="h-full transition-all duration-300"
                        style={{ width: `${(passwordStrength / 4) * 100}%`, backgroundColor: getStrengthColor() }}
                      />
                    </div>
                    <span className="text-xs font-medium" style={{
                      color: passwordStrength === 4 ? '#163300' : 
                      passwordStrength >= 3 ? '#F59E0B' : '#B3261E'
                    }}>
                      {getStrengthText()}
                    </span>
                  </div>

                  {/* Requirements List */}
                  {(passwordFocused || !isPasswordValid) && (
                    <div className="rounded-lg p-3 space-y-1" style={{ backgroundColor: '#FCFCFC' }}>
                      {passwordRequirements.map(req => (
                        <div key={req.id} className="flex items-center gap-2 text-sm">
                          {req.test(password) ? (
                            <FaCheck className="w-3 h-3" style={{ color: '#163300' }} />
                          ) : (
                            <FaTimes className="w-3 h-3" style={{ color: '#D0D0D4' }} />
                          )}
                          <span style={{ color: req.test(password) ? '#163300' : '#7A7A83' }}>
                            {req.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {passwordError && (
                <div className="mt-2 flex items-center gap-2 text-sm p-2 rounded-lg" style={{ color: '#B3261E', backgroundColor: '#FEE2E2' }}>
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#B3261E" strokeWidth="2"/><line x1="12" y1="8" x2="12" y2="13" stroke="#B3261E" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16.5" r="1" fill="#B3261E"/></svg>
                  <p>{passwordError}</p>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <div className="relative">
                <LockIcon className="absolute right-3 top-3.5 pointer-events-none w-5 h-5 text-black" />
                <input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="אימות סיסמה *"
                  className="auth-input w-full p-3 pr-10 pl-10 border rounded-lg focus:outline-none text-[14px]"
                  style={{
                    borderColor: confirmPasswordError
                      ? '#B3261E'
                      : confirmPassword && passwordsMatch 
                      ? '#163300' 
                      : confirmPassword && !passwordsMatch
                      ? '#B3261E'
                      : '#D0D0D4'
                  }}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmPasswordError) setConfirmPasswordError('');
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-3 top-3.5 transition-colors"
                  style={{ color: '#A1A1AA' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#52525B'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#A1A1AA'}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <div className="mt-2 flex items-center gap-2 text-sm p-2 rounded-lg" style={{ color: '#B3261E', backgroundColor: '#FEE2E2' }}>
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#B3261E" strokeWidth="2"/><line x1="12" y1="8" x2="12" y2="13" stroke="#B3261E" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16.5" r="1" fill="#B3261E"/></svg>
                  <p>הסיסמאות אינן תואמות</p>
                </div>
              )}
              {confirmPassword && passwordsMatch && (
                <p className="mt-1 text-sm flex items-center gap-1" style={{ color: '#163300' }}>
                  <FaCheck className="w-3 h-3" />
                  הסיסמאות תואמות
                </p>
              )}
              {confirmPasswordError && (
                <div className="mt-2 flex items-center gap-2 text-sm p-2 rounded-lg" style={{ color: '#B3261E', backgroundColor: '#FEE2E2' }}>
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#B3261E" strokeWidth="2"/><line x1="12" y1="8" x2="12" y2="13" stroke="#B3261E" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16.5" r="1" fill="#B3261E"/></svg>
                  <p>{confirmPasswordError}</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordValid || !passwordsMatch}
              className="bg-black text-white py-3 transition-colors disabled:cursor-not-allowed"
              style={{ fontSize: '18px', borderRadius: '12px', backgroundColor: (loading || !isPasswordValid || !passwordsMatch) ? '#D0D0D4' : 'black' }}
              onMouseEnter={(e) => !(loading || !isPasswordValid || !passwordsMatch) && (e.currentTarget.style.backgroundColor = '#3F3F46')}
              onMouseLeave={(e) => !(loading || !isPasswordValid || !passwordsMatch) && (e.currentTarget.style.backgroundColor = 'black')}
            >
              {loading ? 'מאפס...' : 'אפס סיסמה'}
            </button>

            {error && (
              <div className="flex items-center gap-2 text-sm p-2 rounded-lg" style={{ color: '#B3261E', backgroundColor: '#FEE2E2' }}>
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#B3261E" strokeWidth="2"/><line x1="12" y1="8" x2="12" y2="13" stroke="#B3261E" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16.5" r="1" fill="#B3261E"/></svg>
                <p>{error}</p>
              </div>
            )}

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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex flex-col" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
        <SiteHeader hideAuthButtons={true} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-xl">טוען...</div>
        </div>
      </main>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
