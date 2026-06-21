'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import WithlyLogo from './icons/WithlyLogo';
import NotificationBell from './NotificationBell';
import { MessagesBell } from './ChatWidget';
import UserProfileDropdown from './UserProfileDropdown';
import UserCommunitiesDropdown from './UserCommunitiesDropdown';
import { useUser } from '../lib/UserContext';

interface SiteHeaderProps {
  // Optional: override the default nav links
  hideNavLinks?: boolean;
  // Optional: hide login/signup buttons
  hideAuthButtons?: boolean;
}

export default function SiteHeader({ hideNavLinks = false, hideAuthButtons = false }: SiteHeaderProps) {
  const { user } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userEmail = user?.email ?? null;
  const userId = user?.userId ?? null;
  const userProfile = user
    ? { name: user.name, profileImage: user.profileImage }
    : null;

  // Close mobile menu on route change / resize past breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open. Compensate for the
  // scrollbar width (left side in RTL) so locking doesn't shift the page —
  // which otherwise makes the fixed overlay look misaligned vs the content.
  useEffect(() => {
    if (mobileMenuOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) document.body.style.paddingLeft = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingLeft = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingLeft = '';
    };
  }, [mobileMenuOpen]);

  return (
    <>
    <header dir="rtl" className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8 py-4 bg-white border-b h-[72px]" style={{ borderColor: '#E1E1E2' }}>
      {/* Right side: hamburger (mobile) + logo + (logged-in) divider + communities dropdown */}
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
        {/* Logged-in: vertical divider + user communities switcher (matches
            CommunityNavbar layout). The divider is hidden on mobile to save
            space, matching CommunityNavbar's `hidden xl:block` pattern. */}
        {userEmail && (
          <>
            <div className="w-px h-[30px] flex-shrink-0 mx-2 md:mx-4 hidden xl:block" style={{ backgroundColor: 'var(--color-gray-4)' }} />
            {/* Switcher hidden on mobile — it moves into the hamburger menu */}
            <div className="hidden md:block">
              <UserCommunitiesDropdown />
            </div>
          </>
        )}
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
                className="border-2 border-black text-black px-6 py-2 rounded-[16px] font-semibold hover:bg-black hover:text-white transition"
              >
                כניסה
              </Link>
              <Link
                href="/signup"
                className="bg-black text-white px-6 py-2 rounded-[16px] font-semibold hover:opacity-90 transition border-2 border-black"
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
              className="border-2 border-black text-black px-3 py-1.5 rounded-[16px] font-semibold hover:bg-black hover:text-white transition text-sm"
            >
              כניסה
            </Link>
            <Link
              href="/signup"
              className="bg-black text-white px-3 py-1.5 rounded-[16px] font-semibold hover:opacity-90 transition border-2 border-black text-sm"
            >
              הרשמה
            </Link>
          </div>
        )}
      </div>
    </header>

    {/* Mobile menu overlay (auth-button radii unified to 16px below) */}
    {mobileMenuOpen && (
      <div dir="rtl" className="fixed left-0 right-0 bottom-0 top-[72px] z-50 bg-white md:hidden overflow-y-auto">
        <div className="flex flex-col px-6 py-6 gap-2">
          {/* Communities switcher — lives here on mobile (per nav layout decision) */}
          {userEmail && (
            <div className="pb-3 mb-1 border-b border-gray-100">
              <UserCommunitiesDropdown />
            </div>
          )}
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
                className="border-2 border-black text-black px-6 py-3 rounded-[16px] font-semibold hover:bg-black hover:text-white transition text-center"
              >
                כניסה
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="bg-black text-white px-6 py-3 rounded-[16px] font-semibold hover:opacity-90 transition border-2 border-black text-center"
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
