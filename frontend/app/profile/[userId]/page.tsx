'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaMapMarkerAlt, FaSignInAlt } from 'react-icons/fa';
import SiteHeader from '../../components/SiteHeader';
import ChevronLeftIcon from '../../components/icons/ChevronLeftIcon';
import ChevronRightIcon from '../../components/icons/ChevronRightIcon';
import CameraIcon from '../../components/icons/CameraIcon';
import CalendarIcon from '../../components/icons/CalendarIcon';
import HistoryIcon from '../../components/icons/HistoryIcon';
import UsersIcon from '../../components/icons/UsersIcon';
import { getImageUrl } from '@/app/lib/imageUrl';

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

// Helper function to get visible page numbers (max 10, sliding window)
const getVisiblePages = (currentPage: number, totalPages: number): number[] => {
  const maxVisible = 10;
  let start = 1;
  let end = Math.min(totalPages, maxVisible);
  
  if (totalPages > maxVisible) {
    // Center the current page in the window when possible
    const halfWindow = Math.floor(maxVisible / 2);
    start = Math.max(1, currentPage - halfWindow);
    end = start + maxVisible - 1;
    
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }
  }
  
  const pages: number[] = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
};

interface UserProfile {
  id: string;
  name: string;
  email: string;
  profileImage?: string | null;
  coverImage?: string | null;
  bio?: string | null;
  location?: string | null;
  createdAt: string;
  lastActiveAt?: string | null;
  showOnline?: boolean;
}

interface Community {
  id: string;
  name: string;
  slug?: string | null;
  description: string;
  image?: string | null;
  logo?: string | null;
  memberCount?: number | null;
  price?: number | null;
  topic?: string | null;
  createdAt?: string;
}

