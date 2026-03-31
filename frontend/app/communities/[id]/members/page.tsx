'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useCommunityContext } from '../CommunityContext';
import { FaBan, FaUndo } from 'react-icons/fa';
import SearchXIcon from '../../../components/icons/SearchXIcon';
import UserRemoveIcon from '../../../components/icons/UserRemoveIcon';
import CloseIcon from '../../../components/icons/CloseIcon';
import CrownIcon from '../../../components/icons/CrownIcon';
import { getImageUrl } from '@/app/lib/imageUrl';

interface Member {
  id: string;
  email: string;
  name: string;
  profileImage: string | null;
  joinedAt: string;
  role: 'OWNER' | 'MANAGER' | 'USER';
  isOwner: boolean;
  isManager: boolean;
  isOnline?: boolean;
}

interface BannedUser {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    profileImage: string | null;
  };
  reason: string;
  bannedAt: string;
  expiresAt: string;
  daysLeft: number;
}

interface Community {
  id: string;
  name: string;
  slug?: string | null;
  description: string;
  image?: string | null;
  logo?: string | null;
  topic?: string | null;
  ownerId: string;
}

export default function CommunityMembersPage() {
  const router = useRouter();
  const params = useParams();
  const communityId = params.id as string;

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [removeModal, setRemoveModal] = useState<{ open: boolean; memberId: string | null; memberName: string }>({ open: false, memberId: null, memberName: '' });
  
  const { userEmail, userId, userProfile, isOwnerOrManager } = useCommunityContext();
  const [showBanned, setShowBanned] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!communityId) return;

      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        setLoading(true);

        // Fetch community details
        const communityRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);
        if (communityRes.ok) {
          const communityData = await communityRes.json();
          
          // Redirect to slug URL if community has a slug and we're using ID
          if (communityData.slug && communityId !== communityData.slug) {
            router.replace(`/communities/${communityData.slug}/members`);
            return;
          }
          
          setCommunity(communityData);
        }

        // Check current user's role
        const membershipRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/membership`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (membershipRes.ok) {
          const membershipData = await membershipRes.json();
          setCurrentUserRole(membershipData.role);
        }

        // Fetch members
        const membersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/members`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setMembers(membersData);
          setFilteredMembers(membersData);
        }

        // Fetch banned users (for owners/managers)
        const bannedRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/banned`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (bannedRes.ok) {
          const bannedData = await bannedRes.json();
          setBannedUsers(bannedData);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [communityId, router]);

  // Filter members by search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMembers(members);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredMembers(
        members.filter(
          m =>
            m.name?.toLowerCase().includes(query) ||
            m.email.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, members]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getUsername = (email: string) => {
    return '@' + email.split('@')[0];
  };

  const getRoleBadge = (role: 'OWNER' | 'MANAGER' | 'USER') => {
    switch (role) {
      case 'OWNER':
        return (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#A7EA7B', color: '#163300' }}>
            <CrownIcon className="w-3 h-3" />
            בעלים
          </span>
        );
      case 'MANAGER':
        return (
          <span className="inline-flex items-center text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#91DCED', color: '#003233' }}>
            מנהל קהילה
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E1E1E2', color: '#52525B' }}>
            חבר קהילה
          </span>
        );
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'MANAGER' | 'USER') => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/members/${memberId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        // Update the members list with the new role
        setMembers(prev => prev.map(m => 
          m.id === memberId 
            ? { ...m, role: newRole, isManager: newRole === 'MANAGER' } 
            : m
        ));
        setFilteredMembers(prev => prev.map(m => 
          m.id === memberId 
            ? { ...m, role: newRole, isManager: newRole === 'MANAGER' } 
            : m
        ));
      } else {
        console.error('Failed to update role');
      }
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        // Remove from members list
        setMembers(prev => prev.filter(m => m.id !== memberId));
        setFilteredMembers(prev => prev.filter(m => m.id !== memberId));
        setRemoveModal({ open: false, memberId: null, memberName: '' });
        
        // Refresh banned users list
        const bannedRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/banned`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (bannedRes.ok) {
          setBannedUsers(await bannedRes.json());
        }
      } else {
        const error = await res.json();
        alert(error.message || 'שגיאה בהסרת המשתמש');
      }
    } catch (err) {
      console.error('Error removing member:', err);
      alert('שגיאה בהסרת המשתמש');
    }
  };

  const handleLiftBan = async (banId: string, userName: string) => {
    if (!confirm(`האם אתה בטוח שברצונך להסיר את ההשעיה של ${userName}?`)) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/banned/${banId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setBannedUsers(prev => prev.filter(b => b.id !== banId));
      } else {
        const error = await res.json();
        alert(error.message || 'שגיאה בהסרת ההשעיה');
      }
    } catch (err) {
      console.error('Error lifting ban:', err);
      alert('שגיאה בהסרת ההשעיה');
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 text-right" dir="rtl">
      {/* Members Content */}
      <section className="max-w-3xl mx-auto py-8 px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          {/* Search */}
          <div className="mb-6">
            <div className="flex items-center rounded-lg border border-[#D0D0D4] bg-white px-4 py-3 focus-within:border-transparent focus-within:ring-2 focus-within:ring-black transition-all">
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
                placeholder="חפש חבר קהילה"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mr-3 flex-1 bg-transparent outline-none text-right placeholder:text-gray-400"
                dir="rtl"
              />
            </div>
          </div>

        {/* Members List */}
        <div className="space-y-2">
          {filteredMembers.length > 0 ? (
            filteredMembers.map((member) => (
              <div
                key={member.id}
                className="group flex items-center gap-4 p-4 hover:bg-[#F4F4F5] rounded-xl transition"
              >
                {/* Profile Image */}
                <Link href={`/profile/${member.id}`} className="relative flex-shrink-0">
                  {member.profileImage ? (
                    <img
                      src={getImageUrl(member.profileImage)}
                      alt={member.name}
                      className="w-12 h-12 rounded-full object-cover hover:opacity-80 transition"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-lg font-bold text-pink-600 hover:opacity-80 transition">
                      {member.name?.charAt(0) || member.email.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {member.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#A7EA7B] border-2 border-white rounded-full"></span>
                  )}
                </Link>

                {/* Member Info */}
                <div className="flex-1 text-right">
                  <div className="flex items-center gap-2">
                    <Link href={`/profile/${member.id}`} className="font-semibold text-black hover:underline">
                      {member.name || 'משתמש'}
                    </Link>
                    {getRoleBadge(member.role)}
                  </div>
                  <p className="text-sm text-[#52525B]">
                    {getUsername(member.email)} · תאריך הצטרפות: {formatDate(member.joinedAt)}
                  </p>
                </div>

                {/* Role Management & Remove - Only for Owners/Managers, can't change owner role */}
                {(currentUserRole === 'OWNER' || currentUserRole === 'MANAGER') && member.role !== 'OWNER' && (
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Role change button - Only owners can change roles */}
                    {currentUserRole === 'OWNER' && (
                      <button
                        onClick={() => handleRoleChange(member.id, member.role === 'MANAGER' ? 'USER' : 'MANAGER')}
                        className="px-3 py-1.5 text-[12px] font-medium rounded-md bg-[#3F3F46] text-white hover:bg-[#52525B] transition"
                      >
                        {member.role === 'MANAGER' ? 'שנה לחבר קהילה' : 'קדם למנהל'}
                      </button>
                    )}
                    
                    {/* Remove button - Owners can remove anyone, Managers can only remove Users */}
                    {(currentUserRole === 'OWNER' || (currentUserRole === 'MANAGER' && member.role === 'USER')) && (
                      <button
                        onClick={() => setRemoveModal({ open: true, memberId: member.id, memberName: member.name || 'משתמש' })}
                        className="p-1.5 text-[#B3261E] hover:bg-[#F4F4F5] rounded-lg transition"
                        title="הסר מהקהילה"
                      >
                        <UserRemoveIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              {searchQuery ? (
                <>
                  <SearchXIcon className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-black text-lg">לא נמצאו חברים עבור "{searchQuery}"</p>
                </>
              ) : (
                <p className="text-gray-500">אין חברים בקהילה זו</p>
              )}
            </div>
          )}
        </div>

          {/* Member count */}
          <div className="mt-6 text-center text-sm text-[#3F3F46]">
            {members.length} חברים בקהילה
          </div>
        </div>

        {/* Banned Users Section - Only for Owners/Managers */}
        {(currentUserRole === 'OWNER' || currentUserRole === 'MANAGER') && bannedUsers.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-6">
            <button
              onClick={() => setShowBanned(!showBanned)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <FaBan className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold text-black">משתמשים מושעים ({bannedUsers.length})</h2>
              </div>
              <span className="text-gray-400">{showBanned ? '▲' : '▼'}</span>
            </button>

            {showBanned && (
              <div className="mt-4 space-y-2">
                {bannedUsers.map((ban) => (
                  <div
                    key={ban.id}
                    className="flex items-center gap-4 p-4 bg-red-50 rounded-xl"
                  >
                    {/* Profile Image */}
                    <div className="relative flex-shrink-0">
                      {ban.user.profileImage ? (
                        <img
                          src={getImageUrl(ban.user.profileImage)}
                          alt={ban.user.name}
                          className="w-12 h-12 rounded-full object-cover opacity-50"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-400">
                          {ban.user.name?.charAt(0) || ban.user.email.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Ban Info */}
                    <div className="flex-1 text-right">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700">{ban.user.name || 'משתמש'}</span>
                        <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          <FaBan className="w-3 h-3" />
                          מושעה
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        @{ban.user.email.split('@')[0]} · נותרו {ban.daysLeft} ימים
                      </p>
                    </div>

                    {/* Lift Ban Button */}
                    <button
                      onClick={() => handleLiftBan(ban.id, ban.user.name || 'משתמש')}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition"
                    >
                      <FaUndo className="w-3 h-3" />
                      הסר השעיה
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Remove Member Modal */}
      {removeModal.open && removeModal.memberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRemoveModal({ open: false, memberId: null, memberName: '' })} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" dir="rtl">
            <button
              onClick={() => setRemoveModal({ open: false, memberId: null, memberName: '' })}
              className="absolute top-4 left-4 p-1 hover:bg-gray-100 rounded-full transition"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h3 className="text-xl font-bold text-black mb-2">הסר חבר קהילה</h3>
              <p className="text-[#3F3F46] mb-6">
                האם אתה בטוח שברצונך להסיר את <span className="font-semibold">{removeModal.memberName}</span> מהקהילה?
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setRemoveModal({ open: false, memberId: null, memberName: '' })}
                  className="px-6 py-2.5 border border-black text-black rounded-xl font-medium hover:bg-gray-50 transition"
                >
                  ביטול
                </button>
                <button
                  onClick={() => handleRemoveMember(removeModal.memberId!, removeModal.memberName)}
                  className="px-6 py-2.5 bg-[#B3261E] text-white rounded-xl font-medium hover:bg-[#9C2019] transition"
                >
                  הסר
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
