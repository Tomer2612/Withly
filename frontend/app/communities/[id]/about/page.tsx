'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useCommunityContext } from '../CommunityContext';
import { FaYoutube, FaWhatsapp, FaFacebook, FaInstagram } from 'react-icons/fa';
import PlayIcon from '../../../components/icons/PlayIcon';
import VideoPlayer, { VideoThumbnail } from '../../../components/VideoPlayer';
import LinkIcon from '../../../components/icons/LinkIcon';
import ChevronLeftIcon from '../../../components/icons/ChevronLeftIcon';
import ChevronRightIcon from '../../../components/icons/ChevronRightIcon';
import LogoutIcon from '../../../components/icons/LogoutIcon';
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

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  profileImage?: string;
}

// Gallery media item type
interface GalleryItem {
  type: 'image' | 'video';
  src: string;
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
  
  const goToPrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? allMedia.length - 1 : prev - 1));
    setIsVideoPlaying(false);
  };
  
  const goToNext = () => {
    setCurrentIndex((prev) => (prev === allMedia.length - 1 ? 0 : prev + 1));
    setIsVideoPlaying(false);
  };
  
  // Auto-rotate every 10 seconds (pause on video)
  useEffect(() => {
    if (allMedia.length <= 1) return;
    
    const currentItem = allMedia[currentIndex];
    if (currentItem?.type === 'video' && isVideoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev === allMedia.length - 1 ? 0 : prev + 1));
      setIsVideoPlaying(false);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [allMedia.length, currentIndex, isVideoPlaying]);
  
  if (allMedia.length === 0) return null;
  
  const currentItem = allMedia[currentIndex];
  
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Main Image/Video with Navigation */}
      <div className="relative aspect-video bg-black">
        {currentItem.type === 'video' ? (
          <div onMouseEnter={() => setIsVideoPlaying(true)} onMouseLeave={() => setIsVideoPlaying(false)}>
            <VideoPlayer url={currentItem.src} className="rounded-none" />
          </div>
        ) : (
          <img
            src={getImageUrl(currentItem.src)}
            alt={`${communityName} - תמונה ${currentIndex + 1}`}
            className="w-full h-full object-cover"
          />
        )}
        {/* Navigation Arrows - only show if more than 1 item */}
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
      {/* Thumbnail Strip */}
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

