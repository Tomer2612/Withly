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
  // Optional: server-rendered initial auth state. SiteHeaderServer reads
  // the access cookie and decodes the JWT payload to fill this in, which
  // lets us render the correct UI on first paint and avoid the auth-state
  // flicker. When null, render as logged-out until the /users/me probe
  // confirms otherwise.
  initialUser?: { email: string; userId: string } | null;
}

export default function SiteHeader({ hideNavLinks = false, hideAuthButtons = false, initialUser = null }: SiteHeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(initialUser?.email ?? null);
  const [userId, setUserId] = useState<string | null>(initialUser?.userId ?? null);
  const [userProfile, setUserProfile] = useState<{ name?: string; profileImage?: string | null } | null>(null);

  useEffect(() => {
    // SSR already decided whether we're logged in. If the server saw no
    // valid access cookie, don't probe — that probe would 401, the
    // interceptor would try /auth/refresh, that would also 401, and the
    // user would get bounced to /login?expired=true on a perfectly
    // legitimate logged-out homepage visit. Just trust SSR's decision.
    if (!initialUser) return;

    // Skip the auth probe on the auth-form pages — middleware already
    // redirects logged-in users away from them.
    if (AUTH_FORM_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
      return;
    }

    // Logged in per SSR. Hydrate cached profile immediately, then refresh
    // from /users/me. The global fetch interceptor handles credentials
    // and any refresh-on-401 dance.
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
  }, [pathname, initialUser]);

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
        {!userEmail ? (
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
        {userEmail && (
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
        {!userEmail && !hideAuthButtons && (
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
          
          {!userEmail && !hideAuthButtons && (
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
