'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import WithlyIcon from './icons/WithlyIcon';
import NotificationBell from './NotificationBell';
import { MessagesBell } from './ChatWidget';
import UserProfileDropdown from './UserProfileDropdown';
import UserCommunitiesDropdown from './UserCommunitiesDropdown';
import ComingSoonTooltip from './ComingSoonTooltip';

interface CommunityNavbarProps {
  communityId: string;
  community: { name: string; logo?: string | null } | null;
  activePage: 'feed' | 'courses' | 'members' | 'events' | 'leaderboard' | 'about' | 'manage';
  /** Only owners get the management tab (managers no longer see it). */
  isOwner: boolean;
  userEmail: string | null;
  userId: string | null;
  userProfile: { name?: string; profileImage?: string | null } | null;
  // Optional search functionality
  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export default function CommunityNavbar({
  communityId,
  community,
  activePage,
  isOwner,
  userEmail,
  userId,
  userProfile,
  showSearch = false,
  searchQuery = '',
  onSearchChange,
}: CommunityNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on resize past breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const navLinks = [
    { key: 'feed', label: 'עמוד בית', href: `/communities/${communityId}/feed` },
    { key: 'courses', label: 'קורסים', href: `/communities/${communityId}/courses` },
    { key: 'members', label: 'חברי קהילה', href: `/communities/${communityId}/members` },
    { key: 'events', label: 'יומן אירועים', href: `/communities/${communityId}/events` },
    { key: 'leaderboard', label: 'לוח תוצאות', href: `/communities/${communityId}/leaderboard` },
    { key: 'about', label: 'אודות', href: `/communities/${communityId}/about` },
    ...(isOwner ? [{ key: 'manage', label: 'ניהול קהילה', href: `/communities/${communityId}/manage` }] : []),
  ];

  return (
    <>
    <header dir="rtl" className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8 py-4 bg-white border-b border-gray-200 h-[72px]">
      {/* Right side: Hamburger (mobile) + Withly Logo + Community name */}
      <div className="flex items-center min-w-0 flex-shrink gap-2 md:gap-3">
        {/* Mobile hamburger - visible below xl, BEFORE logo in RTL */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="xl:hidden p-2 rounded-lg hover:bg-gray-100 transition flex-shrink-0"
          aria-label="תפריט ניווט"
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

        <Link href="/" className="hover:opacity-75 transition flex-shrink-0">
          <div className="w-8 h-8 md:w-11 md:h-11 flex items-center justify-center">
            <div className="md:hidden"><WithlyIcon size={28} /></div>
            <div className="hidden md:block"><WithlyIcon size={34} /></div>
          </div>
        </Link>
        
        <div className="w-px h-[30px] flex-shrink-0 mx-2 md:mx-4 hidden xl:block" style={{ backgroundColor: 'var(--color-gray-4)' }} />
        
        <div className="min-w-0">
        
        {/* Community Switcher — skeleton placeholder while community data
            is still loading so the trigger doesn't briefly fall back to the
            SiteHeader "הקהילות שלי" mode. */}
        {community ? (
          <UserCommunitiesDropdown
            activeCommunity={{ id: communityId, name: community.name, logo: community.logo }}
          />
        ) : (
          <div className="flex items-center gap-2 min-w-0" aria-hidden>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-100 flex-shrink-0" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
          </div>
        )}
        </div>
      </div>

      {/* Center: Nav links - visible on lg+ */}
      <nav className="hidden xl:flex absolute left-1/2 -translate-x-1/2 items-center gap-4">
        {navLinks.map((link) => {
          // Insert חנות (coming soon) between לוח תוצאות and אודות
          // HIDDEN until feature ships — re-enable with: link.key === 'leaderboard'
          const showShopAfter = false;
          return (
            <span key={link.key} className="contents">
              <Link
                href={link.href}
                className={`transition px-3 py-1.5 whitespace-nowrap text-black ${
                  activePage === link.key
                    ? 'bg-gray-200 font-normal'
                    : 'hover:bg-gray-50 font-normal'
                }`}
                style={{ borderRadius: '10px', fontSize: '16px' }}
              >
                {link.label}
              </Link>
              {showShopAfter && (
                <ComingSoonTooltip tailDirection="up">
                  <span
                    className="px-3 py-1.5 whitespace-nowrap cursor-default select-none"
                    style={{ borderRadius: '10px', fontSize: '16px', color: '#A1A1AA' }}
                  >
                    חנות
                  </span>
                </ComingSoonTooltip>
              )}
            </span>
          );
        })}
      </nav>

      {/* Left side: Search (optional) + Notifications + Profile + Mobile hamburger */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {/* Search - hidden on mobile, visible on lg+ when enabled */}
        <div className={`relative hidden xl:block ${showSearch ? 'visible' : 'invisible'}`}>
          <svg 
            viewBox="0 0 18 18" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-[18px] h-[18px]"
          >
            <path 
              d="M15.7538 15.7472L12.4988 12.4922" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M8.25024 14.25C11.564 14.25 14.2502 11.5637 14.2502 8.25C14.2502 4.93629 11.564 2.25 8.25024 2.25C4.93654 2.25 2.25024 4.93629 2.25024 8.25C2.25024 11.5637 4.93654 14.25 8.25024 14.25Z" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="חיפוש"
            className="pl-4 pr-10 py-2 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-black w-32"
            tabIndex={showSearch ? 0 : -1}
          />
        </div>

        {/* Messages and Notification Bells */}
        <div className="flex items-center gap-1">
          {userEmail && <MessagesBell />}
          {userEmail && <NotificationBell />}
        </div>

        {/* User Avatar with Dropdown */}
        {userEmail && (
          <UserProfileDropdown
            userEmail={userEmail}
            userId={userId}
            userProfile={userProfile}
            showOnlineIndicator={true}
          />
        )}
      </div>
    </header>

    {/* Mobile nav menu overlay */}
    {mobileMenuOpen && (
      <div dir="rtl" className="fixed inset-0 top-[72px] z-50 bg-white xl:hidden overflow-y-auto">
        <div className="flex flex-col px-6 py-4 gap-1">
          {/* Search on mobile */}
          {showSearch && (
            <div className="relative mb-4">
              <svg 
                viewBox="0 0 18 18" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-[18px] h-[18px]"
              >
                <path d="M15.7538 15.7472L12.4988 12.4922" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8.25024 14.25C11.564 14.25 14.2502 11.5637 14.2502 8.25C14.2502 4.93629 11.564 2.25 8.25024 2.25C4.93654 2.25 2.25024 4.93629 2.25024 8.25C2.25024 11.5637 4.93654 14.25 8.25024 14.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="חיפוש"
                className="w-full pl-4 pr-10 py-3 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-black"
              />
            </div>
          )}

          {navLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`py-3 px-3 rounded-lg text-base transition ${
                activePage === link.key
                  ? 'bg-gray-100 font-medium text-black'
                  : 'text-black hover:bg-gray-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    )}
    </>
  );
}
