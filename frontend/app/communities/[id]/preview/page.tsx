'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authFetch } from '../../../lib/auth';
import { useUser } from '../../../lib/UserContext';
import { FaYoutube, FaWhatsapp, FaFacebook, FaInstagram } from 'react-icons/fa';
import PlayIcon from '../../../components/icons/PlayIcon';
import VideoPlayer, { VideoThumbnail } from '../../../components/VideoPlayer';
import CloseIcon from '../../../components/icons/CloseIcon';
import ChevronLeftIcon from '../../../components/icons/ChevronLeftIcon';
import ChevronRightIcon from '../../../components/icons/ChevronRightIcon';
import { getImageUrl } from '@/app/lib/imageUrl';
import { hypCCodeToHebrew } from '@/app/lib/hypErrors';
import HypPaymentIframeModal from '../../../components/HypPaymentIframeModal';
import ExistingCardConfirmModal from '../../../components/ExistingCardConfirmModal';
import CardPickerModal from '../../../components/CardPickerModal';

interface Community {
  id: string;
  name: string;
  slug?: string | null;
  description: string;
  image?: string | null;
  logo?: string | null;
  ownerId: string;
  createdAt: string;
  topic?: string | null;
  memberCount?: number | null;
  price?: number | null;
  pendingPrice?: number | null;
  youtubeUrl?: string | null;
  whatsappUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  galleryImages?: string[];
  galleryVideos?: string[];
  owner?: {
    id: string;
    name: string;
    email: string;
    profileImage?: string | null;
  };
}

const joinPrice = (c: { price?: number | null; pendingPrice?: number | null }): number =>
  c.pendingPrice ?? c.price ?? 0;

// Gallery media item type
interface GalleryItem {
  type: 'image' | 'video';
  src: string; // For images: path, For videos: YouTube URL
  videoId?: string; // YouTube video ID
}