export default function CommunityAboutPage() {
  const router = useRouter();
  const params = useParams();
  const communityId = params.id as string;
  const { userEmail, userId, userProfile, userRole } = useCommunityContext();

  const [community, setCommunity] = useState<Community | null>(null);
  const [ownerData, setOwnerData] = useState<{ id: string; name: string; profileImage?: string | null; coverImage?: string | null; bio?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [managerCount, setManagerCount] = useState(0);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leavingCommunity, setLeavingCommunity] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Leave community handler
  const handleLeaveCommunity = async () => {
    const token = localStorage.getItem('token');
    if (!token || !communityId) return;

    setLeavingCommunity(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/leave`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to leave community');
      }

      // Redirect to homepage after leaving
      router.push('/');
    } catch (err) {
      console.error('Leave community error:', err);
      alert('שגיאה בעזיבת הקהילה');
    } finally {
      setLeavingCommunity(false);
      setShowLeaveModal(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchCommunity = async () => {
      if (!communityId) {
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');

      try {
        setLoading(true);
        
        // Check membership and role - redirect non-members to preview page
        if (token) {
          const membershipRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/membership`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (membershipRes.ok) {
            const membershipData = await membershipRes.json();
            if (!membershipData.role) {
              // Not a member, redirect to preview page
              router.push(`/communities/${communityId}/preview`);
              return;
            }
            // userRole comes from context now
          }
        } else {
          // Not logged in, redirect to preview page
          router.push(`/communities/${communityId}/preview`);
          return;
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);
        if (!res.ok) throw new Error('Failed to fetch community');
        const data = await res.json();
        
        // Redirect to slug URL if community has a slug and we're using ID
        if (data.slug && communityId !== data.slug) {
          router.replace(`/communities/${data.slug}/about`);
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

        // Fetch members to count managers (OWNER + MANAGER roles)
        if (token) {
          const membersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/members`, {
            headers: { Authorization: `Bearer ${token}` },
          });
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
  }, [communityId, router]);

  // Show loading skeleton instead of "not found" message while loading
  if (!community && loading) {
    return (
      <main className="min-h-screen bg-gray-100 text-right" dir="rtl">
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </main>
    );
  }

  if (!community) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">קהילה לא נמצאה</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 text-right" dir="rtl">
      {/* Content - 2 column layout */}
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Left Sidebar - Owner & Community Info */}
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
                <Link href={`/profile/${ownerData?.id}`} className="font-bold text-black text-xl mb-2 hover:underline block">{ownerData?.name || 'מנהל הקהילה'}</Link>
                
                {/* Centered Bio */}
                {ownerData?.bio && (
                  <p className="text-sm text-gray-600 leading-relaxed">{ownerData.bio}</p>
                )}
              </div>
            </div>

            {/* Community Details Section */}
            <h4 className="text-lg font-semibold text-black mb-3">פרטים נוספים על הקהילה</h4>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 text-center p-5 border-b border-gray-100">
                <div>
                  <p className="text-xl font-bold text-black">{managerCount}</p>
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
                    <a 
                      href={community.youtubeUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-600 flex items-center justify-center transition" 
                      title="יוטוב"
                    >
                      <FaYoutube className="w-5 h-5" />
                    </a>
                  )}
                  {community.whatsappUrl && (
                    <a 
                      href={community.whatsappUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-600 flex items-center justify-center transition" 
                      title="קבוצת ואטסאפ"
                    >
                      <FaWhatsapp className="w-5 h-5" />
                    </a>
                  )}
                  {community.facebookUrl && (
                    <a 
                      href={community.facebookUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-600 flex items-center justify-center transition" 
                      title="פייסבוק"
                    >
                      <FaFacebook className="w-5 h-5" />
                    </a>
                  )}
                  {community.instagramUrl && (
                    <a 
                      href={community.instagramUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-600 flex items-center justify-center transition" 
                      title="אינסטגרם"
                    >
                      <FaInstagram className="w-5 h-5" />
                    </a>
                  )}
                  </div>
                </div>
              )}
            </div>

            {/* Invite Link */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h4 className="text-sm font-medium text-gray-500 mb-3">הזמנת חברים</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/communities/${community?.slug || communityId}/preview` : ''}
                  className="w-full px-3 py-2.5 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => {
                    const inviteUrl = `${window.location.origin}/communities/${community?.slug || communityId}/preview`;
                    navigator.clipboard.writeText(inviteUrl);
                    setInviteCopied(true);
                    setTimeout(() => setInviteCopied(false), 2000);
                  }}
                  className="w-full py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm flex items-center justify-center gap-2"
                >
                  <span>{inviteCopied ? 'הועתק!' : 'העתק לינק'}</span>
                  <LinkIcon size={16} color="white" />
                </button>
              </div>
            </div>

            {/* Leave Community Button - only for non-owners */}
            {userId && community.ownerId !== userId && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <button
                  onClick={() => setShowLeaveModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 hover:bg-red-50 rounded-xl transition font-medium"
                  style={{ color: '#B3261E' }}
                >
                  עזוב את הקהילה
                  <LogoutIcon size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            {/* About Section - moved above image */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-black mb-4">{community.name}</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {community.description}
              </p>
            </div>

            {/* Community Image/Video Slideshow */}
            {(community.image || (community.galleryImages && community.galleryImages.length > 0) || (community.galleryVideos && community.galleryVideos.length > 0)) && (
              <CommunityGallery 
                primaryImage={community.image} 
                galleryImages={community.galleryImages || []} 
                galleryVideos={community.galleryVideos || []}
                communityName={community.name}
              />
            )}
          </div>
        </div>
      </div>

      {/* Leave Community Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-lg" dir="rtl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">עזיבת הקהילה</h3>
            <p className="text-gray-600 mb-6">
              האם אתה בטוח שברצונך לעזוב את הקהילה <span className="font-semibold">{community?.name}</span>?
              לאחר העזיבה, לא תהיה לך גישה לפוסטים ולא תוכל להשתתף בדיונים, עד להצטרפות מחדש
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
              >
                ביטול
              </button>
              <button
                onClick={handleLeaveCommunity}
                disabled={leavingCommunity}
                className="flex-1 py-3 px-4 text-white rounded-xl font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#B3261E' }}
              >
                {leavingCommunity ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    עוזב...
                  </>
                ) : (
                  'עזוב את הקהילה'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}