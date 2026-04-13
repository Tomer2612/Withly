'use client';

import { useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SiteHeader from './components/SiteHeader';
import SiteFooter from './components/SiteFooter';
import FilterDropdown from './components/FilterDropdown';
import SearchXIcon from './components/icons/SearchXIcon';
import ChevronLeftIcon from './components/icons/ChevronLeftIcon';
import ChevronRightIcon from './components/icons/ChevronRightIcon';
import { getImageUrl } from '@/app/lib/imageUrl';

const COMMUNITY_TOPICS = [
  'אנימציה',
  'אוכל, בישול ותזונה',
  'עזרה ותמיכה',
  'עיצוב גרפי',
  'עיצוב מותגים',
  'עריכת וידאו',
  'בריאות הנפש ופיתוח אישי',
  'גיימינג',
  'טיולים ולייףסטייל',
  'לימודים ואקדמיה',
  'מדיה, קולנוע וסדרות',
  'מדיה חברתית ותוכן ויזואלי',
  'ניהול פיננסי והשקעות',
  'ספרים וכתיבה',
  'ספורט ואורח חיים פעיל',
  'תחביבים',
  'יזמות ועסקים עצמאיים',
];

// Topic color mapping - synced with topicIcons.tsx colors
const TOPIC_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'אנימציה': { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
  'אוכל, בישול ותזונה': { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
  'עזרה ותמיכה': { bg: 'bg-teal-100', text: 'text-teal-600', border: 'border-teal-200' },
  'עיצוב גרפי': { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
  'עיצוב מותגים': { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
  'עריכת וידאו': { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' },
  'בריאות הנפש ופיתוח אישי': { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
  'גיימינג': { bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
  'טיולים ולייףסטייל': { bg: 'bg-sky-100', text: 'text-sky-600', border: 'border-sky-200' },
  'לימודים ואקדמיה': { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
  'מדיה, קולנוע וסדרות': { bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-200' },
  'מדיה חברתית ותוכן ויזואלי': { bg: 'bg-fuchsia-100', text: 'text-fuchsia-600', border: 'border-fuchsia-200' },
  'ניהול פיננסי והשקעות': { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
  'ספרים וכתיבה': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  'ספורט ואורח חיים פעיל': { bg: 'bg-lime-100', text: 'text-lime-600', border: 'border-lime-200' },
  'תחביבים': { bg: 'bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-200' },
  'יזמות ועסקים עצמאיים': { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
};

const getTopicColor = (topic: string) => {
  return TOPIC_COLORS[topic] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', bgHex: '#F4F4F5', textHex: '#3F3F46', borderHex: '#E1E1E2' };
};

// Helper function to get visible page numbers (max 10, sliding window)
const getVisiblePages = (currentPage: number, totalPages: number): number[] => {
  const maxVisible = 10;
  let start = 1;
  let end = Math.min(totalPages, maxVisible);
  
  if (totalPages > maxVisible) {
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

const COMMUNITY_SIZES = [
  { value: 'small', label: 'קטנה (0-100)' },
  { value: 'medium', label: 'בינונית (100+)' },
  { value: 'large', label: 'גדולה (1,000+)' },
];

const getSizeCategory = (memberCount?: number | null) => {
  if (memberCount && memberCount >= 1000) return 'large';
  if (memberCount && memberCount >= 100) return 'medium';
  return 'small';
};

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
  _count?: {
    posts: number;
  };
}

interface JwtPayload {
  email: string;
  sub: string;
  iat: number;
  exp: number;
}

export default function Home() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [filteredCommunities, setFilteredCommunities] = useState<Community[]>([]);
  const [userMemberships, setUserMemberships] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedPrice, setSelectedPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const communitiesPerPage = 9;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && token.split('.').length === 3) {
      try {
        const decoded = jwtDecode<JwtPayload>(token);
        setUserEmail(decoded.email);
        setUserId(decoded.sub);

        // Fetch user memberships
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/user/memberships`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.ok ? res.json() : [])
          .then(data => setUserMemberships(data))
          .catch(console.error);
      } catch (e) {
        console.error('Invalid token:', e);
      }
    }
  }, []);

  // Fetch communities
  useEffect(() => {
    const fetchCommunities = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        // Sort by oldest first (ascending by createdAt)
        const sorted = data.sort((a: Community, b: Community) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setCommunities(sorted);
        setFilteredCommunities(sorted);
      } catch (err) {
        console.error('Error fetching communities:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCommunities();
  }, []);

  // Filter communities
  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = communities.filter((community) => {
      const matchesSearch =
        term === ''
          ? true
          : community.name.toLowerCase().includes(term) ||
            community.description.toLowerCase().includes(term);

      const matchesTopic = selectedTopic ? community.topic === selectedTopic : true;
      const matchesSize = selectedSize
        ? getSizeCategory(community.memberCount ?? null) === selectedSize
        : true;
      
      const matchesPrice = (() => {
        if (!selectedPrice) return true;
        const price = community.price ?? 0;
        if (selectedPrice === 'free') return price === 0;
        if (selectedPrice === 'low') return price >= 1 && price <= 50;
        if (selectedPrice === 'high') return price > 50;
        return true;
      })();

      return matchesSearch && matchesTopic && matchesSize && matchesPrice;
    });

    setFilteredCommunities(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, communities, selectedTopic, selectedSize, selectedPrice]);

  const handleCardClick = (community: Community) => {
    if (!userEmail) {
      // Not logged in - go to preview page (will redirect to login if needed)
      router.push(`/communities/${community.id}/preview`);
      return;
    }
    
    const isMember = userMemberships.includes(community.id) || community.ownerId === userId;
    
    if (isMember) {
      // Member/Owner - go to feed
      router.push(`/communities/${community.slug || community.id}/feed`);
    } else {
      // Logged in but not a member - go to preview page to join
      router.push(`/communities/${community.id}/preview`);
    }
  };

  return (
    <main className="min-h-screen text-right" style={{ backgroundColor: '#F4F4F5' }}>
      {/* Header */}
      <SiteHeader />

      {/* Title + CTA */}
      <section className="text-center mb-8 mt-8 md:mt-12 px-4">
        <h1 className="font-semibold text-black mb-3 text-3xl md:text-5xl lg:text-[3.5rem]">
          מאגר הקהילות הגדול בארץ
        </h1>
        <p className="text-lg" style={{ color: '#52525B' }}>
          חפשו, הצטרפו או צרו קהילה לפי תחומי עניין.
        </p>
      </section>

      <div className="flex justify-center mb-10">
        {userEmail ? (
          <Link
            href="/pricing"
            className="bg-black text-white font-normal hover:opacity-90 transition text-lg leading-none"
            style={{ padding: '1rem 1.5rem', borderRadius: '1rem' }}
          >
            צרו קהילה משלכם
          </Link>
        ) : (
          <Link
            href="/signup?createCommunity=true"
            className="bg-black text-white font-normal hover:opacity-90 transition text-lg leading-none"
            style={{ padding: '1rem 1.5rem', borderRadius: '1rem' }}
          >
            צרו קהילה משלכם
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 justify-center mb-6 w-full max-w-5xl mx-auto px-4">
        <div className="flex items-center flex-grow max-w-xs rounded-lg border border-[#D0D0D4] bg-white px-4 py-3 focus-within:border-transparent focus-within:ring-2 focus-within:ring-black transition-all">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth={1.5} 
            stroke="currentColor" 
            className="w-5 h-5 text-zinc-600"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="חפשו קהילה"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mr-3 flex-1 bg-transparent outline-none focus:ring-0 text-right"
            style={{ '--placeholder-color': '#A1A1AA' } as React.CSSProperties}
            dir="rtl"
          />
        </div>

        <div style={{ width: '1px', backgroundColor: '#D0D0D4', alignSelf: 'stretch' }}></div>

        <FilterDropdown
          value={selectedPrice}
          onChange={setSelectedPrice}
          placeholder="מחיר"
          allLabel="כל המחירים"
          options={[
            { value: 'free', label: 'חינם' },
            { value: 'low', label: '₪1-50' },
            { value: 'high', label: '₪51-100' },
          ]}
        />
        
        <FilterDropdown
          value={selectedTopic}
          onChange={setSelectedTopic}
          placeholder="נושא"
          allLabel="כל הנושאים"
          options={COMMUNITY_TOPICS.map(topic => ({ value: topic, label: topic }))}
        />
        
        <FilterDropdown
          value={selectedSize}
          onChange={setSelectedSize}
          placeholder="גודל"
          allLabel="כל הגדלים"
          options={COMMUNITY_SIZES.map(size => ({ value: size.value, label: size.label }))}
        />
      </div>

      {/* Active filters indicator */}
      {(searchTerm || selectedTopic || selectedSize || selectedPrice) && (
        <div className="flex justify-center gap-2 mb-6">
          <span className="text-sm" style={{ color: '#71717A' }}>
            מציג {filteredCommunities.length} מתוך {communities.length} קהילות
          </span>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedTopic('');
              setSelectedSize('');
              setSelectedPrice('');
            }}
            className="text-sm text-black underline hover:no-underline"
          >
            נקה סינון
          </button>
        </div>
      )}

      {/* Community Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl px-4 mx-auto pb-8">
        {loading ? (
          <div className="col-span-full text-center py-12">
            <p className="text-lg" style={{ color: '#71717A' }}>טוען קהילות...</p>
          </div>
        ) : filteredCommunities.length > 0 ? (
          filteredCommunities
            .slice((currentPage - 1) * communitiesPerPage, currentPage * communitiesPerPage)
            .map((community) => {
            // Format member count: under 100 show exact, 100+ show +100, 1000+ show +1,000, etc
            const formatMemberCount = (count: number) => {
              if (count >= 10000) {
                return `${(count / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}K+`;
              }
              if (count >= 1000) {
                return `${(count / 1000).toFixed(1).replace('.0', '')}K+`;
              }
              if (count >= 100) {
                // Round down to nearest 100 and show with +
                const rounded = Math.floor(count / 100) * 100;
                return `${rounded.toLocaleString()}+`;
              }
              return count.toString();
            };
            
            return (
              <div
                key={community.id}
                onClick={() => handleCardClick(community)}
                className="rounded-2xl overflow-hidden bg-white transition-all duration-200 cursor-pointer flex flex-col hover:shadow-lg"
              >
                {community.image ? (
                  <img
                    src={getImageUrl(community.image)}
                    alt={community.name}
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
                      <h2 className="font-bold text-black truncate" style={{ fontSize: '1.5rem' }}>{community.name}</h2>
                      {/* Category below heading */}
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
            );
          })
        ) : (
          <div className="col-span-full text-center py-12">
            <SearchXIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-black text-lg">לא נמצאו קהילות בחיפוש</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && filteredCommunities.length > communitiesPerPage && (() => {
        const totalPages = Math.ceil(filteredCommunities.length / communitiesPerPage);
        const visiblePages = getVisiblePages(currentPage, totalPages);
        return (
          <div className="flex items-center justify-center gap-2 pb-16">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`flex items-center justify-center transition ${
                currentPage === 1 ? 'cursor-not-allowed' : 'hover:text-black'
              }`}
              style={{ color: currentPage === 1 ? '#D0D0D4' : '#3F3F46', width: 32, height: 32 }}
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
            {visiblePages.map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`flex items-center justify-center font-medium text-[16px] transition ${
                  page === currentPage
                    ? 'text-white'
                    : ''
                }`}
                style={{ backgroundColor: page === currentPage ? '#71717A' : 'white', color: page === currentPage ? 'white' : '#71717A', width: 32, height: 32, borderRadius: '50%' }}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className={`flex items-center justify-center transition ${
                currentPage >= totalPages ? 'cursor-not-allowed' : 'hover:text-black'
              }`}
              style={{ color: currentPage >= totalPages ? '#D0D0D4' : '#3F3F46', width: 32, height: 32 }}
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
          </div>
        );
      })()}

      {/* Footer */}
      <SiteFooter />
    </main>
  );
}
