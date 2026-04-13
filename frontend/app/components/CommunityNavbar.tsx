'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import UsersIcon from './icons/UsersIcon';
import WithlyIcon from './icons/WithlyIcon';
import NotificationBell from './NotificationBell';
import { MessagesBell } from './ChatWidget';
import UserProfileDropdown from './UserProfileDropdown';
import { getImageUrl } from '@/app/lib/imageUrl';
import ComingSoonTooltip from './ComingSoonTooltip';

interface UserCommunity {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
}

interface CommunityNavbarProps {
  communityId: string;
  community: { name: string; logo?: string | null } | null;
  activePage: 'feed' | 'courses' | 'members' | 'events' | 'leaderboard' | 'about' | 'manage';
  isOwnerOrManager: boolean;
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
  isOwnerOrManager,
  userEmail,
  userId,
  userProfile,
  showSearch = false,
  searchQuery = '',
  onSearchChange,
}: CommunityNavbarProps) {
  const router = useRouter();
  const [userCommunities, setUserCommunities] = useState<UserCommunity[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch user's communities
  useEffect(() => {
    if (!userEmail) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/user/my-communities`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => setUserCommunities(data))
      .catch(console.error);
  }, [userEmail]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsDropdownOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleCommunitySwitch = (comm: UserCommunity) => {
    setIsDropdownOpen(false);
    router.push(`/communities/${comm.slug || comm.id}/feed`);
  };

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
    ...(isOwnerOrManager ? [{ key: 'manage', label: 'ניהול קהילה', href: `/communities/${communityId}/manage` }] : []),
  ];

  const showCommunityDropdown = userCommunities.length > 1;

  return (
    <>
    <header dir="rtl" className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8 py-4 bg-white border-b border-gray-200 h-[72px]">
      {/* Right side: Hamburger (mobile) + Withly Logo + Community name */}
      <div className="flex items-center min-w-0 flex-shrink-0 max-w-[280px] gap-2 md:gap-3">
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
        
        <div className="w-px h-[30px] bg-gray-400 flex-shrink-0 mx-2 md:mx-4 hidden xl:block" />
        
        <div className="min-w-0">
        
        {/* Community Switcher */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => showCommunityDropdown && setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center gap-2 min-w-0 ${showCommunityDropdown ? 'cursor-pointer hover:opacity-75 transition' : 'cursor-default'}`}
          >
            {community?.logo ? (
              <img
                src={getImageUrl(community.logo)}
                alt={community.name}
                className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <UsersIcon className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
              </div>
            )}
            <span className="font-medium text-black truncate max-w-[120px] md:max-w-[200px]" style={{ fontSize: '16px' }}>{community?.name}</span>
            
            {showCommunityDropdown && (
              <svg 
                width="10" height="5" viewBox="0 0 10 5" fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className={`transform transition-transform duration-200 flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`}
              >
                <path 
                  d="M1 1L5 5L9 1" 
                  stroke="#374151" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>

          {/* Dropdown */}
          {isDropdownOpen && showCommunityDropdown && (
            <div 
              className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-xl z-50 overflow-hidden p-1.5 min-w-[200px]"
              style={{ boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.12)' }}
            >
              {userCommunities.map((comm) => (
                <button
                  key={comm.id}
                  onClick={() => handleCommunitySwitch(comm)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-right rounded-lg transition-colors ${
                    comm.id === communityId 
                      ? 'bg-gray-100 font-medium' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {comm.logo ? (
                    <img
                      src={getImageUrl(comm.logo)}
                      alt={comm.name}
                      className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <UsersIcon className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <span className="text-black truncate" style={{ fontSize: '14px' }}>{comm.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Center: Nav links - visible on lg+ */}
      <nav className="hidden xl:flex absolute left-1/2 -translate-x-1/2 items-center gap-4">
        {navLinks.map((link) => {
          // Insert חנות (coming soon) between לוח תוצאות and אודות
          const showShopAfter = link.key === 'leaderboard';
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