export default function MemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [createdCommunities, setCreatedCommunities] = useState<Community[]>([]);
  const [memberCommunities, setMemberCommunities] = useState<Community[]>([]);
  const [activeTab, setActiveTab] = useState<'created' | 'member'>('created');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats state
  const [stats, setStats] = useState<{ followers: number; following: number; communityMembers: number }>({
    followers: 0,
    following: 0,
    communityMembers: 0,
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [hasConversation, setHasConversation] = useState(false);

  // Pagination state for communities
  const [createdPage, setCreatedPage] = useState(1);
  const [memberPage, setMemberPage] = useState(1);
  const communitiesPerPage = 5;

  // Current user state (for checking if viewing own profile)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Fetch current user ID to check if viewing own profile
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && token.split('.').length === 3) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setCurrentUserId(data.userId);
          }
        })
        .catch(console.error);
    }
  }, []);

  // Fetch profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('token');

        // Fetch all data in parallel for faster loading
        const [profileRes, createdRes, memberRes, statsRes, isFollowingRes, hasConversationRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/communities/created`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/communities/member`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/stats`),
          token 
            ? fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/is-following`, {
                headers: { Authorization: `Bearer ${token}` },
              })
            : Promise.resolve(null),
          token 
            ? fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/has-conversation/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
            : Promise.resolve(null),
        ]);

        if (!profileRes.ok) {
          if (profileRes.status === 404) {
            setError('המשתמש לא נמצא');
          } else {
            throw new Error('Failed to fetch profile');
          }
          return;
        }
        
        const profileData = await profileRes.json();
        setProfile(profileData);

        if (createdRes.ok) {
          const createdData = await createdRes.json();
          setCreatedCommunities(createdData);
        }

        if (memberRes.ok) {
          const memberData = await memberRes.json();
          setMemberCommunities(memberData);
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (isFollowingRes && isFollowingRes.ok) {
          const isFollowingData = await isFollowingRes.json();
          setIsFollowing(isFollowingData.isFollowing);
        }

        if (hasConversationRes && hasConversationRes.ok) {
          const hasConversationData = await hasConversationRes.json();
          setHasConversation(hasConversationData.hasConversation);
        }

      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('שגיאה בטעינת הפרופיל');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchProfileData();
    }
  }, [userId]);

  const formatUsername = (email: string) => {
    return email.split('@')[0] + '@';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const handleFollowToggle = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    setFollowLoading(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/follow`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setIsFollowing(!isFollowing);
        setStats(prev => ({
          ...prev,
          followers: isFollowing ? prev.followers - 1 : prev.followers + 1,
        }));
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleSendMessage = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Use global chat widget
    if ((window as any).openChatWithUser && profile) {
      (window as any).openChatWithUser(userId, profile.name, profile.profileImage);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{error}</p>
          <Link href="/" className="text-black font-semibold hover:underline">
            חזרה לעמוד הראשי
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <SiteHeader />

      {/* Profile Cover Image - Full width outside container */}
      <div className="w-full h-64 relative z-0">
        {profile?.coverImage ? (
          <img
            src={getImageUrl(profile.coverImage)}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-l from-cyan-200 via-teal-100 to-blue-200"></div>
        )}
      
        {/* Edit Cover Button - Only show for own profile */}
        {currentUserId === userId && (
          <label className="absolute bottom-4 left-4 bg-white/90 hover:bg-white text-gray-700 px-4 py-2 rounded-lg font-medium cursor-pointer transition flex items-center gap-2 shadow-md">
            <span>{uploadingCover ? 'מעלה...' : 'עריכת קאבר'}</span>
            <CameraIcon className="w-4 h-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingCover}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) return;
                if (file.size > 20 * 1024 * 1024) return;
                
                const token = localStorage.getItem('token');
                if (!token) return;
                
                setUploadingCover(true);
                try {
                  const formData = new FormData();
                  formData.append('coverImage', file);
                  
                  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                  });
                  
                  if (res.ok) {
                    const data = await res.json();
                    setProfile(prev => prev ? { ...prev, coverImage: data.coverImage } : prev);
                  }
                } catch (err) {
                  console.error('Error uploading cover:', err);
                } finally {
                  setUploadingCover(false);
                }
              }}
            />
          </label>
        )}
      </div>

      {/* Main Content - full width with padding */}
      <div className="w-full px-8">
        {/* Profile Section - Two columns with justify-between */}
        <div className="flex justify-between items-start pb-6">
          {/* Left Side - Profile Info */}
          <div className="flex flex-col items-start">
            {/* Profile Picture with negative margin for overlap */}
            <div className="-mt-20 relative z-10">
              {profile?.profileImage ? (
                <img
                  src={getImageUrl(profile.profileImage)}
                  alt={profile.name}
                  className="w-36 h-36 rounded-full object-cover"
                  style={{ border: '6px solid white' }}
                />
              ) : (
                <div className="w-36 h-36 rounded-full bg-gray-200 flex items-center justify-center" style={{ border: '6px solid white' }}>
                  <span className="text-4xl font-bold text-gray-400">
                    {profile?.name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
            </div>

            {/* Name and Username */}
            <h1 className="text-black mt-4" style={{ fontFamily: 'var(--font-assistant), sans-serif', fontWeight: 700, fontSize: '28px' }}>
              {profile?.name || 'משתמש'}
            </h1>
            <p className="mt-0.5" style={{ color: '#3F3F46', fontSize: '16px' }}>
              {profile?.email ? formatUsername(profile.email) : ''}
            </p>

            {/* Bio */}
            {profile?.bio ? (
              <p className="mt-3 leading-relaxed max-w-lg text-right" dir="rtl" style={{ color: '#3F3F46', fontSize: '16px' }}>
                {profile.bio}
              </p>
            ) : currentUserId === userId ? (
              <p className="text-gray-400 mt-3 italic" style={{ fontSize: '16px' }}>לחצו על הגדרות כדי להוסיף תיאור</p>
            ) : null}

            {/* Info row: Online status, Date, Location - wraps on smaller screens */}
            <div className="flex flex-wrap items-center gap-2 mt-3" style={{ color: '#3F3F46', fontSize: '16px' }}>
              <div className="flex items-center gap-1">
                {(() => {
                  // Calculate online status based on lastActiveAt
                  const lastActive = profile?.lastActiveAt ? new Date(profile.lastActiveAt) : null;
                  const now = new Date();
                  const diffMinutes = lastActive ? Math.floor((now.getTime() - lastActive.getTime()) / 60000) : null;
                  
                  if (profile?.showOnline !== false && diffMinutes !== null && diffMinutes < 5) {
                    // Online now - green dot
                    return (
                      <>
                        <span className="w-2.5 h-2.5 bg-[#A7EA7B] rounded-full"></span>
                        <span>מחובר/ת עכשיו</span>
                      </>
                    );
                  } else if (diffMinutes !== null && diffMinutes < 60) {
                    // Recently active - history icon
                    return (
                      <>
                        <HistoryIcon className="w-4 h-4" />
                        <span>פעיל/ה לפני {diffMinutes} דקות</span>
                      </>
                    );
                  } else if (diffMinutes !== null && diffMinutes < 1440) {
                    // Active today - history icon
                    const hours = Math.floor(diffMinutes / 60);
                    return (
                      <>
                        <HistoryIcon className="w-4 h-4" />
                        <span>פעיל/ה לפני {hours} שעות</span>
                      </>
                    );
                  } else {
                    // Offline - history icon
                    return (
                      <>
                        <HistoryIcon className="w-4 h-4" />
                        <span>לא מחובר/ת</span>
                      </>
                    );
                  }
                })()}
              </div>
              <span style={{ color: '#D0D0D4' }}>•</span>
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" />
                <span>תאריך הצטרפות: {profile?.createdAt ? formatDate(profile.createdAt) : '-'}</span>
              </div>
              {profile?.location && (
                <>
                  <span style={{ color: '#D0D0D4' }}>•</span>
                  <div className="flex items-center gap-1">
                    <FaMapMarkerAlt className="w-4 h-4" />
                    <span>{profile.location}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Side - Stats & Buttons grouped together */}
          <div className="flex flex-col items-start ml-20 mt-24 flex-shrink-0">
            {/* Stats - all on one line */}
            <div className="flex items-center flex-shrink-0">
              <div className="text-right px-6">
                <p className="font-bold text-black" style={{ fontSize: '24px', lineHeight: '1.2' }}>{stats.communityMembers.toLocaleString()}</p>
                <p style={{ fontSize: '16px', color: '#3F3F46', marginTop: '2px' }}>חברים בקהילות שלי</p>
              </div>
              <div className="text-right border-r border-gray-200 px-6">
                <p className="font-bold text-black" style={{ fontSize: '24px', lineHeight: '1.2' }}>{stats.followers.toLocaleString()}</p>
                <p style={{ fontSize: '16px', color: '#3F3F46', marginTop: '2px' }}>עוקבים</p>
              </div>
              <div className="text-right border-r border-gray-200 px-6">
                <p className="font-bold text-black" style={{ fontSize: '24px', lineHeight: '1.2' }}>{stats.following.toLocaleString()}</p>
                <p style={{ fontSize: '16px', color: '#3F3F46', marginTop: '2px' }}>עוקב/ת אחרי</p>
              </div>
            </div>

            {currentUserId && currentUserId !== userId && (
              <div className="flex items-center gap-3 mt-4 pr-6 h-11">
                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`px-8 py-2.5 rounded-xl font-medium transition ${
                    isFollowing
                      ? 'border border-black text-black bg-white hover:bg-gray-100'
                      : 'bg-black text-white hover:opacity-90'
                  } ${followLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {followLoading ? '...' : isFollowing ? 'הסר עוקב' : 'עקוב'}
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!isFollowing && !hasConversation}
                  className={`border px-6 py-2.5 rounded-xl font-medium transition ${
                    (isFollowing || hasConversation)
                      ? 'border-black text-black hover:bg-gray-100 cursor-pointer' 
                      : 'border-gray-300 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  שלח הודעה
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs - below, stuck to left */}
        <div className="mt-8">
          <div className="flex justify-start gap-8 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('created')}
              className={`pb-4 px-2 font-semibold transition relative ${
                activeTab === 'created'
                  ? 'text-black'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              קהילות שיצר
              {activeTab === 'created' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" style={{ borderRadius: 0 }} />
              )}
            </button>
            <button
              onClick={() => setActiveTab('member')}
              className={`pb-4 px-2 font-semibold transition relative ${
                activeTab === 'member'
                  ? 'text-black'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              חבר בקהילות
              {activeTab === 'member' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" style={{ borderRadius: 0 }} />
              )}
            </button>
          </div>

          {/* Communities Grid */}
          <div className="py-8">
              {activeTab === 'created' ? (
                createdCommunities.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <UsersIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>עדיין לא יצר קהילות</p>
                  </div>
                ) : (
                  <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    {[...createdCommunities]
                      .reverse()
                      .slice((createdPage - 1) * communitiesPerPage, createdPage * communitiesPerPage)
                      .map((community) => (
                      <div
                        key={community.id}
                        className="rounded-2xl overflow-hidden hover:shadow-lg bg-white transition-all duration-200 flex flex-col border border-gray-100"
                      >
                        <Link href={`/communities/${community.slug || community.id}/feed`}>
                          {community.image ? (
                            <img
                              src={getImageUrl(community.image)}
                              alt={community.name}
                              className="w-full h-40 object-cover"
                            />
                          ) : (
                            <div className="w-full h-40 flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #DBEAFE, #DCFCE7)' }}>
                              <span className="font-medium" style={{ color: '#A1A1AA' }}>תמונת קהילה</span>
                            </div>
                          )}</Link>
                        <div className="p-5 text-right flex-1 flex flex-col" dir="rtl">
                          {/* Logo + Name + Topic row */}
                          <div className="flex items-start gap-3 mb-2">
                            {community.logo ? (
                              <img
                                src={getImageUrl(community.logo)}
                                alt={community.name}
                                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F4F4F5' }}>
                                <span className="text-lg font-bold" style={{ color: '#A1A1AA' }}>{community.name.charAt(0)}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h2 className="font-bold text-black" style={{ fontSize: '1.5rem' }}>{community.name}</h2>
                              {/* Topic below heading */}
                              {community.topic && (
                                <span className="font-normal" style={{ fontSize: '1rem', color: '#3F3F46' }}>{community.topic}</span>
                              )}
                            </div>
                          </div>
                          <p className="line-clamp-3 leading-relaxed" style={{ fontSize: '1rem', color: '#3F3F46' }}>
                            {community.description}
                          </p>
                          
                          {/* Member count + Price badges - on same line */}
                          <div className="flex flex-wrap items-center justify-start gap-2 mt-auto pt-4">
                            {/* Member count badge */}
                            <span 
                              className="rounded-full font-normal"
                              style={{ backgroundColor: '#F4F4F5', color: '#3F3F46', fontSize: '1rem', padding: '0.5rem 1rem' }}
                            >
                              {(community.memberCount ?? 0) === 1 
                                ? 'משתמש אחד' 
                                : (community.memberCount ?? 0) < 100
                                  ? `${community.memberCount} משתמשים`
                                  : `${formatMemberCount(community.memberCount ?? 0)}+ משתמשים`}
                            </span>
                            
                            {/* Free/Paid badge */}
                            {(community.price ?? 0) === 0 ? (
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
                                ₪{community.price} לחודש
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Pagination for created communities */}
                  {createdCommunities.length > communitiesPerPage && (() => {
                    const totalPages = Math.ceil(createdCommunities.length / communitiesPerPage);
                    const visiblePages = getVisiblePages(createdPage, totalPages);
                    return (
                    <div className="flex items-center justify-center gap-2 mt-8">
                      <button
                        onClick={() => setCreatedPage(p => Math.max(1, p - 1))}
                        disabled={createdPage === 1}
                        className={`flex items-center justify-center transition ${
                          createdPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-[#3F3F46] hover:text-black'
                        }`}
                        style={{ width: 32, height: 32 }}
                      >
                        <ChevronRightIcon className="w-5 h-5" />
                      </button>
                      {visiblePages.map(page => (
                        <button
                          key={page}
                          onClick={() => setCreatedPage(page)}
                          className={`flex items-center justify-center font-medium text-[16px] transition ${
                            page === createdPage
                              ? 'bg-[#71717A] text-white'
                              : 'bg-white text-[#71717A] hover:bg-gray-50'
                          }`}
                          style={{ width: 32, height: 32, borderRadius: '50%' }}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setCreatedPage(p => Math.min(totalPages, p + 1))}
                        disabled={createdPage >= totalPages}
                        className={`flex items-center justify-center transition ${
                          createdPage >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-[#3F3F46] hover:text-black'
                        }`}
                        style={{ width: 32, height: 32 }}
                      >
                        <ChevronLeftIcon className="w-5 h-5" />
                      </button>
                    </div>
                    );
                  })()}
                  </>
                )
              ) : (
                memberCommunities.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <UsersIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>עדיין לא הצטרף לקהילות</p>
                  </div>
                ) : (
                  <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    {[...memberCommunities]
                      .reverse()
                      .slice((memberPage - 1) * communitiesPerPage, memberPage * communitiesPerPage)
                      .map((community) => (
                      <div
                        key={community.id}
                        className="rounded-2xl overflow-hidden hover:shadow-lg bg-white transition-all duration-200 flex flex-col border border-gray-100"
                      >
                        <Link href={`/communities/${community.slug || community.id}/feed`}>
                          {community.image ? (
                            <img
                              src={getImageUrl(community.image)}
                              alt={community.name}
                              className="w-full h-40 object-cover"
                            />
                          ) : (
                            <div className="w-full h-40 flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #DBEAFE, #DCFCE7)' }}>
                              <span className="font-medium" style={{ color: '#A1A1AA' }}>תמונת קהילה</span>
                            </div>
                          )}
                        </Link>
                        <div className="p-5 text-right flex-1 flex flex-col" dir="rtl">
                          {/* Logo + Name + Topic row */}
                          <div className="flex items-start gap-3 mb-2">
                            {community.logo ? (
                              <img
                                src={getImageUrl(community.logo)}
                                alt={community.name}
                                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F4F4F5' }}>
                                <span className="text-lg font-bold" style={{ color: '#A1A1AA' }}>{community.name.charAt(0)}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h2 className="font-bold text-black" style={{ fontSize: '1.5rem' }}>{community.name}</h2>
                              {/* Topic below heading */}
                              {community.topic && (
                                <span className="font-normal" style={{ fontSize: '1rem', color: '#3F3F46' }}>{community.topic}</span>
                              )}
                            </div>
                          </div>
                          <p className="line-clamp-3 leading-relaxed" style={{ fontSize: '1rem', color: '#3F3F46' }}>
                            {community.description}
                          </p>
                          
                          {/* Member count + Price badges - on same line */}
                          <div className="flex flex-wrap items-center justify-start gap-2 mt-auto pt-4">
                            {/* Member count badge */}
                            <span 
                              className="rounded-full font-normal"
                              style={{ backgroundColor: '#F4F4F5', color: '#3F3F46', fontSize: '1rem', padding: '0.5rem 1rem' }}
                            >
                              {(community.memberCount ?? 0) === 1 
                                ? 'משתמש אחד' 
                                : (community.memberCount ?? 0) < 100
                                  ? `${community.memberCount} משתמשים`
                                  : `${formatMemberCount(community.memberCount ?? 0)}+ משתמשים`}
                            </span>
                            
                            {/* Free/Paid badge */}
                            {(community.price ?? 0) === 0 ? (
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
                                ₪{community.price} לחודש
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Pagination for member communities */}
                  {memberCommunities.length > communitiesPerPage && (() => {
                    const totalPages = Math.ceil(memberCommunities.length / communitiesPerPage);
                    const visiblePages = getVisiblePages(memberPage, totalPages);
                    return (
                    <div className="flex items-center justify-center gap-2 mt-8">
                      <button
                        onClick={() => setMemberPage(p => Math.max(1, p - 1))}
                        disabled={memberPage === 1}
                        className={`flex items-center justify-center transition ${
                          memberPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-[#3F3F46] hover:text-black'
                        }`}
                        style={{ width: 32, height: 32 }}
                      >
                        <ChevronRightIcon className="w-5 h-5" />
                      </button>
                      {visiblePages.map(page => (
                        <button
                          key={page}
                          onClick={() => setMemberPage(page)}
                          className={`flex items-center justify-center font-medium text-[16px] transition ${
                            page === memberPage
                              ? 'bg-[#71717A] text-white'
                              : 'bg-white text-[#71717A] hover:bg-gray-50'
                          }`}
                          style={{ width: 32, height: 32, borderRadius: '50%' }}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setMemberPage(p => Math.min(totalPages, p + 1))}
                        disabled={memberPage >= totalPages}
                        className={`flex items-center justify-center transition ${
                          memberPage >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-[#3F3F46] hover:text-black'
                        }`}
                        style={{ width: 32, height: 32 }}
                      >
                        <ChevronLeftIcon className="w-5 h-5" />
                      </button>
                    </div>
                    );
                  })()}
                  </>
                )
              )}
          </div>
        </div>
      </div>
    </div>
  );
}