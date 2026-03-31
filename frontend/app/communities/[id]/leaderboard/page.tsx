'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { FaStar } from 'react-icons/fa';
import { useCommunityContext } from '../CommunityContext';
import TrophyIcon from '../../../components/icons/TrophyIcon';
import AwardIcon from '../../../components/icons/AwardIcon';
import UsersIcon from '../../../components/icons/UsersIcon';
import { getImageUrl } from '@/app/lib/imageUrl';

interface Community {
  id: string;
  name: string;
  slug?: string | null;
  topic: string | null;
  logo: string | null;
}

interface LeaderboardMember {
  rank: number;
  userId: string;
  name: string;
  email: string;
  profileImage: string | null;
  points: number;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const params = useParams();
  const communityId = params.id as string;
  const { userEmail, userId, userProfile, isOwner, isManager } = useCommunityContext();

  const [mounted, setMounted] = useState(false);
  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<LeaderboardMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!communityId) return;

      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        // Fetch community details
        const communityRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);
        if (communityRes.ok) {
          const communityData = await communityRes.json();
          
          // Redirect to slug URL if community has a slug and we're using ID
          if (communityData.slug && communityId !== communityData.slug) {
            router.replace(`/communities/${communityData.slug}/leaderboard`);
            return;
          }
          
          setCommunity(communityData);
        }

        // Fetch leaderboard (top 10 members)
        const leaderboardRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/top-members?limit=10`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (leaderboardRes.ok) {
          const leaderboardData = await leaderboardRes.json();
          setMembers(leaderboardData);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [communityId]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <TrophyIcon className="w-6 h-6 text-[#FFD700]" />;
      case 2:
        return <AwardIcon className="w-6 h-6 text-[#A8A8A8]" />;
      case 3:
        return <AwardIcon className="w-6 h-6 text-[#CD7F32]" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-gray-500 font-bold">{rank}</span>;
    }
  };

  const getRankBgColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300';
      case 2:
        return 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300';
      case 3:
        return 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-300';
      default:
        return 'bg-white border-gray-200';
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 text-right" dir="rtl">
      {/* Main Content */}
      <section className="max-w-5xl mx-auto py-8 px-4">
        {/* Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3" style={{ backgroundColor: '#A7EA7B' }}>
            <TrophyIcon className="w-7 h-7 text-black" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">עשרת המובילים</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6">
          
          {/* Left Content - Leaderboard */}
          <div>
            {/* Leaderboard */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {members.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {members.map((member, index) => (
                <div
                  key={member.userId}
                  className={`flex items-center gap-4 p-4 transition hover:bg-gray-50 ${getRankBgColor(member.rank)} ${
                    member.rank <= 3 ? 'border-r-4' : ''
                  } ${
                    index === members.length - 1 ? 'rounded-b-2xl' : ''
                  } ${index === 0 ? 'rounded-t-2xl' : ''}`}
                >
                  {/* Rank */}
                  <div className="w-10 flex justify-center">
                    {getRankIcon(member.rank)}
                  </div>

                  {/* Profile Image */}
                  <Link href={`/profile/${member.userId}`}>
                    {member.profileImage ? (
                      <img
                        src={getImageUrl(member.profileImage)}
                        alt={member.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-white shadow hover:opacity-80 transition"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center text-lg font-bold text-pink-600 border-2 border-white shadow hover:opacity-80 transition">
                        {member.name?.charAt(0) || '?'}
                      </div>
                    )}
                  </Link>

                  {/* Name */}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      <Link href={`/profile/${member.userId}`} className="hover:underline">
                        {member.name}
                      </Link>
                    </p>
                    {member.rank <= 3 && (
                      <p className="text-gray-500" style={{ fontSize: '14px' }}>
                        {member.rank === 1 && 'מקום ראשון'}
                        {member.rank === 2 && 'מקום שני'}
                        {member.rank === 3 && 'מקום שלישי'}
                      </p>
                    )}
                  </div>

                  {/* Points */}
                  <div className="text-left flex items-center gap-1.5">
                    <span className="font-bold text-gray-900 text-lg">{member.points}</span>
                    <FaStar className="w-4 h-4 text-yellow-500" />
                    <span className="text-gray-500" style={{ fontSize: '14px' }}>נקודות</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">אין נתונים עדיין</p>
              <p className="text-sm text-gray-400">התחילו לפרסם פוסטים ולהגיב כדי לצבור נקודות!</p>
            </div>
          )}
        </div>
          </div>

          {/* Right Sidebar - User Points */}
          <div className="order-2 lg:order-2">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-2">הניקוד שלך:</h3>
              <div className="text-2xl font-bold text-gray-900 mb-4">
                {members.find(m => m.userId === userId)?.points || 0} נקודות
              </div>
              
              <div className="border-t border-gray-100 pt-4">
                <h4 className="font-semibold text-gray-900 mb-3 text-sm">איך צוברים נקודות:</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>ליצור פוסטים, להגיב ולעשות לייקים</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>להתחיל ולסיים קורסים</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>להשתתף באירועי הקהילה</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
