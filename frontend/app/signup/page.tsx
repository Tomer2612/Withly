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
import CheckIcon from '../components/icons/CheckIcon';
import CloseIcon from '../components/icons/CloseIcon';
import UserIcon from '../components/icons/UserIcon';

// Checkmark Icon component
const CheckmarkIcon = ({ className = "w-3 h-2.5" }: { className?: string }) => (
  <svg 
    viewBox="0 0 6 5" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M0.5625 2.0625L2.0625 3.5625L5.0625 0.5625" 
      stroke="currentColor" 
      strokeWidth="1.125" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// Minimum requirements (must have all)
const passwordRequirements = [
  { id: 'length', label: 'לפחות 6 תווים', test: (p: string) => p.length >= 6 },
  { id: 'letter', label: 'לפחות אות אחת', test: (p: string) => /[a-zA-Z]/.test(p) },
  { id: 'number', label: 'לפחות מספר אחד', test: (p: string) => /[0-9]/.test(p) },
];

// Suggestions for stronger password (optional but recommended)
const passwordSuggestions = [
  { id: 'length10', label: '10 תווים או יותר', test: (p: string) => p.length >= 10 },
  { id: 'uppercase', label: 'אות גדולה באנגלית (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'אות קטנה באנגלית (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { id: 'special', label: 'תו מיוחד (!@#$%^&*)', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

// Email validation
const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Name validation - only letters and spaces allowed (Hebrew, English, spaces)
const isValidName = (name: string) => {
  // Allow Hebrew, English letters, and spaces only
  const nameRegex = /^[\u0590-\u05FFa-zA-Z\s]+$/;
  return nameRegex.test(name.trim()) && name.trim().length > 0;
};

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Clear any expired tokens on mount
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.exp || payload.exp * 1000 < Date.now()) {
          localStorage.removeItem('token');
          localStorage.removeItem('userProfileCache');
          document.cookie = 'auth-token=; path=/; max-age=0';
        }
      }
    } catch { localStorage.removeItem('token'); document.cookie = 'auth-token=; path=/; max-age=0'; }
  }, []);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  // Check if user is creating a community (came from "צרו קהילה" button)
  const isCreatingCommunity = searchParams.get('createCommunity') === 'true';

  useEffect(() => {
    // Check URL param first, then localStorage
    const returnParam = searchParams.get('returnUrl');
    if (returnParam) {
      setReturnUrl(returnParam);
    } else {
      // Check localStorage (set by pricing page etc.)
      const storedReturnUrl = localStorage.getItem('returnUrl');
      if (storedReturnUrl) {
        setReturnUrl(storedReturnUrl);
      }
    }
  }, [searchParams]);

  // Check password strength (based on suggestions met)
  const requirementsMet = passwordRequirements.filter(req => req.test(password)).length;
  const suggestionsMet = passwordSuggestions.filter(sug => sug.test(password)).length;
  const isPasswordValid = requirementsMet === passwordRequirements.length;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  
  // Strength is based on requirements + suggestions (total 7 items)
  const totalStrength = requirementsMet + suggestionsMet;

  // Email validation on blur - also triggers check
  const validateEmail = async () => {
    setEmailTouched(true);
    setEmailChecking(true);
    
    if (!email) {
      setEmailError('');
      setEmailChecking(false);
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError('כתובת אימייל לא תקינה');
      setEmailChecking(false);
      return;
    }
    
    // Check if email exists
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/check-email?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.exists) {
          setEmailError('כתובת האימייל כבר רשומה במערכת');
        } else {
          setEmailError('');
        }
      }
    } catch (error) {
      // Silently fail
    } finally {
      setEmailChecking(false);
    }
  };

  const getStrengthColor = () => {
    // Red if base requirements not met, light green if met, dark green if strong
    if (!isPasswordValid) return 'bg-[#B3261E]';
    if (totalStrength <= 5) return 'bg-[#A7EA7B]';
    return 'bg-[#163300]';
  };

  const getStrengthText = () => {
    if (password.length === 0) return '';
    if (totalStrength <= 2) return 'חלשה';
    if (totalStrength <= 4) return 'בינונית';
    if (totalStrength <= 5) return 'טובה';
    return 'חזקה מאוד';
  };

  const scrollToFirstError = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.focus();
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');

    // Validate all fields with inline errors
    if (!name.trim()) {
      setNameError('יש להזין שם מלא');
      scrollToFirstError('signup-name');
      return;
    }

    if (!isValidName(name)) {
      setNameError('שם יכול להכיל רק אותיות בעברית או באנגלית');
      scrollToFirstError('signup-name');
      return;
    }

    if (!isValidEmail(email)) {
      setEmailError('כתובת אימייל לא תקינה');
      scrollToFirstError('signup-email');
      return;
    }

    if (!isPasswordValid) {
      setPasswordError('הסיסמה לא עומדת בדרישות');
      scrollToFirstError('signup-password');
      return;
    }

    if (!passwordsMatch) {
      setConfirmPasswordError('הסיסמאות אינן תואמות');
      scrollToFirstError('signup-confirm-password');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.message?.includes('Unique constraint') || data.message?.includes('already exists')) {
          setMessage('כתובת האימייל כבר רשומה במערכת');
          setEmailError('כתובת האימייל כבר רשומה במערכת. אולי תרצה להתחבר או לאפס סיסמה?');
        } else {
          setMessage(data.message || 'ההרשמה נכשלה');
        }
        return;
      }

      localStorage.setItem('token', data.access_token);
      // Set cookie for middleware auth
      document.cookie = `auth-token=${data.access_token}; path=/; max-age=604800; SameSite=Lax`;
      
      // Check if user was creating a community - skip email verification and go straight to pricing
      const isCreatingCommunity = searchParams.get('createCommunity') === 'true';
      if (isCreatingCommunity) {
        router.push('/pricing?step=create');
        return;
      }
      
      // Check if user was joining a community from preview page
      const pendingJoinCommunity = localStorage.getItem('pendingJoinCommunity');
      if (pendingJoinCommunity) {
        const pendingPayment = localStorage.getItem('pendingPayment');
        localStorage.removeItem('pendingJoinCommunity');
        localStorage.removeItem('pendingPayment');
        
        if (pendingPayment) {
          // Paid community - redirect back to preview to show payment modal
          router.push(`/communities/${pendingJoinCommunity}/preview?showPayment=true`);
        } else {
          // Free community - join directly then redirect to community
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
        return;
      }
      
      // Save returnUrl for after email verification
      if (returnUrl) {
        localStorage.setItem('returnUrl', returnUrl);
      }
      setShowVerificationMessage(true);
    } catch (error) {
      console.error('Signup error:', error);
      setMessage('שגיאה בהרשמה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      if (res.ok) {
        setMessage('מייל אימות נשלח שוב!');
      } else {
        setMessage('שגיאה בשליחת מייל');
      }
    } catch (error) {
      setMessage('שגיאה בשליחת מייל');
    } finally {
      setResending(false);
    }
  };

  if (showVerificationMessage) {
    return (
      <main className="min-h-screen flex flex-col" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
        <SiteHeader hideAuthButtons={true} />

        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center text-center" style={{ border: '1px solid #D0D0D4' }}>
              {/* Success Icon - CheckIcon on light green bg */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#A7EA7B' }}>
                <CheckIcon className="w-5 h-4 text-black" />
              </div>

              <h1 className="font-semibold text-black" style={{ fontSize: '28px', marginTop: '16px' }}>ההרשמה הושלמה!</h1>
              
              <p className="text-black" style={{ fontSize: '18px', marginTop: '20px' }}>
                שלחנו לך מייל אימות לכתובת:
              </p>
              <p className="font-semibold text-black" style={{ fontSize: '18px', marginTop: '12px' }}>{email}</p>
              <p className="text-black" style={{ fontSize: '18px', marginTop: '12px' }}>
                אנא בדוק את תיבת הדואר שלך ולחץ על הקישור לאימות.
              </p>
              
              <div className="w-full" style={{ borderTop: '1px solid #D0D0D4', marginTop: '24px', paddingTop: '24px' }}>
                <button
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="hover:underline"
                  style={{ fontSize: '18px', color: resending ? '#A1A1AA' : '#000000' }}
                >
                  {resending ? 'שולח...' : 'לא קיבלת? שלח שוב'}
                </button>
              </div>
              
              {message && (
                <p className={`text-sm ${message.includes('שגיאה') ? 'text-red-600' : 'text-green-600'}`} style={{ marginTop: '12px' }}>{message}</p>
              )}
              
              <button
                onClick={() => router.push('/')}
                className="bg-black text-white py-3 px-6 transition-colors"
                style={{ fontSize: '18px', marginTop: '24px', borderRadius: '12px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3F3F46'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'black'}
              >
                המשך לאתר
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
      {/* Top Navbar */}
      <SiteHeader hideAuthButtons={true} />

      {/* Content Area */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className={`flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 w-full ${isCreatingCommunity ? 'max-w-5xl' : 'max-w-md'}`}>
          
          {/* Right Side - Marketing Content (only shown when creating community) */}
          {isCreatingCommunity && (
            <div className="hidden lg:block w-full lg:w-1/2 text-right">
              <h2 className="text-[32px] mb-8 leading-tight" style={{ fontWeight: 400, color: '#27272A' }}>
                פותחים קהילה ומתחילים להרוויח
              </h2>
              
              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: '#A7EA7B' }}>
                    <CheckmarkIcon className="w-3 h-2.5 text-black" />
                  </div>
                  <p className="text-[16px]" style={{ color: '#3F3F46' }}>
                    מערכת פשוטה ליצור הכנסה וניהול מנויים מהרגע הראשון
                  </p>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: '#A7EA7B' }}>
                    <CheckmarkIcon className="w-3 h-2.5 text-black" />
                  </div>
                  <p className="text-[16px]" style={{ color: '#3F3F46' }}>
                    פלטפורמה שמרכזת קורסים, צ'אט וקהילה במקום אחד
                  </p>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: '#A7EA7B' }}>
                    <CheckmarkIcon className="w-3 h-2.5 text-black" />
                  </div>
                  <p className="text-[16px]" style={{ color: '#3F3F46' }}>
                    הקמת קהילה פעילה ומעוצבת בדקות, ללא ידע טכני
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Left Side - Registration Form */}
          <div className={`w-full ${isCreatingCommunity ? 'lg:w-1/2' : ''} max-w-md`}>
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <form
                onSubmit={handleSignup}
                className="w-full flex flex-col gap-4 text-right"
              >
                <h1 className="text-[21px] text-center mb-2" style={{ fontWeight: 600 }}>מתחילים כאן</h1>

                {/* Google Button */}
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg text-[16px] hover:opacity-80 transition border"
                  style={{ borderColor: '#E1E1E2', backgroundColor: '#F4F4F5' }}
                >
                  הצטרפות מהירה עם Google
                  <GoogleIcon className="w-5 h-5" />
                </a>

                <div className="relative my-3 text-center text-[12px]" style={{ color: '#A1A1AA' }}>
                  <span className="bg-white px-3 relative z-10">או באמצעות מייל</span>
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full" style={{ borderTop: '1px solid #E1E1E2' }}></div>
                  </div>
                </div>

            {/* Name Field */}
            <div>
              <div className="relative">
                <UserIcon className="absolute right-3 top-3.5 w-5 h-5" style={{ color: '#000000' }} />
                <input
                  id="signup-name"
                  type="text"
                  placeholder="שם מלא *"
                  className={`auth-input w-full p-3 pr-10 border rounded-lg focus:outline-none text-[14px]`}
                  style={{ borderColor: nameError ? '#B3261E' : '#D0D0D4' }}
                  value={name}
                  onChange={(e) => {
                    // Only allow Hebrew, English letters and spaces
                    const newValue = e.target.value;
                    const filteredValue = newValue.replace(/[^א-תa-zA-Z\s]/g, '');
                    setName(filteredValue);
                    if (nameError) setNameError('');
                  }}
                  required
                />
              </div>
              {nameError && (
                <div className="mt-2 flex items-center gap-2 text-sm p-2 rounded-lg" style={{ color: '#B3261E', backgroundColor: '#FEE2E2' }}>
                  <CloseIcon className="w-4 h-4 flex-shrink-0" />
                  <p>{nameError}</p>
                </div>
              )}
            </div>

            {/* Email Field */}
            <div>
              <div className="relative">
                <MailIcon className="absolute right-3 top-3.5 pointer-events-none w-5 h-5 text-black" />
                <input
                  id="signup-email"
                  type="text"
                  placeholder="כתובת אימייל *"
                  className="auth-input w-full p-3 pr-10 pl-10 border rounded-lg focus:outline-none text-[14px]"
                  style={{ 
                    borderColor: emailError 
                      ? '#B3261E' 
                      : emailTouched && email && isValidEmail(email) && !emailError && !emailChecking
                      ? '#000000'
                      : '#D0D0D4'
                  }}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailTouched(false);
                    setEmailError('');
                  }}
                  onBlur={validateEmail}
                  required
                />
                <div className="absolute left-3 top-3.5 pointer-events-none">
                  {emailChecking ? (
                    <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#D0D0D4', borderTopColor: '#52525B' }} />
                  ) : emailTouched && email ? (
                    emailError ? (
                      <CloseIcon className="w-4 h-4" style={{ color: '#B3261E' }} />
                    ) : isValidEmail(email) ? (
                      <CheckIcon className="w-4 h-4" style={{ color: '#000000' }} />
                    ) : null
                  ) : null}
                </div>
              </div>
              {emailError && (
                <div className="mt-2 flex items-start gap-2 text-sm p-2 rounded-lg" style={{ color: '#B3261E', backgroundColor: '#FEE2E2' }}>
                    <CloseIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p>{emailError}</p>
                    {emailError.includes('כבר רשומה') && (
                      <div className="mt-1 flex gap-3">
                        <a href="/login" className="hover:underline" style={{ color: '#003233' }}>התחברות</a>
                        <a href="/forgot-password" className="hover:underline" style={{ color: '#003233' }}>איפוס סיסמה</a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="relative">
                <KeyIcon className="absolute right-3 top-3.5 w-5 h-5 text-black" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="סיסמה *"
                  className="auth-input w-full p-3 pr-10 pl-10 border rounded-lg focus:outline-none text-[14px]"
                  style={{
                    borderColor: passwordError
                      ? '#B3261E'
                      : password && isPasswordValid 
                      ? '#000000' 
                      : password && !isPasswordValid
                      ? '#B3261E'
                      : '#D0D0D4'
                  }}
                  value={password}
                  onChange={(e) => {
                    // Block Hebrew characters in password
                    const newValue = e.target.value.replace(/[֐-׿]/g, '');
                    setPassword(newValue);
                    if (passwordError) setPasswordError('');
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  required
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

              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#E1E1E2' }}>
                      <div 
                        className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                        style={{ width: `${(totalStrength / 7) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium" style={{
                      color: totalStrength >= 6 ? '#163300' : 
                      totalStrength >= 4 ? '#163300' : '#B3261E'
                    }}>
                      {getStrengthText()}
                    </span>
                  </div>

                  {/* Requirements List (must have) */}
                  {(passwordFocused || !isPasswordValid) && (
                    <div className="rounded-lg p-3 space-y-1 mb-2" style={{ backgroundColor: '#FCFCFC' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#52525B' }}>דרישות חובה:</p>
                      {passwordRequirements.map(req => (
                        <div key={req.id} className="flex items-center gap-2 text-sm">
                          {req.test(password) ? (
                            <CheckIcon className="w-3 h-3" style={{ color: '#000000' }} />
                          ) : (
                            <CloseIcon className="w-3 h-3" style={{ color: '#B3261E' }} />
                          )}
                          <span style={{ color: req.test(password) ? '#000000' : '#7A7A83' }}>
                            {req.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggestions List (optional) */}
                  {passwordFocused && isPasswordValid && (
                    <div className="rounded-lg p-3 space-y-1" style={{ backgroundColor: '#91DCED20' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#003233' }}>המלצות לסיסמה חזקה יותר:</p>
                      {passwordSuggestions.map(sug => (
                        <div key={sug.id} className="flex items-center gap-2 text-sm">
                          {sug.test(password) ? (
                            <CheckIcon className="w-3 h-3" style={{ color: '#000000' }} />
                          ) : (
                            <span className="w-3 h-3 rounded-full" style={{ border: '1px solid #91DCED' }} />
                          )}
                          <span style={{ color: sug.test(password) ? '#000000' : '#003233' }}>
                            {sug.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {passwordError && (
                <div className="mt-2 flex items-center gap-2 text-sm p-2 rounded-lg" style={{ color: '#B3261E', backgroundColor: '#FEE2E2' }}>
                  <CloseIcon className="w-4 h-4 flex-shrink-0" />
                  <p>{passwordError}</p>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <div className="relative">
                <KeyIcon className="absolute right-3 top-3.5 w-5 h-5 text-black" />
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="אימות סיסמה *"
                  className="auth-input w-full p-3 pr-10 pl-10 border rounded-lg focus:outline-none text-[14px]"
                  style={{
                    borderColor: confirmPasswordError
                      ? '#B3261E'
                      : confirmPassword && passwordsMatch 
                      ? '#000000' 
                      : confirmPassword && !passwordsMatch
                      ? '#B3261E'
                      : '#D0D0D4'
                  }}
                  value={confirmPassword}
                  onChange={(e) => {
                    // Block Hebrew characters in confirm password
                    const newValue = e.target.value.replace(/[\u0590-\u05ff]/g, '');
                    setConfirmPassword(newValue);
                    if (confirmPasswordError) setConfirmPasswordError('');
                  }}
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
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
                  <CloseIcon className="w-4 h-4 flex-shrink-0" />
                  <p>הסיסמאות אינן תואמות</p>
                </div>
              )}
              {confirmPassword && passwordsMatch && (
                <p className="mt-1 text-sm flex items-center gap-1" style={{ color: '#000000' }}>
                  <CheckIcon className="w-3 h-3" />
                  הסיסמאות תואמות
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !isPasswordValid || !passwordsMatch || !name.trim() || !isValidEmail(email) || !!emailError}
              className="bg-black text-white py-3 transition-colors font-medium disabled:cursor-not-allowed"
              style={{ borderRadius: '12px', backgroundColor: (isSubmitting || !isPasswordValid || !passwordsMatch || !name.trim() || !isValidEmail(email) || !!emailError) ? '#D0D0D4' : 'black' }}
              onMouseEnter={(e) => !(isSubmitting || !isPasswordValid || !passwordsMatch || !name.trim() || !isValidEmail(email) || !!emailError) && (e.currentTarget.style.backgroundColor = '#3F3F46')}
              onMouseLeave={(e) => !(isSubmitting || !isPasswordValid || !passwordsMatch || !name.trim() || !isValidEmail(email) || !!emailError) && (e.currentTarget.style.backgroundColor = 'black')}
            >
              {isSubmitting ? 'נרשם...' : 'הרשמה'}
            </button>

            {message && <p className="text-center text-[14px]" style={{ color: '#B3261E' }}>{message}</p>}

            {/* Login Redirect */}
            <p className="text-center text-[14px] mt-2">
             יש לך כבר חשבון?{' '}
              <a href={`/login${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`} className="text-black font-medium hover:underline">
                התחברו כאן
              </a>
            </p>
          </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">טוען...</div>}>
      <SignupContent />
    </Suspense>
  );
}
