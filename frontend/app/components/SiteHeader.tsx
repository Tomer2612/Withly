'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import WithlyLogo from './icons/WithlyLogo';
import NotificationBell from './NotificationBell';
import { MessagesBell } from './ChatWidget';
import UserProfileDropdown from './UserProfileDropdown';

// Pages where the user is by definition not logged in — skip the /users/me
// probe (and its refresh-on-401 fallback) entirely instead of burning two
// round-trips on every visit.
const AUTH_FORM_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/access-gate', '/google-success'];

interface SiteHeaderProps {
  // Optional: override the default nav links
  hideNavLinks?: boolean;
  // Optional: hide login/signup buttons
  hideAuthButtons?: boolean;
}

export default function SiteHeader({ hideNavLinks = false, hideAuthButtons = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ name?: string; profileImage?: string | null } | null>(null);

  useEffect(() => {
    setMounted(true);

    // Skip the auth probe on the auth-form pages — the user is definitely
    // not logged in there, and middleware already redirects them away if
    // they are. Saves a guaranteed-failing /users/me + /auth/refresh pair.
    if (AUTH_FORM_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
      return;
    }

    // Auth state lives in httpOnly cookies — JS can't read them, so we
    // probe /users/me. 200 means logged in (and gives us the profile);
    // 401 means logged out. The global fetch interceptor already adds
    // credentials and runs the refresh-on-401 retry, so a single failure
    // here is the genuine signal.
    const cached = localStorage.getItem('userProfileCache');
    if (cached) {
      try { setUserProfile(JSON.parse(cached)); } catch {}
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) {
          setUserEmail(null);
          setUserId(null);
          setUserProfile(null);
          localStorage.removeItem('userProfileCache');
          return;
        }
        setUserEmail(data.email);
        setUserId(data.userId);
        const profile = { name: data.name, profileImage: data.profileImage };
        setUserProfile(profile);
        localStorage.setItem('userProfileCache', JSON.stringify(profile));
      })
      .catch(console.error);
  }, [pathname]);

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
      <div className="flex items-center gap-1">
        {/* Mobile hamburger - on right side in RTL */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 transition"
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
            <div className="flex items-center gap-1">
              <MessagesBell />
              <NotificationBell />
            </div>
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
            <div className="flex items-center gap-1">
              <MessagesBell />
              <NotificationBell />
            </div>
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
              className="border-2 border-black text-black px-3 py-1.5 rounded-lg font-semibold hover:bg-black hover:text-white transition text-sm"
            >
              כניסה
            </Link>
            <Link
              href="/signup"
              className="bg-black text-white px-3 py-1.5 rounded-lg font-semibold hover:opacity-90 transition border-2 border-black text-sm"
            >
              הרשמה
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
