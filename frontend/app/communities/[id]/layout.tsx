'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import CommunityNavbar from '../../components/CommunityNavbar';
import SuspendedCommunityModal from '../../components/SuspendedCommunityModal';
import PriceChangeAnnouncementModal from '../../components/PriceChangeAnnouncementModal';
import ScheduledSuspensionModal from '../../components/ScheduledSuspensionModal';
import { useUser } from '../../lib/UserContext';
import { CommunityLayoutContext, CommunityLayoutContextType } from './CommunityContext';

interface Community {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
  ownerId: string;
  ownerName?: string | null;
  subscriptionStatus: 'ACTIVE' | 'SUSPENDED';
  price?: number | null;
  pendingPrice?: number | null;
  pendingPriceEffectiveAt?: string | null;
  priceChangeAnnouncedAt?: string | null;
  subscriptionCancelledAt?: string | null;
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

  const { user, loading: userLoading } = useUser();
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
  // Tracks the membership row's priceChangeSeenForEffectiveAt; used to
  // decide whether to show the price-change announcement popup.
  const [priceChangeSeenForEffectiveAt, setPriceChangeSeenForEffectiveAt] = useState<string | null>(null);
  const [memberJoinedAt, setMemberJoinedAt] = useState<string | null>(null);
  const [suspensionScheduledSeenAt, setSuspensionScheduledSeenAt] = useState<string | null>(null);

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

