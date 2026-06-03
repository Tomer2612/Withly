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
import CreditCardForm, { isCardComplete } from '../../../components/CreditCardForm';
import { getImageUrl } from '@/app/lib/imageUrl';

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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Check if we should show payment modal (coming back from signup).
  // Banned users skip this - the banner replaces the join flow entirely.
  useEffect(() => {
    if (searchParams.get('showPayment') === 'true' && community && !isBanned) {
      setShowPaymentModal(true);
      // Remove the query param from URL
      router.replace(`/communities/${communityId}/preview`);
    }
  }, [searchParams, community, communityId, router, isBanned]);

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
              c.topic === data.topic && c.id !== communityId
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

  const handleJoinClick = () => {
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

    if (effectivePrice > 0) {
      setShowPaymentModal(true);
    } else {
      joinCommunity();
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

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPaymentValid) return;
    setJoining(true);

    // Save credit card info to user payment methods
    const lastFour = cardNumber.slice(-4);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/payment-methods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardLastFour: lastFour,
          cardBrand: 'Visa',
        }),
      });
    } catch (err) {
      console.error('Failed to save card info:', err);
    }
    
    await joinCommunity();
    setShowPaymentModal(false);
  };

  const isPaymentValid = isCardComplete(cardNumber, cardExpiry, cardCvv);

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
                  <button
                    onClick={handleJoinClick}
                    disabled={joining}
                    className="w-full py-3 px-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                    <p className="text-xs text-gray-500 text-center mt-2">₪{joinPrice(community)} לחודש • חודש ניסיון חינם</p>
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
                  <h4 className="text-sm font-medium text-gray-500 mb-3 text-center">עקבו אחרינו</h4>
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
              <h2 className="text-2xl font-bold text-black mb-4">{community.name}</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {community.description}
              </p>
            </div>
          </div>
        </div>

        {/* Similar Communities Section */}
        {similarCommunities.length > 0 && (
          <div className="mt-20">
            <h2 className="text-2xl font-bold text-right mb-8">קהילות דומות</h2>
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
                          <h3 className="font-bold text-black truncate" style={{ fontSize: '1.5rem' }}>{comm.name}</h3>
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

      {/* Payment Modal */}
      {showPaymentModal && community && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative shadow-lg" dir="rtl">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 left-4 text-gray-400 hover:text-gray-600"
            >
              <CloseIcon className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-bold text-center mb-8">מתחילים חודש ניסיון חינם</h2>

            <CreditCardForm
              cardNumber={cardNumber}
              cardExpiry={cardExpiry}
              cardCvv={cardCvv}
              onCardNumberChange={setCardNumber}
              onCardExpiryChange={setCardExpiry}
              onCardCvvChange={setCardCvv}
            />

            <button
              onClick={handlePaymentSubmit}
              disabled={!isPaymentValid || joining}
              className="w-full mt-8 bg-black text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {joining ? 'מצטרף לקהילה...' : 'הצטרפות לקהילה'}
            </button>

            <p className="text-center text-sm text-gray-500 mt-4">
              תזכורת תשלח במייל 3 ימים לפני סיום הניסיון. אפשר<br />
              לבטל בקליק דרך הגדרות הקהילה.
            </p>
          </div>
        </div>
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
