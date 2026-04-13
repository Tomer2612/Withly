'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { jwtDecode } from 'jwt-decode';
import WithlyLogo from './icons/WithlyLogo';
import NotificationBell from './NotificationBell';
import { MessagesBell } from './ChatWidget';
import UserProfileDropdown from './UserProfileDropdown';
import { clearSessionAndRedirect } from '../lib/auth';

interface JwtPayload {
  email: string;
  sub: string;
  iat: number;
  exp: number;
}

interface SiteHeaderProps {
  // Optional: override the default nav links
  hideNavLinks?: boolean;
  // Optional: hide login/signup buttons
  hideAuthButtons?: boolean;
}

export default function SiteHeader({ hideNavLinks = false, hideAuthButtons = false }: SiteHeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ name?: string; profileImage?: string | null } | null>(null);

  useEffect(() => {
    setMounted(true);

    const clearSession = () => {
      setUserEmail(null);
      setUserId(null);
      setUserProfile(null);
      clearSessionAndRedirect();
    };

    const token = localStorage.getItem('token');
    if (token && token.split('.').length === 3) {
      try {
        const decoded = jwtDecode<JwtPayload>(token);

        // Check if token is expired — redirect to login
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          clearSession();
          return;
        }

        setUserEmail(decoded.email);
        setUserId(decoded.sub);

        // Read cached profile immediately
        const cached = localStorage.getItem('userProfileCache');
        if (cached) {
          try { setUserProfile(JSON.parse(cached)); } catch {}
        }

        // Fetch fresh user profile and validate token server-side
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            if (data) {
              const profile = { name: data.name, profileImage: data.profileImage };
              setUserProfile(profile);
              localStorage.setItem('userProfileCache', JSON.stringify(profile));
            }
          })
          .catch(console.error);
      } catch (e) {
        console.error('Invalid token:', e);
        clearSession();
      }
    } else if (token) {
      // Malformed token
      clearSession();
    }
  }, []);

  // Close mobile menu on route change / resize past breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  return (
    <>
    <header dir="rtl" className="flex items-center justify-between px-4 md:px-8 py-4 bg-white border-b h-[72px]" style={{ borderColor: '#E1E1E2' }}>
      {/* Right side: hamburger (mobile) + logo */}
      <div className="flex items-center gap-2">
        {/* Mobile hamburger - on right side in RTL */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition"
          aria-label="תפריט"
        >
          {mobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
        <Link href="/" className="flex items-center hover:opacity-75 transition">
          <WithlyLogo height={28} />
        </Link>
      </div>
      
      {/* Desktop nav + auth */}
      <div className="hidden md:flex gap-6 items-center">
        {/* Nav Links */}
        {!hideNavLinks && (
          <>
            <Link href="/pricing" className="text-black hover:opacity-70 transition text-[18px] font-normal">
              מחירון
            </Link>
            <Link href="/support" className="text-black hover:opacity-70 transition text-[18px] font-normal">
              שאלות ותשובות
            </Link>
            <Link href="/contact" className="text-black hover:opacity-70 transition text-[18px] font-normal">
              צרו קשר
            </Link>
          </>
        )}

        {/* Auth Section */}
        {!mounted ? (
          <div className="w-10 h-10" />
        ) : !userEmail ? (
          !hideAuthButtons && (
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="border-2 border-black text-black px-6 py-2 rounded-lg font-semibold hover:bg-black hover:text-white transition"
              >
                כניסה
              </Link>
              <Link
                href="/signup"
                className="bg-black text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition border-2 border-black"
              >
                הרשמה
              </Link>
          </div>
          )
        ) : (
          <div className="flex items-center gap-3">
            <MessagesBell />
            <NotificationBell />
            <UserProfileDropdown
              userEmail={userEmail}
              userId={userId}
              userProfile={userProfile}
            />
          </div>
        )}
      </div>

      {/* Mobile: user icons (if logged in) */}
      <div className="flex md:hidden items-center gap-3">
        {mounted && userEmail && (
          <>
            <MessagesBell />
            <NotificationBell />
            <UserProfileDropdown
              userEmail={userEmail}
              userId={userId}
              userProfile={userProfile}
            />
          </>
        )}
        {mounted && !userEmail && !hideAuthButtons && (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="border-2 border-black text-black px-4 py-1.5 rounded-lg font-semibold hover:bg-black hover:text-white transition text-sm"
            >
              כניסה
            </Link>
          </div>
        )}
      </div>
    </header>

    {/* Mobile menu overlay */}
    {mobileMenuOpen && (
      <div dir="rtl" className="fixed inset-0 top-[72px] z-50 bg-white md:hidden overflow-y-auto">
        <div className="flex flex-col px-6 py-6 gap-2">
          {!hideNavLinks && (
            <>
              <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="text-black text-lg font-normal py-3 border-b border-gray-100 hover:opacity-70 transition">
                מחירון
              </Link>
              <Link href="/support" onClick={() => setMobileMenuOpen(false)} className="text-black text-lg font-normal py-3 border-b border-gray-100 hover:opacity-70 transition">
                שאלות ותשובות
              </Link>
              <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="text-black text-lg font-normal py-3 border-b border-gray-100 hover:opacity-70 transition">
                צרו קשר
              </Link>
            </>
          )}
          
          {mounted && !userEmail && !hideAuthButtons && (
            <div className="flex flex-col gap-3 mt-4">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="border-2 border-black text-black px-6 py-3 rounded-lg font-semibold hover:bg-black hover:text-white transition text-center"
              >
                כניסה
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition border-2 border-black text-center"
              >
                הרשמה
              </Link>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