  // Fetch community data and membership.
  // `silent=true` skips the loading-reset — used by refreshCommunity() after
  // in-place mutations (renewal, cancel-subscription, etc.) so children
  // don't unmount mid-action and lose state like success messages. The full
  // reset is reserved for community-change navigation, where stale child
  // state is the actual problem we're guarding against.
  const fetchCommunity = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setInitialDataLoaded(false);
    }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);

      if (res.ok) {
        const data = await res.json();
        const isSuspended = data.subscriptionStatus === 'SUSPENDED';
        setCommunity({
          id: data.id,
          name: data.name,
          slug: data.slug,
          logo: data.logo,
          ownerId: data.ownerId,
          ownerName: data.owner?.name ?? null,
          subscriptionStatus: data.subscriptionStatus ?? 'ACTIVE',
          price: data.price ?? null,
          pendingPrice: data.pendingPrice ?? null,
          pendingPriceEffectiveAt: data.pendingPriceEffectiveAt ?? null,
          priceChangeAnnouncedAt: data.priceChangeAnnouncedAt ?? null,
          subscriptionCancelledAt: data.subscriptionCancelledAt ?? null,
        });

        if (user) {
          const membershipRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/membership`,
          );
          if (membershipRes.ok) {
            const m = await membershipRes.json();
            setIsMember(!!m.isMember);
            setUserRole(m.role ?? null);
            setPriceChangeSeenForEffectiveAt(m.priceChangeSeenForEffectiveAt ?? null);
            setMemberJoinedAt(m.joinedAt ?? null);
            setSuspensionScheduledSeenAt(m.suspensionScheduledSeenAt ?? null);
            // Non-members (banned or not) belong on /preview. Doing the
            // redirect at the layout level — before children render —
            // avoids the feed/about/etc page flashing into view first.
            // Mark data loaded *before* navigating so the spinner clears
            // once the new page mounts; layout's deps don't include
            // pathname so it won't refire on the destination route.
            // Skip the preview redirect for SUSPENDED communities — the
            // suspended modal takes precedence and its "back home" link
            // does the right thing.
            if (!m.isMember && !isSuspended && !pathname?.includes('/preview')) {
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
    // Hold the fetch until UserContext settles. Without this guard, the
    // effect fires once with user=null (initial render before /users/me
    // probe finishes) and again once user is hydrated — causing the feed
    // page to double-refetch in turn.
    if (userLoading) return;
    if (communityId) {
      fetchCommunity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, user, userLoading]);

  const isOwner = userRole === 'OWNER' || (userId !== null && community?.ownerId === userId);
  const isManager = userRole === 'MANAGER';
  const isOwnerOrManager = isOwner || isManager;

  // Suspended-community gating. Owner can still navigate manage routes (so
  // they can hit the Payments tab and renew); everyone else gets the popup
  // on every community route. The popup itself blocks interaction underneath.
  const isSuspended = community?.subscriptionStatus === 'SUSPENDED';
  const onManageRoute = pathname?.includes('/manage') ?? false;
  const showSuspendedModal = isSuspended && !(isOwner && onManageRoute);
  const suspendedRole: 'owner' | 'member' = isOwner ? 'owner' : 'member';

  // Price-change announcement popup — show to members/managers (not owner)
  // when the community has a pending change AND this member hasn't seen it
  // yet for this particular effective date. Suspended popup wins if both.
  const pendingEffectiveAtDate = community?.pendingPriceEffectiveAt
    ? new Date(community.pendingPriceEffectiveAt)
    : null;
  const memberSeenAtDate = priceChangeSeenForEffectiveAt
    ? new Date(priceChangeSeenForEffectiveAt)
    : null;
  const announcedAtDate = community?.priceChangeAnnouncedAt
    ? new Date(community.priceChangeAnnouncedAt)
    : null;
  const memberJoinedAtDate = memberJoinedAt ? new Date(memberJoinedAt) : null;
  // New joiners (after the announcement) are already paying the new price —
  // skip the popup for them. Only members who joined before the announcement
  // are being grandfathered and need the heads-up.
  const memberPredatesAnnouncement =
    !!announcedAtDate && !!memberJoinedAtDate && memberJoinedAtDate < announcedAtDate;
  const hasUnseenPriceChange =
    !!pendingEffectiveAtDate
    && pendingEffectiveAtDate > new Date()
    && memberPredatesAnnouncement
    && (!memberSeenAtDate || memberSeenAtDate.getTime() !== pendingEffectiveAtDate.getTime());
  const showPriceChangeModal =
    !showSuspendedModal && !isOwner && !!isMember && hasUnseenPriceChange;

  // Scheduled-suspension popup — fires once per pending cancellation date,
  // for current members and managers (not the owner who triggered it).
  const cancelledAtDate = community?.subscriptionCancelledAt
    ? new Date(community.subscriptionCancelledAt)
    : null;
  const suspensionSeenAtDate = suspensionScheduledSeenAt
    ? new Date(suspensionScheduledSeenAt)
    : null;
  const hasUnseenSuspensionScheduled =
    !!cancelledAtDate
    && cancelledAtDate > new Date()
    && (!suspensionSeenAtDate || suspensionSeenAtDate.getTime() !== cancelledAtDate.getTime());
  const showSuspensionScheduledModal =
    !showSuspendedModal
    && !showPriceChangeModal
    && !isOwner
    && !!isMember
    && hasUnseenSuspensionScheduled;

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
    refreshCommunity: () => fetchCommunity(true),
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
          isOwner={isOwner}
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
          ban-redirect resolves, causing the visible "flash then bounce."
          Also skip rendering children behind the suspended modal — the
          modal's backdrop is semi-transparent, so the child page would
          paint visibly underneath for one frame. */}
      {!initialDataLoaded ? (
        <main className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
        </main>
      ) : showSuspendedModal ? (
        <main className="min-h-screen bg-gray-100" />
      ) : (
        children
      )}
      {showSuspensionScheduledModal && cancelledAtDate && (
        <ScheduledSuspensionModal
          communityId={communityId}
          communityName={community?.name ?? null}
          effectiveDate={cancelledAtDate}
          ownerName={community?.ownerName ?? null}
          isPaidCommunity={(community?.price ?? 0) > 0}
          onClose={() => {
            setSuspensionScheduledSeenAt(community?.subscriptionCancelledAt ?? null);
          }}
        />
      )}
      {showPriceChangeModal && pendingEffectiveAtDate && community?.pendingPrice != null && (
        <PriceChangeAnnouncementModal
          communityId={communityId}
          currentPrice={community.price ?? 0}
          newPrice={community.pendingPrice}
          effectiveDate={pendingEffectiveAtDate}
          onClose={() => {
            // Mark as seen locally so the popup doesn't re-render on
            // subsequent route changes within this session.
            setPriceChangeSeenForEffectiveAt(community.pendingPriceEffectiveAt ?? null);
          }}
        />
      )}
      {showSuspendedModal && (
        <SuspendedCommunityModal
          role={suspendedRole}
          communityId={communityId}
          canLeave={!!isMember && !isOwner}
        />
      )}
    </CommunityLayoutContext.Provider>
  );
}