// Gallery Component with slideshow functionality
function CommunityGallery({ primaryImage, galleryImages, galleryVideos, communityName }: { 
  primaryImage?: string | null; 
  galleryImages: string[];
  galleryVideos: string[];
  communityName: string;
}) {
  // Build unified media array: videos first, then images
  const allMedia: GalleryItem[] = [
    ...galleryVideos.map(url => ({
      type: 'video' as const,
      src: url,
    })),
    ...(primaryImage ? [{ type: 'image' as const, src: primaryImage }] : []),
    ...galleryImages.map(img => ({ type: 'image' as const, src: img })),
  ];
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  
  // Auto-rotate every 10 seconds (pause on video)
  useEffect(() => {
    if (allMedia.length <= 1) return;
    
    // Don't auto-rotate if currently showing a video and it's playing
    const currentItem = allMedia[currentIndex];
    if (currentItem?.type === 'video' && isVideoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev === allMedia.length - 1 ? 0 : prev + 1));
      setIsVideoPlaying(false);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [allMedia.length, currentIndex, isVideoPlaying]);
  
  if (allMedia.length === 0) return null;
  
  const goToPrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? allMedia.length - 1 : prev - 1));
    setIsVideoPlaying(false);
  };
  
  const goToNext = () => {
    setCurrentIndex((prev) => (prev === allMedia.length - 1 ? 0 : prev + 1));
    setIsVideoPlaying(false);
  };
  
  const currentItem = allMedia[currentIndex];
  
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="relative aspect-video bg-black">
        {currentItem.type === 'video' ? (
          <div onMouseEnter={() => setIsVideoPlaying(true)} onMouseLeave={() => setIsVideoPlaying(false)} onClick={() => setIsVideoPlaying((prev) => !prev)}>
            <VideoPlayer url={currentItem.src} className="rounded-none" />
          </div>
        ) : (
          <img
            src={getImageUrl(currentItem.src)}
            alt={`${communityName} - תמונה ${currentIndex + 1}`}
            className="w-full h-full object-cover"
          />
        )}
        {allMedia.length > 1 && (
          <>
            <button 
              onClick={goToNext}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition"
            >
              <ChevronLeftIcon className="w-4 h-4 text-gray-700" />
            </button>
            <button 
              onClick={goToPrev}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition"
            >
              <ChevronRightIcon className="w-4 h-4 text-gray-700" />
            </button>
          </>
        )}
      </div>
      {allMedia.length > 1 && (
        <div className="flex gap-2 p-3 bg-gray-50 justify-center overflow-x-auto">
          {allMedia.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx);
                setIsVideoPlaying(false);
              }}
              className={`w-24 h-[54px] rounded-lg overflow-hidden flex-shrink-0 border-2 transition relative ${
                idx === currentIndex ? 'border-[#A7EA7B]' : 'border-transparent hover:border-gray-300'
              }`}
            >
              {item.type === 'video' ? (
                <>
                  <VideoThumbnail url={item.src} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PlayIcon className="w-8 h-8" />
                  </div>
                </>
              ) : (
                <img
                  src={getImageUrl(item.src)}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CommunityPreviewContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const communityId = params.id as string;

  const { user } = useUser();
  const userEmail = user?.email ?? null;
  const [community, setCommunity] = useState<Community | null>(null);
  const [ownerData, setOwnerData] = useState<{ id: string; name: string; profileImage?: string | null; coverImage?: string | null; bio?: string | null } | null>(null);
  const [similarCommunities, setSimilarCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [managerCount, setManagerCount] = useState(0);
  const [joining, setJoining] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [paidJoinError, setPaidJoinError] = useState<string | null>(null);

  // Phase 4 Mission 3 — paid-join flow. Mirrors the Phase 3.3 pricing
  // page picker: fetch wallet on click; empty → HYP iframe; ≥1 → confirm
  // popup with primary pre-selected.
  const [pickerView, setPickerView] = useState<'none' | 'confirm' | 'picker' | 'iframe'>('none');
  const [savedCards, setSavedCards] = useState<{
    id: string; cardLastFour: string; cardBrand: string;
    cardExpMonth: number | null; cardExpYear: number | null;
    isPrimary: boolean; createdAt: string;
  }[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [finalizingPaidJoin, setFinalizingPaidJoin] = useState(false);

  // Show payment popup after returning from signup. Banned users skip
  // this - the banner replaces the join flow entirely.
  useEffect(() => {
    if (searchParams.get('showPayment') === 'true' && community && !isBanned) {
      // Re-trigger the join click path so the wallet is fetched + the
      // right modal is opened. handleJoinClick is async-safe here.
      void handleJoinClickForResume();
      router.replace(`/communities/${communityId}/preview`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, community, communityId, router, isBanned]);

  // Surface a toast/banner when the iframe-redirect path bounced back
  // with ?card=error (charge failed or tokenize failed).
  useEffect(() => {
    if (searchParams.get('card') === 'error') {
      setPaidJoinError('החיוב לא עבר. אפשר לנסות שוב או להשתמש בכרטיס אחר.');
      router.replace(`/communities/${communityId}/preview`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const fetchCommunity = async () => {
      if (!communityId) {
        setLoading(false);
        return;
      }

      try {
        setCommunity(null);
        setLoading(true);

        // Check membership - if member, redirect to feed; if banned, surface that.
        if (user) {
          const membershipRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/membership`);
          if (membershipRes.ok) {
            const membershipData = await membershipRes.json();
            if (membershipData.role) {
              // Already a member — hard navigate so the layout's membership
              // cache can't lag behind and bounce us back here.
              window.location.href = `/communities/${communityId}/feed`;
              return;
            }
            if (membershipData.isBanned) {
              setIsBanned(true);
            }
          }
        }

        const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);
        if (!res.ok) throw new Error('Failed to fetch community');
        const data = await res.json();
        
        // Redirect to slug URL if community has a slug and we're using ID
        if (data.slug && communityId !== data.slug) {
          router.replace(`/communities/${data.slug}/preview`);
          return;
        }
        
        setCommunity(data);

        // Fetch owner data separately
        if (data.ownerId) {
          const ownerRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${data.ownerId}`);
          if (ownerRes.ok) {
            const owner = await ownerRes.json();
            setOwnerData(owner);
          }
        }

        // Fetch similar communities (same topic)
        if (data.topic) {
          const allRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities`);
          if (allRes.ok) {
            const allCommunities = await allRes.json();
            const similar = allCommunities.filter((c: Community) =>
              c.topic === data.topic && c.id !== data.id && c.slug !== data.slug
            ).slice(0, 3);
            setSimilarCommunities(similar);
          }
        }

        // Fetch members to count managers
        if (user) {
          const membersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/members`);
          if (membersRes.ok) {
            const members = await membersRes.json();
            const managers = members.filter((m: { role: string }) => m.role === 'OWNER' || m.role === 'MANAGER');
            setManagerCount(managers.length);
          }
        }
      } catch (err) {
        console.error('Error fetching community:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCommunity();
  }, [communityId, router, user]);

  const handleJoinClick = async () => {
    // Banned users can't rejoin — bail before any signup/payment side trips.
    if (isBanned) return;

    const effectivePrice = community ? joinPrice(community) : 0;

    if (!userEmail) {
      // Save the community ID and payment intent for after registration
      localStorage.setItem('pendingJoinCommunity', communityId);
      if (effectivePrice > 0) {
        localStorage.setItem('pendingPayment', 'true');
      }
      router.push('/signup');
      return;
    }

    if (effectivePrice <= 0) {
      joinCommunity();
      return;
    }

    // Paid path — fetch wallet, decide picker vs iframe.
    await openPaidJoinPicker();
  };

  // Same flow used by ?showPayment=true URL return-from-signup.
  const handleJoinClickForResume = async () => {
    if (!community || isBanned) return;
    const effectivePrice = joinPrice(community);
    if (effectivePrice <= 0) return;
    await openPaidJoinPicker();
  };

  // Fetches the user's wallet, filters to unexpired cards, sorts primary-
  // first/newest-first, and opens either ExistingCardConfirmModal (≥1 card)
  // or the HYP iframe directly (empty wallet). Identical pattern to the
  // pricing page Phase 3.3 picker.
  const openPaidJoinPicker = async () => {
    setPaidJoinError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/payment-methods`, {
        credentials: 'include',
      });
      const allCards: typeof savedCards = res.ok ? await res.json() : [];
      const now = new Date();
      const nowYM = now.getFullYear() * 100 + (now.getMonth() + 1);
      const unexpired = allCards.filter(c => {
        if (c.cardExpMonth == null || c.cardExpYear == null) return true;
        return c.cardExpYear * 100 + c.cardExpMonth >= nowYM;
      });
      unexpired.sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setSavedCards(unexpired);
      if (unexpired.length === 0) {
        setPickerView('iframe');
      } else {
        setSelectedCardId(unexpired[0].id);
        setPickerView('confirm');
      }
    } catch {
      // Network blip — fall back to the iframe (legacy behavior).
      setPickerView('iframe');
    }
  };

  // Existing-card path: POST to backend; on success it returns the
  // community + memberSubscription. Redirect to feed.
  const finalizePaidJoinWithExistingCard = async () => {
    setFinalizingPaidJoin(true);
    setPaidJoinError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/join-paid-with-existing-card`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethodId: selectedCardId }),
        },
      );
      if (!res.ok) {
        // Backend returns NestJS-style { message, statusCode }. Map known
        // business errors to friendly Hebrew toasts; everything else is
        // a generic failure.
        const errorBody = await res.json().catch(() => ({}));
        const msg = String(errorBody?.message ?? '');
        if (msg.startsWith('CHARGE_FAILED')) {
          // Phase 6.5 — backend throws `CHARGE_FAILED:<ccode>`; pull the
          // ccode and surface a code-specific Hebrew message when we
          // have one. Unknown codes fall back to the generic copy.
          const ccode = msg.split(':')[1]?.trim();
          const { message, isSpecific } = hypCCodeToHebrew(ccode);
          setPaidJoinError(
            isSpecific
              ? `${message}. ניתן לנסות שוב או להשתמש בכרטיס אחר.`
              : 'החיוב לא עבר. אפשר לנסות שוב או להשתמש בכרטיס אחר.',
          );
        } else if (msg === 'CARD_EXPIRED') {
          setPaidJoinError('הכרטיס פג תוקף. יש להוסיף כרטיס חדש.');
        } else if (msg === 'COMMUNITY_SUSPENDED') {
          setPaidJoinError('הקהילה מושעית כרגע, לא ניתן להצטרף.');
        } else {
          setPaidJoinError('שגיאה בהצטרפות לקהילה. יש לנסות שוב.');
        }
        setPickerView('none');
        return;
      }
      // Success → land on feed with a "joined" toast.
      const redirectId = community?.slug || communityId;
      window.location.href = `/communities/${redirectId}/feed?card=joined`;
    } catch {
      setPaidJoinError('שגיאה בהצטרפות לקהילה. יש לנסות שוב.');
      setPickerView('none');
    } finally {
      setFinalizingPaidJoin(false);
    }
  };

  const joinCommunity = async () => {
    setJoining(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/join`, {
        method: 'POST',
      });
      
      if (res.ok) {
        // Redirect using slug if available. Use a hard navigation (not
        // router.push) so the community layout remounts with fresh
        // membership state — otherwise the layout caches isMember=false
        // from before we joined and feed bounces us back to preview.
        const redirectId = community?.slug || communityId;
        window.location.href = `/communities/${redirectId}/feed`;
      }
    } catch (err) {
      console.error('Failed to join community:', err);
    } finally {
      setJoining(false);
    }
  };


  if (loading || !community) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin"></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 text-right" dir="rtl">
      {/* Content - 2 column layout */}
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Left Sidebar */}
          <div className="space-y-6">
            {/* Owner Card */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Cover Photo */}
              {ownerData?.coverImage ? (
                <img
                  src={getImageUrl(ownerData.coverImage)}
                  alt=""
                  className="w-full h-28 object-cover"
                />
              ) : (
                <div className="w-full h-28 bg-gradient-to-r from-pink-100 to-purple-100" />
              )}
              
              <div className="px-5 pb-5 -mt-12 text-center">
                {/* Centered Profile Photo */}
                <div className="flex justify-center mb-3">
                  <Link href={`/profile/${ownerData?.id}`} className="cursor-pointer hover:opacity-80 transition">
                    {ownerData?.profileImage ? (
                      <img
                        src={getImageUrl(ownerData.profileImage)}
                        alt={ownerData.name}
                        className="w-24 h-24 rounded-full object-cover border-[5px] border-white"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-pink-100 flex items-center justify-center text-2xl font-bold text-pink-600 border-[5px] border-white">
                        {ownerData?.name?.charAt(0) || 'U'}
                      </div>
                    )}
                  </Link>
                </div>
                
                {/* Centered Name */}
                <Link href={`/profile/${ownerData?.id}`} className="font-bold text-black text-xl mb-2 hover:opacity-80 transition block">{ownerData?.name || 'מנהל הקהילה'}</Link>
                
                {/* Centered Bio */}
                {ownerData?.bio && (
                  <p className="text-sm text-gray-600 leading-relaxed">{ownerData.bio}</p>
                )}
              </div>

              {/* Join Button (or banned banner) */}
              <div className="px-5 pb-5">
              {isBanned ? (
                <div
                  className="w-full py-3 px-4 rounded-xl font-medium text-center"
                  style={{ backgroundColor: '#FCE8E6', color: '#B3261E' }}
                >
                  הושעית מהקהילה ולא ניתן להצטרף שוב.
                  <br />
                  צור קשר עם הבעלים או המנהלים להסרת ההשעיה.
                </div>
              ) : (
                <>
                  {/* Inline join error — surfaces redirect-back failures (card=error)
                      and existing-card POST rejections. Replaces the previous
                      fixed-top toast: stays inline above the action so the user
                      sees both the error and the retry button together, and
                      doesn't auto-dismiss. */}
                  {paidJoinError && (
                    <div
                      className="w-full px-4 py-3 rounded-xl mb-3 flex items-start gap-3 text-right"
                      style={{ backgroundColor: '#FCE8E6', color: '#B3261E' }}
                      role="alert"
                    >
                      <span className="flex-1" style={{ fontSize: '14px', lineHeight: '1.5' }}>
                        {paidJoinError}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPaidJoinError(null)}
                        className="flex-shrink-0 opacity-70 hover:opacity-100"
                        aria-label="סגירה"
                      >
                        <CloseIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handleJoinClick}
                    disabled={joining}
                    className="w-full py-3 px-4 bg-black text-white rounded-md font-semibold text-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {joining ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        מצטרף...
                      </>
                    ) : joinPrice(community) > 0 ? (
                      `הצטרפות בתשלום`
                    ) : (
                      `הצטרפות בחינם`
                    )}
                  </button>
                  {joinPrice(community) > 0 ? (
                    <p className="text-sm text-gray-500 text-center mt-2">₪{joinPrice(community)} לחודש </p>
                  ) : null}
                </>
              )}
              </div>
            </div>

            {/* Community Details Section */}
            <h4 className="text-lg font-semibold text-black mb-3">פרטים נוספים על הקהילה</h4>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 text-center p-5 border-b border-gray-100">
                <div>
                  <p className="text-xl font-bold text-black">{managerCount || 1}</p>
                  <p className="text-xs text-gray-500">מנהלים</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-black">
                    {userEmail ? 1 : 0}
                  </p>
                  <p className="text-xs text-gray-500">מחוברים</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-black">
                    {(() => {
                      const count = community.memberCount || 1;
                      if (count >= 10000) return `${Math.floor(count / 10000) * 10000}+`;
                      if (count >= 1000) return `${Math.floor(count / 1000) * 1000}+`;
                      if (count >= 100) return `${Math.floor(count / 100) * 100}+`;
                      return count;
                    })()}
                  </p>
                  <p className="text-xs text-gray-500">משתמשים</p>
                </div>
              </div>

              {/* Social Links */}
              {(community.youtubeUrl || community.whatsappUrl || community.facebookUrl || community.instagramUrl) && (
                <div className="p-5">
                  <h4 className="text-[18px] font-semibold text-gray-500 mb-3 text-center">עקבו אחרינו</h4>
                  <div className="flex justify-center gap-3">
                    {community.youtubeUrl && (
                      <a href={community.youtubeUrl} target="_blank" rel="noopener noreferrer" 
                        className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-600 flex items-center justify-center transition">
                        <FaYoutube className="w-5 h-5" />
                      </a>
                    )}
                    {community.whatsappUrl && (
                      <a href={community.whatsappUrl} target="_blank" rel="noopener noreferrer" 
                        className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-600 flex items-center justify-center transition">
                        <FaWhatsapp className="w-5 h-5" />
                      </a>
                    )}
                    {community.facebookUrl && (
                      <a href={community.facebookUrl} target="_blank" rel="noopener noreferrer" 
                        className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-600 flex items-center justify-center transition">
                        <FaFacebook className="w-5 h-5" />
                      </a>
                    )}
                    {community.instagramUrl && (
                      <a href={community.instagramUrl} target="_blank" rel="noopener noreferrer" 
                        className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-600 flex items-center justify-center transition">
                        <FaInstagram className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            {/* Community Image/Video Slideshow */}
            {(community.image || (community.galleryImages && community.galleryImages.length > 0) || (community.galleryVideos && community.galleryVideos.length > 0)) && (
              <CommunityGallery 
                primaryImage={community.image} 
                galleryImages={community.galleryImages || []} 
                galleryVideos={community.galleryVideos || []}
                communityName={community.name}
              />
            )}

            {/* About Section */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-[28px] font-semibold text-black mb-4">{community.name}</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {community.description}
              </p>
            </div>
          </div>
        </div>

        {/* Similar Communities Section */}
        {similarCommunities.length > 0 && (
          <div className="mt-20">
            <h2 className="text-[28px] font-semibold text-right mb-8">קהילות דומות</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {similarCommunities.map((comm) => {
                // Format member count like homepage
                const formatMemberCount = (count: number) => {
                  if (count >= 10000) {
                    return `${(count / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}K+`;
                  }
                  if (count >= 1000) {
                    return `${(count / 1000).toFixed(1).replace('.0', '')}K+`;
                  }
                  if (count >= 100) {
                    const rounded = Math.floor(count / 100) * 100;
                    return `${rounded.toLocaleString()}+`;
                  }
                  return count.toString();
                };
                
                return (
                  <Link
                    key={comm.id}
                    href={`/communities/${comm.id}/preview`}
                    className="rounded-2xl overflow-hidden bg-white transition-all duration-200 hover:shadow-lg flex flex-col"
                  >
                    {comm.image ? (
                      <img
                        src={getImageUrl(comm.image)}
                        alt={comm.name}
                        className="w-full object-cover"
                        style={{ aspectRatio: '16/9' }}
                      />
                    ) : (
                      <div className="w-full flex items-center justify-center" style={{ aspectRatio: '16/9', background: 'linear-gradient(to bottom right, #DBEAFE, #DCFCE7)' }}>
                        <span className="font-medium" style={{ color: '#A1A1AA' }}>תמונת קהילה</span>
                      </div>
                    )}
                    <div className="p-5 text-right flex-1 flex flex-col" dir="rtl">
                      <div className="flex items-start gap-3 mb-2">
                        {comm.logo ? (
                          <img
                            src={getImageUrl(comm.logo)}
                            alt={comm.name}
                            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F4F4F5' }}>
                            <span className="text-lg font-bold" style={{ color: '#A1A1AA' }}>{comm.name.charAt(0)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-black truncate" style={{ fontSize: '1.5rem' }}>{comm.name}</h3>
                          {comm.topic && (
                            <span className="font-normal" style={{ fontSize: '1rem', color: '#3F3F46' }}>{comm.topic}</span>
                          )}
                        </div>
                      </div>
                      <p className="line-clamp-3 leading-relaxed" style={{ fontSize: '1rem', color: '#3F3F46' }}>
                        {comm.description}
                      </p>
                      
                      {/* Member count + Price badges */}
                      <div className="flex flex-wrap items-center justify-start gap-2 mt-auto pt-4">
                        {/* Member count badge */}
                        <span 
                          className="rounded-full font-normal"
                          style={{ backgroundColor: '#F4F4F5', color: '#3F3F46', fontSize: '1rem', padding: '0.5rem 1rem' }}
                        >
                          {(comm.memberCount ?? 0) === 1 
                            ? 'משתמש אחד' 
                            : (comm.memberCount ?? 0) < 100
                              ? `${comm.memberCount} משתמשים`
                              : `${formatMemberCount(comm.memberCount ?? 0)}+ משתמשים`}
                        </span>
                        
                        {/* Free/Paid badge — joinPrice for pending changes */}
                        {joinPrice(comm) === 0 ? (
                          <span
                            className="rounded-full font-normal"
                            style={{ backgroundColor: '#A7EA7B', color: '#163300', fontSize: '1rem', padding: '0.5rem 1rem' }}
                          >
                            חינם
                          </span>
                        ) : (
                          <span
                            className="rounded-full font-normal"
                            style={{ backgroundColor: '#91DCED', color: '#003233', fontSize: '1rem', padding: '0.5rem 1rem' }}
                          >
                            ₪{joinPrice(comm)} לחודש
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Phase 4 Mission 3 — paid-join confirm modal (≥1 card in wallet) */}
      {pickerView === 'confirm' && community && user && savedCards.length > 0 && (
        <ExistingCardConfirmModal
          title={community.name}
          logoUrl={community.logo ?? community.image ?? null}
          monthlyPrice={Math.max(1, joinPrice(community))}
          selectedCard={(() => {
            const card = savedCards.find(c => c.id === selectedCardId) ?? savedCards[0];
            return {
              id: card.id,
              cardLastFour: card.cardLastFour,
              cardBrand: card.cardBrand,
            };
          })()}
          actionLabel={`הצטרפות ב₪${joinPrice(community)}`}
          loading={finalizingPaidJoin}
          onCancel={() => setPickerView('none')}
          onSwitchCard={() => setPickerView('picker')}
          onConfirm={finalizePaidJoinWithExistingCard}
        />
      )}

      {/* Phase 4 Mission 3 — wallet picker (Screen 2) */}
      {pickerView === 'picker' && (
        <CardPickerModal
          cards={savedCards.map(c => ({ id: c.id, cardLastFour: c.cardLastFour, cardBrand: c.cardBrand }))}
          selectedId={selectedCardId}
          onCancel={() => setPickerView('none')}
          onSelect={(id) => {
            setSelectedCardId(id);
            setPickerView('confirm');
          }}
          onAddNew={() => setPickerView('iframe')}
        />
      )}

      {/* Phase 4 Mission 3 — HYP iframe (new card). The backend handles
          the post-tokenize SOFT charge + membership creation atomically;
          on success HYP redirects parent to /communities/<id>/feed?card=joined.
          On failure, redirect lands on /preview?card=error and the
          banner above renders. */}
      {pickerView === 'iframe' && community && user && (
        <HypPaymentIframeModal
          amount={Math.max(1, joinPrice(community))}
          j5="J2"
          showAmount
          bof
          orderPrefix={`tokenize-memberJoin-${communityId}`}
          clientName={user.name || user.email}
          email={user.email}
          userId={user.userId}
          title={`הצטרפות לקהילה "${community.name}"`}
          onClose={() => setPickerView('none')}
        />
      )}
    </main>
  );
}

export default function CommunityPreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">טוען...</div>}>
      <CommunityPreviewContent />
    </Suspense>
  );
}
