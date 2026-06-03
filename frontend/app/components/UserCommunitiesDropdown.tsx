'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import UsersIcon from './icons/UsersIcon';
import { getImageUrl } from '@/app/lib/imageUrl';

interface UserCommunity {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
}

interface UserCommunitiesDropdownProps {
  /**
   * When provided, the trigger renders this community's logo + name (the
   * CommunityNavbar style) and highlights the matching entry inside the
   * dropdown. When omitted (e.g. SiteHeader, outside the community
   * context), the trigger is a generic "הקהילות שלי" button.
   */
  activeCommunity?: { id: string; name: string; logo?: string | null };
}

/**
 * Shared user-communities switcher used by CommunityNavbar (inline,
 * inside a community) and SiteHeader (generic, on non-community pages).
 * List is sorted alphabetically. A "discover more communities" entry sits
 * at the top, but is hidden in two contexts: (a) on the homepage itself,
 * since that's where it would navigate, and (b) inside a specific
 * community (CommunityNavbar mode).
 */
export default function UserCommunitiesDropdown({ activeCommunity }: UserCommunitiesDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [communities, setCommunities] = useState<UserCommunity[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/user/my-communities`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setCommunities(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Alphabetical sort (Hebrew-aware via localeCompare). The currently-active
  // community (when inside a community) is excluded from the list — the
  // navbar trigger already shows it, no need to repeat it.
  // NOTE: `activeCommunity.id` is whatever URL param the user navigated by —
  // could be the database id OR the community slug — so we compare against
  // both `c.id` and `c.slug`.
  const sortedCommunities = useMemo(
    () => [...communities]
      .filter(c => !activeCommunity || (c.id !== activeCommunity.id && c.slug !== activeCommunity.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'he')),
    [communities, activeCommunity],
  );

  // Hide the discover entry only on the homepage (it'd link to where you
  // already are). Shown inside communities too — sits at the top of the list.
  const showDiscover = pathname !== '/';

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSwitch = (comm: UserCommunity) => {
    setIsOpen(false);
    if (activeCommunity && comm.id === activeCommunity.id) return;
    router.push(`/communities/${comm.slug || comm.id}/feed`);
  };

  // Open the dropdown whenever there's something useful inside: another
  // community to switch to, OR the discover entry. SiteHeader (no
  // activeCommunity) always opens. CommunityNavbar opens when the user has
  // other communities to switch to OR when discover is shown (i.e. on a
  // community page, discover is visible — so even a single-community user
  // can reach it from inside their community).
  const enableOpen = !activeCommunity || communities.length > 1 || showDiscover;

  return (
    <div className="relative" ref={dropdownRef}>
      {activeCommunity ? (
        <button
          onClick={() => enableOpen && setIsOpen(!isOpen)}
          className={`flex items-center gap-2 min-w-0 ${enableOpen ? 'cursor-pointer hover:opacity-75 transition' : 'cursor-default'}`}
        >
          {activeCommunity.logo ? (
            <img
              src={getImageUrl(activeCommunity.logo)}
              alt={activeCommunity.name}
              className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <UsersIcon className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
            </div>
          )}
          <span className="font-medium text-black truncate max-w-[150px] sm:max-w-[200px] md:max-w-[250px]" style={{ fontSize: '16px' }}>
            {activeCommunity.name}
          </span>
          {enableOpen && (
            <svg
              width="10" height="5" viewBox="0 0 10 5" fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`transform transition-transform duration-200 flex-shrink-0 overflow-visible ${isOpen ? 'rotate-180' : ''}`}
            >
              <path d="M1 1L5 5L9 1" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 cursor-pointer hover:opacity-75 transition"
          aria-label="הקהילות שלי"
        >
          <span className="text-black font-normal" style={{ fontSize: '18px' }}>הקהילות שלי</span>
          <svg
            width="10" height="5" viewBox="0 0 10 5" fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`transform transition-transform duration-200 flex-shrink-0 overflow-visible ${isOpen ? 'rotate-180' : ''}`}
          >
            <path
              d="M1 1L5 5L9 1"
              stroke="#374151"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {isOpen && (
        <div
          className="absolute top-full mt-1 right-0 bg-white border border-gray-200 rounded-xl z-50 overflow-hidden min-w-[200px] py-1.5"
          style={{ boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.12)' }}
        >
          {/* py-1.5 on the parent insets the scrollbar from the panel's
              rounded corners so it doesn't visually clip at the top/bottom.
              Inside, all entries share the same shell. Discover is just the
              first item (not sticky) — it scrolls with the rest.
              `flex-row-reverse` puts the logo on the right and text on the
              left (the scroll container is direction:ltr via
              `scrollbar-styled` to put the scrollbar on the right, so we
              reverse flex order manually rather than fight with `dir`). */}
          <div className="max-h-[280px] overflow-y-auto scrollbar-styled px-1.5">
            {showDiscover && (
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="w-full flex flex-row-reverse items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors text-black"
                style={{ fontSize: '16px', fontWeight: 400 }}
              >
                <span
                  className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--color-gray-2)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9.99935 18.3327C14.6017 18.3327 18.3327 14.6017 18.3327 9.99935C18.3327 5.39698 14.6017 1.66602 9.99935 1.66602C5.39698 1.66602 1.66602 5.39698 1.66602 9.99935C1.66602 14.6017 5.39698 18.3327 9.99935 18.3327Z" stroke="#3F3F46" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M13.5335 6.4668L12.0301 10.976C11.9483 11.2214 11.8105 11.4445 11.6275 11.6275C11.4445 11.8105 11.2214 11.9483 10.976 12.0301L6.4668 13.5335L7.97013 9.0243C8.05195 8.77881 8.1898 8.05195 9.0243 7.97013L13.5335 6.4668Z" stroke="#3F3F46" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="truncate flex-1 text-right" style={{ fontWeight: 400 }}>גילוי קהילות נוספות</span>
              </Link>
            )}
            {sortedCommunities.length === 0 && !showDiscover && (
              <div className="px-3 py-6 text-center text-black" style={{ fontSize: '16px', fontWeight: 400 }}>
                עוד לא הצטרפת לקהילות עדיין
              </div>
            )}
            {sortedCommunities.length > 0 && (
              sortedCommunities.map((comm) => (
                <button
                  key={comm.id}
                  onClick={() => handleSwitch(comm)}
                  className="w-full flex flex-row-reverse items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors text-black"
                  style={{ fontSize: '16px', fontWeight: 400 }}
                >
                  <span
                    className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: 'var(--color-gray-2)' }}
                  >
                    {comm.logo ? (
                      <img
                        src={getImageUrl(comm.logo)}
                        alt={comm.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UsersIcon className="w-4 h-4 text-gray-400" />
                    )}
                  </span>
                  <span className="truncate flex-1 text-right" style={{ fontWeight: 400 }}>{comm.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
