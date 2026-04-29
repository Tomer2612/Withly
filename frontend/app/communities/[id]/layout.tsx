'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import CommunityNavbar from '../../components/CommunityNavbar';
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

interface JwtPayload {
  email: string;
  sub: string;
  iat: number;
  exp: number;
}

export default function CommunityLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const communityId = params.id as string;

  const [community, setCommunity] = useState<Community | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
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

  // Fetch user info from token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode<JwtPayload>(token);
        setUserEmail(decoded.email);
        setUserId(decoded.sub);
      } catch {
        localStorage.removeItem('token');
      }
    }
  }, []);

  // Fetch user profile
  useEffect(() => {
    if (!userId) return;
    
    // Check cache first
    const cachedProfile = localStorage.getItem('userProfileCache');
    if (cachedProfile) {
      try {
        const parsed = JSON.parse(cachedProfile);
        if (parsed.userId === userId) {
          setUserProfile({ name: parsed.name, profileImage: parsed.profileImage });
        }
      } catch {}
    }
    
    // Fetch fresh data
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUserProfile({ name: data.name, profileImage: data.profileImage });
          localStorage.setItem('userProfileCache', JSON.stringify({
            userId,
            name: data.name,
            profileImage: data.profileImage,
          }));
        }
      } catch {}
    };
    
    fetchProfile();
  }, [userId]);

  // Fetch community data and membership
  const fetchCommunity = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`, { headers });

      if (res.ok) {
        const data = await res.json();
        setCommunity({
          id: data.id,
          name: data.name,
          slug: data.slug,
          logo: data.logo,
          ownerId: data.ownerId,
        });

        // Membership detection — important: don't flip isMember to a stale value
        // while the JWT is still decoding. If a token exists in storage but
        // userId hasn't been set yet, leave isMember alone and wait for the
        // re-render after userId settles. Otherwise feed/page.tsx briefly sees
        // isMember=false and bounces the user to /preview.
        if (token && !userId) {
          // userId not decoded yet — this effect will refire when it is.
          // Don't mark initial-data-loaded yet so children don't paint
          // until membership is actually known.
          return;
        } else if (token && userId) {
          const membershipRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/membership`,
            { headers },
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
          // No token at all — anonymous viewer
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
  }, [communityId, userId]);

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
