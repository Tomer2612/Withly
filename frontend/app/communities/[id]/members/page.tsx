'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useCommunityContext } from '../CommunityContext';
import { authFetch } from '../../../lib/auth';
import SearchXIcon from '../../../components/icons/SearchXIcon';
import UserRemoveIcon from '../../../components/icons/UserRemoveIcon';
import CrownIcon from '../../../components/icons/CrownIcon';
import { getImageUrl } from '@/app/lib/imageUrl';

interface Member {
  id: string;
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
    profileImage: string | null;
  };
  reason: string;
  bannedAt: string;
  expiresAt: string | null;
  daysLeft: number | null;
}

export default function CommunityMembersPage() {
  const router = useRouter();
  const params = useParams();
  const communityId = params.id as string;

  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [removeModal, setRemoveModal] = useState<{ open: boolean; memberId: string | null; memberName: string }>({ open: false, memberId: null, memberName: '' });
  const [liftBanModal, setLiftBanModal] = useState<{ open: boolean; banId: string | null; memberName: string }>({ open: false, banId: null, memberName: '' });

  const { userEmail, userRole } = useCommunityContext();
  const currentUserRole = userRole;
  const [showBanned, setShowBanned] = useState(false);
  const [menuOpenMemberId, setMenuOpenMemberId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!communityId) return;

      if (!userEmail) {
        router.push('/login');
        return;
      }

      try {
        // Fetch community details — only need it for the slug redirect.
        const communityRes = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);
        if (communityRes.ok) {
          const communityData = await communityRes.json();
          if (communityData.slug && communityId !== communityData.slug) {
            router.replace(`/communities/${communityData.slug}/members`);
            return;
          }
        }

        // Fetch members
        const membersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/members`);

        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setMembers(membersData);
          setFilteredMembers(membersData);
        }

        // Fetch banned users (for owners/managers)
        const bannedRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/banned`);
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
  }, [communityId, router, userEmail]);

  // Filter members by search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMembers(members);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredMembers(
        members.filter(m => m.name?.toLowerCase().includes(query))
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

  const getRoleBadge = (role: 'OWNER' | 'MANAGER' | 'USER') => {
    switch (role) {
      case 'OWNER':
        return (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap overflow-hidden text-ellipsis" style={{ backgroundColor: '#A7EA7B', color: '#163300' }}>
            <CrownIcon className="w-3 h-3 flex-shrink-0" />
            בעלים
          </span>
        );
      case 'MANAGER':
        return (
          <span className="inline-flex items-center text-[12px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap overflow-hidden text-ellipsis" style={{ backgroundColor: '#91DCED', color: '#003233' }}>
            מנהל קהילה
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-[12px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap overflow-hidden text-ellipsis" style={{ backgroundColor: '#E1E1E2', color: '#52525B' }}>
            חבר קהילה
          </span>
        );
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'MANAGER' | 'USER') => {
    if (!userEmail) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/members/${memberId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
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

  const handleRemoveMember = async (memberId: string) => {
    if (!userEmail) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Remove from members list
        setMembers(prev => prev.filter(m => m.id !== memberId));
        setFilteredMembers(prev => prev.filter(m => m.id !== memberId));
        setRemoveModal({ open: false, memberId: null, memberName: '' });

        // Refresh banned users list
        const bannedRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/banned`);
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

  const handleLiftBan = async (banId: string) => {
    if (!userEmail) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/banned/${banId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setBannedUsers(prev => prev.filter(b => b.id !== banId));
        setLiftBanModal({ open: false, banId: null, memberName: '' });
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
                className="w-5 h-5 text-gray-600"
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
                className="group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-[#F4F4F5] rounded-xl transition"
              >
                {/* Profile Image */}
                <Link href={`/profile/${member.id}`} className="relative flex-shrink-0">
                  {member.profileImage ? (
                    <img
                      src={getImageUrl(member.profileImage)}
                      alt={member.name}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover hover:opacity-80 transition"
                    />
                  ) : (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-pink-100 flex items-center justify-center text-lg font-bold text-pink-600 hover:opacity-80 transition">
                      {member.name?.charAt(0) || '?'}
                    </div>
                  )}
                  {member.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#A7EA7B] border-2 border-white rounded-full"></span>
                  )}
                </Link>

                {/* Member Info */}
                <div className="flex-1 text-right min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link href={`/profile/${member.id}`} className="font-semibold text-black hover:opacity-80 transition truncate flex-shrink-0">
                      {member.name || 'משתמש'}
                    </Link>
                    {getRoleBadge(member.role)}
                  </div>
                  <p className="text-sm text-[#52525B] truncate">
                    תאריך הצטרפות: {formatDate(member.joinedAt)}
                  </p>
                </div>

                {/* Role Management & Remove - Only for Owners/Managers, can't change owner role */}
                {(currentUserRole === 'OWNER' || currentUserRole === 'MANAGER') && member.role !== 'OWNER' && (
                  <div className="flex-shrink-0">
                    {/* Desktop: inline buttons */}
                    <div className="hidden sm:flex items-center gap-2">
                      {currentUserRole === 'OWNER' && (
                        <button
                          onClick={() => handleRoleChange(member.id, member.role === 'MANAGER' ? 'USER' : 'MANAGER')}
                          className="px-3 py-1.5 text-[12px] font-semibold rounded-md bg-[#3F3F46] text-white hover:bg-[#52525B] transition whitespace-nowrap"
                        >
                          {member.role === 'MANAGER' ? 'שינוי לחבר קהילה' : 'קידום למנהל קהילה'}
                        </button>
                      )}
                      {(currentUserRole === 'OWNER' || (currentUserRole === 'MANAGER' && member.role === 'USER')) && (
                        <button
                          onClick={() => setRemoveModal({ open: true, memberId: member.id, memberName: member.name || 'משתמש' })}
                          className="p-1.5 text-[#B3261E] hover:bg-[#F4F4F5] rounded-md transition"
                          title="השעיה מהקהילה"
                        >
                          <UserRemoveIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    {/* Mobile: 3-dots menu (mirrors the feed post menu) */}
                    <div className="sm:hidden relative">
                      <button
                        onClick={() => setMenuOpenMemberId(menuOpenMemberId === member.id ? null : member.id)}
                        className="p-2 text-[#52525B] rounded-md hover:bg-gray-100 transition"
                        aria-label="פעולות"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="1.75" />
                          <circle cx="12" cy="12" r="1.75" />
                          <circle cx="12" cy="19" r="1.75" />
                        </svg>
                      </button>
                      {menuOpenMemberId === member.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuOpenMemberId(null)} />
                          <div className="absolute left-0 top-full mt-1 bg-white border border-[#E4E4E7] rounded-xl shadow-lg z-20 min-w-[180px] p-1" dir="rtl">
                            {currentUserRole === 'OWNER' && (
                              <button
                                onClick={() => { handleRoleChange(member.id, member.role === 'MANAGER' ? 'USER' : 'MANAGER'); setMenuOpenMemberId(null); }}
                                className="w-full px-3 py-2.5 text-right text-sm rounded-lg hover:bg-[#F4F4F5] flex items-center gap-3 transition text-[#3F3F46]"
                              >
                                {member.role === 'MANAGER' ? 'שינוי לחבר קהילה' : 'קידום למנהל קהילה'}
                              </button>
                            )}
                            {(currentUserRole === 'OWNER' || (currentUserRole === 'MANAGER' && member.role === 'USER')) && (
                              <button
                                onClick={() => { setRemoveModal({ open: true, memberId: member.id, memberName: member.name || 'משתמש' }); setMenuOpenMemberId(null); }}
                                className="w-full px-3 py-2.5 text-right text-sm text-[#B3261E] rounded-lg hover:bg-[#F4F4F5] flex items-center gap-3 transition"
                              >
                                <UserRemoveIcon className="w-5 h-5" />
                                השעיה מהקהילה
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin"></div>
            </div>
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
                <h2 className="font-semibold text-black" style={{ fontSize: '21px' }}>משתמשים מושעים ({bannedUsers.length})</h2>
              </div>
              <svg
                width="14" height="7" viewBox="0 0 10 5" fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`transform transition-transform duration-200 text-black overflow-visible flex-shrink-0 ${showBanned ? 'rotate-180' : ''}`}
              >
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {showBanned && (
              <div className="mt-4 space-y-2">
                {bannedUsers.map((ban) => (
                  <div
                    key={ban.id}
                    className="flex items-center gap-3 sm:gap-4 p-4 hover:bg-[#F4F4F5] rounded-xl transition"
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
                          {ban.user.name?.charAt(0) || '?'}
                        </div>
                      )}
                    </div>

                    {/* Ban Info */}
                    <div className="flex-1 text-right min-w-0">
                      <span className="font-semibold text-gray-700 truncate block">{ban.user.name || 'משתמש'}</span>
                      <p className="text-sm text-gray-500 truncate">
                        {ban.daysLeft === null ? 'השעיה לצמיתות' : `נותרו ${ban.daysLeft} ימים`}
                      </p>
                    </div>

                    {/* Lift Ban Button */}
                    <button
                      onClick={() => setLiftBanModal({ open: true, banId: ban.id, memberName: ban.user.name || 'משתמש' })}
                      className="px-3 py-1.5 text-sm font-semibold rounded-md transition hover:opacity-90 flex-shrink-0 whitespace-nowrap"
                      style={{ backgroundColor: '#A7EA7B', color: '#163300' }}
                    >
                      הסרת השעיה
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Suspend Member Modal */}
      {removeModal.open && removeModal.memberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="absolute inset-0" onClick={() => setRemoveModal({ open: false, memberId: null, memberName: '' })} />
          <div
            className="relative bg-white shadow-xl p-6"
            style={{ borderRadius: '16px', width: 'fit-content', maxWidth: 'min(90vw, 640px)' }}
            dir="rtl"
          >
            <div className="text-center">
              <h3 className="font-semibold text-black mb-2" style={{ fontSize: '21px' }}>השעה חבר מהקהילה</h3>
              <p className="mb-6" style={{ fontSize: '18px', color: 'var(--color-gray-10)' }}>
                האם אתה בטוח שברצונך להשעות ולהעיף את <span className="font-semibold">{removeModal.memberName}</span> מהקהילה? הוא לא יוכל להצטרף שוב עד להסרת ההשעיה.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setRemoveModal({ open: false, memberId: null, memberName: '' })}
                  className="bg-white text-black border hover:bg-gray-50 transition"
                  style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem', borderColor: 'var(--color-black)' }}
                >
                  ביטול
                </button>
                <button
                  onClick={() => handleRemoveMember(removeModal.memberId!)}
                  className="bg-error text-white transition hover:opacity-90"
                  style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem' }}
                >
                  השעיית משתמש
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lift Ban Modal */}
      {liftBanModal.open && liftBanModal.banId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="absolute inset-0" onClick={() => setLiftBanModal({ open: false, banId: null, memberName: '' })} />
          <div
            className="relative bg-white shadow-xl p-6"
            style={{ borderRadius: '16px', width: 'fit-content', maxWidth: 'min(90vw, 640px)' }}
            dir="rtl"
          >
            <div className="text-center">
              <h3 className="font-semibold text-black mb-2" style={{ fontSize: '21px' }}>הסרת השעיה</h3>
              <p className="mb-6" style={{ fontSize: '18px', color: 'var(--color-gray-10)' }}>
                האם אתה בטוח שברצונך להסיר את ההשעיה של <span className="font-semibold">{liftBanModal.memberName}</span>? הוא יוכל להצטרף שוב לקהילה.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setLiftBanModal({ open: false, banId: null, memberName: '' })}
                  className="bg-white text-black border hover:bg-gray-50 transition"
                  style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem', borderColor: 'var(--color-black)' }}
                >
                  ביטול
                </button>
                <button
                  onClick={() => handleLiftBan(liftBanModal.banId!)}
                  className="transition hover:opacity-90"
                  style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem', backgroundColor: '#A7EA7B', color: '#163300' }}
                >
                  הסרת ההשעיה
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
