'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import CommunityNavbar from '../../components/CommunityNavbar';
import { useUser } from '../../lib/UserContext';
import { CommunityLayoutContext, CommunityLayoutContextType } from './CommunityContext';

interface Community {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
  ownerId: string;
}

interface UserProfile {
  name?: string;
  profileImage?: string | null;
}

export default function CommunityLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const communityId = params.id as string;

  const { user } = useUser();
  const userEmail = user?.email ?? null;
  const userId = user?.userId ?? null;
  const userProfile: UserProfile | null = user
    ? { name: user.name, profileImage: user.profileImage }
    : null;

  const [community, setCommunity] = useState<Community | null>(null);
  const [userRole, setUserRole] = useState<'OWNER' | 'MANAGER' | 'MEMBER' | null>(null);
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Determine active page from pathname
  const getActivePage = useCallback((): 'feed' | 'courses' | 'members' | 'events' | 'leaderboard' | 'about' | 'manage' => {
    if (pathname?.includes('/manage')) return 'manage';
    if (pathname?.includes('/about')) return 'about';
    if (pathname?.includes('/leaderboard')) return 'leaderboard';
    if (pathname?.includes('/events')) return 'events';
    if (pathname?.includes('/members')) return 'members';
    if (pathname?.includes('/courses')) return 'courses';
    return 'feed';
  }, [pathname]);

  // Show search only on feed and courses pages
  const showSearch = pathname?.includes('/feed') || pathname?.includes('/courses');

  // Reset search query when navigating between pages
  useEffect(() => {
    setSearchQuery('');
  }, [pathname]);

  // Fetch community data and membership
  const fetchCommunity = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);

      if (res.ok) {
        const data = await res.json();
        setCommunity({
          id: data.id,
          name: data.name,
          slug: data.slug,
          logo: data.logo,
          ownerId: data.ownerId,
        });

        if (user) {
          const membershipRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/membership`,
          );
          if (membershipRes.ok) {
            const m = await membershipRes.json();
            setIsMember(!!m.isMember);
            setUserRole(m.role ?? null);
            // Non-members (banned or not) belong on /preview. Doing the
            // redirect at the layout level — before children render —
            // avoids the feed/about/etc page flashing into view first.
            // Mark data loaded *before* navigating so the spinner clears
            // once the new page mounts; layout's deps don't include
            // pathname so it won't refire on the destination route.
            if (!m.isMember && !pathname?.includes('/preview')) {
              setLoading(false);
              setInitialDataLoaded(true);
              router.replace(`/communities/${communityId}/preview`);
              return;
            }
          }
        } else {
          // Anonymous viewer
          setIsMember(false);
          setUserRole(null);
        }
      }
      setLoading(false);
      setInitialDataLoaded(true);
    } catch (error) {
      console.error('Error fetching community:', error);
      setLoading(false);
      setInitialDataLoaded(true);
    }
  };

  useEffect(() => {
    if (communityId) {
      fetchCommunity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, user]);

  const isOwner = userRole === 'OWNER' || (userId !== null && community?.ownerId === userId);
  const isManager = userRole === 'MANAGER';
  const isOwnerOrManager = isOwner || isManager;

  // Don't show navbar on pages that have their own header
  const isPreviewPage = pathname?.includes('/preview');
  const isCreatePage = pathname?.includes('/create');
  const isEditPage = pathname?.includes('/edit');
  const shouldShowNavbar = !isPreviewPage && !isCreatePage && !isEditPage;

  const contextValue: CommunityLayoutContextType = {
    community,
    userEmail,
    userId,
    userProfile,
    userRole,
    isOwner,
    isManager,
    isOwnerOrManager,
    isMember,
    loading: loading && !initialDataLoaded,
    refreshCommunity: fetchCommunity,
    searchQuery,
    setSearchQuery,
  };

  return (
    <CommunityLayoutContext.Provider value={contextValue}>
      {shouldShowNavbar && (
        <CommunityNavbar
          communityId={communityId}
          community={community}
          activePage={getActivePage()}
          isOwnerOrManager={isOwnerOrManager}
          userEmail={userEmail}
          userId={userId}
          userProfile={userProfile}
          showSearch={showSearch}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}
      {/* Hold child render until the first community + membership fetch is
          done. Otherwise feed/about/etc paint briefly before the layout's
          ban-redirect resolves, causing the visible "flash then bounce." */}
      {initialDataLoaded ? children : (
        <main className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
        </main>
      )}
    </CommunityLayoutContext.Provider>
  );
}
